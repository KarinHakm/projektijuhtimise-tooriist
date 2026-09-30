import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createAiClient } from '../server/ai/client.js';
import { addMessage } from '../server/conversation.js';
import { buildProjectContext } from '../server/ai/context.js';
import { getProposal } from '../server/proposals.js';
import { replaceRoles } from '../server/roles.js';
import { checkStories } from '../server/ai/tasks/stories.js';

// Ajutine andmebaas ja võlts-AI: arendaja data/app.db faili ei puututa ja võrku ei saadeta midagi.
// NB: need testid kontrollivad struktuuri (kinnitatud rollid, vorming, numeratsioon, peamise rolli lood
// alguses). Seda, kas lood on sisuliselt loogilises töövoo järjekorras, kontrollitakse brauseris.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const ROLES = ['Potentsiaalne liige', 'Administraator'];

const story = (role, rolePhrase, want, soThat, size = 'M', touchesView = true) => ({ role, rolePhrase, want, soThat, size, touchesView });
const PROPOSAL = {
  message: 'Pakun järgmised lood.',
  primaryRole: 'Potentsiaalne liige',
  stories: [
    story('Potentsiaalne liige', 'Potentsiaalse liikmena', 'näha treeningute tunniplaani', 'saaksin hinnata, kas treeningud sobivad'),
    story('Potentsiaalne liige', 'Potentsiaalse liikmena', 'näha liikmepakette ja nende hindu', 'saaksin valida endale sobiva paketi', 'S'),
    story('Potentsiaalne liige', 'Potentsiaalse liikmena', 'registreeruda valitud paketiga', 'saaksin klubi liikmeks', 'L'),
    story('Potentsiaalne liige', 'Potentsiaalse liikmena', 'tasuda liikmetasu veebis', 'mu liikmesus hakkaks kehtima', 'L'),
    story('Potentsiaalne liige', 'Potentsiaalse liikmena', 'saada makse kinnituse', 'oleksin kindel, et liikmesus on aktiivne', 'S'),
    story('Administraator', 'Administraatorina', 'lisada uue paketi', 'hinnakiri oleks ajakohane', 'M', true),
  ],
};
const clone = () => structuredClone(PROPOSAL);

const aiOk = (data) => () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(data) } }], usage: { completion_tokens: 300 } }), { status: 200 });
const aiStatus = (status, headers = {}) => () => new Response(`teenuse viga ${FAKE_TOKEN}`, { status, headers });

let dir, db, projectId, otherProjectId, server, base, ai;

function fakeAi(opts = {}) {
  const queue = [];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const next = queue.shift();
    if (!next) throw new Error('võlts-AI-l pole vastust');
    return next(init);
  };
  return { client: createAiClient({ token: FAKE_TOKEN, model: 'Qwen3.8-27B', fetchImpl, ...opts }), calls, push: (...r) => queue.push(...r) };
}

async function startServer(aiClient) {
  server = createApp({ db, ai: aiClient }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}
async function stopServer() {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-stories-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine projekt') RETURNING id").get().id;
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', replyTo: idea.id, content: { message: 'Selge.', summary: 'Liikmeks astumine käib veebis.' } });
  replaceRoles(db, projectId, [{ name: ROLES[0], source: 'ai' }, { name: ROLES[1], source: 'manual' }]);
  ai = fakeAi();
  await startServer(ai.client);
});
afterEach(async () => {
  await stopServer();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (pid, path = '') => `${base}/${pid}/stories${path}`;
const post = (pid, path, body) => fetch(url(pid, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getState = async (pid = projectId) => (await fetch(url(pid))).json();
const storyRows = () => db.prepare('SELECT position, role, role_phrase, want, so_that, size, status, origin FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => ({ ...r }));
const proposalRows = () => db.prepare("SELECT id, status FROM ai_proposals WHERE kind = 'stories' ORDER BY created_at, rowid").all().map((r) => ({ ...r }));

async function propose(data = PROPOSAL) {
  ai.push(aiOk(data));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 200);
  return (await res.json()).proposal;
}
// Brauseri lisamise päringu kuju: ettepaneku lood koos järjekorranumbriga.
const asApply = (proposal, indexes) => indexes.map((i) => {
  const { role, rolePhrase, want, soThat, size } = proposal.stories[i];
  return { index: i, role, rolePhrase, want, soThat, size };
});

// --- Eeltingimus ja päring ---

test('kinnitatud rollideta annab "Paku lugusid" 409 ja AI-d ei kutsuta', async () => {
  const res = await post(otherProjectId, '/propose');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'roles_not_confirmed');
  assert.equal(ai.calls.length, 0);
});

test('päringu skeemis on rolli lubatud väärtused täpselt kinnitatud rollid', async () => {
  await propose();
  const schema = ai.calls[0].response_format.json_schema.schema;
  assert.deepEqual(schema.properties.primaryRole.enum, ROLES);
  assert.deepEqual(schema.properties.stories.items.properties.role.enum, ROLES);
  assert.equal(schema.properties.stories.minItems, 5);
  assert.deepEqual(ai.calls[0].chat_template_kwargs, { enable_thinking: false });
});

test('prompt sisaldab kinnitatud rolle, kokkuvõtet, "et saaksin" näidet ja ringja kasu keeldu', async () => {
  await propose();
  const prompt = ai.calls[0].messages.find((m) => m.role === 'user').content;
  assert.match(prompt, /Kinnitatud rollid: Potentsiaalne liige; Administraator/);
  assert.match(prompt, /Liikmeks astumine käib veebis\./);
  assert.match(prompt, /et saaksin valida endale sobiva paketi/);
  assert.match(prompt, /Kasu ei tohi korrata tegevust/);
});

test('ettepanek salvestub olekuga pending, pealkirjad on koostatud ja backlog jääb tühjaks', async () => {
  const proposal = await propose();
  assert.equal(proposal.primaryRole, 'Potentsiaalne liige');
  assert.deepEqual(proposal.stories.map((s) => s.index), [0, 1, 2, 3, 4, 5]);
  assert.equal(proposal.stories[1].title, 'Potentsiaalse liikmena soovin näha liikmepakette ja nende hindu, et saaksin valida endale sobiva paketi.');
  assert.equal(getProposal(db, proposal.id).status, 'pending');
  assert.deepEqual(storyRows(), []);
  assert.deepEqual((await getState()).stories, []);
});

// --- Kinnitamata rollid ja muud reeglid ---

test('AI vastus kinnitamata rolliga lükatakse tagasi: kordus, siis 502 ja midagi ei salvestata', async () => {
  const bad = clone();
  bad.stories[5].role = 'Treener'; // võlts-AI eirab skeemi; server peab selle ise tuvastama
  ai.push(aiOk(bad), aiOk(bad));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, 'invalid_response');
  assert.equal(ai.calls.length, 2);
  assert.deepEqual(proposalRows(), []);
  assert.deepEqual(storyRows(), []);
});

test('kinnitamata peamine roll lükatakse samuti tagasi', async () => {
  const bad = clone();
  bad.primaryRole = 'Külastaja';
  ai.push(aiOk(bad), aiOk(PROPOSAL));
  assert.equal((await post(projectId, '/propose')).status, 200);
  assert.equal(ai.calls.length, 2);
});

test('serveri teine kaitsekiht (checkStories) tuvastab kinnitamata rolli ka skeemist sõltumata', () => {
  assert.deepEqual(checkStories(PROPOSAL, ROLES), []);
  const bad = clone();
  bad.stories[5].role = 'Treener';
  bad.primaryRole = 'Külastaja';
  const problems = checkStories(bad, ROLES);
  assert.ok(problems.includes('lugu 6: kinnitamata roll'), problems.join('; '));
  assert.ok(problems.includes('peamine roll ei ole kinnitatud'), problems.join('; '));
  // Rolli võrdlus on tõstutundetu (ka täpitähtedega), nagu L05 rollide puhul.
  const lower = clone();
  lower.stories[0].role = 'potentsiaalne liige';
  assert.deepEqual(checkStories(lower, ROLES), []);
});

test('vorminguvead AI vastuses (topelt-"soovin", topelt-"et", vale kääne) põhjustavad korduse', async () => {
  for (const [field, value] of [['want', 'soovin näha hindu'], ['soThat', 'et saaksin valida'], ['rolePhrase', 'Potentsiaalne liige']]) {
    const bad = clone();
    bad.stories[1][field] = value;
    ai.push(aiOk(bad), aiOk(PROPOSAL));
    const res = await post(projectId, '/propose');
    assert.equal(res.status, 200, field);
    await post(projectId, '/reject', { proposalId: (await res.json()).proposal.id });
  }
  assert.equal(ai.calls.length, 6);
});

test('peamise rolli lood peavad olema järjest loendi alguses', async () => {
  const bad = clone();
  bad.stories = [bad.stories[5], ...bad.stories.slice(0, 5)]; // administraator esimesena
  const mixed = clone();
  [mixed.stories[2], mixed.stories[5]] = [mixed.stories[5], mixed.stories[2]]; // administraator keskel
  ai.push(aiOk(bad), aiOk(mixed));
  assert.equal((await post(projectId, '/propose')).status, 502);
  assert.equal(ai.calls.length, 2);
});

test('alla viie loo põhjustab korduse', async () => {
  const few = clone();
  few.stories = few.stories.slice(0, 4);
  ai.push(aiOk(few), aiOk(PROPOSAL));
  assert.equal((await post(projectId, '/propose')).status, 200);
  assert.equal(ai.calls.length, 2);
});

test('tegevuse "et"-kõrvallause annab ettepanekus hoiatuse, mitte tagasilükkamise', async () => {
  const warn = clone();
  warn.stories[0].want = 'näha tunniplaani, et valida aeg';
  const proposal = await propose(warn);
  assert.equal(ai.calls.length, 1);
  assert.equal(proposal.stories[0].warnings.length, 1);
  assert.deepEqual(proposal.stories[1].warnings, []);
});

// --- Korduv küsimine ja "Paku teistsuguseid" ---

test('korduv "Paku lugusid" (nt pärast värskendamist) tagastab sama ettepaneku ilma AI-kutseta', async () => {
  const first = await propose();
  const res = await post(projectId, '/propose');
  assert.equal((await res.json()).proposal.id, first.id);
  assert.equal(ai.calls.length, 1);
});

test('"Paku teistsuguseid" edu: vana lükatakse tagasi ja uus salvestatakse', async () => {
  const first = await propose();
  const other = clone();
  other.stories[0].want = 'lugeda klubi tutvustust';
  ai.push(aiOk(other));
  const res = await post(projectId, '/propose', { replace: first.id });
  assert.equal(res.status, 200);
  const second = (await res.json()).proposal;
  assert.notEqual(second.id, first.id);
  assert.equal(second.stories[0].want, 'lugeda klubi tutvustust');
  assert.deepEqual(proposalRows().map((p) => [p.id, p.status]), [[first.id, 'rejected'], [second.id, 'pending']]);
});

test('"Paku teistsuguseid" AI vea korral jätab senise ettepaneku pending ja kasutatavaks', async () => {
  const first = await propose();
  for (const failure of [aiStatus(500), aiStatus(429, { 'retry-after': '20' })]) {
    ai.push(failure);
    const res = await post(projectId, '/propose', { replace: first.id });
    assert.ok(res.status >= 429);
  }
  assert.deepEqual(proposalRows(), [{ id: first.id, status: 'pending' }]);
  assert.equal((await getState()).proposal.id, first.id);
  // Senise ettepaneku saab endiselt backlog'i lisada.
  assert.equal((await post(projectId, '/apply', { proposalId: first.id, stories: asApply(first, [0, 1]) })).status, 200);
  assert.equal(storyRows().length, 2);
});

test('"Paku teistsuguseid" kahe vigase AI vastuse korral jätab senise ettepaneku alles', async () => {
  const first = await propose();
  const bad = clone();
  bad.stories[0].role = 'Treener';
  ai.push(aiOk(bad), aiOk(bad));
  assert.equal((await post(projectId, '/propose', { replace: first.id })).status, 502);
  assert.deepEqual(proposalRows(), [{ id: first.id, status: 'pending' }]);
});

test('"Paku teistsuguseid" ajalimiidi korral jätab senise ettepaneku alles', async () => {
  const first = await propose();
  await stopServer();
  ai = fakeAi({ timeoutMs: 50 });
  await startServer(ai.client);
  ai.push((init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
  assert.equal((await post(projectId, '/propose', { replace: first.id })).status, 504);
  assert.deepEqual(proposalRows(), [{ id: first.id, status: 'pending' }]);
});

test('"Paku teistsuguseid", kui vana on juba backlog’i lisatud: 409 ja uut ettepanekut ei salvestata', async () => {
  const first = await propose();
  await post(projectId, '/apply', { proposalId: first.id, stories: asApply(first, [0]) });
  const res = await post(projectId, '/propose', { replace: first.id });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'stale_proposal');
  assert.equal(ai.calls.length, 1);
  assert.deepEqual(proposalRows(), [{ id: first.id, status: 'applied' }]);
});

// --- Lisamine backlog'i ---

test('"Lisa valitud" lisab ainult valitud lood happy path’i järjekorras, staatusega idee', async () => {
  const proposal = await propose();
  const res = await post(projectId, '/apply', { proposalId: proposal.id, stories: asApply(proposal, [3, 0, 1]) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).proposal, null);
  assert.deepEqual(storyRows().map((r) => [r.position, r.want, r.size, r.status, r.origin]), [
    [1, 'näha treeningute tunniplaani', 'M', 'idee', 'ai'],
    [2, 'näha liikmepakette ja nende hindu', 'S', 'idee', 'ai'],
    [3, 'tasuda liikmetasu veebis', 'L', 'idee', 'ai'],
  ]);
  assert.equal(getProposal(db, proposal.id).status, 'applied');
});

test('muudetud loo päritolu on ai_edited; päritolu määrab server, mitte brauser', async () => {
  const proposal = await propose();
  const stories = asApply(proposal, [0, 1, 5]);
  stories[1].want = 'näha kõiki liikmepakette';
  stories[2].role = 'Potentsiaalne liige';
  stories[2].rolePhrase = 'Potentsiaalse liikmena';
  stories.forEach((s) => { s.edited = false; s.origin = 'ai'; }); // brauseri väidet ignoreeritakse
  assert.equal((await post(projectId, '/apply', { proposalId: proposal.id, stories })).status, 200);
  assert.deepEqual(storyRows().map((r) => r.origin), ['ai', 'ai_edited', 'ai_edited']);
});

test('lisamisel lükatakse tagasi kinnitamata roll, vorminguvead, vale suurus ja vigased järjekorranumbrid', async () => {
  const proposal = await propose();
  const base = () => asApply(proposal, [0, 1]);
  const cases = [
    (s) => { s[0].role = 'Treener'; },
    (s) => { s[0].want = 'soovin näha tunniplaani'; },
    (s) => { s[0].soThat = 'et saaksin hinnata'; },
    (s) => { s[0].rolePhrase = 'Potentsiaalne liige'; },
    (s) => { s[0].size = 'XL'; },
    (s) => { s[0].index = 99; },
    (s) => { s[1].index = 0; },
  ];
  for (const mutate of cases) {
    const stories = base();
    mutate(stories);
    assert.equal((await post(projectId, '/apply', { proposalId: proposal.id, stories })).status, 400, mutate.toString());
  }
  assert.equal((await post(projectId, '/apply', { proposalId: proposal.id, stories: [] })).status, 400);
  assert.deepEqual(storyRows(), []);
  assert.equal(getProposal(db, proposal.id).status, 'pending');
});

test('kaks samaaegset lisamise HTTP-päringut: üks 200, teine 409 ja lood lisatakse üks kord', async () => {
  const proposal = await propose();
  const body = { proposalId: proposal.id, stories: asApply(proposal, [0, 1, 2, 3, 4, 5]) };
  const [a, b] = await Promise.all([post(projectId, '/apply', body), post(projectId, '/apply', body)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await (a.status === 409 ? a : b).json()).code, 'already_decided');
  assert.equal(storyRows().length, 6);
  assert.equal(db.prepare('SELECT count(*) n FROM stories').get().n, 6);
});

test('uued lood lisatakse olemasolevate lõppu', async () => {
  const first = await propose();
  await post(projectId, '/apply', { proposalId: first.id, stories: asApply(first, [0, 1]) });
  const second = await propose();
  await post(projectId, '/apply', { proposalId: second.id, stories: asApply(second, [2]) });
  assert.deepEqual(storyRows().map((r) => r.position), [1, 2, 3]);
});

test('"Loobu": ettepanek lükatakse tagasi ja backlog’i ei lisata midagi', async () => {
  const proposal = await propose();
  assert.equal((await post(projectId, '/reject', { proposalId: proposal.id })).status, 200);
  assert.equal((await post(projectId, '/apply', { proposalId: proposal.id, stories: asApply(proposal, [0]) })).status, 409);
  assert.deepEqual(storyRows(), []);
});

test('teise projekti ettepanek annab 404', async () => {
  const proposal = await propose();
  replaceRoles(db, otherProjectId, [{ name: 'Administraator', source: 'manual' }]);
  assert.equal((await post(otherProjectId, '/apply', { proposalId: proposal.id, stories: asApply(proposal, [5]) })).status, 404);
  assert.equal(getProposal(db, proposal.id).status, 'pending');
});

// --- Vead, kontekst, lekked ---

test('AI teenuse vea või 429 korral ettepanekut ei salvestata', async () => {
  ai.push(aiStatus(500));
  assert.equal((await post(projectId, '/propose')).status, 502);
  ai.push(aiStatus(429, { 'retry-after': '30' }));
  const r429 = await post(projectId, '/propose');
  assert.equal(r429.status, 429);
  assert.equal((await r429.json()).retryAfterSeconds, 30);
  assert.deepEqual(proposalRows(), []);
});

test('AI kontekstis on backlog’i lood, mitte pooleli ettepaneku lood', async () => {
  const proposal = await propose();
  assert.deepEqual(buildProjectContext(db, projectId).stories, []);
  await post(projectId, '/apply', { proposalId: proposal.id, stories: asApply(proposal, [1]) });
  assert.deepEqual(buildProjectContext(db, projectId).stories, [
    { role: 'Potentsiaalne liige', title: 'Potentsiaalse liikmena soovin näha liikmepakette ja nende hindu, et saaksin valida endale sobiva paketi.' },
  ]);
});

test('token ei jõua ühtegi vastusesse', async () => {
  ai.push(aiStatus(500), aiStatus(401), aiOk(PROPOSAL));
  const bodies = [];
  for (let i = 0; i < 3; i++) bodies.push(await (await post(projectId, '/propose')).text());
  bodies.push(await (await fetch(url(projectId))).text());
  for (const b of bodies) assert.ok(!b.includes(FAKE_TOKEN));
});
