import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { aiOk, fakeAi } from './helpers/fake-ai.js';

// L27: backlog'i ülevaatus. Ajutine andmebaas ja võlts-AI; päris AI-d ei kutsuta.
let dir, db, projectId, server, base, ai, ids;

async function startServer(aiClient) {
  server = createApp({ db, ai: aiClient }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects`;
}

// Meelega vigane backlog: iga leiutüübi jaoks vähemalt üks lugu.
function seed() {
  const insert = db.prepare(`INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin, touches_view)
                             VALUES (?, ?, 'Külastaja', ?, ?, ?, ?, 'ai', ?) RETURNING id`);
  const add = (pos, rolePhrase, want, soThat, size, view) => insert.get(projectId, pos, rolePhrase, want, soThat, size, view ? 1 : 0).id;
  const crit = db.prepare("INSERT INTO criteria (story_id, position, text, origin) VALUES (?, ?, ?, 'ai') RETURNING id");
  const ok = (storyId) => ['Lehel on pealkiri.', 'Lehel on otsinguväli.', 'Lehel on nupp „Saada“.'].map((t, i) => crit.get(storyId, i + 1, t).id);

  const badTitle = add(1, 'Külastaja', 'näha tunniplaani', 'saaksin trenni valida', 'S', false); // pole olevas käändes
  ok(badTitle);
  const untestable = add(2, 'Külastajana', 'näha hinnakirja', 'saaksin paketi valida', 'S', false);
  const vague = crit.get(untestable, 1, 'Hinnakiri on selgelt näha.').id;
  const noCriteria = add(3, 'Külastajana', 'saada klubile sõnum', 'saaksin küsimusele vastuse', 'S', false);
  const noMockup = add(4, 'Külastajana', 'näha treenerite tutvustust', 'saaksin treeneri valida', 'S', true);
  ok(noMockup);
  const tooLarge = add(5, 'Külastajana', 'registreeruda, maksta liikmemaksu ja broneerida trenni', 'saaksin klubiga liituda', 'L', false);
  const largeCriteria = ok(tooLarge);
  const dupA = add(6, 'Külastajana', 'näha treeningute nädalakava', 'saaksin aja valida', 'S', false);
  const dupACriteria = ok(dupA);
  const dupB = add(7, 'Külastajana', 'vaadata nädala treeninguid', 'saaksin sobiva aja leida', 'S', false);
  const dupBCriteria = [crit.get(dupB, 1, 'Nädalavaates on iga trenni algusaeg.').id, crit.get(dupB, 2, 'Lehel on otsing.').id,
    crit.get(dupB, 3, 'Trenni juures on treeneri nimi.').id];
  return { badTitle, untestable, vague, noCriteria, noMockup, tooLarge, largeCriteria, dupA, dupB, dupACriteria, dupBCriteria };
}

const AI_REVIEW = () => ({
  message: 'Leidsin mõned probleemid.',
  storyFixes: [{ storyId: ids.badTitle, reason: 'Roll peab olema olevas käändes.', rolePhrase: 'Külastajana', want: 'näha tunniplaani', soThat: 'saaksin trenni valida' }],
  criteriaAdds: [{ storyId: ids.noCriteria, reason: 'Kriteeriumid puuduvad.', criteria: ['Vormil on väli „Sõnum“.', 'Pärast saatmist kuvatakse kinnitusteade.', 'Vormil on väli „Sõnum“.'] }],
  criterionFixes: [{ criterionId: ids.vague, reason: '„Selgelt“ on hinnanguline.', text: 'Hinnakirjas on iga paketi hind eurodes.' }],
  viewDecisions: [{ storyId: ids.noMockup, reason: 'Treenerite tutvustus on eraldi leht.', decision: 'needs_mockup' }],
  tooLarge: [{
    storyId: ids.tooLarge, problem: 'Lool on kolm eraldi tegevust.', reason: 'Registreerumine, makse ja broneerimine on eraldi töövood.',
    first: { want: 'registreeruda klubi liikmeks', soThat: 'saaksin klubiga liituda' }, second: { want: 'broneerida trenni', soThat: 'saaksin trennis osaleda' },
    firstCriteria: [ids.largeCriteria[0], ids.largeCriteria[2]], secondCriteria: [ids.largeCriteria[1]],
  }],
  overlaps: [
    {
      keepId: ids.dupA, removeId: ids.dupB, problem: 'Mõlemad näitavad nädala treeninguid.', reason: 'Sama nõue kahes loos.', suggestion: 'Ühenda lugu 7 looga 6.',
      story: { want: 'näha nädala treeningute kava', soThat: 'saaksin sobiva aja valida' },
      // „Lehel on otsing.“ on sisuline (mitte täpne) kordus kriteeriumist „Lehel on otsinguväli.“
      criteria: [...ids.dupACriteria.map((id) => ({ criterionId: id, action: 'keep', duplicateOf: 0 })),
        { criterionId: ids.dupBCriteria[0], action: 'keep', duplicateOf: 0 },
        { criterionId: ids.dupBCriteria[1], action: 'duplicate', duplicateOf: ids.dupACriteria[1] },
        { criterionId: ids.dupBCriteria[2], action: 'keep', duplicateOf: 0 }],
    },
    { keepId: ids.dupA, removeId: 999, problem: 'Olematu lugu.', reason: 'x', suggestion: 'x', story: { want: 'x', soThat: 'y' }, criteria: [] }, // vigane viide jäetakse välja
  ],
});

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-review-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  ids = seed();
  ai = fakeAi();
  await startServer(ai.client);
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path, body) => fetch(`${base}/${projectId}/review${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const backlogRows = () => ({
  stories: db.prepare('SELECT * FROM stories ORDER BY id').all().map((r) => ({ ...r })),
  criteria: db.prepare('SELECT * FROM criteria ORDER BY id').all().map((r) => ({ ...r })),
  questions: db.prepare('SELECT * FROM story_questions ORDER BY id').all().map((r) => ({ ...r })),
});
async function runReview(data = AI_REVIEW()) {
  ai.push(aiOk(data));
  const res = await post('/run');
  assert.equal(res.status, 200);
  return (await res.json()).review;
}
const finding = (review, id) => review.findings.find((f) => f.id === id);

test('ülevaatus leiab kõik leiutüübid meelega vigastest lugudest ega muuda backlogi', async () => {
  const before = backlogRows();
  const review = await runReview();
  assert.deepEqual(backlogRows(), before);

  assert.equal(review.ai, true);
  assert.deepEqual(finding(review, `connextra-${ids.badTitle}`).suggestion.rolePhrase, 'Külastajana');
  assert.deepEqual(finding(review, `no_criteria-${ids.noCriteria}`).suggestion.criteria, ['Vormil on väli „Sõnum“.', 'Pärast saatmist kuvatakse kinnitusteade.']); // kordus eemaldatud
  assert.equal(finding(review, `untestable-${ids.vague}`).suggestion.text, 'Hinnakirjas on iga paketi hind eurodes.');
  assert.equal(finding(review, `no_mockup-${ids.noMockup}`).suggestion.decision, 'needs_mockup');
  const large = finding(review, `too_large-${ids.tooLarge}`);
  assert.equal(large.problem, 'Lool on kolm eraldi tegevust.');
  assert.ok(large.reason && large.suggestion.second.want === 'broneerida trenni');
  assert.deepEqual(large.suggestion.criteriaToSecond, [ids.largeCriteria[1]]); // L28: kriteeriumide jaotus
  const overlap = finding(review, `overlap-${ids.dupA}-${ids.dupB}`).suggestion;
  assert.deepEqual([overlap.keepId, overlap.removeId, overlap.merge.duplicates], [ids.dupA, ids.dupB, [{ id: ids.dupBCriteria[1], of: ids.dupACriteria[1] }]]);
  assert.equal(review.findings.filter((f) => f.type === 'overlap').length, 1); // olematu loo leid jäeti välja
  for (const f of review.findings) assert.ok(f.problem && f.reason, f.id);

  // AI-le läksid koodi leiud ja loo kriteeriumid (projekti seis).
  const prompt = ai.calls[0].messages[1].content;
  assert.match(prompt, new RegExp(`mittekontrollitav kriteerium id ${ids.vague}`));
  assert.match(prompt, /Hinnakiri on selgelt näha\./);
});

test('Rakenda, Muuda ja Ignoreeri muudavad ainult leiu lugu; Ignoreeri jätab backlogi muutmata', async () => {
  await runReview();

  let res = await post(`/findings/connextra-${ids.badTitle}/apply`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT role_phrase AS r FROM stories WHERE id = ?').get(ids.badTitle).r, 'Külastajana');

  res = await post(`/findings/untestable-${ids.vague}/apply`, { value: { text: 'Hinnakirjas on iga paketi kuuhind.' } }); // Muuda
  assert.equal(res.status, 200);
  assert.deepEqual({ ...db.prepare('SELECT text, origin FROM criteria WHERE id = ?').get(ids.vague) }, { text: 'Hinnakirjas on iga paketi kuuhind.', origin: 'ai_edited' });

  res = await post(`/findings/no_mockup-${ids.noMockup}/apply`);
  assert.equal(res.status, 200);
  assert.deepEqual(db.prepare('SELECT text FROM story_questions WHERE story_id = ?').all(ids.noMockup).map((r) => r.text), ["Vajab mockup'i"]);
  assert.equal(db.prepare('SELECT status FROM stories WHERE id = ?').get(ids.noMockup).status, 'vajab_tapsustamist');

  const before = backlogRows();
  res = await post(`/findings/no_criteria-${ids.noCriteria}/ignore`);
  assert.equal(res.status, 200);
  assert.deepEqual(backlogRows(), before);
  const body = await res.json();
  assert.equal(finding(body.review, `no_criteria-${ids.noCriteria}`).status, 'ignored');

  res = await post(`/findings/no_criteria-${ids.noCriteria}/apply`);
  assert.equal(res.status, 409);
});

test('AI-ta on ainult koodi leiud ilma otsuseta; aegunud leidu ei rakendata', async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await startServer(createDisabledAi());

  const before = backlogRows();
  const res = await post('/run');
  const { review } = await res.json();
  assert.deepEqual(backlogRows(), before);
  assert.equal(review.ai, false);
  assert.match(review.aiNote, /liiga suuri ja kattuvaid lugusid ei kontrollitud/);
  assert.deepEqual([...new Set(review.findings.map((f) => f.type))].sort(), ['connextra', 'no_criteria', 'no_mockup', 'untestable']);

  // Mockup'i leiu kohta ei tehta automaatset otsust: rakendada saab ainult kasutaja valikuga.
  assert.equal(finding(review, `no_mockup-${ids.noMockup}`).suggestion, null);
  assert.equal((await (await post(`/findings/no_mockup-${ids.noMockup}/apply`)).json()).code, 'no_suggestion');

  db.prepare("UPDATE criteria SET text = 'Hinnakirjas on hind.' WHERE id = ?").run(ids.vague);
  const stale = await post(`/findings/untestable-${ids.vague}/apply`, { value: { text: 'Uus tekst.' } });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'stale_finding');
  assert.equal(db.prepare('SELECT text FROM criteria WHERE id = ?').get(ids.vague).text, 'Hinnakirjas on hind.');
});

// L28: AI jagamine leiust ja selle tagasivõtmine.
const fullRows = () => ({ ...backlogRows(), project: { ...db.prepare('SELECT focus_story_id, mvp_count FROM projects WHERE id = ?').get(projectId) } });

test('AI jagamine jaotab kriteeriumid ettepaneku järgi ja tagasivõtmine taastab algse seisu täpselt', async () => {
  db.prepare("INSERT INTO story_questions (story_id, text) VALUES (?, 'Kas makse käib kaardiga?')").run(ids.tooLarge);
  db.prepare("UPDATE stories SET status = 'vajab_tapsustamist' WHERE id = ?").run(ids.tooLarge);
  db.prepare('UPDATE projects SET focus_story_id = ?, mvp_count = 6 WHERE id = ?').run(ids.tooLarge, projectId);
  db.prepare("UPDATE criteria SET ref_kind = 'no_view', ref_source = 'user' WHERE id = ?").run(ids.largeCriteria[1]);
  await runReview();
  const before = fullRows();

  let res = await post(`/findings/too_large-${ids.tooLarge}/apply`);
  assert.equal(res.status, 200);
  const second = db.prepare('SELECT id FROM stories WHERE position = 6').get().id;
  assert.notEqual(second, ids.tooLarge);
  const textsOf = (id) => db.prepare('SELECT text FROM criteria WHERE story_id = ? ORDER BY position').all(id).map((r) => r.text);
  assert.deepEqual(textsOf(ids.tooLarge), ['Lehel on pealkiri.', 'Lehel on nupp „Saada“.']);
  assert.deepEqual(textsOf(second), ['Lehel on otsinguväli.']);
  assert.equal(db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId).n, 7);

  res = await post(`/findings/too_large-${ids.tooLarge}/undo`);
  assert.equal(res.status, 200);
  assert.deepEqual(fullRows(), before); // koht, kriteeriumide järjestus ja seos, küsimus, staatus, MVP joon, alustamise lugu
  assert.equal(finding((await res.json()).review, `too_large-${ids.tooLarge}`).status, 'undone');
});

test('vigane kriteeriumide jaotus jäetakse välja; muudetud osa korral tagasivõtmist ei tehta', async () => {
  const [a, b, c] = ids.largeCriteria;
  for (const [firstCriteria, secondCriteria] of [[[a], [b]], [[a, b], [b, c]], [[a, b], [c, ids.vague]]]) { // puudub / kahes / võõras
    const data = AI_REVIEW();
    Object.assign(data.tooLarge[0], { firstCriteria, secondCriteria });
    assert.equal(finding(await runReview(data), `too_large-${ids.tooLarge}`).suggestion, null);
  }

  await runReview();
  assert.equal((await post(`/findings/too_large-${ids.tooLarge}/apply`)).status, 200);
  const second = db.prepare('SELECT id FROM stories WHERE position = 6').get().id;
  db.prepare("UPDATE stories SET want = 'broneerida trenni veebis' WHERE id = ?").run(second);
  const after = fullRows();
  const res = await post(`/findings/too_large-${ids.tooLarge}/undo`);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /osa 2 on pärast jagamist muutunud.*Osalist taastamist ei tehta/);
  assert.deepEqual(fullRows(), after);
});

// L29: AI ühendamine leiust ja selle tagasivõtmine.
const withMockups = () => ({ ...fullRows(), mockups: db.prepare('SELECT * FROM mockups ORDER BY id').all().map((r) => ({ ...r })) });
const addMockup = (storyId) => db.prepare('INSERT INTO mockups (story_id, version, spec) VALUES (?, 1, ?)')
  .run(storyId, JSON.stringify({ title: 'Nädal', components: [{ type: 'heading', text: 'Nädala treeningud', items: [] }] }));

test('AI ühendamine järgib ettepanekut (mockup ühel lool lubatud) ja tagasivõtmine taastab mõlemad lood täpselt', async () => {
  addMockup(ids.dupB); // mockup ainult eemaldataval lool: säilib ühendatud loos
  db.prepare("UPDATE criteria SET ref_kind = 'element', ref_index = 0, ref_version = 1, ref_source = 'user' WHERE id = ?").run(ids.dupBCriteria[0]);
  db.prepare("INSERT INTO story_questions (story_id, text) VALUES (?, 'Kas näidata ka saali?')").run(ids.dupB);
  db.prepare('UPDATE projects SET focus_story_id = ?, mvp_count = 7 WHERE id = ?').run(ids.dupB, projectId);
  const review = await runReview();
  assert.equal(finding(review, `overlap-${ids.dupA}-${ids.dupB}`).mergeInfo.blocked, false);
  const before = withMockups();

  let res = await post(`/findings/overlap-${ids.dupA}-${ids.dupB}/apply`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT 1 FROM stories WHERE id = ?').get(ids.dupB), undefined);
  const kept = db.prepare('SELECT id, ref_kind FROM criteria WHERE story_id = ? ORDER BY position').all(ids.dupA).map((r) => ({ ...r }));
  assert.deepEqual(kept.map((c) => c.id), [...ids.dupACriteria, ids.dupBCriteria[0], ids.dupBCriteria[2]]); // kordus eemaldatud
  assert.equal(kept[3].ref_kind, 'element'); // mockup tuli kaasa, seos säilis
  assert.deepEqual({ ...db.prepare('SELECT want, status FROM stories WHERE id = ?').get(ids.dupA) }, { want: 'näha nädala treeningute kava', status: 'vajab_tapsustamist' });
  assert.deepEqual({ ...db.prepare('SELECT focus_story_id AS f, mvp_count AS m FROM projects WHERE id = ?').get(projectId) }, { f: ids.dupA, m: 6 });
  assert.equal(db.prepare('SELECT story_id FROM mockups').get().story_id, ids.dupA);

  res = await post(`/findings/overlap-${ids.dupA}-${ids.dupB}/undo`);
  assert.equal(res.status, 200);
  assert.deepEqual(withMockups(), before); // id-d, kriteeriumid ja järjekord, seosed, küsimus, staatused, MVP, alustamise lugu, mockup
});

test('vigane ühendamisjaotus jäetakse välja; mõlema mockupi korral keeldutakse; muudetud ühendatud lugu ei võeta tagasi', async () => {
  const [a1, a2, a3] = ids.dupACriteria;
  const [b1, b2, b3] = ids.dupBCriteria;
  const keep = (id) => ({ criterionId: id, action: 'keep', duplicateOf: 0 });
  const bad = [
    [keep(a1), keep(a2), keep(a3), keep(b1), keep(b2)], // b3 puudub
    [keep(a1), keep(a2), keep(a3), keep(b1), keep(b2), keep(b3), keep(b3)], // b3 kaks korda
    [keep(a1), keep(a2), keep(a3), keep(b1), keep(b3), { criterionId: b2, action: 'duplicate', duplicateOf: 9999 }], // kordab olematut
  ];
  for (const criteria of bad) {
    const data = AI_REVIEW();
    data.overlaps[0].criteria = criteria;
    assert.equal(finding(await runReview(data), `overlap-${ids.dupA}-${ids.dupB}`).suggestion.merge, null);
  }

  addMockup(ids.dupA);
  addMockup(ids.dupB);
  await runReview();
  let res = await post(`/findings/overlap-${ids.dupA}-${ids.dupB}/apply`);
  assert.equal((await res.json()).code, 'both_mockups');
  db.prepare('DELETE FROM mockups WHERE story_id = ?').run(ids.dupA);

  assert.equal((await post(`/findings/overlap-${ids.dupA}-${ids.dupB}/apply`)).status, 200);
  db.prepare("UPDATE stories SET want = 'näha nädala kava' WHERE id = ?").run(ids.dupA);
  const after = withMockups();
  res = await post(`/findings/overlap-${ids.dupA}-${ids.dupB}/undo`);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /Ühendamist ei saa tagasi võtta.*Osalist taastamist ei tehta/);
  assert.deepEqual(withMockups(), after);
});

// L18: ülevaatuse asendustekst, mis on ise mittekontrollitav – üks lisapäring; parandamata tekst jääb märkega.
test('enesekontroll ülevaatusel: mittekontrollitav asendustekst saab ühe ümbersõnastuse, parandamata jääb märkega', async () => {
  const data = AI_REVIEW();
  data.criterionFixes[0].text = 'Hinnakiri on selge.';
  ai.push(aiOk(data), aiOk({ criteria: [{ key: `untestable-${ids.vague}`, text: 'Hinnakiri on lihtne.' }] }));
  const res = await post('/run');
  assert.equal(ai.calls.length, 2);
  const s = finding((await res.json()).review, `untestable-${ids.vague}`).suggestion;
  assert.deepEqual([s.text, s.selfCheck.status], ['Hinnakiri on selge.', 'still_untestable']);
});
