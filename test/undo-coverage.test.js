import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { consistencyFor } from '../server/criteria.js';
import { createProposal } from '../server/proposals.js';
import { captureProject } from '../server/undo.js';
import { createDemoDb } from '../scripts/demo-data.js';

// L21 laiendus: AI ettepanekute rakendamine, mockup, täpsustus, staatus, küsimused, MVP joon, alustamise lugu,
// kriteeriumi seos ja kooskõla ülevaatus on tagasivõetavad. Näidisandmebaasi koopia ajutises kaustas, AI välja lülitatud.
let dir, db, projectId, focusId, server, base;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-undo-cov-'));
  db = openDb(createDemoDb(join(dir, 'demo.db')));
  ({ id: projectId, focus_story_id: focusId } = db.prepare('SELECT id, focus_story_id FROM projects').get());
  server = createApp({ db, ai: createDisabledAi() }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const send = (method, path, body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const undoState = async () => (await send('GET', '/undo')).json();
const all = () => captureProject(db, projectId);
const pending = (kind) => db.prepare("SELECT id, payload FROM ai_proposals WHERE project_id = ? AND kind = ? AND status = 'pending'").get(projectId, kind);
const stories = () => db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);

// Toiming → silt → tagasivõtmine taastab täpselt enne-seisu (ka ettepaneku oleku).
async function roundTrip(method, path, body, label) {
  const before = all();
  const res = await send(method, path, body);
  assert.equal(res.status, 200, await res.clone().text());
  assert.notDeepEqual(all(), before);
  const st = await undoState();
  assert.equal(st.available, true);
  assert.match(st.label, label);
  assert.equal((await send('POST', '/undo', { at: st.at })).status, 200);
  assert.deepEqual(all(), before);
}

test('lugude lisamine ettepanekust võetakse tagasi (näidisettepanekul ilma „AI“ sildita); ettepanek on jälle ootel', async () => {
  const p = pending('stories');
  const chosen = JSON.parse(p.payload).stories.map((s, index) => ({ index, ...s })).slice(0, 2);
  await roundTrip('POST', '/stories/apply', { proposalId: p.id, stories: chosen }, /^Lisasid backlog'i lood \(2\)$/);
  assert.equal(pending('stories')?.id, p.id);
});

test('kliendi täpsustuse rakendamine võetakse tagasi (lugu, kriteeriumid ja mockup\'i versioon)', async () => {
  const p = pending('refinement');
  await roundTrip('POST', '/refinement/apply', { proposalId: p.id, storyId: JSON.parse(p.payload).storyId }, /^Rakendasid kliendi täpsustuse loole \d+$/);
  assert.equal(pending('refinement')?.id, p.id);
});

test('AI kriteeriumide salvestamine, mockup\'i kinnitamine ja versiooni taastamine võetakse tagasi', async () => {
  const c = createProposal(db, { projectId, kind: 'criteria', payload: { storyId: focusId, message: 'x', criteria: ['Vormi all on nupp „Saada taotlus“.'], refs: [] } });
  await roundTrip('POST', '/criteria/apply', { proposalId: c.id, criteria: [{ index: 0, text: 'Vormi all on nupp „Saada taotlus“.' }] }, /kriteeriumid AI ettepanekust$/);

  const m = createProposal(db, { projectId, kind: 'mockup', payload: { storyId: focusId, message: 'x', mockup: { title: 'Taotlus', components: [{ type: 'heading', text: 'Taotlus' }] } } });
  await roundTrip('POST', '/criteria/mockup/accept', { proposalId: m.id }, /mockup'i$/);

  assert.equal((await send('POST', '/criteria/mockup/accept', { proposalId: m.id })).status, 200); // versioon 2
  await roundTrip('POST', '/criteria/mockup/restore', { storyId: focusId, version: 1 }, /mockup'i versiooni 1$/);
});

test('staatus, küsimus, küsimuse vastatuks märkimine ja MVP joon võetakse tagasi', async () => {
  const [first] = stories();
  await roundTrip('POST', `/stories/${first}/status`, { status: 'labivaadatud' }, /^Muutsid loo 1 staatust \(Läbivaadatud\)$/);
  await roundTrip('POST', `/stories/${first}/questions`, { text: 'Kas makse on kohustuslik?' }, /^Lisasid loole 1 küsimuse$/);
  assert.equal((await send('POST', `/stories/${first}/questions`, { text: 'Kas makse on kohustuslik?' })).status, 200);
  const q = db.prepare('SELECT id FROM story_questions WHERE story_id = ? AND resolved_at IS NULL').get(first);
  await roundTrip('POST', `/stories/${first}/questions/${q.id}/resolve`, undefined, /^Märkisid loo 1 küsimuse vastatuks$/);
  await roundTrip('POST', '/stories/mvp', { count: 1 }, /^Muutsid MVP joone kohta$/);
  await roundTrip('POST', '/stories/mvp', { count: null }, /^Eemaldasid MVP joone$/);
});

test('alustamise loo valik, kriteeriumi seos ja kooskõla ülevaatus võetakse tagasi', async () => {
  const other = stories().find((id) => id !== focusId);
  await roundTrip('POST', '/priority/choose', { storyId: other }, /^Valisid alustamise looks loo \d+$/);
  const pr = createProposal(db, { projectId, kind: 'priority', payload: { message: 'x', storyId: other, reason: 'y' } });
  await roundTrip('POST', '/priority/accept', { proposalId: pr.id }, /^Valisid AI soovitusel alustamise looks loo \d+$/);
  const crit = db.prepare('SELECT id FROM criteria WHERE story_id = ? ORDER BY id').get(focusId);
  await roundTrip('POST', '/criteria/link', { criterionId: crit.id, kind: 'no_view' }, /kriteeriumi seost mockup'iga$/);
  await roundTrip('POST', '/criteria/review', { storyId: focusId, fingerprint: consistencyFor(db, focusId).fingerprint }, /kooskõla ülevaatuse$/);
});

test('ebaõnnestunud toiming kirjet ei tee ega kustuta eelmist', async () => {
  const [first] = stories();
  await send('POST', '/stories/mvp', { count: 1 });
  const st = await undoState();
  assert.equal((await send('POST', `/stories/${first}/status`, { status: 'valmis_arenduseks' })).status, 409); // DoR pole täidetud
  assert.deepEqual(await undoState(), st);
});
