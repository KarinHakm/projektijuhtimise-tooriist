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

// Prioriteedisoovitus (L08). Ajutine andmebaas ja võlts-AI: arendaja data/app.db faili ei puututa ja võrku ei saadeta midagi.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const s = (want, soThat, size = 'M') => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat, size, origin: 'ai', touchesView: true });

let dir, dbPath, db, projectId, otherProjectId, ids, otherStoryId, server, base, ai;

function fakeAi() {
  const queue = [];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const next = queue.shift();
    if (!next) throw new Error('võlts-AI-l pole vastust');
    return next();
  };
  return { client: createAiClient({ token: FAKE_TOKEN, model: 'Qwen3.8-27B', fetchImpl }), calls, push: (...r) => queue.push(...r) };
}
const aiOk = (data) => () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(data) } }], usage: { completion_tokens: 80 } }), { status: 200 });
const aiStatus = (status) => () => new Response(`teenuse viga ${FAKE_TOKEN}`, { status });

async function startServer(client) {
  server = createApp({ db, ai: client }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}
async function stopServer() {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-priority-'));
  dbPath = join(dir, 'app.db');
  db = openDb(dbPath);
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine projekt') RETURNING id").get().id;
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', replyTo: idea.id, content: { message: 'Selge.', summary: 'Liikmeks astumine käib veebis.' } });
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  appendStories(db, projectId, [
    s('näha treeningute tunniplaani', 'saaksin valida sobiva treeningu'),
    s('näha liikmepakette ja hindu', 'saaksin valida endale sobiva paketi', 'S'),
    s('registreeruda liikmeks', 'saaksin treeningutel osaleda', 'L'),
  ], null);
  ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  appendStories(db, otherProjectId, [s('teise projekti lugu', 'midagi muud')], null);
  otherStoryId = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherProjectId).id;
  ai = fakeAi();
  await startServer(ai.client);
});
afterEach(async () => {
  if (server.listening) await stopServer();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (pid, path = '') => `${base}/${pid}/priority${path}`;
const post = (pid, path, body) => fetch(url(pid, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const focus = (pid = projectId) => db.prepare('SELECT focus_story_id AS id FROM projects WHERE id = ?').get(pid).id;
const proposals = () => db.prepare("SELECT status FROM ai_proposals WHERE kind = 'priority' ORDER BY rowid").all().map((r) => r.status);
const recommend = (storyId) => ({ message: 'Milline lugu on kõige olulisem?', storyId, reason: 'Ilma hindadeta ei saa külastaja paketti valida ega liikmeks astuda.' });

async function propose(storyId = ids[1]) {
  ai.push(aiOk(recommend(storyId)));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 200);
  return (await res.json()).proposal;
}

test('soovitus salvestub ootele: lugu, pealkiri ja põhjendus; alustamise lugu veel ei muutu', async () => {
  const proposal = await propose();
  assert.equal(proposal.storyId, ids[1]);
  assert.equal(proposal.title, 'Külastajana soovin näha liikmepakette ja hindu, et saaksin valida endale sobiva paketi.');
  assert.match(proposal.reason, /hindadeta/);
  assert.deepEqual(proposals(), ['pending']);
  assert.equal(focus(), null);
});

test('AI päringus on backlog’i lood tunnustega, kokkuvõte ja skeem lubab ainult selle projekti lugusid', async () => {
  await propose();
  const [call] = ai.calls;
  const prompt = call.messages.map((m) => m.content).join('\n');
  for (const id of ids) assert.match(prompt, new RegExp(`id ${id}: `));
  assert.match(prompt, /Liikmeks astumine käib veebis/);
  assert.doesNotMatch(prompt, /teise projekti lugu/);
  assert.deepEqual(call.response_format.json_schema.schema.properties.storyId.enum, ids);
});

test('teise projekti või olematu loo soovitus lükatakse tagasi: kordus, siis 502 ja midagi ei salvestata', async () => {
  ai.push(aiOk(recommend(otherStoryId)), aiOk(recommend(99999)));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 502);
  assert.equal(ai.calls.length, 2);
  assert.deepEqual(proposals(), []);
});

test('tühja backlog’i korral 409 ja AI-d ei kutsuta', async () => {
  const empty = db.prepare("INSERT INTO projects (name) VALUES ('Tühi') RETURNING id").get().id;
  const res = await post(empty, '/propose');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'no_stories');
  assert.equal(ai.calls.length, 0);
});

test('korduv küsimine tagastab sama pooleli soovituse ilma AI-kutseta', async () => {
  const first = await propose();
  const res = await post(projectId, '/propose');
  assert.equal((await res.json()).proposal.id, first.id);
  assert.equal(ai.calls.length, 1);
});

test('"Nõus, alustame sellest" määrab alustamise loo üks kord; teine kinnitus annab 409', async () => {
  const proposal = await propose();
  const res = await post(projectId, '/accept', { proposalId: proposal.id });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.focusStoryId, ids[1]);
  assert.equal(body.proposal, null);
  assert.equal(focus(), ids[1]);
  assert.deepEqual(proposals(), ['applied']);
  assert.equal((await post(projectId, '/accept', { proposalId: proposal.id })).status, 409);
});

test('"Valin ise teise" määrab kasutaja valitud loo ja lükkab AI soovituse tagasi', async () => {
  await propose(ids[1]);
  const res = await post(projectId, '/choose', { storyId: ids[2] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.focusStoryId, ids[2]);
  assert.equal(body.proposal, null);
  assert.equal(focus(), ids[2]);
  assert.deepEqual(proposals(), ['rejected']);
});

test('oma valik töötab ka ilma AI-ta (seadistamata AI)', async () => {
  await stopServer();
  await startServer(createAiClient({}));
  const res = await post(projectId, '/choose', { storyId: ids[0] });
  assert.equal(res.status, 200);
  assert.equal(focus(), ids[0]);
});

test('teise projekti, olematu või vigase loo valik annab 404 ja alustamise lugu ei muutu', async () => {
  for (const storyId of [otherStoryId, 99999, String(ids[0]), null]) {
    const res = await post(projectId, '/choose', { storyId });
    assert.equal(res.status, 404, String(storyId));
  }
  assert.equal(focus(), null);
});

test('teise projekti soovitust ei saa selles projektis kinnitada', async () => {
  const proposal = await propose();
  const res = await post(otherProjectId, '/accept', { proposalId: proposal.id });
  assert.equal(res.status, 404);
  assert.equal(focus(), null);
  assert.equal(focus(otherProjectId), null);
});

test('alustamise lugu on näha lugude päringus ja püsib pärast andmebaasi uuesti avamist', async () => {
  await post(projectId, '/choose', { storyId: ids[2] });
  const stories = await (await fetch(`${base}/${projectId}/stories`)).json();
  assert.equal(stories.focusStoryId, ids[2]);
  await stopServer();
  db.close();
  db = openDb(dbPath);
  assert.equal(focus(), ids[2]);
});

test('AI teenuse vea korral soovitust ei salvestata ja token ei jõua vastusesse', async () => {
  ai.push(aiStatus(500));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 502);
  assert.doesNotMatch(await res.text(), /TOKEN/);
  assert.deepEqual(proposals(), []);
});
