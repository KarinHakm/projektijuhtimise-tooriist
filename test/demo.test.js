import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createAiClient } from '../server/ai/client.js';
import { checkStories } from '../server/ai/tasks/stories.js';
import { validateStoryText } from '../shared/story-format.js';
import { createDemoDb, loadFixture } from '../scripts/demo-data.js';

// Näidisandmed (npm run demo). Ajutine kaust; arendaja data/app.db faili ei puututa ja AI-d ei kutsuta.
let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pjt-demo-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const read = (path, sql, ...args) => {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return db.prepare(sql).all(...args).map((r) => ({ ...r })); } finally { db.close(); }
};

test('loob ainult demo.db faili: kõrval olev app.db jääb baithaaval samaks', () => {
  const appDb = join(dir, 'app.db');
  writeFileSync(appDb, 'PÄRIS ANDMED – ei tohi muutuda');
  const before = readFileSync(appDb);
  const path = createDemoDb(join(dir, 'demo.db'), { protectedPaths: [appDb] });
  assert.equal(path, join(dir, 'demo.db'));
  assert.deepEqual(readFileSync(appDb), before);
  assert.equal(read(path, 'PRAGMA integrity_check')[0].integrity_check, 'ok');
});

test('keeldub kirjutamast faili app.db või kaitstud faili; faili ei muudeta', () => {
  const appDb = join(dir, 'app.db');
  writeFileSync(appDb, 'PÄRIS ANDMED');
  assert.throws(() => createDemoDb(appDb), /päris andmebaas/);
  const other = join(dir, 'minu.db');
  writeFileSync(other, 'KAITSTUD');
  assert.throws(() => createDemoDb(other, { protectedPaths: [other] }), /päris andmebaas/);
  assert.equal(readFileSync(appDb, 'utf8'), 'PÄRIS ANDMED');
  assert.equal(readFileSync(other, 'utf8'), 'KAITSTUD');
});

test('projektid on märgitud näidiseks ja sisu ei pärine arendaja projektidest', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const projects = read(path, 'SELECT name, description FROM projects ORDER BY id');
  assert.equal(projects.length, 2);
  for (const p of projects) {
    assert.match(p.name, /^Näidis: /);
    assert.doesNotMatch(p.description, /NÄIDISANDMED/); // näidise märk on rakenduses lühike silt „Näidis“
  }
  const text = JSON.stringify(loadFixture());
  for (const own of ['Spordiklubi', 'L04 test', 'Potentsiaalne liige', 'treening']) assert.ok(!text.includes(own), own);
});

test('rollid on käsitsi lisatud; backlog’i lood on päritoluga manual; vestluse "assistendi" sõnumid on märgitud demo', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  assert.deepEqual([...new Set(read(path, 'SELECT source FROM project_roles').map((r) => r.source))], ['manual']);
  const origins = read(path, 'SELECT origin FROM stories').map((r) => r.origin);
  assert.equal(origins.length, 5);
  assert.ok(origins.every((o) => o === 'manual'));
  const assistant = read(path, "SELECT content FROM conversation_messages WHERE role = 'assistant'").map((r) => JSON.parse(r.content));
  assert.equal(assistant.length, 2);
  assert.ok(assistant.every((c) => c.demo === true));
});

test('näidisettepanek on ootel, märgitud demo ja läbib rakenduse enda lugude reeglid', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const [row] = read(path, "SELECT payload, status FROM ai_proposals WHERE kind = 'stories'");
  assert.equal(row.status, 'pending');
  const payload = JSON.parse(row.payload);
  assert.equal(payload.demo, true);
  assert.deepEqual(checkStories(payload, ['Lugeja', 'Raamatukoguhoidja']), []);
  for (const s of payload.stories) assert.deepEqual(validateStoryText(s).errors, [], s.want);
});

test('uus käivitus taastab algseisu', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const db = new DatabaseSync(path);
  db.exec("DELETE FROM stories; UPDATE ai_proposals SET status = 'rejected'");
  db.close();
  createDemoDb(path);
  assert.equal(read(path, 'SELECT COUNT(*) AS n FROM stories')[0].n, 5);
  assert.equal(read(path, "SELECT status FROM ai_proposals")[0].status, 'pending');
});

test('server: näidisettepanekul on märge demo ja lisatud lood saavad päritolu manual', async () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const db = openDb(path);
  const server = createApp({ db, ai: createAiClient({}) }).listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const projectId = db.prepare("SELECT id FROM projects WHERE name LIKE 'Näidis: Linna%'").get().id;
    const url = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}/stories`;
    const state = await (await fetch(url)).json();
    assert.equal(state.proposal.demo, true);
    const stories = state.proposal.stories.slice(0, 2).map(({ index, role, rolePhrase, want, soThat, size }) => ({ index, role, rolePhrase, want, soThat, size }));
    const res = await fetch(`${url}/apply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposalId: state.proposal.id, stories }) });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).stories.map((s) => s.origin), ['manual', 'manual']);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    db.close();
  }
});
