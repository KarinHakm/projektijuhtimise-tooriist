import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { appendStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';
import { appendCriteria, saveMockup } from '../server/criteria.js';
import { createProposal } from '../server/proposals.js';
import { forbiddenAi } from './helpers/fake-ai.js';

// Kahe loo käsitsi ühendamine (L26). Ajutine andmebaas; AI-d ei kutsuta.
const s = (want, origin = 'ai') => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', origin, touchesView: true });
const STORY = { role: 'Külastaja', rolePhrase: 'Külastajana', want: 'registreeruda ja tasuda liikmetasu', soThat: 'saaksin liituda', size: 'L', touchesView: true };
const MOCKUP = { title: 'V', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'button', text: 'Saada', items: [] }] };
let dir, db, projectId, otherId, ids, otherStory, server, base, ai;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-merge-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('üks'), s('registreeruda'), s('kolm'), s('tasuda liikmetasu', 'manual'), s('viis')], null);
  appendStories(db, otherId, [s('võõras')], null);
  ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  otherStory = db.prepare('SELECT id FROM stories WHERE project_id = ?').get(otherId).id;
  ai = forbiddenAi();
  server = createApp({ db, ai: ai.client }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
});
afterEach(async () => {
  assert.equal(ai.calls, 0);
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (method, path, body, pid = projectId) => fetch(`${base}/${pid}/stories${path}`, {
  method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const rows = (sql, ...a) => db.prepare(sql).all(...a).map((r) => ({ ...r }));
const info = async (keep, remove) => (await call('GET', `/${keep}/merge-info?with=${remove}`)).json();
const [A, B] = [1, 3]; // indeksid: lugu 2 (registreeruda) ja lugu 4 (tasuda liikmetasu)

function seed() {
  saveMockup(db, ids[B], MOCKUP); // mockup ainult eemaldataval lool
  appendCriteria(db, ids[A], [{ text: "Vormil on väli 'E-post'.", origin: 'manual' }, { text: 'Pärast registreerumist kuvatakse kinnitus.', origin: 'manual', ref: { kind: 'no_view', source: 'user' } }]);
  appendCriteria(db, ids[B], [
    { text: "vormil on väli 'e-post'.", origin: 'manual', ref: { kind: 'element', index: 0, version: 1, source: 'user' } },
    { text: "Vormil on nupp 'Saada'.", origin: 'manual', ref: { kind: 'element', index: 1, version: 1, source: 'user' } },
  ]);
  db.prepare('INSERT INTO story_questions (story_id, text) VALUES (?, ?)').run(ids[B], 'Milline makseviis?');
}

test('merge-info: kriteeriumid mõlemast loost, duplikaadid, seosed ja nende säilimine, küsimused, mockup, koht', async () => {
  seed();
  setFocusStory(db, projectId, ids[B]);
  const i = await info(ids[A], ids[B]);
  assert.deepEqual(i.criteria.map((c) => [c.from, c.linkSurvives, c.duplicateWith.length]), [['keep', false, 1], ['keep', true, 0], ['remove', true, 1], ['remove', true, 0]]);
  assert.equal(i.criteria[2].linkLabel, '1. sisestusväli: E-post (mockup v1)');
  assert.equal(i.criteria[1].linkLabel, 'ei puuduta vaadet');
  assert.deepEqual([i.blocked, i.mockups.from, i.focus, i.resultPosition, i.questions.length], [false, 'remove', 'remove', 2, 1]);
  assert.equal((await call('GET', `/${ids[A]}/merge-info?with=${ids[A]}`)).status, 404);
  assert.equal((await call('GET', `/${ids[A]}/merge-info?with=${otherStory}`)).status, 404);
});

test('ühendamine: säilitatav ID ja eespool olev koht; täpselt valitud kriteeriumid; küsimused ja mockup üle; teiste lugude sisu ei muutu', async () => {
  seed();
  const i = await info(ids[A], ids[B]);
  const dropped = i.criteria[2].id; // duplikaat koos seosega, kasutaja jättis teadlikult märkimata
  const others = rows('SELECT * FROM stories WHERE id IN (?, ?, ?) ORDER BY id', ids[0], ids[2], ids[4]);
  const res = await call('POST', `/${ids[A]}/merge`, { withId: ids[B], story: STORY, keepCriteria: i.criteria.map((c) => c.id).filter((id) => id !== dropped) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.stories.map((x) => x.id), [ids[0], ids[A], ids[2], ids[4]]);
  assert.deepEqual(body.stories.map((x) => x.position), [1, 2, 3, 4]);
  assert.deepEqual([body.merge.removedCriteria, body.merge.movedQuestions], [1, 1]);
  const merged = body.stories[1];
  assert.deepEqual([merged.want, merged.size, merged.origin, merged.status], [STORY.want, 'L', 'ai_edited', 'vajab_tapsustamist']);
  assert.deepEqual(rows('SELECT text, position, ref_kind, ref_version FROM criteria WHERE story_id = ? ORDER BY position', ids[A]), [
    { text: "Vormil on väli 'E-post'.", position: 1, ref_kind: null, ref_version: null },
    { text: 'Pärast registreerumist kuvatakse kinnitus.', position: 2, ref_kind: 'no_view', ref_version: null },
    { text: "Vormil on nupp 'Saada'.", position: 3, ref_kind: 'element', ref_version: 1 },
  ]);
  assert.equal(rows('SELECT COUNT(*) AS n FROM criteria WHERE id = ?', dropped)[0].n, 0);
  assert.deepEqual(rows('SELECT version FROM mockups WHERE story_id = ?', ids[A]).map((m) => m.version), [1]);
  assert.equal(rows('SELECT COUNT(*) AS n FROM stories WHERE id = ?', ids[B])[0].n, 0);
  assert.deepEqual(rows('SELECT text FROM story_questions WHERE story_id = ?', ids[A]).map((q) => q.text), ['Milline makseviis?']);
  assert.deepEqual(rows('SELECT * FROM stories WHERE id IN (?, ?, ?) ORDER BY id', ids[0], ids[2], ids[4]).map(({ position, ...r }) => r), others.map(({ position, ...r }) => r));
});

test('kõik kriteeriumid valitud (vaikimisi): ka duplikaadid jäävad alles', async () => {
  seed();
  const i = await info(ids[A], ids[B]);
  await call('POST', `/${ids[A]}/merge`, { withId: ids[B], story: STORY, keepCriteria: i.criteria.map((c) => c.id) });
  assert.equal(rows('SELECT COUNT(*) AS n FROM criteria WHERE story_id = ?', ids[A])[0].n, 4);
});

test('säilitatav lugu tagapool: ühendatud lugu läheb eespool olevale kohale; alustamise lugu läheb ühendatud loole', async () => {
  setFocusStory(db, projectId, ids[A]);
  const res = await call('POST', `/${ids[B]}/merge`, { withId: ids[A], story: STORY, keepCriteria: [] });
  const body = await res.json();
  assert.deepEqual(body.stories.map((x) => x.id), [ids[0], ids[B], ids[2], ids[4]]);
  assert.equal(body.focusStoryId, ids[B]);
});

test('MVP joon: mõlemad joone kohal → arv −1; ainult eespool olev joone kohal → arv sama', async () => {
  db.prepare('UPDATE projects SET mvp_count = 4 WHERE id = ?').run(projectId);
  await call('POST', `/${ids[A]}/merge`, { withId: ids[B], story: STORY, keepCriteria: [] });
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n, 3);
  db.prepare('UPDATE projects SET mvp_count = 1 WHERE id = ?').run(projectId);
  await call('POST', `/${ids[0]}/merge`, { withId: ids[4], story: { ...STORY, want: 'üks ja viis' }, keepCriteria: [] });
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n, 1);
});

test('mõlemal mockup → keeld (409); midagi ei muutu; teisi lugusid saab endiselt ühendada', async () => {
  saveMockup(db, ids[A], MOCKUP);
  saveMockup(db, ids[B], MOCKUP);
  const before = JSON.stringify([rows('SELECT * FROM stories ORDER BY id'), rows('SELECT * FROM mockups ORDER BY id')]);
  assert.equal((await info(ids[A], ids[B])).blocked, true);
  const res = await call('POST', `/${ids[A]}/merge`, { withId: ids[B], story: STORY, keepCriteria: [] });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'both_mockups');
  assert.equal(JSON.stringify([rows('SELECT * FROM stories ORDER BY id'), rows('SELECT * FROM mockups ORDER BY id')]), before);
  assert.equal((await call('POST', `/${ids[A]}/merge`, { withId: ids[2], story: STORY, keepCriteria: [] })).status, 200);
});

test('ootel ettepanekud: mõlema kriteeriumid/mockup/täpsustus ja eemaldatava prioriteet tagasi; säilitatava prioriteet jääb', async () => {
  const mk = (kind, storyId) => createProposal(db, { projectId, kind, payload: { storyId } }).id;
  const rejected = [mk('criteria', ids[A]), mk('refinement', ids[B]), mk('mockup', ids[B]), mk('priority', ids[B])];
  const kept = [mk('priority', ids[A]), mk('criteria', ids[0])];
  const body = await (await call('POST', `/${ids[A]}/merge`, { withId: ids[B], story: STORY, keepCriteria: [] })).json();
  assert.equal(body.merge.rejectedProposals, 4);
  const status = (id) => db.prepare('SELECT status FROM ai_proposals WHERE id = ?').get(id).status;
  assert.deepEqual(rejected.map(status), ['rejected', 'rejected', 'rejected', 'rejected']);
  assert.deepEqual(kept.map(status), ['pending', 'pending']);
});

test('vigased päringud: vigane sõnastus, võõras või topelt kriteerium, teine projekt; midagi ei muutu', async () => {
  seed();
  appendCriteria(db, ids[0], [{ text: 'Muu loo kriteerium.', origin: 'manual' }]);
  const foreign = rows('SELECT id FROM criteria WHERE story_id = ?', ids[0])[0].id;
  const own = rows('SELECT id FROM criteria WHERE story_id = ?', ids[A])[0].id;
  const snap = () => JSON.stringify([rows('SELECT * FROM stories ORDER BY id'), rows('SELECT * FROM criteria ORDER BY id'), rows('SELECT * FROM story_questions ORDER BY id')]);
  const before = snap();
  for (const [body, field] of [
    [{ withId: ids[B], story: { ...STORY, want: 'soovin: midagi' }, keepCriteria: [] }, 'story.want'],
    [{ withId: ids[B], story: STORY, keepCriteria: [foreign] }, 'criteria'],
    [{ withId: ids[B], story: STORY, keepCriteria: [own, own] }, 'criteria'],
    [{ withId: ids[B], story: STORY }, 'criteria'],
  ]) {
    const res = await call('POST', `/${ids[A]}/merge`, body);
    assert.equal(res.status, 400, field);
    assert.equal((await res.json()).field, field);
  }
  assert.equal((await call('POST', `/${ids[A]}/merge`, { withId: otherStory, story: STORY, keepCriteria: [] })).status, 404);
  assert.equal((await call('POST', `/${ids[A]}/merge`, { withId: ids[A], story: STORY, keepCriteria: [] })).status, 404);
  assert.equal(snap(), before);
});
