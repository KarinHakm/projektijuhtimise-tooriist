import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';
import { appendCriteria, saveMockup } from '../server/criteria.js';
import { captureProject, stateHash } from '../server/undo.js';

// L21: üldine tagasivõtmine (viimane toetatud muudatus). Ajutine andmebaas, AI välja lülitatud.
let dir, db, projectId, otherProjectId, ids, server, base;
const s = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin valida', size: 'M', origin: 'ai', touchesView: true });

async function start() {
  server = createApp({ db, ai: createDisabledAi() }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}
async function stop() {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-undo-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('näha nädalakava'), s('näha hindu'), s('esitada taotluse')], null);
  appendStories(db, otherProjectId, [s('teise projekti lugu')], null);
  ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  appendCriteria(db, ids[1], [{ text: 'Iga paketi juures on hind eurodes.', origin: 'ai', ref: { kind: 'element', index: 0, version: 1, source: 'user' } }]);
  saveMockup(db, ids[1], { title: 'Hinnad', components: [{ type: 'list', text: 'Paketid', items: ['A'] }] });
  db.prepare("INSERT INTO story_questions (story_id, text) VALUES (?, 'Kas km?')").run(ids[1]);
  db.prepare('INSERT INTO story_overlaps (project_id, story_a, story_b) VALUES (?, ?, ?)').run(projectId, ids[0], ids[1]);
  db.prepare('UPDATE projects SET focus_story_id = ?, mvp_count = 2 WHERE id = ?').run(ids[1], projectId);
  await start();
});
afterEach(async () => {
  await stop();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const send = (method, path, body) => fetch(`${base}/${projectId}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const undoState = async () => (await send('GET', '/undo')).json();
const undo = async () => send('POST', '/undo', { at: (await undoState()).at });
const all = (pid) => captureProject(db, pid);

test('räsi on deterministlik: sama seis annab sama räsi, ainult ajatempli muutus räsi ei muuda', () => {
  const h = stateHash(all(projectId));
  assert.equal(stateHash(all(projectId)), h);
  db.prepare("UPDATE stories SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(ids[0]);
  assert.equal(stateHash(all(projectId)), h);
  db.prepare("UPDATE stories SET want = 'muu' WHERE id = ?").run(ids[0]);
  assert.notEqual(stateHash(all(projectId)), h);
});

test('loo kustutamise tagasivõtmine taastab kõik read täpselt (ka ajatemplid), teine projekt jääb puutumata; püsib taaskäivitusel', async () => {
  const before = all(projectId);
  const other = all(otherProjectId);
  assert.equal((await send('DELETE', `/stories/${ids[1]}`)).status, 200);
  await stop();
  await start(); // nagu serveri taaskäivitus
  const st = await undoState();
  assert.deepEqual([st.available, st.label], [true, 'Kustutasid loo 2 „Külastajana soovin näha hindu, et saaksin valida.“']);
  const res = await undo();
  assert.equal(res.status, 200);
  assert.deepEqual(all(projectId), before);
  assert.deepEqual(all(otherProjectId), other);
  assert.equal((await undoState()).available, false);
  assert.equal((await undo()).status, 409); // teist korda midagi tagasi võtta pole
});

test('ainult viimane toiming; vale aeg või pärast toetamata muudatust (küsimus) tagasivõtmist ei tehta', async () => {
  await send('POST', `/stories/${ids[2]}/move`, { direction: 'up' });
  const afterMove = all(projectId);
  await send('POST', `/stories/${ids[0]}/criteria`, { text: 'Kavas on iga trenni algusaeg.' });
  assert.equal((await send('POST', '/undo', { at: 'vale' })).status, 409);
  assert.equal((await undo()).status, 200);
  assert.deepEqual(all(projectId), afterMove); // järjekord jäi muudetuks, kriteerium kadus

  await send('PUT', `/stories/${ids[0]}`, { ...s('näha nädala kava'), touchesView: true });
  await send('POST', `/stories/${ids[0]}/questions`, { text: 'Toetamata muudatus' });
  const st = await undoState();
  assert.equal(st.available, false);
  assert.match(st.reason, /on tehtud teisi muudatusi/);
  const before = all(projectId);
  const res = await undo();
  assert.deepEqual([res.status, (await res.json()).code], [409, 'stale']);
  assert.deepEqual(all(projectId), before);
});

test('etapi märge tagasivõtmist ei blokeeri; käsitsi jagamine ja ühendamine võetakse tagasi', async () => {
  const before = all(projectId);
  const part = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin valida', size: 'S', touchesView: true });
  assert.equal((await send('POST', `/stories/${ids[1]}/split`, { first: part('näha hindu'), second: part('näha soodustusi'), criteriaToSecond: [], questionsToSecond: [] })).status, 200);
  await send('POST', '/stage/active', { key: 'lood' });
  assert.equal((await undo()).status, 200);
  assert.deepEqual(all(projectId), before);

  assert.equal((await send('POST', `/stories/${ids[0]}/merge`, { withId: ids[2], story: part('näha nädalakava'), keepCriteria: [] })).status, 200);
  assert.equal((await undo()).status, 200);
  assert.deepEqual(all(projectId), before);
});

test('kui tagasivõtmise kirje kirjutamine ebaõnnestub, võetakse ka kasutaja toiming tagasi', async () => {
  db.exec("CREATE TRIGGER fail_undo BEFORE INSERT ON undo_journal BEGIN SELECT RAISE(ABORT, 'test'); END");
  const before = all(projectId);
  const res = await send('DELETE', `/stories/${ids[0]}`);
  assert.equal(res.status, 500);
  assert.deepEqual(all(projectId), before);
  assert.equal(db.isTransaction, false);
});
