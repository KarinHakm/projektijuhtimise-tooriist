import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createAiClient } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';
import { appendCriteria, saveMockup } from '../server/criteria.js';

// Staatus, DoR ja avatud küsimused (L19, L20). Ajutine andmebaas; AI-d ei kutsuta.
const s = (want, touchesView = true) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin klubiga liituda', size: 'M', origin: 'manual', touchesView });
const CRITERIA = ["Vormil on väli 'E-post'.", "Vormil on nupp 'Saada'.", 'Pärast saatmist kuvatakse kinnitusteade.'].map((text) => ({ text, origin: 'manual' }));
let dir, db, projectId, otherId, story, otherStory, server, base, aiCalls;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-ready-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('esitada taotluse'), s('näha hindu')], null);
  appendStories(db, otherId, [s('midagi muud')], null);
  [story] = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  otherStory = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherId).id;
  appendCriteria(db, story, CRITERIA);
  saveMockup(db, story, { title: 'Vorm', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'button', text: 'Saada', items: [] }] });
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

const post = (path, body, pid = projectId) => fetch(`${base}/${pid}/stories/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const get = async () => (await (await fetch(`${base}/${projectId}/stories`)).json()).stories.find((x) => x.id === story);
const statusOf = () => db.prepare('SELECT status FROM stories WHERE id = ?').get(story).status;

test('loendis on iga loo valmisolek ja küsimused', async () => {
  const st = await get();
  assert.equal(st.readiness.ok, true);
  assert.deepEqual(st.readiness.checks.map((c) => c.ok), [true, true, true, true, true]);
  assert.deepEqual(st.questions, []);
  const second = (await (await fetch(`${base}/${projectId}/stories`)).json()).stories[1];
  assert.equal(second.readiness.ok, false); // kriteeriume ja mockup'i pole
});

test('„Vajab täpsustamist“ saab määrata käsitsi ilma küsimuseta', async () => {
  const res = await post(`${story}/status`, { status: 'vajab_tapsustamist' });
  assert.equal(res.status, 200);
  assert.equal(statusOf(), 'vajab_tapsustamist');
  assert.deepEqual((await get()).questions, []);
});

test('küsimus → „Vajab täpsustamist“ ja „Valmis arenduseks“ keelatud; vastamine EI tõsta staatust; kasutaja määrab ise valmis', async () => {
  assert.equal((await post(`${story}/questions`, { text: '  Klient täpsustab   maksevõimalused. ' })).status, 200);
  assert.equal(statusOf(), 'vajab_tapsustamist');
  const blocked = await post(`${story}/status`, { status: 'valmis_arenduseks' });
  assert.equal(blocked.status, 409);
  const body = await blocked.json();
  assert.equal(body.code, 'not_ready');
  assert.deepEqual(body.missing, ['Avatud küsimusi ei ole – Avatud küsimusi: 1.']);
  assert.equal(statusOf(), 'vajab_tapsustamist');

  const q = (await get()).questions[0];
  assert.equal(q.text, 'Klient täpsustab maksevõimalused.');
  assert.equal((await post(`${story}/questions/${q.id}/resolve`)).status, 200);
  assert.equal(statusOf(), 'vajab_tapsustamist'); // vastamine ei muuda staatust
  assert.equal((await get()).readiness.ok, true);
  assert.equal((await post(`${story}/questions/${q.id}/resolve`)).status, 409);

  assert.equal((await post(`${story}/status`, { status: 'valmis_arenduseks' })).status, 200);
  const st = await get();
  assert.equal(st.status, 'valmis_arenduseks');
  assert.deepEqual([st.readiness.ready, st.readiness.expired], [true, false]);
});

test('hilisem kriteeriumi muutmine rikub DoR-i → valmisolek aegunud (ei loeta valmis); parandus taastab', async () => {
  assert.equal((await post(`${story}/status`, { status: 'valmis_arenduseks' })).status, 200);
  const id = db.prepare('SELECT id FROM criteria WHERE story_id = ? AND position = 3').get(story).id;
  db.prepare("UPDATE criteria SET text = 'Kinnitusteade on selge ja kiire.' WHERE id = ?").run(id);
  let st = await get();
  assert.equal(st.status, 'valmis_arenduseks'); // salvestatud staatus jääb, aga ...
  assert.deepEqual([st.readiness.ok, st.readiness.ready, st.readiness.expired], [false, false, true]);
  assert.match(st.readiness.checks.find((c) => !c.ok).detail, /K3/);
  db.prepare("UPDATE criteria SET text = 'Pärast saatmist kuvatakse kinnitusteade.' WHERE id = ?").run(id);
  st = await get();
  assert.deepEqual([st.readiness.ready, st.readiness.expired], [true, false]);
});

test('küsimuse lisamine valmis loole viib selle „Vajab täpsustamist“', async () => {
  await post(`${story}/status`, { status: 'valmis_arenduseks' });
  await post(`${story}/questions`, { text: 'Kas telefon on kohustuslik?' });
  assert.equal(statusOf(), 'vajab_tapsustamist');
});

test('vigased päringud: tundmatu staatus, tühi või liiga pikk küsimus, teise projekti lugu ja küsimus', async () => {
  assert.equal((await post(`${story}/status`, { status: 'valmis' })).status, 400);
  assert.equal((await post(`${story}/questions`, { text: '   ' })).status, 400);
  assert.equal((await post(`${story}/questions`, { text: 'x'.repeat(301) })).status, 400);
  assert.equal((await post(`${otherStory}/status`, { status: 'idee' })).status, 404);
  assert.equal((await post(`${otherStory}/questions`, { text: 'Küsimus' })).status, 404);
  await post(`${otherStory}/questions`, { text: 'Teise projekti küsimus' }, otherId);
  const foreignQ = db.prepare('SELECT id FROM story_questions WHERE story_id = ?').get(otherStory).id;
  assert.equal((await post(`${story}/questions/${foreignQ}/resolve`)).status, 404);
  assert.equal(statusOf(), 'idee');
});
