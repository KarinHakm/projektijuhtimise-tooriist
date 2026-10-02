import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { aiOk, fakeAi } from './helpers/fake-ai.js';
import { replaceRoles } from '../server/roles.js';
import { appendStories } from '../server/stories.js';
import { appendCriteria, consistencyFor, saveMockup } from '../server/criteria.js';
import { withReadiness } from '../server/readiness.js';
import { listStories } from '../server/stories.js';
import { captureProject } from '../server/undo.js';

// L24: uus vaade promptist. Ajutine andmebaas ja võlts-AI; päris AI-d ei kutsuta.
let dir, db, projectId, otherProjectId, storyId, otherStoryId, server, base, ai;
const V1 = { title: 'Taotlus', components: [{ type: 'heading', text: 'Liikmeks astumise taotlus', items: [] }] };
const AI_DATA = () => ({
  message: 'Pakun tunniplaani vaate.',
  story: { role: 'Külastaja', rolePhrase: 'Külastajana', want: 'näha nädala tunniplaani', soThat: 'saaksin trenni valida', size: 'M' },
  criteria: [
    { text: 'Tunniplaanis on iga trenni algusaeg.', ref: 'Tunniplaan' },
    { text: 'Iga trenni juures on treeneri nimi.', ref: 'Tunniplaan' },
    { text: 'Lehel on nupp „Broneeri“.', ref: 'Broneeri' },
  ],
  mockup: { title: 'Tunniplaan', components: [{ type: 'heading', text: 'Nädala tunniplaan', items: [] }, { type: 'list', text: 'Tunniplaan', items: ['E 18:00 Jooga'] }, { type: 'button', text: 'Broneeri', items: [] }] },
});

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-newview-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherProjectId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'ai' }]);
  const s = (pid, want) => appendStories(db, pid, [{ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', origin: 'ai', touchesView: true }], null);
  s(projectId, 'esitada taotluse');
  s(otherProjectId, 'teise projekti lugu');
  storyId = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(projectId).id;
  otherStoryId = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherProjectId).id;
  saveMockup(db, storyId, V1, 1);
  appendCriteria(db, storyId, [{ text: 'Taotlusvormil on pealkiri.', origin: 'ai' }]);
  db.prepare('UPDATE projects SET mvp_count = 1 WHERE id = ?').run(projectId);
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

const post = (path, body, pid = projectId) => fetch(`${base}/${pid}/views${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const rows = () => ({
  stories: db.prepare('SELECT * FROM stories ORDER BY id').all().map((r) => ({ ...r })),
  criteria: db.prepare('SELECT * FROM criteria ORDER BY id').all().map((r) => ({ ...r })),
  mockups: db.prepare('SELECT * FROM mockups ORDER BY id').all().map((r) => ({ ...r })),
});
async function propose(data = AI_DATA()) {
  ai.push(aiOk(data));
  const res = await post('/propose', { description: 'Tunniplaani vaade, kus külastaja näeb nädala trenne ja saab broneerida.' });
  assert.equal(res.status, 200);
  return (await res.json()).proposal;
}

test('uus lugu: ettepanek ei muuda midagi; „Lisa“ loob loo backlogi lõppu koos vaate 1 ja seotud kriteeriumidega', async () => {
  const before = rows();
  const p = await propose();
  assert.deepEqual(rows(), before);
  assert.equal(p.story.title, 'Külastajana soovin näha nädala tunniplaani, et saaksin trenni valida.');
  assert.deepEqual(p.criteria.map((c) => c.ref), [1, 1, 2]);

  const res = await post('/apply', { proposalId: p.id, target: { kind: 'new' } });
  assert.equal(res.status, 200);
  const { result } = await res.json();
  assert.deepEqual([result.created, result.viewNo, result.version], [true, 1, 1]);
  const s = listStories(db, projectId).at(-1);
  assert.deepEqual([s.id, s.position, s.origin, s.touchesView], [result.storyId, 2, 'ai', true]);
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n, 1); // MVP joone alla
  assert.deepEqual(db.prepare('SELECT text, origin, ref_kind, ref_index, ref_version FROM criteria WHERE story_id = ? ORDER BY position').all(s.id).map((r) => ({ ...r })), [
    { text: 'Tunniplaanis on iga trenni algusaeg.', origin: 'ai', ref_kind: 'element', ref_index: 1, ref_version: 1 },
    { text: 'Iga trenni juures on treeneri nimi.', origin: 'ai', ref_kind: 'element', ref_index: 1, ref_version: 1 },
    { text: 'Lehel on nupp „Broneeri“.', origin: 'ai', ref_kind: 'element', ref_index: 2, ref_version: 1 },
  ]);
  assert.equal(withReadiness(db, [s])[0].readiness.checks.find((c) => c.key === 'mockup').ok, true);
});

test('lisavaade olemasolevale loole: vaade 2 serveri arvutatud versiooniga, vaade 1 ja loo tekst muutumata', async () => {
  const p = await propose();
  const storyBefore = { ...db.prepare('SELECT want, so_that, origin FROM stories WHERE id = ?').get(storyId) };
  const view1 = db.prepare('SELECT * FROM mockups WHERE story_id = ?').all(storyId).map((r) => ({ ...r }));
  // Klient ei saa vaate ega versiooni numbrit määrata – võõrad väljad ei mõjuta tulemust.
  const res = await post('/apply', { proposalId: p.id, target: { kind: 'story', storyId, viewNo: 1, version: 1 } });
  assert.equal(res.status, 200);
  const { result } = await res.json();
  assert.deepEqual([result.created, result.storyId, result.viewNo, result.version], [false, storyId, 2, 2]);
  assert.deepEqual(db.prepare('SELECT * FROM mockups WHERE story_id = ? AND view_no = 1').all(storyId).map((r) => ({ ...r })), view1);
  assert.deepEqual({ ...db.prepare('SELECT want, so_that, origin FROM stories WHERE id = ?').get(storyId) }, storyBefore);
  const c = consistencyFor(db, storyId);
  assert.equal(c.criteria.filter((x) => x.warnings.some((w) => w.code === 'stale_ref')).length, 0);
  assert.equal(c.criteria[1].link.label, 'Vaade 2 · 2. loend: Tunniplaan');
});

test('„Muuda“: muudetud sõnastus ja kriteerium on ai_edited, lisatud on manual; piirangud ja „Loobu“', async () => {
  const p = await propose();
  let res = await post('/apply', { proposalId: p.id, target: { kind: 'story', storyId: otherStoryId } });
  assert.equal(res.status, 404); // teise projekti lugu
  res = await post('/apply', { proposalId: p.id, target: { kind: 'story', storyId }, criteria: [{ index: 0, text: 'taotlusvormil on pealkiri.' }] });
  assert.equal((await res.json()).code, 'duplicate_criterion'); // kordab olemasolevat
  res = await post('/apply', { proposalId: p.id, target: { kind: 'new' }, criteria: [{ index: 0, text: 'A on.' }, { text: 'a on.' }] });
  assert.equal(res.status, 400);

  res = await post('/apply', {
    proposalId: p.id, target: { kind: 'new' }, story: { want: 'näha nädala trenne' },
    criteria: [{ index: 0, text: 'Tunniplaanis on iga trenni algus- ja lõpuaeg.' }, { index: 2, text: 'Lehel on nupp „Broneeri“.' }, { text: 'Tunniplaanis on saali nimi.' }],
  });
  assert.equal(res.status, 200);
  const sid = (await res.json()).result.storyId;
  assert.deepEqual({ ...db.prepare('SELECT want, origin FROM stories WHERE id = ?').get(sid) }, { want: 'näha nädala trenne', origin: 'ai_edited' });
  assert.deepEqual(db.prepare('SELECT origin, ref_kind FROM criteria WHERE story_id = ? ORDER BY position').all(sid).map((r) => [r.origin, r.ref_kind]),
    [['ai_edited', 'element'], ['ai', 'element'], ['manual', null]]);
  assert.equal((await post('/apply', { proposalId: p.id, target: { kind: 'new' } })).status, 409); // juba rakendatud

  const p2 = await propose();
  const before = rows();
  assert.equal((await post('/reject', { proposalId: p2.id })).status, 200);
  assert.deepEqual(rows(), before);
});

test('AI tõrge või vigane vastus: ettepanekut ei looda; tühi kirjeldus ja pooleli ettepanek keelduvad', async () => {
  const bad = AI_DATA();
  bad.mockup.components[0].type = 'video';
  ai.push(aiOk(bad), aiOk({ ...AI_DATA(), story: { ...AI_DATA().story, role: 'Tundmatu' } }));
  let res = await post('/propose', { description: 'Tunniplaan' });
  assert.equal(res.status, 502);
  assert.equal(ai.calls.length, 2); // üks kordus
  assert.equal((await (await fetch(`${base}/${projectId}/views`)).json()).proposal, null);
  assert.equal((await post('/propose', { description: '   ' })).status, 400);
  await propose();
  assert.equal((await post('/propose', { description: 'Veel üks' })).status, 409);
});

// L21: L24 „Lisa“ on toetatud muudatus – tagasivõtmine eemaldab uue loo ja ettepanek on jälle ootel.
test('uue loo lisamise tagasivõtmine: lugu, mockup ja kriteeriumid kaovad, ettepanek on jälle ootel', async () => {
  const p = await propose();
  const before = captureProject(db, projectId);
  assert.equal((await post('/apply', { proposalId: p.id, target: { kind: 'new' } })).status, 200);
  const undo = async (body) => fetch(`${base}/${projectId}/undo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const st = await (await fetch(`${base}/${projectId}/undo`)).json();
  assert.equal(st.label, 'Lisasid uue vaate põhjal uue loo');
  assert.equal((await undo({ at: st.at })).status, 200);
  assert.deepEqual(captureProject(db, projectId), before);
  assert.equal((await (await fetch(`${base}/${projectId}/views`)).json()).proposal.id, p.id);
});
