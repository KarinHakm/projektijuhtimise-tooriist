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
import { replaceRoles } from '../server/roles.js';
import { appendStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';

// Kriteeriumid ja mockup (L09, L10). Ajutine andmebaas ja võlts-AI: data/app.db faili ei puututa.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const s = (want, soThat) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat, size: 'M', origin: 'ai', touchesView: true });
const MOCKUP = {
  title: 'Paketid',
  components: [
    { type: 'heading', text: 'Liikmepaketid', items: [] },
    { type: 'list', text: 'Paketid', items: ['Põhipakett 30 €', 'Täispakett 50 €'] },
    { type: 'text', text: '<script>alert(1)</script> sh km', items: [] },
    { type: 'button', text: 'Vali pakett', items: [] },
  ],
};
const AI_DATA = {
  message: 'Pakun kriteeriumid ja mockup’i.',
  criteria: [
    { text: 'Paketi juures on näha selle hind eurodes.', ref: 'Paketid' },
    { text: 'Paketi hinna juures on märge, kas hind sisaldab käibemaksu.', ref: '<script>alert(1)</script> sh km' },
    { text: 'Iga paketi juures on nupp "Vali pakett".', ref: 'Vali pakett' },
    { text: 'Paketid on kuvatud hinna järgi kasvavas järjekorras.', ref: '' },
  ],
  mockup: MOCKUP,
};

let dir, db, projectId, otherProjectId, storyId, otherStoryId, server, base, ai;


beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-criteria-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', replyTo: idea.id, content: { message: 'Selge.', summary: 'Liikmetasu makstakse veebis.' } });
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  appendStories(db, projectId, [s('näha liikmepakette ja hindu', 'saaksin valida paketi'), s('registreeruda liikmeks', 'saaksin osaleda')], null);
  storyId = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').get(projectId).id;
  setFocusStory(db, projectId, storyId);
  appendStories(db, otherProjectId, [s('teise projekti lugu', 'midagi')], null);
  otherStoryId = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherProjectId).id;
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

const url = (pid, path = '') => `${base}/${pid}/criteria${path}`;
const post = (pid, path, body) => fetch(url(pid, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const saved = () => db.prepare('SELECT text, origin FROM criteria WHERE story_id = ? ORDER BY position').all(storyId).map((r) => ({ ...r }));
const mockups = () => db.prepare('SELECT story_id AS storyId, version FROM mockups').all().map((r) => ({ ...r }));
const statuses = (kind) => db.prepare('SELECT status FROM ai_proposals WHERE kind = ? ORDER BY rowid').all(kind).map((r) => r.status);

async function propose(data = AI_DATA) {
  ai.push(aiOk(data));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 200);
  return res.json();
}

test('ettepanek loob kaks eraldi ootel ettepanekut; enne kinnitamist ei salvestata midagi', async () => {
  const state = await propose();
  assert.equal(state.story.id, storyId);
  assert.equal(state.criteriaProposal.criteria.length, 4);
  assert.equal(state.mockupProposal.mockup.title, 'Paketid');
  assert.deepEqual(saved(), []);
  assert.deepEqual(mockups(), []);
  assert.deepEqual(statuses('criteria'), ['pending']);
  assert.deepEqual(statuses('mockup'), ['pending']);
});

test('AI päringus on valitud lugu ja kriteeriumide reeglid; skeem lubab ainult kokkulepitud komponenditüüpe', async () => {
  await propose();
  const [call] = ai.calls;
  const prompt = call.messages.map((m) => m.content).join('\n');
  assert.match(prompt, /Valitud kasutajalugu: Külastajana soovin näha liikmepakette ja hindu/);
  assert.match(prompt, /jah või ei/);
  const types = call.schema.properties.mockup.properties.components.items.properties.type.enum;
  assert.deepEqual(types, ['heading', 'text', 'button', 'input', 'list', 'image', 'card']);
});

test('tundmatu komponenditüüp lükatakse tagasi: kordus, siis 502 ja midagi ei salvestata', async () => {
  const bad = { ...AI_DATA, mockup: { title: 'X', components: [{ type: 'script', text: 'alert(1)', items: [] }, { type: 'text', text: 'a', items: [] }] } };
  ai.push(aiOk(bad), aiOk(bad));
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 502);
  assert.equal(ai.calls.length, 2);
  assert.deepEqual(statuses('criteria'), []);
});

test('salvestatakse ainult saadetud kriteeriumid; päritolu määrab server (ai, ai_edited, manual)', async () => {
  const state = await propose();
  const res = await post(projectId, '/apply', {
    proposalId: state.criteriaProposal.id,
    criteria: [
      { index: 0, text: AI_DATA.criteria[0].text },
      { index: 1, text: 'Paketi hinna juures on märge „sh km“.' },
      { text: 'Pakettide all on kontaktinfo.' },
    ],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(saved(), [
    { text: AI_DATA.criteria[0].text, origin: 'ai' },
    { text: 'Paketi hinna juures on märge „sh km“.', origin: 'ai_edited' },
    { text: 'Pakettide all on kontaktinfo.', origin: 'manual' },
  ]);
  // Eemaldatud kriteeriume (indeksid 2 ja 3) brauser ei saatnud, seega neid ei ole.
  assert.ok(!saved().some((c) => c.text === AI_DATA.criteria[2].text || c.text === AI_DATA.criteria[3].text));
  assert.deepEqual(statuses('criteria'), ['applied']);
});

test('kriteeriumide salvestamine ei kinnita mockup’i', async () => {
  const state = await propose();
  await post(projectId, '/apply', { proposalId: state.criteriaProposal.id, criteria: [{ index: 0, text: AI_DATA.criteria[0].text }] });
  const after = await (await fetch(url(projectId))).json();
  assert.deepEqual(mockups(), []);
  assert.deepEqual(statuses('mockup'), ['pending']);
  assert.ok(after.mockupProposal);
  assert.equal(after.mockup, null);
});

test('[Kinnita mockup] seob mockup’i looga versioonina 1; teine kinnitus annab 409', async () => {
  const state = await propose();
  const res = await post(projectId, '/mockup/accept', { proposalId: state.mockupProposal.id });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.mockup.version, 1);
  assert.deepEqual(mockups(), [{ storyId, version: 1 }]);
  assert.equal((await post(projectId, '/mockup/accept', { proposalId: state.mockupProposal.id })).status, 409);
});

test('[Loobu] ei salvesta mockup’i', async () => {
  const state = await propose();
  const res = await post(projectId, '/mockup/reject', { proposalId: state.mockupProposal.id });
  assert.equal(res.status, 200);
  assert.deepEqual(mockups(), []);
  assert.deepEqual(statuses('mockup'), ['rejected']);
});

test('[Paku uus] asendab mockup’i ettepaneku alles pärast edukat AI vastust', async () => {
  const state = await propose();
  ai.push(aiFail('unavailable'));
  assert.equal((await post(projectId, '/mockup/propose')).status, 502);
  const still = await (await fetch(url(projectId))).json();
  assert.equal(still.mockupProposal.id, state.mockupProposal.id);
  ai.push(aiOk({ message: 'Uus.', mockup: { ...MOCKUP, title: 'Paketid v2' } }));
  const res = await post(projectId, '/mockup/propose');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).mockupProposal.mockup.title, 'Paketid v2');
  assert.deepEqual(statuses('mockup'), ['rejected', 'pending']);
});

test('mockup’i tekst salvestub tavatekstina ("<script>" jääb tekstiks, HTML-i ei looda)', async () => {
  const state = await propose();
  await post(projectId, '/mockup/accept', { proposalId: state.mockupProposal.id });
  const spec = JSON.parse(db.prepare('SELECT spec FROM mockups').get().spec);
  assert.equal(spec.components[2].text, '<script>alert(1)</script> sh km');
});

test('vigane salvestus: tühi valik, vale indeks, korduv tekst ja tühi tekst annavad 400 ning midagi ei salvestata', async () => {
  const state = await propose();
  const id = state.criteriaProposal.id;
  for (const criteria of [[], [{ index: 9, text: 'x on olemas' }], [{ text: 'Sama.' }, { text: 'sama.' }], [{ text: '   ' }]]) {
    const res = await post(projectId, '/apply', { proposalId: id, criteria });
    assert.equal(res.status, 400, JSON.stringify(criteria));
  }
  assert.deepEqual(saved(), []);
  assert.deepEqual(statuses('criteria'), ['pending']);
});

test('ilma alustamise loota annab ettepanek 409 ja AI-d ei kutsuta', async () => {
  db.prepare('UPDATE projects SET focus_story_id = NULL WHERE id = ?').run(projectId);
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'no_focus');
  assert.equal(ai.calls.length, 0);
});

test('teise projekti ettepanekut ei saa selles projektis salvestada', async () => {
  const state = await propose();
  const res = await post(otherProjectId, '/apply', { proposalId: state.criteriaProposal.id, criteria: [{ index: 0, text: AI_DATA.criteria[0].text }] });
  assert.equal(res.status, 404);
  assert.deepEqual(saved(), []);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM criteria WHERE story_id = ?').get(otherStoryId).n, 0);
});

test('kui lool on juba kriteeriumid, uut ettepanekut ei tehta (409) – neid muudab kliendi täpsustus', async () => {
  const state = await propose();
  await post(projectId, '/apply', { proposalId: state.criteriaProposal.id, criteria: [{ index: 0, text: AI_DATA.criteria[0].text }] });
  const res = await post(projectId, '/propose');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'already_has_criteria');
  assert.equal(ai.calls.length, 1);
});
