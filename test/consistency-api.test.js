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

// Kooskõla server (L23): AI viited, käsitsi sidumine ja kasutaja ülevaatuse kinnitus. Ajutine andmebaas ja võlts-AI.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const s = (want, soThat) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat, size: 'M', origin: 'ai', touchesView: true });
const MOCKUP_V1 = {
  title: 'Taotlus',
  components: [
    { type: 'heading', text: 'Liikmeks astumise taotlus', items: [] },
    { type: 'input', text: 'E-posti aadress', items: [] },
    { type: 'button', text: 'Esita taotlus', items: [] },
    { type: 'button', text: 'Salvesta', items: [] },
  ],
};
const CRITERIA = [
  { text: "Kasutaja näeb sisestusvälja 'E-posti aadress'.", origin: 'ai' },
  { text: "Kasutaja näeb nuppu 'Esita taotlus'.", origin: 'ai' },
  { text: "Pärast nupu 'Esita taotlus' vajutamist kuvatakse kinnitusteade.", origin: 'ai_edited' },
];

let dir, db, projectId, otherProjectId, target, other, server, base, ai;

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
const aiOk = (data) => () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(data) } }], usage: { completion_tokens: 300 } }), { status: 200 });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-consistency-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', replyTo: idea.id, content: { message: 'Selge.', summary: 'Liikmeks astutakse veebis.' } });
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  appendStories(db, projectId, [s('esitada liikmeks astumise taotluse', 'saaksin liituda'), s('näha hindu', 'saaksin valida')], null);
  [target, other] = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  setFocusStory(db, projectId, target);
  appendCriteria(db, target, CRITERIA);
  saveMockup(db, target, MOCKUP_V1);
  appendCriteria(db, other, [{ text: 'Hinnad on eurodes.', origin: 'ai' }]);
  ai = fakeAi();
  server = createApp({ db, ai: ai.client }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (path = '') => `${base}/${projectId}/criteria${path}`;
const post = (path, body, pid = projectId) => fetch(`${base}/${pid}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const state = async () => (await fetch(url())).json();
const dump = () => ({
  stories: db.prepare('SELECT * FROM stories ORDER BY id').all().map((r) => ({ ...r })),
  criteria: db.prepare('SELECT * FROM criteria ORDER BY id').all().map((r) => ({ ...r })),
  mockups: db.prepare('SELECT * FROM mockups ORDER BY id').all().map((r) => ({ ...r })),
});
const criterionIds = () => db.prepare('SELECT id FROM criteria WHERE story_id = ? ORDER BY position').all(target).map((r) => r.id);

test('vana vastuolu on näha: K3 "pole vastet" ja nupp "Salvesta" põhjendamata; lugemine ei muuda midagi', async () => {
  const before = dump();
  const s1 = await state();
  assert.deepEqual(s1.consistency.criteria[2].warnings.map((w) => w.code), ['no_match']);
  assert.deepEqual(s1.consistency.components[3].warnings.map((w) => w.code), ['unjustified']);
  assert.equal(s1.consistency.review, null);
  assert.deepEqual(dump(), before);
});

test('kasutaja sidumine muudab ainult selle kriteeriumi viidet; teised lood ja kriteeriumid jäävad samaks', async () => {
  const before = dump();
  const [, , k3] = criterionIds();
  const res = await post('criteria/link', { criterionId: k3, kind: 'element', index: 3 });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.consistency.criteria[2].link, { kind: 'element', index: 3, label: '4. nupp: Salvesta', source: 'user' });
  const after = dump();
  assert.deepEqual(after.stories, before.stories); // ka updated_at
  assert.deepEqual(after.mockups, before.mockups);
  assert.deepEqual(after.criteria.filter((c) => c.id !== k3), before.criteria.filter((c) => c.id !== k3));
  assert.deepEqual(after.criteria.find((c) => c.id === k3).text, before.criteria.find((c) => c.id === k3).text);
});

test('vigane sidumine: olematu element, teise projekti kriteerium või tundmatu liik ei muuda midagi', async () => {
  const before = dump();
  const [k1] = criterionIds();
  const otherCriterion = db.prepare('SELECT id FROM criteria WHERE story_id = ?').get(other).id;
  assert.equal((await post('criteria/link', { criterionId: k1, kind: 'element', index: 9 })).status, 400);
  assert.equal((await post('criteria/link', { criterionId: k1, kind: 'magic' })).status, 400);
  assert.equal((await post('criteria/link', { criterionId: otherCriterion, kind: 'no_view' }, otherProjectId)).status, 404);
  assert.deepEqual(dump(), before);
});

test('ülevaatuse kinnitus kehtib sellele seisule ja aegub, kui viide muutub; aegunud sõrmejäljega kinnitust ei salvestata', async () => {
  const s1 = await state();
  const ok = await post('criteria/review', { storyId: target, fingerprint: s1.consistency.fingerprint });
  assert.equal(ok.status, 200);
  const reviewed = (await ok.json()).consistency.review;
  assert.equal(reviewed.valid, true);
  assert.equal(reviewed.mockupVersion, 1);
  const [k1] = criterionIds();
  await post('criteria/link', { criterionId: k1, kind: 'element', index: 1 });
  const s2 = await state();
  assert.equal(s2.consistency.review.valid, false);
  const stale = await post('criteria/review', { storyId: target, fingerprint: s1.consistency.fingerprint });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'stale_review');
});

test('kliendi täpsustuse rakendamine (uus mockup’i versioon) muudab ülevaatuse aegunuks; uue versiooni saab üle vaadata', async () => {
  const s1 = await state();
  await post('criteria/review', { storyId: target, fingerprint: s1.consistency.fingerprint });
  const v2 = { title: 'Taotlus', components: [MOCKUP_V1.components[0], MOCKUP_V1.components[1], MOCKUP_V1.components[2], { type: 'text', text: 'Kinnitusteade: taotlus on esitatud', items: [] }] };
  ai.push(aiOk({
    message: 'Eemaldasin nupu Salvesta ja lisasin kinnitusteate.',
    story: { want: 'esitada liikmeks astumise taotluse', soThat: 'saaksin liituda' },
    criteria: [{ from: 0, text: CRITERIA[0].text, ref: 1 }, { from: 1, text: CRITERIA[1].text, ref: 2 }, { from: 2, text: CRITERIA[2].text, ref: 3 }],
    mockup: v2,
    otherStories: [],
  }));
  const proposed = await post('refinement/propose', { storyId: target, clarification: 'Eemalda nupp Salvesta; pärast esitamist kuvatakse kinnitusteade.' });
  assert.equal(proposed.status, 200);
  const p = (await proposed.json()).proposal;
  assert.equal(p.preview.consistency.warningCount, 0);
  assert.deepEqual(p.preview.consistency.criteria[2].link.label, '4. tekst: Kinnitusteade: taotlus on esitatud');
  assert.equal((await post('refinement/apply', { proposalId: p.id, storyId: target })).status, 200);

  const s2 = await state();
  assert.equal(s2.mockup.version, 2);
  assert.equal(s2.consistency.review.valid, false); // varasem kinnitus käis versiooni 1 kohta
  assert.equal(s2.consistency.warningCount, 0);
  assert.deepEqual(s2.consistency.criteria.map((c) => c.link.source), ['ai', 'ai', 'ai']);
  const again = await post('criteria/review', { storyId: target, fingerprint: s2.consistency.fingerprint });
  assert.equal(again.status, 200);
  assert.deepEqual((await again.json()).consistency.review.mockupVersion, 2);
});

test('AI viide olematule mockup’i komponendile ei lükka vastust tagasi: kriteerium jääb ilma seoseta ja hoiatus on nähtav', async () => {
  db.prepare('DELETE FROM criteria WHERE story_id = ?').run(target);
  db.prepare('DELETE FROM mockups WHERE story_id = ?').run(target);
  ai.push(aiOk({ message: 'x', criteria: [{ text: 'Kuvatakse tekst Abc.', ref: 7 }, { text: 'Kuvatakse tekst Bcd.', ref: 1 }, { text: 'Kuvatakse tekst Cde.', ref: -1 }], mockup: { title: 'X', components: [{ type: 'text', text: 'Abc', items: [] }, { type: 'text', text: 'Bcd', items: [] }] } }));
  const res = await post('criteria/propose', {});
  assert.equal(res.status, 200);
  assert.equal(ai.calls.length, 1); // kordust ei tehtud
  const proposed = await res.json();
  assert.deepEqual(proposed.criteriaProposal.criteria.map((c) => c.ref), [null, 1, -1]);
  await post('criteria/mockup/accept', { proposalId: proposed.mockupProposal.id });
  await post('criteria/apply', { proposalId: proposed.criteriaProposal.id, criteria: [{ index: 0, text: 'Kuvatakse tekst Abc.' }, { index: 1, text: 'Kuvatakse tekst Bcd.' }] });
  const s1 = await state();
  assert.equal(s1.consistency.criteria[0].link, null); // seos puudub
  assert.equal(s1.consistency.criteria[1].link.label, '2. tekst: Bcd');
});

test('AI viited salvestuvad koos kriteeriumidega ja saavad versiooni mockup’i kinnitamisel', async () => {
  db.prepare('DELETE FROM criteria WHERE story_id = ?').run(target);
  db.prepare('DELETE FROM mockups WHERE story_id = ?').run(target);
  ai.push(aiOk({ message: 'x', criteria: [{ text: "Kasutaja näeb nuppu 'Esita taotlus'.", ref: 1 }, { text: 'Taotluse andmed salvestatakse.', ref: -1 }, { text: "Kuvatakse pealkiri 'Taotlus'.", ref: 0 }], mockup: { title: 'Taotlus', components: [{ type: 'heading', text: 'Taotlus', items: [] }, { type: 'button', text: 'Esita taotlus', items: [] }] } }));
  const proposed = await (await post('criteria/propose', {})).json();
  await post('criteria/apply', { proposalId: proposed.criteriaProposal.id, criteria: [{ index: 0, text: "Kasutaja näeb nuppu 'Esita taotlus'." }, { index: 1, text: 'Taotluse andmed salvestatakse.' }] });
  let refs = db.prepare('SELECT ref_kind, ref_index, ref_version, ref_source FROM criteria WHERE story_id = ? ORDER BY position').all(target).map((r) => ({ ...r }));
  assert.deepEqual(refs, [
    { ref_kind: 'element', ref_index: 1, ref_version: null, ref_source: 'ai' },
    { ref_kind: 'no_view', ref_index: null, ref_version: null, ref_source: 'ai' },
  ]);
  await post('criteria/mockup/accept', { proposalId: proposed.mockupProposal.id });
  refs = db.prepare('SELECT ref_version FROM criteria WHERE story_id = ? ORDER BY position').all(target).map((r) => r.ref_version);
  assert.deepEqual(refs, [1, null]);
  const s1 = await state();
  assert.equal(s1.consistency.criteria[0].link.label, '2. nupp: Esita taotlus');
  // AI hinnang "ei puuduta vaadet" ei kustuta hoiatust
  assert.deepEqual(s1.consistency.criteria[1].warnings.map((w) => w.code), ['no_match']);
});
