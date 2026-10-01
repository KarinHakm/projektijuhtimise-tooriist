import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { aiFail, aiHang, aiOk, aiText, fakeAi } from './helpers/fake-ai.js';
import { createDisabledAi } from '../server/ai/client.js';
import { addMessage } from '../server/conversation.js';
import { buildProjectContext } from '../server/ai/context.js';
import { getProposal } from '../server/proposals.js';
import { roleKey, unconfirmedRoles } from '../server/roles.js';

// Ajutine andmebaas ja võlts-AI: arendaja data/app.db faili ei puututa ja võrku ei saadeta midagi.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const ROLES = {
  message: 'Pakun järgmised rollid.',
  roles: [
    { name: 'Külastaja', description: 'Tutvub treeningute ja pakettidega.' },
    { name: 'Klubi liige', description: 'Registreerub treeningutele.' },
    { name: 'Administraator', description: 'Haldab pakette ja treeninguid.' },
  ],
};


let dir, db, projectId, otherProjectId, server, base, ai;


async function startServer(aiClient) {
  server = createApp({ db, ai: aiClient }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}

// Vestlus, mis on jõudnud kokkuvõtteni (L04 tulemus), kirjutatakse otse andmebaasi.
function seedConversation(pid, { summary = true } = {}) {
  const idea = addMessage(db, { projectId: pid, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  const q = addMessage(db, {
    projectId: pid, role: 'assistant', kind: 'questions', replyTo: idea.id,
    content: { message: 'Täpsustan.', questions: [{ id: 'k1', text: 'Kes on kasutajad?', multiSelect: true, options: ['Külastaja', 'Administraator'] }] },
  });
  const a = addMessage(db, {
    projectId: pid, role: 'user', kind: 'answers', replyTo: q.id,
    content: { answers: [{ questionId: 'k1', selected: ['Külastaja'], other: 'Treener', skipped: false }] },
  });
  if (summary) addMessage(db, { projectId: pid, role: 'assistant', kind: 'summary', replyTo: a.id, content: { message: 'Selge.', summary: 'Kasutajad on külastaja ja treener.' } });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-roles-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine projekt') RETURNING id").get().id;
  seedConversation(projectId);
  addMessage(db, { projectId: otherProjectId, role: 'user', kind: 'idea', content: { text: 'TEISE PROJEKTI SALAJANE IDEE' } });
  ai = fakeAi();
  await startServer(ai.client);
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (pid, path = '') => `${base}/${pid}/roles${path}`;
const post = (pid, path, body) => fetch(url(pid, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getRoles = async (pid = projectId) => (await fetch(url(pid))).json();
const roleRows = () => db.prepare('SELECT name, source, position FROM project_roles WHERE project_id = ? ORDER BY position').all(projectId).map((r) => ({ ...r }));

async function propose() {
  ai.push(aiOk(ROLES));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 200);
  return (await res.json()).proposal;
}

const selection = [
  { name: 'Külastaja', source: 'ai' },
  { name: 'Administraator', source: 'ai' }, // "Klubi liige" jäeti välja
  { name: 'Treener', source: 'manual' },
];

// --- Ettepanek ---

test('ettepanek salvestub olekuga pending, kinnitatud rolle ei teki', async () => {
  const proposal = await propose();
  assert.equal(ai.calls.length, 1);
  assert.deepEqual(proposal.roles.map((r) => r.name), ['Külastaja', 'Klubi liige', 'Administraator']);
  assert.equal(getProposal(db, proposal.id).status, 'pending');
  assert.deepEqual(roleRows(), []);
  const state = await getRoles();
  assert.deepEqual(state.roles, []);
  assert.equal(state.proposal.id, proposal.id);
});

test('prompt koostatakse andmebaasist: idee, vabatekstiline vastus ja kokkuvõte, mitte teise projekti andmed', async () => {
  await propose();
  const prompt = ai.calls[0].messages.find((m) => m.role === 'user').content;
  assert.match(prompt, /Spordiklubi tahab veebi\./);
  assert.match(prompt, /muu: Treener/);
  assert.match(prompt, /Kasutajad on külastaja ja treener\./);
  assert.ok(!prompt.includes('TEISE PROJEKTI'));
  assert.equal(ai.calls[0].schema.type, 'object');
});

test('korduv "Paku rollid" (nt pärast värskendamist) tagastab sama ettepaneku ilma AI-kutseta', async () => {
  const first = await propose();
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).proposal.id, first.id);
  assert.equal(ai.calls.length, 1);
});

test('enne vestluse kokkuvõtet annab "Paku rollid" 409 ja AI-d ei kutsuta', async () => {
  const res = await post(otherProjectId, '/propose');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'conversation_not_ready');
  assert.equal(ai.calls.length, 0);
});

test('AI ajalimiidi või 429 korral ettepanekut ei salvestata', async () => {
  ai.push(aiFail('usage_limit', { retryAfterSeconds: 30 }));
  const r429 = await post(projectId, '/propose');
  assert.equal(r429.status, 429);
  assert.equal((await r429.json()).retryAfterSeconds, 30);
  assert.equal((await getRoles()).proposal, null);

  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  ai = fakeAi({ timeoutMs: 50 });
  await startServer(ai.client);
  ai.push(aiHang());
  const rTimeout = await post(projectId, '/propose');
  assert.equal(rTimeout.status, 504);
  assert.equal((await getRoles()).proposal, null);
  assert.equal(db.prepare('SELECT count(*) n FROM ai_proposals').get().n, 0);
});

test('korduvad rollinimed või "Muu" AI vastuses põhjustavad korduse', async () => {
  const dup = { message: 'x', roles: [{ name: 'Külastaja', description: 'a' }, { name: 'külastaja', description: 'b' }] };
  const other = { message: 'x', roles: [{ name: 'Külastaja', description: 'a' }, { name: 'Muu', description: 'b' }] };
  ai.push(aiOk(dup), aiOk(other));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 502);
  assert.equal(ai.calls.length, 2);
  assert.equal((await getRoles()).proposal, null);
});

// --- Kinnitamine ---

test('kinnitamine salvestab ainult valitud ja käsitsi lisatud rollid', async () => {
  const proposal = await propose();
  const res = await post(projectId, '/apply', { proposalId: proposal.id, roles: selection });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.proposal, null);
  assert.deepEqual(roleRows(), [
    { name: 'Külastaja', source: 'ai', position: 1 },
    { name: 'Administraator', source: 'ai', position: 2 },
    { name: 'Treener', source: 'manual', position: 3 },
  ]);
  assert.equal(getProposal(db, proposal.id).status, 'applied');
});

test('AI rolli nimi normaliseeritakse ettepaneku kirjapildile', async () => {
  const proposal = await propose();
  await post(projectId, '/apply', { proposalId: proposal.id, roles: [{ name: '  külastaja ', source: 'ai' }] });
  assert.deepEqual(roleRows().map((r) => r.name), ['Külastaja']);
});

test('kaks samaaegset rakendamise HTTP-päringut: üks 200, teine 409 ja rollid salvestuvad üks kord', async () => {
  const proposal = await propose();
  const body = { proposalId: proposal.id, roles: selection };
  const [a, b] = await Promise.all([post(projectId, '/apply', body), post(projectId, '/apply', body)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const conflict = a.status === 409 ? a : b;
  assert.equal((await conflict.json()).code, 'already_decided');
  assert.equal(roleRows().length, 3);
  assert.equal(db.prepare('SELECT count(*) n FROM project_roles').get().n, 3);
});

test('teine rakendamine hiljem annab 409 ega kirjuta vahepealset käsitsi muudatust üle', async () => {
  const proposal = await propose();
  assert.equal((await post(projectId, '/apply', { proposalId: proposal.id, roles: selection })).status, 200);
  db.prepare("UPDATE project_roles SET name = 'Treener-juhendaja', name_key = 'treener-juhendaja' WHERE name = 'Treener'").run();
  const second = await post(projectId, '/apply', { proposalId: proposal.id, roles: selection });
  assert.equal(second.status, 409);
  assert.deepEqual(roleRows().map((r) => r.name), ['Külastaja', 'Administraator', 'Treener-juhendaja']);
});

test('"Loobu": ettepanek lükatakse tagasi, rolle ei salvestata ja rakendamine annab hiljem 409', async () => {
  const proposal = await propose();
  const res = await post(projectId, '/reject', { proposalId: proposal.id });
  assert.equal(res.status, 200);
  assert.equal(getProposal(db, proposal.id).status, 'rejected');
  assert.deepEqual(roleRows(), []);
  assert.equal((await post(projectId, '/apply', { proposalId: proposal.id, roles: selection })).status, 409);
  assert.equal((await post(projectId, '/reject', { proposalId: proposal.id })).status, 409);
});

test('vigane valik annab 400, midagi ei salvestata ja ettepanek jääb pending', async () => {
  const proposal = await propose();
  const cases = [
    [],
    [{ name: '   ', source: 'manual' }],
    [{ name: 'Külastaja', source: 'ai' }, { name: 'KÜLASTAJA', source: 'manual' }],
    [{ name: 'Õpetaja', source: 'manual' }, { name: 'õpetaja', source: 'manual' }],
    [{ name: 'Leiutatud roll', source: 'ai' }],
    [{ name: 'x'.repeat(41), source: 'manual' }],
    [{ name: 'Külastaja', source: 'muu' }],
    Array.from({ length: 11 }, (_, i) => ({ name: `Roll ${i}`, source: 'manual' })),
  ];
  for (const roles of cases) {
    const res = await post(projectId, '/apply', { proposalId: proposal.id, roles });
    assert.equal(res.status, 400, JSON.stringify(roles));
  }
  assert.deepEqual(roleRows(), []);
  assert.equal(getProposal(db, proposal.id).status, 'pending');
});

test('teise projekti või olematu ettepanek annab 404', async () => {
  const proposal = await propose();
  assert.equal((await post(otherProjectId, '/apply', { proposalId: proposal.id, roles: selection })).status, 404);
  assert.equal((await post(projectId, '/apply', { proposalId: 'olematu', roles: selection })).status, 404);
  assert.equal((await post(otherProjectId, '/reject', { proposalId: proposal.id })).status, 404);
  assert.equal(getProposal(db, proposal.id).status, 'pending');
});

// --- Kontekst ja L06 kontroll ---

test('AI kontekstis on ainult kinnitatud rollid, mitte pooleli ettepanek', async () => {
  const proposal = await propose();
  assert.deepEqual(buildProjectContext(db, projectId).roles, []);
  await post(projectId, '/apply', { proposalId: proposal.id, roles: selection });
  assert.deepEqual(buildProjectContext(db, projectId).roles, ['Külastaja', 'Administraator', 'Treener']);
});

test('unconfirmedRoles leiab rollid, mida kinnitatud rollide seas ei ole (L06 lugude kontrolliks)', async () => {
  const proposal = await propose();
  await post(projectId, '/apply', { proposalId: proposal.id, roles: selection });
  assert.deepEqual(unconfirmedRoles(db, projectId, ['külastaja', 'Klubi liige', 'TREENER', 'Tundmatu']), ['Klubi liige', 'Tundmatu']);
  assert.equal(roleKey('  ÕPETAJA '), 'õpetaja');
});

test('token ei jõua ühtegi vastusesse', async () => {
  ai.push(aiFail('unavailable'), aiFail('not_logged_in'), aiOk(ROLES));
  const bodies = [];
  for (let i = 0; i < 3; i++) bodies.push(await (await post(projectId, '/propose')).text());
  bodies.push(await (await fetch(url(projectId))).text());
  for (const b of bodies) assert.ok(!b.includes(FAKE_TOKEN));
});
