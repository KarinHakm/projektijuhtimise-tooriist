import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { checkStories } from '../server/ai/tasks/stories.js';
import { checkMockup } from '../server/ai/tasks/criteria.js';
import { consistencyFor } from '../server/criteria.js';
import { checkCriterion } from '../shared/criteria-check.js';
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

test('üks näidisprojekt „Explore Estonia“; sisu on käsitsi kirjutatud, mitte kopeeritud testkoopiatest', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const projects = read(path, 'SELECT name, description FROM projects ORDER BY id');
  assert.deepEqual(projects.map((p) => p.name), ['Näidis: Explore Estonia']);
  assert.doesNotMatch(projects[0].description, /NÄIDISANDMED/); // näidise märk on rakenduses lühike silt „Näidis“
  const text = JSON.stringify(loadFixture());
  for (const own of ['TESTKOOPIA', 'VÕLTSANDMED', 'Potentsiaalne liige', 'raamatukogu', 'Lugeja']) assert.ok(!text.includes(own), own);
});

test('läbiv näide: vestlus, 2 rolli, 4 lugu, alustamise lugu, 3 kriteeriumi ja kinnitatud mockup; kõik käsitsi', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  assert.deepEqual(read(path, 'SELECT name, source FROM project_roles ORDER BY position').map((r) => [r.name, r.source]), [['Külastaja', 'manual'], ['Reisikorraldaja', 'manual']]);
  const stories = read(path, 'SELECT id, origin FROM stories ORDER BY position');
  assert.equal(stories.length, 4);
  assert.ok(stories.every((s) => s.origin === 'manual'));
  const [{ focus, mvp }] = read(path, 'SELECT focus_story_id AS focus, mvp_count AS mvp FROM projects');
  assert.equal(focus, stories[2].id);
  assert.equal(mvp, 3); // MVP joon kolme loo all
  const criteria = read(path, 'SELECT text, origin, ref_kind FROM criteria WHERE story_id = ? ORDER BY position', focus);
  assert.equal(criteria.length, 3);
  assert.ok(criteria.every((c) => c.origin === 'manual' && c.ref_kind === null));
  for (const c of criteria) assert.deepEqual(checkCriterion(c.text), [], c.text);
  assert.deepEqual(read(path, 'SELECT version FROM mockups WHERE story_id = ?', focus).map((m) => m.version), [1]);
  const msgs = read(path, 'SELECT role, kind, content FROM conversation_messages ORDER BY id');
  assert.deepEqual(msgs.map((m) => m.kind), ['idea', 'questions', 'answers', 'summary']);
  assert.equal(JSON.parse(msgs[1].content).questions.length, 2);
  assert.ok(msgs.filter((m) => m.role === 'assistant').every((m) => JSON.parse(m.content).demo === true));
});

test('teadlik kooskõlahoiatus: täpselt üks (teade „Broneerimistaotlus saadetud“ puudub mockup’ist), kasutaja pole seda üle vaadanud', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const db = openDb(path);
  try {
    const focus = db.prepare('SELECT focus_story_id AS id FROM projects').get().id;
    const c = consistencyFor(db, focus);
    assert.equal(c.warningCount, 1);
    assert.deepEqual(c.criteria.map((x) => x.warnings.map((w) => w.code)), [[], [], ['no_match']]);
    assert.match(c.criteria[2].warnings[0].message, /„teade“, „saadetud“/);
    assert.equal(c.review, null);
  } finally {
    db.close();
  }
});

test('ootel näidisettepanekud: lood ja kliendi täpsustus on märgitud demo ning läbivad rakenduse reeglid', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const rows = read(path, 'SELECT kind, payload, status FROM ai_proposals ORDER BY created_at');
  assert.deepEqual(rows.map((r) => [r.kind, r.status]), [['stories', 'pending'], ['refinement', 'pending']]);
  const [stories, refinement] = rows.map((r) => JSON.parse(r.payload));
  assert.equal(stories.demo, true);
  assert.deepEqual(checkStories(stories, ['Külastaja', 'Reisikorraldaja']), []);
  for (const s of stories.stories) assert.deepEqual(validateStoryText(s).errors, [], s.want);
  assert.equal(refinement.demo, true);
  assert.deepEqual(checkMockup(refinement.after.mockup), []);
  for (const c of refinement.after.criteria) assert.deepEqual(checkCriterion(c.text), [], c.text);
});

test('uus käivitus taastab algseisu', () => {
  const path = createDemoDb(join(dir, 'demo.db'));
  const db = new DatabaseSync(path);
  db.exec("DELETE FROM criteria; UPDATE ai_proposals SET status = 'rejected'");
  db.close();
  createDemoDb(path);
  assert.equal(read(path, 'SELECT COUNT(*) AS n FROM stories')[0].n, 4);
  assert.equal(read(path, 'SELECT COUNT(*) AS n FROM criteria')[0].n, 3);
  assert.deepEqual(read(path, 'SELECT status FROM ai_proposals').map((r) => r.status), ['pending', 'pending']);
});

async function withDemoServer(fn) {
  const path = createDemoDb(join(dir, 'demo.db'));
  const db = openDb(path);
  let calls = 0;
  const ai = { configured: true, timeoutMs: 1000, complete: async () => { calls++; throw new Error('AI-d ei tohi kutsuda'); } };
  const server = createApp({ db, ai }).listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const projectId = db.prepare("SELECT id FROM projects WHERE name = 'Näidis: Explore Estonia'").get().id;
    await fn({ db, base: `http://127.0.0.1:${server.address().port}/api/projects/${projectId}` });
    assert.equal(calls, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    db.close();
  }
}
const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('server: lugude näidisettepanek on märgitud demo ja lisatud lood saavad päritolu manual', async () => {
  await withDemoServer(async ({ base }) => {
    const state = await (await fetch(`${base}/stories`)).json();
    assert.equal(state.proposal.demo, true);
    const stories = state.proposal.stories.slice(0, 2).map(({ index, role, rolePhrase, want, soThat, size }) => ({ index, role, rolePhrase, want, soThat, size }));
    const res = await postJson(`${base}/stories/apply`, { proposalId: state.proposal.id, stories });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).stories.slice(-2).map((s) => s.origin), ['manual', 'manual']);
  });
});

test('server: täpsustuse näidisettepanek – eelvaade, rakendamine muudab ainult alustamise lugu, uus kriteerium on käsitsi, mockup v2', async () => {
  await withDemoServer(async ({ db, base }) => {
    const others = () => db.prepare('SELECT * FROM stories WHERE id != (SELECT focus_story_id FROM projects) ORDER BY id').all().map((r) => ({ ...r }));
    const before = others();
    const state = await (await fetch(`${base}/refinement`)).json();
    assert.equal(state.proposal.demo, true);
    assert.deepEqual(state.proposal.preview.criteria.items.map((c) => c.status), ['unchanged', 'added', 'unchanged', 'unchanged']);
    assert.equal(state.proposal.otherStories.length, 1);
    const res = await postJson(`${base}/refinement/apply`, { proposalId: state.proposal.id, storyId: state.story.id });
    assert.equal(res.status, 200);
    const after = await res.json();
    assert.equal(after.mockup.version, 2);
    assert.deepEqual(after.criteria.map((c) => c.origin), ['manual', 'manual', 'manual', 'manual']);
    assert.deepEqual(others(), before);
    // teadlik hoiatus jääb alles, kuni kasutaja selle üle vaatab
    assert.deepEqual(after.consistency.criteria.map((x) => x.warnings.map((w) => w.code)), [[], [], [], ['no_match']]);
  });
});
