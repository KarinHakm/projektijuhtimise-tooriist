import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';

// L26: kahe loo märkimine kattuvaks. Ajutine andmebaas, AI välja lülitatud.
let dir, db, projectId, otherProjectId, ids, otherStory, server, base;
const s = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin aja valida', size: 'S', origin: 'ai', touchesView: false });

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
  dir = mkdtempSync(join(tmpdir(), 'pjt-overlap-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('näha nädalakava'), s('vaadata nädala trenne'), s('näha hindu')], null);
  appendStories(db, otherProjectId, [s('teise projekti lugu')], null);
  ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  otherStory = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherProjectId).id;
  await start();
});
afterEach(async () => {
  await stop();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const send = (method, path, body) => fetch(`${base}/${projectId}/stories${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const overlapsOf = (data) => Object.fromEntries(data.stories.map((x) => [x.id, x.overlaps]));
const rows = () => ({
  stories: db.prepare('SELECT * FROM stories ORDER BY id').all().map((r) => ({ ...r })),
  overlaps: db.prepare('SELECT * FROM story_overlaps ORDER BY id').all().map((r) => ({ ...r })),
});

test('märkimine on mõlema loo juures, püsib uue rakenduse eksemplariga; „Pole kattuv“ eemaldab ainult märke', async () => {
  const before = rows().stories;
  let res = await send('POST', `/${ids[1]}/overlaps`, { withId: ids[0] });
  assert.equal(res.status, 200);
  assert.deepEqual(overlapsOf(await res.json()), { [ids[0]]: [ids[1]], [ids[1]]: [ids[0]], [ids[2]]: [] });
  await stop();
  await start(); // nagu serveri taaskäivitus
  assert.deepEqual(overlapsOf(await (await fetch(`${base}/${projectId}/stories`)).json())[ids[0]], [ids[1]]);
  res = await send('DELETE', `/${ids[0]}/overlaps/${ids[1]}`);
  assert.equal(res.status, 200);
  assert.deepEqual(rows(), { stories: before, overlaps: [] });
});

test('piirangud: iseendaga 400, teise projekti lugu 404, sama paar teistpidi 409, puuduv märge 404; midagi ei muutu', async () => {
  await send('POST', `/${ids[0]}/overlaps`, { withId: ids[1] });
  const before = rows();
  assert.equal((await send('POST', `/${ids[0]}/overlaps`, { withId: ids[0] })).status, 400);
  assert.equal((await send('POST', `/${ids[0]}/overlaps`, { withId: otherStory })).status, 404);
  assert.equal((await send('POST', `/${ids[1]}/overlaps`, { withId: ids[0] })).status, 409);
  assert.equal((await send('DELETE', `/${ids[0]}/overlaps/${ids[2]}`)).status, 404);
  assert.deepEqual(rows(), before);
});

test('„Eemalda lugu N“: kustutamise mõjus on märge; kustutamine ja ühendamine eemaldavad märke kaskaadiga', async () => {
  await send('POST', `/${ids[0]}/overlaps`, { withId: ids[1] });
  await send('POST', `/${ids[0]}/overlaps`, { withId: ids[2] });
  assert.deepEqual((await (await send('GET', `/${ids[1]}/delete-impact`)).json()).overlaps, [ids[0]]);
  assert.equal((await send('DELETE', `/${ids[1]}`)).status, 200);
  assert.deepEqual(rows().overlaps.map((o) => [o.story_a, o.story_b]), [[ids[0], ids[2]]]);
  const res = await send('POST', `/${ids[0]}/merge`, { withId: ids[2], story: { ...s('näha nädalakava ja hindu') }, keepCriteria: [] });
  assert.equal(res.status, 200);
  assert.deepEqual(rows().overlaps, []);
});
