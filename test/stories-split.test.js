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

// Loo käsitsi jagamine kaheks (L25). Ajutine andmebaas; AI-d ei kutsuta.
const s = (want, origin = 'ai') => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'L', origin, touchesView: true });
const part = (want, soThat = 'saaksin liituda') => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat, size: 'M', touchesView: true });
let dir, db, projectId, otherId, ids, otherStory, server, base, ai;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-split-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  otherId = db.prepare("INSERT INTO projects (name) VALUES ('Teine') RETURNING id").get().id;
  appendStories(db, projectId, [s('üks'), s('registreeruda ja maksta liikmetasu'), s('kolm'), s('neli', 'manual')], null);
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
const target = () => ids[1];

function seedRelated() {
  const t = target();
  setFocusStory(db, projectId, t);
  saveMockup(db, t, { title: 'V', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'button', text: 'Maksa', items: [] }] });
  appendCriteria(db, t, [
    { text: "Vormil on väli 'E-post'.", origin: 'manual', ref: { kind: 'element', index: 0, version: 1, source: 'user' } },
    { text: "Vormil on nupp 'Maksa'.", origin: 'manual', ref: { kind: 'element', index: 1, version: 1, source: 'user' } },
    { text: 'Pärast makset kuvatakse kviitung.', origin: 'manual' },
  ]);
  db.prepare('INSERT INTO story_questions (story_id, text) VALUES (?, ?), (?, ?)').run(t, 'Kas e-post on kohustuslik?', t, 'Milline makseviis?');
}

test('split-info: kriteeriumid (seosega või mitte), küsimused, mockup, ootel ettepanekud, alustamise lugu, MVP', async () => {
  seedRelated();
  db.prepare('UPDATE projects SET mvp_count = 2 WHERE id = ?').run(projectId);
  for (const kind of ['criteria', 'refinement', 'priority']) createProposal(db, { projectId, kind, payload: { storyId: target() } });
  const info = await (await call('GET', `/${target()}/split-info`)).json();
  assert.deepEqual(info.criteria.map((c) => c.linked), [true, true, false]);
  assert.equal(info.questions.length, 2);
  assert.deepEqual([info.mockupVersions, info.pendingProposals, info.isFocus, info.aboveMvpLine], [1, 2, true, true]);
  assert.equal((await call('GET', `/${otherStory}/split-info`)).status, 404);
});

test('jagamine: osa 1 = algne lugu uue sõnastusega, osa 2 kohe järel; teiste lugude sisu ei muutu', async () => {
  const before = rows('SELECT * FROM stories WHERE id IN (?, ?, ?) ORDER BY id', ids[0], ids[2], ids[3]);
  const res = await call('POST', `/${target()}/split`, { first: part('registreeruda liikmeks'), second: part('maksta liikmetasu veebis', 'saaksin kohe treenima hakata') });
  assert.equal(res.status, 200);
  const body = await res.json();
  const order = body.stories.map((x) => x.id);
  assert.deepEqual(order, [ids[0], ids[1], body.split.secondId, ids[2], ids[3]]);
  const [first, second] = [body.stories[1], body.stories[2]];
  assert.deepEqual([first.want, first.origin, first.size], ['registreeruda liikmeks', 'ai_edited', 'M']);
  assert.deepEqual([second.want, second.origin, second.status], ['maksta liikmetasu veebis', 'manual', 'idee']);
  const after = rows('SELECT * FROM stories WHERE id IN (?, ?, ?) ORDER BY id', ids[0], ids[2], ids[3]);
  assert.deepEqual(after.map(({ position, ...r }) => r), before.map(({ position, ...r }) => r)); // ainult koht nihkus
});

test('kriteeriumid ja küsimused jaotatakse valiku järgi; osale 2 viidud seos eemaldatakse; mockup ja alustamise lugu jäävad osale 1', async () => {
  seedRelated();
  const crit = rows('SELECT id FROM criteria WHERE story_id = ? ORDER BY position', target()).map((r) => r.id);
  const q = rows('SELECT id FROM story_questions WHERE story_id = ? ORDER BY id', target()).map((r) => r.id);
  const res = await call('POST', `/${target()}/split`, {
    first: part('registreeruda liikmeks'), second: part('maksta liikmetasu veebis'), criteriaToSecond: [crit[1], crit[2]], questionsToSecond: [q[1]],
  });
  const { split, stories } = await res.json();
  assert.deepEqual([split.movedCriteria, split.movedQuestions], [2, 1]);
  assert.deepEqual(rows('SELECT text, position, ref_kind FROM criteria WHERE story_id = ? ORDER BY position', target()), [{ text: "Vormil on väli 'E-post'.", position: 1, ref_kind: 'element' }]);
  assert.deepEqual(rows('SELECT text, position, ref_kind FROM criteria WHERE story_id = ? ORDER BY position', split.secondId), [
    { text: "Vormil on nupp 'Maksa'.", position: 1, ref_kind: null },
    { text: 'Pärast makset kuvatakse kviitung.', position: 2, ref_kind: null },
  ]);
  assert.deepEqual(rows('SELECT text FROM story_questions WHERE story_id = ?', split.secondId).map((r) => r.text), ['Milline makseviis?']);
  assert.equal(stories.find((x) => x.id === split.secondId).status, 'vajab_tapsustamist'); // avatud küsimusega osa 2
  assert.equal(rows('SELECT COUNT(*) AS n FROM mockups WHERE story_id = ?', target())[0].n, 1);
  assert.equal(rows('SELECT COUNT(*) AS n FROM mockups WHERE story_id = ?', split.secondId)[0].n, 0);
  assert.equal(db.prepare('SELECT focus_story_id AS f FROM projects WHERE id = ?').get(projectId).f, target());
  // kokku ei kadunud midagi
  assert.equal(rows('SELECT COUNT(*) AS n FROM criteria WHERE story_id IN (?, ?)', target(), split.secondId)[0].n, 3);
  assert.equal(rows('SELECT COUNT(*) AS n FROM story_questions WHERE story_id IN (?, ?)', target(), split.secondId)[0].n, 2);
});

test('ootel ettepanekud: algse loo kriteeriumid, mockup ja täpsustus lükatakse tagasi; prioriteet ja teise loo omad jäävad', async () => {
  const mine = Object.fromEntries(['criteria', 'mockup', 'refinement', 'priority'].map((kind) => [kind, createProposal(db, { projectId, kind, payload: { storyId: target() } }).id]));
  const others = createProposal(db, { projectId, kind: 'criteria', payload: { storyId: ids[0] } }).id;
  const res = await call('POST', `/${target()}/split`, { first: part('registreeruda liikmeks'), second: part('maksta liikmetasu') });
  assert.equal((await res.json()).split.rejectedProposals, 3);
  const status = (id) => db.prepare('SELECT status FROM ai_proposals WHERE id = ?').get(id).status;
  assert.deepEqual(['criteria', 'mockup', 'refinement', 'priority'].map((k) => status(mine[k])), ['rejected', 'rejected', 'rejected', 'pending']);
  assert.equal(status(others), 'pending');
});

test('MVP joon: joone kohal olev lugu → osa 2 ka joone kohale; joone all → joon paigal', async () => {
  db.prepare('UPDATE projects SET mvp_count = 2 WHERE id = ?').run(projectId);
  await call('POST', `/${target()}/split`, { first: part('registreeruda liikmeks'), second: part('maksta liikmetasu') });
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n, 3);
  await call('POST', `/${ids[3]}/split`, { first: part('neli a'), second: part('neli b') });
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n, 3);
});

test('vigased päringud: sama sõnastus, vigane osa, võõras kriteerium, teine projekt; midagi ei muutu', async () => {
  seedRelated();
  const before = JSON.stringify([rows('SELECT * FROM stories ORDER BY id'), rows('SELECT * FROM criteria ORDER BY id'), rows('SELECT * FROM story_questions ORDER BY id')]);
  const foreign = appendCriteria(db, ids[0], [{ text: 'Muu loo kriteerium.', origin: 'manual' }]) ?? rows('SELECT id FROM criteria WHERE story_id = ?', ids[0])[0].id;
  const snapshot = JSON.stringify([rows('SELECT * FROM stories ORDER BY id'), rows('SELECT * FROM criteria ORDER BY id'), rows('SELECT * FROM story_questions ORDER BY id')]);
  const cases = [
    [{ first: part('sama'), second: part('sama') }, 'second.want'],
    [{ first: { ...part('a'), rolePhrase: 'Külastaja' }, second: part('b') }, 'first.rolePhrase'],
    [{ first: part('a'), second: { ...part('b'), want: 'soovin: b' } }, 'second.want'],
    [{ first: part('a'), second: part('b'), criteriaToSecond: [foreign] }, 'criteria'],
    [{ first: part('a'), second: part('b'), questionsToSecond: [999999] }, 'questions'],
  ];
  for (const [body, field] of cases) {
    const res = await call('POST', `/${target()}/split`, body);
    assert.equal(res.status, 400, field);
    assert.equal((await res.json()).field, field);
  }
  assert.equal((await call('POST', `/${otherStory}/split`, { first: part('a'), second: part('b') })).status, 404);
  assert.equal(JSON.stringify([rows('SELECT * FROM stories ORDER BY id'), rows('SELECT * FROM criteria ORDER BY id'), rows('SELECT * FROM story_questions ORDER BY id')]), snapshot);
  assert.ok(before.length > 0);
});
