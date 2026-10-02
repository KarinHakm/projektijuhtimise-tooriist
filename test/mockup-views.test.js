import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';
import { appendCriteria, consistencyFor, latestMockup, saveMockup } from '../server/criteria.js';

// L22: mitu mockup'i (vaadet) loo kohta. Ajutine andmebaas, AI välja lülitatud.
let dir, db, projectId, storyId, server, base;
const V1 = { title: 'Taotlus', components: [{ type: 'heading', text: 'Liikmeks astumise taotlus', items: [] }, { type: 'button', text: 'Saada taotlus', items: [] }] };
const V2 = { title: 'Kinnitus', components: [{ type: 'heading', text: 'Taotlus on esitatud', items: [] }, { type: 'button', text: 'Tagasi avalehele', items: [] }] };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-views-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  appendStories(db, projectId, [{ role: 'Külastaja', rolePhrase: 'Külastajana', want: 'esitada taotluse', soThat: 'saaksin liituda', size: 'M', origin: 'ai', touchesView: true }], null);
  storyId = db.prepare('SELECT id FROM stories').get().id;
  setFocusStory(db, projectId, storyId);
  saveMockup(db, storyId, V1, 1); // v1
  saveMockup(db, storyId, V1, 1); // v2 (vaade 1 uusim)
  saveMockup(db, storyId, V2, 2); // v3 (vaade 2)
  appendCriteria(db, storyId, [
    { text: 'Taotluse lehel on nupp „Saada taotlus“.', origin: 'ai', ref: { kind: 'element', index: 1, version: 2, source: 'user' } },
    { text: 'Pärast saatmist kuvatakse teade „Taotlus on esitatud“.', origin: 'ai', ref: { kind: 'element', index: 0, version: 3, source: 'user' } },
  ]);
  server = createApp({ db, ai: createDisabledAi() }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}/criteria`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('kaks vaadet: mõlema vaate seos kehtib oma vaate uusima versiooni vastu; vastuses on lisavaade', async () => {
  const c = consistencyFor(db, storyId);
  assert.deepEqual(c.criteria.map((x) => x.warnings.map((w) => w.code)), [[], []]); // kumbki ei ole aegunud
  assert.deepEqual(c.criteria.map((x) => x.link.label), ['Vaade 1 · 2. nupp: Saada taotlus', 'Vaade 2 · 1. pealkiri: Taotlus on esitatud']);
  assert.deepEqual(c.views.map((v) => [v.viewNo, v.version]), [[1, 2], [2, 3]]);
  const snap = await (await fetch(base)).json();
  assert.equal(snap.mockup.version, 2);
  assert.deepEqual(snap.extraViews.map((v) => [v.viewNo, v.mockup.version, v.mockup.title]), [[2, 3, 'Kinnitus']]);
});

test('seos vaate 2 elemendiga ja vaate 2 taastamine ei puuduta vaadet 1', async () => {
  let res = await post('/link', { criterionId: db.prepare('SELECT id FROM criteria ORDER BY position').get().id, kind: 'element', index: 1, view: 2 });
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT ref_version AS v FROM criteria ORDER BY position').get().v, 3);

  saveMockup(db, storyId, { ...V2, title: 'Kinnitus 2' }, 2); // v4
  res = await post('/mockup/restore', { storyId, version: 3 });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).restored, { from: 3, to: 5 });
  assert.deepEqual([latestMockup(db, storyId, 2).version, latestMockup(db, storyId, 2).title], [5, 'Kinnitus']);
  assert.equal(latestMockup(db, storyId, 1).version, 2); // vaade 1 muutmata
  assert.equal((await post('/mockup/restore', { storyId, version: 5 })).status, 409); // juba praegune
});
