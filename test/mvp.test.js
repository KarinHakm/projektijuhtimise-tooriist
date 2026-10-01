import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';

// MVP joon (L17). Ajutine andmebaas; AI-d ei kutsuta.
const s = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', origin: 'manual', touchesView: true });
let dir, path, db, projectId, otherId, server, base;

async function start() {
  db = openDb(path);
  server = createApp({ db, ai: { configured: true, timeoutMs: 1000, complete: async () => { throw new Error('AI-d ei tohi kutsuda'); } } }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}
async function stop() {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-mvp-'));
  path = join(dir, 'app.db');
  await start();
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('üks'), s('kaks'), s('kolm'), s('neli')], null);
});
afterEach(async () => {
  await stop();
  rmSync(dir, { recursive: true, force: true });
});

const mvp = (count, pid = projectId) => fetch(`${base}/${pid}/stories/mvp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count }) });
const state = async () => (await fetch(`${base}/${projectId}/stories`)).json();
const stored = () => db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n;

test('alguses joont pole; joone määramine, liigutamine ja eemaldamine', async () => {
  assert.equal((await state()).mvpCount, null);
  assert.equal((await (await mvp(3)).json()).mvpCount, 3);
  assert.equal(stored(), 3);
  assert.equal((await (await mvp(0)).json()).mvpCount, 0);
  assert.equal((await (await mvp(4)).json()).mvpCount, 4);
  assert.equal((await (await mvp(null)).json()).mvpCount, null);
  assert.equal(stored(), null);
});

test('vigased väärtused annavad 400 ja ei muuda midagi; teine projekt ei muutu', async () => {
  await mvp(2);
  for (const bad of [-1, 5, 1.5, '2', true]) assert.equal((await mvp(bad)).status, 400, String(bad));
  assert.equal((await fetch(`${base}/${projectId}/stories/mvp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
  assert.equal(stored(), 2);
  assert.equal((await mvp(2, 9999)).status, 404);
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(otherId).n, null);
});

test('joon on seotud kohaga: lugu tõstetakse üle joone, joon jääb samale kohale', async () => {
  await mvp(2);
  const ids = (await state()).stories.map((x) => x.id);
  await fetch(`${base}/${projectId}/stories/${ids[2]}/move`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ direction: 'up' }) });
  const after = await state();
  assert.equal(after.mvpCount, 2);
  assert.deepEqual(after.stories.slice(0, 2).map((x) => x.id), [ids[0], ids[2]]);
});

test('salvestatud koht suurem kui lugude arv: kuvatakse lugude arvuga piiratult, lugemine andmebaasi ei muuda', async () => {
  db.prepare('UPDATE projects SET mvp_count = 9 WHERE id = ?').run(projectId);
  assert.equal((await state()).mvpCount, 4);
  assert.equal(stored(), 9);
});

test('joone koht püsib pärast andmebaasi sulgemist ja taasavamist', async () => {
  await mvp(3);
  await stop();
  await start();
  assert.equal((await state()).mvpCount, 3);
});
