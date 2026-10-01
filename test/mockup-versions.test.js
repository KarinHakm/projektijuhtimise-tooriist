import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createAiClient } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';
import { appendCriteria, saveMockup } from '../server/criteria.js';

// Mockup'i versioonid ja taastamine (L22). Ajutine andmebaas; AI-d ei kutsuta.
const s = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', origin: 'manual', touchesView: true });
const V1 = { title: 'Taotlus', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'button', text: 'Saada', items: [] }] };
const V2 = { title: 'Taotlus', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'input', text: 'Telefon', items: [] }, { type: 'button', text: 'Saada', items: [] }] };
let dir, db, projectId, otherId, story, other, server, base, aiCalls;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-versions-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('esitada taotluse'), s('näha hindu')], null);
  [story, other] = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  setFocusStory(db, projectId, story);
  saveMockup(db, story, V1);
  saveMockup(db, story, V2);
  appendCriteria(db, story, [
    { text: "Vormil on väli 'E-post'.", origin: 'manual', ref: { kind: 'element', index: 0, version: 1, source: 'user' } },
    { text: "Vormil on väli 'Telefon'.", origin: 'manual', ref: { kind: 'element', index: 1, version: 2, source: 'user' } },
  ]);
  aiCalls = 0;
  const ai = createAiClient({ token: 't', model: 'm', fetchImpl: async () => { aiCalls++; throw new Error('AI-d ei tohi kutsuda'); } });
  server = createApp({ db, ai }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
});
afterEach(async () => {
  assert.equal(aiCalls, 0);
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (path = '', pid = projectId) => `${base}/${pid}/criteria${path}`;
const restore = (body, pid) => fetch(url('/mockup/restore', pid), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const rows = () => db.prepare('SELECT version, spec, created_at FROM mockups WHERE story_id = ? ORDER BY version').all(story).map((r) => ({ ...r }));

test('loendis on varasemad versioonid (uusim on eraldi praegune mockup)', async () => {
  const st = await (await fetch(url())).json();
  assert.equal(st.mockup.version, 2);
  assert.deepEqual(st.mockupVersions.map((v) => [v.version, v.components.length]), [[1, 2]]);
});

test('taastamine loob uue versiooni; vanad read jäävad muutmata; viited taastatud versioonile viiakse üle', async () => {
  const before = rows();
  const res = await restore({ storyId: story, version: 1 });
  assert.equal(res.status, 200);
  const st = await res.json();
  assert.deepEqual(st.restored, { from: 1, to: 3 });
  assert.equal(st.mockup.version, 3);
  assert.deepEqual(st.mockup.components, V1.components);
  assert.deepEqual(st.mockupVersions.map((v) => v.version), [2, 1]);
  assert.deepEqual(rows().slice(0, 2), before); // ajalugu alles, üle ei kirjutatud
  const refs = db.prepare('SELECT ref_version AS v FROM criteria WHERE story_id = ? ORDER BY position').all(story).map((r) => r.v);
  assert.deepEqual(refs, [3, 2]); // v1 viide → v3; v2 viide jääb (aegunud)
  assert.deepEqual(st.consistency.criteria.map((c) => c.warnings.map((w) => w.code)), [[], ['stale_ref', 'no_match']]); // telefoni välja taastatud versioonis pole
});

test('kooskõla ülevaatus aegub pärast taastamist', async () => {
  const st = await (await fetch(url())).json();
  const reviewed = await fetch(url('/review'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ storyId: story, fingerprint: st.consistency.fingerprint }) });
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json()).consistency.review.valid, true);
  const after = await (await restore({ storyId: story, version: 1 })).json();
  assert.equal(after.consistency.review.valid, false);
  assert.equal(after.consistency.review.mockupVersion, 2);
});

test('keeldumised: praegune versioon, olematu versioon, teine lugu, teine projekt; midagi ei salvestata', async () => {
  const before = rows();
  assert.equal((await restore({ storyId: story, version: 2 })).status, 409);
  assert.equal((await restore({ storyId: story, version: 7 })).status, 404);
  assert.equal((await restore({ storyId: story, version: '1' })).status, 404);
  assert.equal((await restore({ storyId: other, version: 1 })).status, 409);
  assert.equal((await restore({ storyId: story, version: 1 }, otherId)).status, 409);
  assert.equal((await restore({ storyId: story, version: 1 }, 9999)).status, 404);
  assert.deepEqual(rows(), before);
});
