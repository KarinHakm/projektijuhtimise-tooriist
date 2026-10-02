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
  const ok = (storyId) => ['Lehel on pealkiri.', 'Lehel on otsinguväli.', 'Lehel on nupp „Saada“.'].forEach((t, i) => crit.get(storyId, i + 1, t));

  const badTitle = add(1, 'Külastaja', 'näha tunniplaani', 'saaksin trenni valida', 'S', false); // pole olevas käändes
  ok(badTitle);
  const untestable = add(2, 'Külastajana', 'näha hinnakirja', 'saaksin paketi valida', 'S', false);
  const vague = crit.get(untestable, 1, 'Hinnakiri on selgelt näha.').id;
  const noCriteria = add(3, 'Külastajana', 'saada klubile sõnum', 'saaksin küsimusele vastuse', 'S', false);
  const noMockup = add(4, 'Külastajana', 'näha treenerite tutvustust', 'saaksin treeneri valida', 'S', true);
  ok(noMockup);
  const tooLarge = add(5, 'Külastajana', 'registreeruda, maksta liikmemaksu ja broneerida trenni', 'saaksin klubiga liituda', 'L', false);
  ok(tooLarge);
  const dupA = add(6, 'Külastajana', 'näha treeningute nädalakava', 'saaksin aja valida', 'S', false);
  ok(dupA);
  const dupB = add(7, 'Külastajana', 'vaadata nädala treeninguid', 'saaksin sobiva aja leida', 'S', false);
  ok(dupB);
  return { badTitle, untestable, vague, noCriteria, noMockup, tooLarge, dupA, dupB };
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
  }],
  overlaps: [
    { keepId: ids.dupA, removeId: ids.dupB, problem: 'Mõlemad näitavad nädala treeninguid.', reason: 'Sama nõue kahes loos.', suggestion: 'Ühenda lugu 7 looga 6.' },
    { keepId: ids.dupA, removeId: 999, problem: 'Olematu lugu.', reason: 'x', suggestion: 'x' }, // vigane viide jäetakse välja
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
async function runReview() {
  ai.push(aiOk(AI_REVIEW()));
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
  assert.deepEqual(finding(review, `overlap-${ids.dupA}-${ids.dupB}`).suggestion, { keepId: ids.dupA, removeId: ids.dupB, text: 'Ühenda lugu 7 looga 6.' });
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
  res = await post(`/findings/too_large-${ids.tooLarge}/apply`);
  assert.equal((await res.json()).code, 'use_form'); // jagamine käib eelvaatega vormis; enne seda leidu ei märgita
  const part = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin klubiga liituda', size: 'M', touchesView: false });
  const split = await fetch(`${base}/${projectId}/stories/${ids.tooLarge}/split`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first: part('registreeruda klubi liikmeks'), second: part('broneerida trenni'), criteriaToSecond: [], questionsToSecond: [] }),
  });
  assert.equal(split.status, 200);
  res = await post(`/findings/too_large-${ids.tooLarge}/apply`);
  assert.equal(res.status, 200);
  assert.equal(finding((await res.json()).review, `too_large-${ids.tooLarge}`).status, 'applied');
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
