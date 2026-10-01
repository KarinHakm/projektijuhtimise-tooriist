import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';
import { appendCriteria, saveMockup } from '../server/criteria.js';
import { createProposal } from '../server/proposals.js';

// Lugude käsitsi haldus (L15): lisamine, muutmine, kustutamine. Ajutine andmebaas; AI-d ei kutsuta.
const s = (want, origin = 'ai') => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', origin, touchesView: true });
const NEW = { role: 'Treener', rolePhrase: 'Treenerina', want: 'näha oma treeningute osalejaid', soThat: 'teaksin, kui palju inimesi tuleb', size: 'S', touchesView: false };
let dir, db, projectId, otherId, ids, otherStory, server, base, aiCalls;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-manage-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('üks'), s('kaks'), s('kolm'), s('neli', 'manual')], null);
  appendStories(db, otherId, [s('võõras')], null);
  ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  otherStory = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherId).id;
  aiCalls = 0;
  const ai = { configured: true, timeoutMs: 1000, complete: async () => { aiCalls++; throw new Error('AI-d ei tohi kutsuda'); } };
  server = createApp({ db, ai }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
});
afterEach(async () => {
  assert.equal(aiCalls, 0);
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (method, path, body, pid = projectId) => fetch(`${base}/${pid}/stories${path}`, {
  method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const order = () => db.prepare('SELECT id, position FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => ({ ...r }));
const project = () => ({ ...db.prepare('SELECT focus_story_id AS focus, mvp_count AS mvp FROM projects WHERE id = ?').get(projectId) });

test('lisamine: lõppu (MVP joone alla), päritolu käsitsi, ka kinnitamata rolliga ja ilma AI-ta', async () => {
  db.prepare('UPDATE projects SET mvp_count = 2 WHERE id = ?').run(projectId);
  const res = await call('POST', '', NEW);
  assert.equal(res.status, 201);
  const body = await res.json();
  const added = body.stories.at(-1);
  assert.equal(added.id, body.createdId);
  assert.deepEqual([added.position, added.origin, added.role, added.touchesView, added.status], [5, 'manual', 'Treener', false, 'idee']);
  assert.equal(added.title, 'Treenerina soovin näha oma treeningute osalejaid, et teaksin, kui palju inimesi tuleb.');
  assert.equal(body.mvpCount, 2);
});

test('vigane lugu: 400 koos väljaga; midagi ei lisata', async () => {
  const cases = [[{ role: '' }, 'role'], [{ rolePhrase: 'Treener' }, 'rolePhrase'], [{ want: 'soovin näha' }, 'want'], [{ want: 'soovin: näha' }, 'want'], [{ soThat: 'et teaksin' }, 'soThat'], [{ soThat: 'et: teaksin' }, 'soThat'], [{ size: 'XL' }, 'size']];
  for (const [patch, field] of cases) {
    const res = await call('POST', '', { ...NEW, ...patch });
    assert.equal(res.status, 400, field);
    assert.equal((await res.json()).field, field);
  }
  assert.equal(order().length, 4);
});

test('muutmine: sisu muutub, järjekord, staatus ja alustamise lugu jäävad; AI lugu → ai_edited, käsitsi lugu jääb käsitsi', async () => {
  setFocusStory(db, projectId, ids[1]);
  db.prepare("UPDATE stories SET status = 'labivaadatud' WHERE id = ?").run(ids[1]);
  const before = order();
  const res = await call('PUT', `/${ids[1]}`, { ...NEW, role: 'Külastaja', rolePhrase: 'Külastajana' });
  assert.equal(res.status, 200);
  const st = (await res.json()).stories.find((x) => x.id === ids[1]);
  assert.deepEqual([st.want, st.origin, st.status, st.touchesView], [NEW.want, 'ai_edited', 'labivaadatud', false]);
  assert.deepEqual(order(), before);
  assert.equal(project().focus, ids[1]);
  await call('PUT', `/${ids[3]}`, { ...NEW });
  assert.equal(db.prepare('SELECT origin FROM stories WHERE id = ?').get(ids[3]).origin, 'manual');
});

test('muutmine ilma sisulise muutuseta jätab AI loo päritoluks „ai“', async () => {
  await call('PUT', `/${ids[0]}`, { role: 'Külastaja', rolePhrase: 'Külastajana', want: 'üks', soThat: 'saaksin liituda', size: 'M', touchesView: true });
  assert.equal(db.prepare('SELECT origin FROM stories WHERE id = ?').get(ids[0]).origin, 'ai');
});

test('teise projekti lugu ei saa muuta ega kustutada (404)', async () => {
  assert.equal((await call('PUT', `/${otherStory}`, NEW)).status, 404);
  assert.equal((await call('GET', `/${otherStory}/delete-impact`)).status, 404);
  assert.equal((await call('DELETE', `/${otherStory}`)).status, 404);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stories WHERE project_id = ?').get(otherId).n, 1);
});

test('alustamise loo kustutamine: mõju on enne näha; seotud andmed kustuvad, ootel ettepanekud lükatakse tagasi, viiteid ei jää', async () => {
  const target = ids[1];
  setFocusStory(db, projectId, target);
  appendCriteria(db, target, [{ text: "Vormil on väli 'E-post'.", origin: 'manual' }]);
  saveMockup(db, target, { title: 'V', components: [{ type: 'input', text: 'E-post', items: [] }] });
  saveMockup(db, target, { title: 'V', components: [{ type: 'button', text: 'Saada', items: [] }] });
  db.prepare('INSERT INTO story_questions (story_id, text) VALUES (?, ?)').run(target, 'Küsimus?');
  db.prepare('UPDATE projects SET mvp_count = 3 WHERE id = ?').run(projectId);
  const pending = ['criteria', 'mockup', 'refinement', 'priority'].map((kind) => createProposal(db, { projectId, kind, payload: { storyId: target } }).id);
  const keep = createProposal(db, { projectId, kind: 'refinement', payload: {
    storyId: ids[2], clarification: 'Täpsustus', message: 'Ettepanek',
    before: { want: 'kolm', soThat: 'saaksin liituda', criteria: [], mockup: null },
    after: { want: 'kolm', soThat: 'saaksin liituda', criteria: [], mockup: null },
    otherStories: [{ storyId: target, suggestion: 'x' }, { storyId: ids[0], suggestion: 'y' }],
  } }).id;

  const impact = await (await call('GET', `/${target}/delete-impact`)).json();
  assert.deepEqual(impact, { isFocus: true, aboveMvpLine: true, criteria: 1, mockupVersions: 2, questions: 1, pendingProposals: 4 });

  const res = await call('DELETE', `/${target}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted.isFocus, true);
  assert.deepEqual(project(), { focus: null, mvp: 2 });
  assert.deepEqual(order().map((r) => r.position), [1, 2, 3]);
  assert.deepEqual(order().map((r) => r.id), [ids[0], ids[2], ids[3]]);
  for (const t of ['criteria', 'mockups', 'story_questions']) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE story_id = ?`).get(target).n, 0, t);
  const statuses = db.prepare(`SELECT id, status FROM ai_proposals`).all().map((r) => [r.id, r.status]);
  for (const id of pending) assert.deepEqual(statuses.find((x) => x[0] === id), [id, 'rejected']);
  assert.deepEqual(statuses.find((x) => x[0] === keep), [keep, 'pending']);
  // teise loo täpsustuse ettepanek ei näita kustutatud loo kohta soovitust (katkist viidet ei ole)
  const ref = await (await fetch(`${base}/${projectId}/refinement?storyId=${ids[2]}`)).json();
  assert.deepEqual(ref.proposal.otherStories.map((o) => o.storyId), [ids[0]]);
  // etapp: alustamise lugu tuleb uuesti valida
  const stage = await (await fetch(`${base}/${projectId}/stage`)).json();
  assert.equal(stage.stages.find((x) => x.key === 'prioriteedid').status, 'next');
});

test('MVP joone all oleva loo kustutamine joont ei nihuta; viimane lugu kustub korrektselt', async () => {
  db.prepare('UPDATE projects SET mvp_count = 2 WHERE id = ?').run(projectId);
  assert.equal((await call('DELETE', `/${ids[3]}`)).status, 200);
  assert.equal(project().mvp, 2);
  assert.equal((await call('DELETE', `/${ids[3]}`)).status, 404);
  assert.equal(order().length, 3);
});
