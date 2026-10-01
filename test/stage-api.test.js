import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createAiClient } from '../server/ai/client.js';
import { addMessage } from '../server/conversation.js';
import { replaceRoles } from '../server/roles.js';
import { appendStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';
import { appendCriteria, saveMockup } from '../server/criteria.js';
import { createProposal } from '../server/proposals.js';

// Etapi päring (L13, L14): tuletab etapi andmebaasist, ei muuda ühtegi rida ega kutsu AI-d.
const s = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', origin: 'ai', touchesView: true });
let dir, db, projectId, server, base, aiCalls;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-stage-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  aiCalls = 0;
  const ai = createAiClient({ token: 'test-token', model: 'Qwen3.8-27B', fetchImpl: async () => { aiCalls++; throw new Error('AI-d ei tohi kutsuda'); } });
  server = createApp({ db, ai }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const stage = async (pid = projectId) => {
  const res = await fetch(`${base}/${pid}/stage`);
  return { status: res.status, body: await res.json() };
};
const dump = () => Object.fromEntries(['projects', 'conversation_messages', 'project_roles', 'stories', 'ai_proposals', 'criteria', 'mockups']
  .map((t) => [t, db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all().map((r) => ({ ...r }))]));
const setTime = (table, id, at) => db.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).run(at, id);

test('tundmatu projekt annab 404', async () => {
  assert.equal((await stage(9999)).status, 404);
  assert.equal((await stage('abc')).status, 404);
});

test('etapp liigub andmete järgi edasi; uusim AI väljund määrab kaardi; lugemine ei muuda andmeid ega kutsu AI-d', async () => {
  let r = (await stage()).body;
  assert.deepEqual([r.lastDone, r.next.key, r.steps.map((x) => x.id), r.latestAiCard], [null, 'idee', ['write-idea'], null]);

  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  r = (await stage()).body;
  assert.deepEqual(r.steps.map((x) => x.id), ['retry-conversation']);

  const summary = addMessage(db, { projectId, role: 'assistant', kind: 'summary', replyTo: idea.id, content: { message: 'Selge.', summary: 'Liikmeks astutakse veebis.' } });
  setTime('conversation_messages', summary.id, '2026-10-01T08:00:00.000Z');
  r = (await stage()).body;
  assert.deepEqual([r.lastDone.key, r.next.key, r.latestAiCard], ['idee', 'rollid', 'conversation']);

  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  const proposal = createProposal(db, { projectId, kind: 'stories', payload: { message: 'Lood', stories: [] } });
  setTime('ai_proposals', proposal.id, '2026-10-01T09:00:00.000Z');
  const before = dump();
  r = (await stage()).body;
  assert.deepEqual([r.lastDone.key, r.next.key, r.steps.map((x) => x.id), r.latestAiCard], ['rollid', 'lood', ['review-stories'], 'stories']);
  assert.deepEqual(dump(), before);
  assert.equal(aiCalls, 0);
});

test('alustamise loo järgsed etapid; teise loo ootel ettepanek ei loe', async () => {
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  appendStories(db, projectId, [s('esitada taotluse'), s('näha hindu')], null);
  const [target, other] = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((x) => x.id);
  let r = (await stage()).body;
  assert.deepEqual([r.lastDone.key, r.next.key, r.steps.map((x) => x.id)], ['lood', 'prioriteedid', ['propose-priority', 'choose-priority']]);
  assert.equal(r.stages.find((x) => x.key === 'kriteeriumid').reason, 'Vali enne alustamise lugu.');

  setFocusStory(db, projectId, target);
  createProposal(db, { projectId, kind: 'criteria', payload: { storyId: other, criteria: [] } });
  r = (await stage()).body;
  assert.deepEqual([r.lastDone.key, r.steps.map((x) => x.id)], ['prioriteedid', ['propose-criteria']]);

  appendCriteria(db, target, [{ text: "Kasutaja näeb nuppu 'Esita taotlus'.", origin: 'ai' }]);
  saveMockup(db, target, { title: 'Taotlus', components: [{ type: 'button', text: 'Esita taotlus', items: [] }, { type: 'button', text: 'Salvesta', items: [] }] });
  r = (await stage()).body;
  assert.deepEqual([r.lastDone.key, r.next.key, r.steps.map((x) => x.id)], ['kriteeriumid', 'tapsustused', ['review-consistency', 'refine']]);

  const applied = createProposal(db, { projectId, kind: 'refinement', payload: { storyId: target } });
  db.prepare("UPDATE ai_proposals SET status = 'applied' WHERE id = ?").run(applied.id);
  r = (await stage()).body;
  assert.deepEqual([r.lastDone.key, r.next, r.allBuiltDone, r.latestAiCard], ['tapsustused', null, true, 'refinement']);
  assert.equal(r.stages.find((x) => x.key === 'groomimine').status, 'not_built');
  assert.equal(aiCalls, 0);
});

test('projektide loendis on iga projekti etapi kokkuvõte (ainult lugemine)', async () => {
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  appendStories(db, projectId, [s('esitada taotluse')], null);
  const before = dump();
  const list = await (await fetch(base)).json();
  assert.deepEqual(list[0].progress, {
    stages: list[0].progress.stages,
    lastDone: 'Lood', next: 'Prioriteedid', nextStep: 'Küsi AI-lt prioriteedisoovitus', allBuiltDone: false, storyCount: 1,
  });
  assert.deepEqual(list[0].progress.stages.map((x) => x.status), ['skipped', 'done', 'done', 'next', 'blocked', 'blocked', 'not_built']);
  assert.deepEqual(dump(), before);
  assert.equal(aiCalls, 0);
});
