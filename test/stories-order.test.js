import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories, listStories } from '../server/stories.js';

// Backlog'i järjestamine (L07). Ajutine andmebaas; arendaja data/app.db faili ei puututa ja AI-d ei kutsuta.
const OLD = '2026-01-01T00:00:00.000Z';
const s = (want, size = 'M') => ({ role: 'Potentsiaalne liige', rolePhrase: 'Potentsiaalse liikmena', want, soThat: 'saaksin edasi minna', size, origin: 'ai', touchesView: true });

let dir, dbPath, db, projectId, otherProjectId, server, base;

async function startServer() {
  server = createApp({ db, ai: createDisabledAi() }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}
async function stopServer() {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-order-'));
  dbPath = join(dir, 'app.db');
  db = openDb(dbPath);
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine projekt') RETURNING id").get().id;
  appendStories(db, projectId, [s('näha tunniplaani'), s('näha hindu', 'S'), s('esitada taotluse', 'L')], null);
  appendStories(db, otherProjectId, [s('teise projekti esimene'), s('teise projekti teine')], null);
  // Vanad ajatemplid: kui järjestamine neid puudutaks, oleks muutus kindlalt näha.
  db.prepare('UPDATE stories SET created_at = ?, updated_at = ?').run(OLD, OLD);
  await startServer();
});
afterEach(async () => {
  if (server.listening) await stopServer();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const move = (pid, storyId, body) => fetch(`${base}/${pid}/stories/${storyId}/move`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
});
const wants = (pid = projectId) => listStories(db, pid).map((r) => r.want);
const idOf = (want) => db.prepare('SELECT id FROM stories WHERE want = ?').get(want).id;
// Kõik veerud peale positsiooni: järjestamine ei tohi neid muuta.
const contentById = () => Object.fromEntries(db.prepare('SELECT * FROM stories ORDER BY id').all()
  .map(({ position, ...rest }) => [rest.id, { ...rest }]));
const allRows = () => db.prepare('SELECT * FROM stories ORDER BY id').all().map((r) => ({ ...r }));

test('↓ vahetab loo järgmisega; vastuses on uus järjekord', async () => {
  const res = await move(projectId, idOf('näha tunniplaani'), { direction: 'down' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.stories.map((r) => [r.position, r.want]), [[1, 'näha hindu'], [2, 'näha tunniplaani'], [3, 'esitada taotluse']]);
  assert.deepEqual(wants(), ['näha hindu', 'näha tunniplaani', 'esitada taotluse']);
});

test('↑ vahetab loo eelmisega', async () => {
  const res = await move(projectId, idOf('esitada taotluse'), { direction: 'up' });
  assert.equal(res.status, 200);
  assert.deepEqual(wants(), ['näha tunniplaani', 'esitada taotluse', 'näha hindu']);
});

test('järjestamine muudab ainult kahe loo positsiooni; sisu, created_at ja updated_at jäävad samaks', async () => {
  const before = contentById();
  const positionsBefore = Object.fromEntries(db.prepare('SELECT id, position FROM stories').all().map((r) => [r.id, r.position]));
  assert.equal((await move(projectId, idOf('näha hindu'), { direction: 'up' })).status, 200);
  assert.equal((await move(projectId, idOf('näha hindu'), { direction: 'down' })).status, 200);
  assert.equal((await move(projectId, idOf('esitada taotluse'), { direction: 'up' })).status, 200);
  assert.deepEqual(contentById(), before);
  for (const row of allRows()) {
    assert.equal(row.updated_at, OLD, `updated_at muutus: ${row.want}`);
    assert.equal(row.created_at, OLD, `created_at muutus: ${row.want}`);
  }
  const changed = db.prepare('SELECT id, position FROM stories').all().filter((r) => positionsBefore[r.id] !== r.position);
  assert.equal(changed.length, 2); // algusega võrreldes vahetasid kohad "näha hindu" ja "esitada taotluse"
});

test('esimest lugu üles ja viimast alla tõsta ei saa: 409 ja midagi ei muutu', async () => {
  const before = allRows();
  const up = await move(projectId, idOf('näha tunniplaani'), { direction: 'up' });
  assert.equal(up.status, 409);
  assert.equal((await up.json()).code, 'at_edge');
  const down = await move(projectId, idOf('esitada taotluse'), { direction: 'down' });
  assert.equal(down.status, 409);
  assert.equal((await down.json()).code, 'at_edge');
  assert.deepEqual(allRows(), before);
});

test('teise projekti lugu ei leita (404) ja kumbki projekt ei muutu', async () => {
  const before = allRows();
  const res = await move(projectId, idOf('teise projekti teine'), { direction: 'up' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'not_found');
  assert.deepEqual(allRows(), before);
});

test('olematu või vigase loo id korral 404', async () => {
  for (const id of [9999, 'abc', 0, -1, 1.5]) {
    const res = await move(projectId, id, { direction: 'up' });
    assert.equal(res.status, 404, String(id));
  }
});

test('vale või puuduva suuna korral 400 ja midagi ei muutu', async () => {
  const before = allRows();
  for (const body of [{}, { direction: 'left' }, { direction: 'UP' }, { direction: 1 }]) {
    const res = await move(projectId, idOf('näha hindu'), body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).code, 'invalid_direction');
  }
  assert.deepEqual(allRows(), before);
});

test('olematu projekti korral 404', async () => {
  const res = await move(9999, idOf('näha hindu'), { direction: 'up' });
  assert.equal(res.status, 404);
});

test('muudetud järjekord püsib pärast andmebaasi uuesti avamist', async () => {
  assert.equal((await move(projectId, idOf('näha tunniplaani'), { direction: 'down' })).status, 200);
  await stopServer();
  db.close();
  db = openDb(dbPath);
  assert.deepEqual(wants(), ['näha hindu', 'näha tunniplaani', 'esitada taotluse']);
  assert.deepEqual(wants(otherProjectId), ['teise projekti esimene', 'teise projekti teine']);
});

test('positsioonide vahe korral vahetatakse lähima naabriga', async () => {
  db.prepare('UPDATE stories SET position = position * 4 WHERE project_id = ?').run(projectId); // 4, 8, 12
  assert.equal((await move(projectId, idOf('esitada taotluse'), { direction: 'up' })).status, 200);
  assert.deepEqual(listStories(db, projectId).map((r) => [r.position, r.want]), [[4, 'näha tunniplaani'], [8, 'esitada taotluse'], [12, 'näha hindu']]);
});

test('mitu tõstet järjest jätavad positsioonid kordumatuks ja järjestikuseks', async () => {
  for (const [want, direction] of [['esitada taotluse', 'up'], ['esitada taotluse', 'up'], ['näha hindu', 'up'], ['näha tunniplaani', 'up']]) {
    assert.equal((await move(projectId, idOf(want), { direction })).status, 200);
  }
  assert.deepEqual(listStories(db, projectId).map((r) => r.position), [1, 2, 3]);
  assert.deepEqual(wants(), ['esitada taotluse', 'näha tunniplaani', 'näha hindu']);
});
