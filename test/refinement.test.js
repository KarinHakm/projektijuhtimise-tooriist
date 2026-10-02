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
import { appendCriteria, saveMockup } from '../server/criteria.js';

// Kliendi täpsustus (L11) ja ainult valitud loo muutmine (L12). Ajutine andmebaas ja võlts-AI.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const OLD = '2026-01-01T00:00:00.000Z';
const s = (want, soThat) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat, size: 'M', origin: 'ai', touchesView: true });
const MOCKUP_V1 = { title: 'Paketid', components: [{ type: 'heading', text: 'Paketid', items: [] }, { type: 'list', text: 'Hinnad', items: ['Põhipakett 30 €'] }, { type: 'input', text: 'Sünniaeg', items: [] }] };
const MOCKUP_V2 = { title: 'Paketid', components: [{ type: 'heading', text: 'Paketid', items: [] }, { type: 'list', text: 'Hinnad', items: ['Põhipakett 30 € sh km'] }, { type: 'text', text: 'Hinnad sisaldavad käibemaksu (sh km)', items: [] }] };

let dir, db, projectId, otherProjectId, target, other, otherProjStory, server, base, ai;


const refineData = (overrides = {}) => ({
  message: 'Lisasin käibemaksu märke.',
  story: { want: 'näha liikmepakette ja hindu koos käibemaksuga', soThat: 'saaksin valida paketi' },
  criteria: [
    { from: 0, text: 'Paketi juures on näha hind eurodes.', ref: 'Hinnad' },
    { from: 1, text: 'Paketi hinna juures on märge „sh km“.', ref: 'Hinnad' },
    { from: -1, text: 'Hinnakirja all on märge, et hinnad sisaldavad käibemaksu.', ref: 'Hinnad sisaldavad käibemaksu (sh km)' },
  ],
  mockup: MOCKUP_V2,
  otherStories: [{ storyId: other, suggestion: 'Registreerumise kinnituses võiks samuti olla märge „sh km“.' }],
  ...overrides,
});

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-refine-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'Spordiklubi tahab veebi.' } });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', replyTo: idea.id, content: { message: 'Selge.', summary: 'Liikmetasu makstakse veebis.' } });
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  appendStories(db, projectId, [s('näha liikmepakette ja hindu', 'saaksin valida paketi'), s('registreeruda liikmeks', 'saaksin osaleda')], null);
  [target, other] = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  appendStories(db, otherProjectId, [s('teise projekti lugu', 'midagi')], null);
  otherProjStory = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherProjectId).id;
  setFocusStory(db, projectId, target);
  appendCriteria(db, target, [{ text: 'Paketi juures on näha hind eurodes.', origin: 'ai' }, { text: 'Paketi juures on hind käsitsi kirjutatud.', origin: 'manual' }]);
  saveMockup(db, target, MOCKUP_V1);
  appendCriteria(db, other, [{ text: 'Registreerumisvormis on väli „E-post“.', origin: 'ai' }]);
  saveMockup(db, other, { title: 'Registreerumine', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'button', text: 'Registreeru', items: [] }] });
  db.prepare('UPDATE stories SET updated_at = ?').run(OLD);
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

const url = (pid, path = '') => `${base}/${pid}/refinement${path}`;
const post = (pid, path, body) => fetch(url(pid, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
// Kogu andmebaasi seis peale ai_proposals tabeli: sellega kontrollitakse, et midagi ei muutunud.
const dump = (where = '') => ({
  stories: db.prepare(`SELECT * FROM stories ${where} ORDER BY id`).all().map((r) => ({ ...r })),
  criteria: db.prepare('SELECT * FROM criteria ORDER BY id').all().map((r) => ({ ...r })),
  mockups: db.prepare('SELECT * FROM mockups ORDER BY id').all().map((r) => ({ ...r })),
  projects: db.prepare('SELECT * FROM projects ORDER BY id').all().map((r) => ({ ...r })),
});
const othersDump = () => ({
  stories: db.prepare('SELECT * FROM stories WHERE id <> ? ORDER BY id').all(target).map((r) => ({ ...r })),
  criteria: db.prepare('SELECT * FROM criteria WHERE story_id <> ? ORDER BY id').all(target).map((r) => ({ ...r })),
  mockups: db.prepare('SELECT * FROM mockups WHERE story_id <> ? ORDER BY id').all(target).map((r) => ({ ...r })),
});

async function propose(data = refineData(), storyId = target) {
  ai.push(aiOk(data));
  const res = await post(projectId, '/propose', { storyId, clarification: 'Paketi hinnas peab olema näha, kas see sisaldab käibemaksu.' });
  assert.equal(res.status, 200);
  return (await res.json()).proposal;
}

test('ettepanek jääb ootele ja midagi ei muutu; eelvaade arvutatakse koodis', async () => {
  const before = dump();
  const p = await propose();
  assert.deepEqual(dump(), before);
  assert.equal(p.preview.storyChanged, true);
  assert.deepEqual(p.preview.criteria.items.map((i) => i.status), ['unchanged', 'modified', 'added']);
  assert.deepEqual(p.preview.criteria.removed, []);
  assert.equal(p.preview.criteria.items[1].oldText, 'Paketi juures on hind käsitsi kirjutatud.');
  assert.deepEqual(p.preview.mockup.removed, [false, true, true]);
  assert.deepEqual(p.preview.mockup.added, [false, true, true]);
});

test('AI päringus on loo hetkeseis (ka käsitsi kriteerium), mockup, täpsustus ja teised lood ainult lugemiseks', async () => {
  await propose();
  const call = ai.calls[0];
  const prompt = call.messages.map((m) => m.content).join('\n');
  assert.match(prompt, /\[1\] Paketi juures on hind käsitsi kirjutatud\./);
  assert.match(prompt, /Sünniaeg/);
  assert.match(prompt, /Kliendi täpsustus: Paketi hinnas peab olema näha, kas see sisaldab käibemaksu\./);
  assert.match(prompt, /neid sa EI muuda/);
  assert.doesNotMatch(prompt, /teise projekti lugu/);
  assert.deepEqual(call.schema.properties.otherStories.items.properties.storyId.enum, [other]);
});

test('soovitused teistele lugudele on ainult tekst: kuvamine ei muuda ühtegi rida', async () => {
  const p = await propose();
  assert.deepEqual(p.otherStories, [{ storyId: other, title: 'Külastajana soovin registreeruda liikmeks, et saaksin osaleda.', suggestion: 'Registreerumise kinnituses võiks samuti olla märge „sh km“.' }]);
  const before = dump();
  for (let i = 0; i < 3; i++) await fetch(url(projectId, `?storyId=${target}`));
  assert.deepEqual(dump(), before);
});

test('[Rakenda] muudab ainult valitud lugu: sõnastus, kriteeriumid ja mockup v2; v1 jääb alles; teised lood muutmata', async () => {
  const p = await propose();
  const others = othersDump();
  const res = await post(projectId, '/apply', { proposalId: p.id, storyId: target });
  assert.equal(res.status, 200);
  const story = db.prepare('SELECT want, so_that, updated_at FROM stories WHERE id = ?').get(target);
  assert.equal(story.want, 'näha liikmepakette ja hindu koos käibemaksuga');
  assert.notEqual(story.updated_at, OLD);
  assert.deepEqual(db.prepare('SELECT text, origin FROM criteria WHERE story_id = ? ORDER BY position').all(target).map((r) => ({ ...r })), [
    { text: 'Paketi juures on näha hind eurodes.', origin: 'ai' },
    { text: 'Paketi hinna juures on märge „sh km“.', origin: 'ai_edited' },
    { text: 'Hinnakirja all on märge, et hinnad sisaldavad käibemaksu.', origin: 'ai' },
  ]);
  assert.deepEqual(db.prepare('SELECT version FROM mockups WHERE story_id = ? ORDER BY version').all(target).map((r) => r.version), [1, 2]);
  assert.deepEqual(othersDump(), others);
});

test('rakendamise päring teise loo tunnusega lükatakse tagasi ja midagi ei salvestata', async () => {
  const p = await propose();
  const before = dump();
  const res = await post(projectId, '/apply', { proposalId: p.id, storyId: other });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'other_story');
  assert.deepEqual(dump(), before);
});

test('päring, mis sisaldab teise loo andmeid, lükatakse tervikuna tagasi – ka valitud loo osa ei salvestata', async () => {
  const p = await propose();
  const before = dump();
  const bodies = [
    { proposalId: p.id, storyId: target, stories: [{ id: other, want: 'muudetud' }] },
    { proposalId: p.id, storyId: target, changes: { want: 'näha hindu', otherStories: [{ storyId: other }] } },
    { proposalId: p.id, storyId: target, changes: { criteria: [{ from: 0, text: 'Hind on eurodes.', storyId: other }] } },
  ];
  for (const body of bodies) {
    const res = await post(projectId, '/apply', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).code, 'other_story');
  }
  assert.deepEqual(dump(), before);
  assert.equal(db.prepare('SELECT status FROM ai_proposals WHERE id = ?').get(p.id).status, 'pending');
});

test('[Muuda]: kasutaja muudetud tekst salvestub; vigane muudatus ei salvesta midagi', async () => {
  const p = await propose();
  const before = dump();
  const bad = await post(projectId, '/apply', { proposalId: p.id, storyId: target, changes: { want: 'soovin näha hindu' } });
  assert.equal(bad.status, 400);
  assert.deepEqual(dump(), before);
  const res = await post(projectId, '/apply', {
    proposalId: p.id, storyId: target,
    changes: { criteria: [{ from: 0, text: 'Paketi juures on näha hind eurodes.' }, { from: -1, text: 'Hinna kõrval on tekst „sh km“.' }] },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(db.prepare('SELECT text, origin FROM criteria WHERE story_id = ? ORDER BY position').all(target).map((r) => ({ ...r })), [
    { text: 'Paketi juures on näha hind eurodes.', origin: 'ai' },
    { text: 'Hinna kõrval on tekst „sh km“.', origin: 'ai_edited' },
  ]);
});

test('[Loobu]: lugu, kriteeriumid ja mockup jäävad muutmata', async () => {
  const p = await propose();
  const before = dump();
  const res = await post(projectId, '/reject', { proposalId: p.id });
  assert.equal(res.status, 200);
  assert.deepEqual(dump(), before);
  assert.equal((await post(projectId, '/apply', { proposalId: p.id, storyId: target })).status, 409);
});

test('kui lugu muutus pärast ettepanekut, rakendamist ei tehta (409 stale) ja midagi ei salvestata', async () => {
  const p = await propose();
  db.prepare("UPDATE criteria SET text = 'Käsitsi muudetud vahepeal.' WHERE story_id = ? AND position = 1").run(target);
  const before = dump();
  const res = await post(projectId, '/apply', { proposalId: p.id, storyId: target });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'stale');
  assert.deepEqual(dump(), before);
});

test('AI vigane mockup või soovitus vale loo kohta: kordus, siis 502 ja midagi ei salvestata', async () => {
  const before = dump();
  ai.push(aiOk(refineData({ mockup: { title: 'X', components: [{ type: 'iframe', text: 'x', items: [] }, { type: 'text', text: 'y', items: [] }] } })),
    aiOk(refineData({ otherStories: [{ storyId: otherProjStory, suggestion: 'Muuda teise projekti lugu.' }] })));
  const res = await post(projectId, '/propose', { storyId: target, clarification: 'Lisa käibemaks.' });
  assert.equal(res.status, 502);
  assert.equal(ai.calls.length, 2);
  assert.deepEqual(dump(), before);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ai_proposals WHERE kind = 'refinement'").get().n, 0);
});

test('täpsustus teisele loole on eraldi voog: alustamise lugu (prioriteet) ei muutu', async () => {
  const p = await propose(refineData({ story: { want: 'registreeruda liikmeks veebis', soThat: 'saaksin osaleda' }, criteria: [{ from: 0, text: 'Registreerumisvormis on väli „E-post“.', ref: 'E-post' }], mockup: { title: 'Registreerumine', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'button', text: 'Registreeru', items: [] }] }, otherStories: [] }), other);
  assert.equal(db.prepare('SELECT focus_story_id AS f FROM projects WHERE id = ?').get(projectId).f, target);
  const res = await post(projectId, '/apply', { proposalId: p.id, storyId: other });
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT focus_story_id AS f FROM projects WHERE id = ?').get(projectId).f, target);
  assert.equal(db.prepare('SELECT want FROM stories WHERE id = ?').get(target).want, 'näha liikmepakette ja hindu');
});

test('teise projekti lugu ei saa täpsustada; tühi täpsustus annab 400', async () => {
  assert.equal((await post(projectId, '/propose', { storyId: otherProjStory, clarification: 'x' })).status, 404);
  assert.equal((await post(projectId, '/propose', { storyId: target, clarification: '  ' })).status, 400);
  assert.equal(ai.calls.length, 0);
});

test('täpsustuses vigane AI viide (elementi pole) ei lükka vastust tagasi: eelvaates seos puudub ja hoiatus jääb', async () => {
  const data = refineData();
  data.criteria = data.criteria.map((c, i) => (i === 2 ? { ...c, ref: 'Olematu element' } : c));
  const p = await propose(data);
  assert.equal(ai.calls.length, 1);
  assert.equal(p.after.criteria[2].ref, null);
  assert.equal(p.preview.consistency.criteria[2].link, null);
  assert.equal(p.preview.consistency.criteria[0].link.label, '2. loend: Hinnad');
});

test('pooleli ettepaneku korral uut täpsustust samale loole ei tehta (409)', async () => {
  await propose();
  const res = await post(projectId, '/propose', { storyId: target, clarification: 'Veel üks.' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'pending_exists');
  assert.equal(ai.calls.length, 1);
});

// L18: täpsustuse uus kriteerium, mida AI ei suuda kontrollitavaks sõnastada, jääb nähtavaks märkega; rakendamine töötab.
test('enesekontroll: endiselt vigane parandus jätab algse teksti märkega; muutmata rakendamine ei ebaõnnestu', async () => {
  const data = refineData();
  data.criteria[2].text = 'Hinnakiri on kiire lugeda.';
  ai.push(aiOk(data), aiOk({ criteria: [{ key: '2', text: 'Hinnakiri on lihtne lugeda.' }] }));
  const res = await post(projectId, '/propose', { storyId: target, clarification: 'Paketi hinnas peab olema näha, kas see sisaldab käibemaksu.' });
  assert.equal(res.status, 200);
  assert.equal(ai.calls.length, 2);
  const p = (await res.json()).proposal;
  assert.deepEqual([p.after.criteria[2].text, p.after.criteria[2].selfCheck.status], ['Hinnakiri on kiire lugeda.', 'still_untestable']);
  assert.equal((await post(projectId, '/apply', { proposalId: p.id, storyId: target })).status, 200);
});

// L22: täpsustus muudab ainult vaadet 1 – olemasoleva kriteeriumi seos vaate 2 elemendiga jääb alles.
test('täpsustuse rakendamine säilitab üle tuleva kriteeriumi seose vaate 2 elemendiga', async () => {
  const v2 = saveMockup(db, target, { title: 'Kinnitus', components: [{ type: 'text', text: 'Hinnad sisaldavad käibemaksu', items: [] }] }, 2);
  const firstId = db.prepare('SELECT id FROM criteria WHERE story_id = ? ORDER BY position').get(target).id;
  db.prepare("UPDATE criteria SET ref_kind = 'element', ref_index = 0, ref_version = ?, ref_source = 'user' WHERE id = ?").run(v2, firstId);
  const p = await propose(); // kriteerium 0 tuleb üle (from: 0)
  assert.equal((await post(projectId, '/apply', { proposalId: p.id, storyId: target })).status, 200);
  const ref = { ...db.prepare('SELECT ref_kind, ref_index, ref_version, ref_source FROM criteria WHERE story_id = ? ORDER BY position').get(target) };
  assert.deepEqual(ref, { ref_kind: 'element', ref_index: 0, ref_version: v2, ref_source: 'user' });
});
