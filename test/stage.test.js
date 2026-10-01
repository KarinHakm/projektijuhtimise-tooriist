import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { AI_OUTPUT_CARD, CARDS, computeStage, MAX_STEPS } from '../shared/stage.js';

// Etapid ja järgmised sammud (L13, L14). Puhas loogika, ilma andmebaasi ja AI-ta.
const NO_PENDING = { roles: false, stories: false, priority: false, criteria: false, mockup: false, refinement: false };
const facts = (over = {}) => ({
  conversation: 'empty', roles: 0, stories: 0, focus: false, criteria: 0, mockup: false, refinements: 0,
  consistency: null, latestAi: null, ...over, pending: { ...NO_PENDING, ...over.pending },
});
// Testandmebaasi projektide seis (vestlust neis pole, rollid on lisatud otse).
const P101 = facts({ roles: 2, stories: 4, focus: true, criteria: 3, mockup: true, refinements: 3, consistency: { warnings: 0, reviewValid: true }, latestAi: { kind: 'refinement' } });
const P102 = facts({ roles: 2, stories: 3, latestAi: { kind: 'stories' } });
const P103 = facts({ roles: 2, pending: { stories: true }, latestAi: { kind: 'stories' } });

const statuses = (r) => Object.fromEntries(r.stages.map((s) => [s.key, s.status]));
const ids = (r) => r.steps.map((s) => s.id);

test('uus projekt: ükski etapp pole läbitud, soovitatud on idee kirjeldamine; ülejäänud on eelduseta', () => {
  const r = computeStage(facts());
  assert.equal(r.lastDone, null);
  assert.deepEqual(r.next, { key: 'idee', label: 'Idee' });
  assert.deepEqual(ids(r), ['write-idea']);
  assert.deepEqual(statuses(r), { idee: 'next', rollid: 'blocked', lood: 'blocked', prioriteedid: 'blocked', kriteeriumid: 'blocked', tapsustused: 'blocked', groomimine: 'not_built' });
  assert.equal(r.latestAiCard, null);
});

test('projekt 101: etapid 2–6 tehtud, viimati läbitud „Täpsustused“, edasi ainult valikulised sammud', () => {
  const r = computeStage(P101);
  assert.deepEqual(statuses(r), { idee: 'skipped', rollid: 'done', lood: 'done', prioriteedid: 'done', kriteeriumid: 'done', tapsustused: 'done', groomimine: 'not_built' });
  assert.deepEqual(r.lastDone, { key: 'tapsustused', label: 'Täpsustused' });
  assert.equal(r.next, null);
  assert.equal(r.allBuiltDone, true);
  assert.deepEqual(ids(r), ['refine-again', 'view-backlog', 'choose-other']);
  assert.ok(r.steps.every((s) => s.optional));
  assert.equal(r.latestAiCard, 'refinement');
});

test('projekt 102: viimati läbitud „Lood“, soovitatud prioriteet; kriteeriumide sammu pole, etapp on eelduseta', () => {
  const r = computeStage(P102);
  assert.deepEqual(r.lastDone, { key: 'lood', label: 'Lood' });
  assert.deepEqual(r.next, { key: 'prioriteedid', label: 'Prioriteedid' });
  assert.deepEqual(ids(r), ['propose-priority', 'choose-priority']);
  const criteria = r.stages.find((s) => s.key === 'kriteeriumid');
  assert.deepEqual([criteria.status, criteria.reason, criteria.selectable], ['blocked', 'Vali enne alustamise lugu.', false]);
  assert.ok(!r.steps.some((s) => s.card === 'criteria' || s.card === 'refinement'));
});

test('projekt 103: ootel lugude ettepanek → „Vali lood backlog’i“ lugude kaardil', () => {
  const r = computeStage(P103);
  assert.deepEqual(r.lastDone, { key: 'rollid', label: 'Rollid' });
  assert.deepEqual(r.next, { key: 'lood', label: 'Lood' });
  assert.deepEqual(r.steps.map((s) => [s.id, s.label, s.card]), [['review-stories', "Vali lood backlog'i", 'stories']]);
  assert.equal(r.latestAiCard, 'stories');
});

test('vestluse olekud: vastamata küsimused ja saamata AI vastus', () => {
  assert.deepEqual(ids(computeStage(facts({ conversation: 'questions' }))), ['answer-questions']);
  const r = computeStage(facts({ conversation: 'unanswered' }));
  assert.deepEqual(ids(r), ['retry-conversation']);
  assert.equal(r.steps[0].ai, true);
  assert.deepEqual(ids(computeStage(facts({ conversation: 'done' }))), ['propose-roles']);
});

test('ülevaatamata kooskõla hoiatused tulevad enne täpsustust; kehtiv ülevaatus eemaldab sammu', () => {
  const base = { conversation: 'done', roles: 1, stories: 2, focus: true, criteria: 2, mockup: true };
  assert.deepEqual(ids(computeStage(facts({ ...base, consistency: { warnings: 2, reviewValid: false } }))), ['review-consistency', 'refine']);
  assert.deepEqual(ids(computeStage(facts({ ...base, consistency: { warnings: 2, reviewValid: true } }))), ['refine']);
});

test('kriteeriumide etapp: ootel kriteeriumid ja mockup; ilma mockup’ita kriteeriumid → mockup’i küsimine', () => {
  const base = { conversation: 'done', roles: 1, stories: 2, focus: true };
  assert.deepEqual(ids(computeStage(facts({ ...base, pending: { criteria: true, mockup: true } }))), ['review-criteria', 'review-mockup']);
  assert.deepEqual(ids(computeStage(facts(base))), ['propose-criteria']);
  assert.deepEqual(ids(computeStage(facts({ ...base, criteria: 2 }))), ['propose-mockup']);
});

test('sammu kunagi üle 4 ja kunagi eelduseta etapile; Groomimist ei soovitata ega saa valida', () => {
  const bools = [false, true];
  let checked = 0;
  for (const conversation of ['empty', 'questions', 'unanswered', 'done']) for (const roles of [0, 2]) for (const stories of [0, 3])
    for (const focus of bools) for (const criteria of [0, 2]) for (const mockup of bools) for (const refinements of [0, 1])
      for (const pend of bools) for (const warn of bools) {
        const pending = Object.fromEntries(Object.keys(NO_PENDING).map((k) => [k, pend]));
        const r = computeStage(facts({ conversation, roles, stories, focus, criteria, mockup, refinements, pending, consistency: warn ? { warnings: 1, reviewValid: false } : null }));
        assert.ok(r.steps.length >= 1 && r.steps.length <= MAX_STEPS, JSON.stringify(r.steps));
        const byKey = Object.fromEntries(r.stages.map((s) => [s.key, s]));
        for (const s of r.steps) assert.ok(byKey[s.stage].status !== 'blocked' && byKey[s.stage].status !== 'not_built', `${s.id} eelduseta etapis ${s.stage}`);
        assert.equal(byKey.groomimine.selectable, false);
        assert.ok(!r.steps.some((s) => s.stage === 'groomimine'));
        assert.equal(r.stages.filter((s) => s.status === 'next').length, r.next ? 1 : 0);
        checked++;
      }
  assert.equal(checked, 4 * 2 * 2 * 2 * 2 * 2 * 2 * 2 * 2);
});

test('uusima AI väljundi kaart: igale AI väljundi liigile on projekti vaates kaart', () => {
  for (const [kind, card] of Object.entries(AI_OUTPUT_CARD)) {
    assert.equal(computeStage(facts({ latestAi: { kind } })).latestAiCard, card);
    assert.ok(CARDS[card], kind);
  }
});

// Iga sammu sihtmärk peab olemasolevates komponentides olemas olema (muidu nupp ei vii kuhugi).
test('kõigi sammude kaardid ja fookuse sihtmärgid on projekti vaates olemas', () => {
  const view = readFileSync('src/pages/ProjectView.jsx', 'utf8');
  const components = readdirSync('src/components').map((f) => readFileSync(`src/components/${f}`, 'utf8')).join('\n');
  for (const key of Object.keys(CARDS)) assert.match(view, new RegExp(`id=\\{CARDS\\.${key}\\}`), key);
  const seen = new Map();
  const variants = [facts(), facts({ conversation: 'questions' }), facts({ conversation: 'unanswered' }), facts({ conversation: 'done' }),
    P101, P102, P103, facts({ conversation: 'done', roles: 1, pending: { roles: true } }), facts({ roles: 1, stories: 2, pending: { priority: true } }),
    facts({ roles: 1, stories: 2, focus: true }), facts({ roles: 1, stories: 2, focus: true, criteria: 1 }),
    facts({ roles: 1, stories: 2, focus: true, pending: { criteria: true, mockup: true } }),
    facts({ roles: 1, stories: 2, focus: true, criteria: 1, mockup: true, consistency: { warnings: 1, reviewValid: false }, pending: { refinement: true } }),
    facts({ roles: 1, stories: 2, focus: true, criteria: 1, mockup: true })];
  for (const v of variants) for (const s of computeStage(v).steps) seen.set(s.id, s);
  const allIds = [...readFileSync('shared/stage.js', 'utf8').matchAll(/add(?:Pending)?\(\{ id: '([\w-]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...seen.keys()].sort(), [...new Set(allIds)].sort()); // kõik sammud on läbi proovitud
  for (const s of seen.values()) {
    assert.ok(CARDS[s.card], s.id);
    if (!s.focus) continue;
    const [, kind, name] = s.focus.match(/^(#|\.|\[data-step=")([\w-]+)/);
    const pattern = kind === '#' ? `id="${name}"` : kind === '.' ? `className="${name}"` : `data-step="${name}"`;
    assert.ok(components.includes(pattern), `${s.id}: ${pattern}`);
  }
});

test('näidisprojekti nimi: eesliide „Näidis: “ eraldatakse märgiks, muu nimi jääb samaks', async () => {
  const { splitDemoName } = await import('../src/demo/name.js');
  assert.deepEqual(splitDemoName("Näidis: backlog'i järjestamine"), { demo: true, name: "backlog'i järjestamine" });
  assert.deepEqual(splitDemoName('TESTKOOPIA A – Lisa kõik'), { demo: false, name: 'TESTKOOPIA A – Lisa kõik' });
});

test('tehtud etapi ootel lisaettepanek on viimane: esimene samm vastab ribal soovitatud etapile (spordiklubi näidis)', () => {
  const r = computeStage(facts({
    conversation: 'done', roles: 2, stories: 4, focus: true, criteria: 3, mockup: true,
    consistency: { warnings: 1, reviewValid: false }, pending: { stories: true, refinement: true }, latestAi: { kind: 'refinement' },
  }));
  assert.deepEqual(r.next, { key: 'tapsustused', label: 'Täpsustused' });
  assert.deepEqual(r.steps.map((s) => [s.id, s.label]), [
    ['review-refinement', 'Vaata täpsustuse ettepanek üle'],
    ['review-consistency', 'Vaata kooskõla hoiatused üle'],
    ['review-stories', "Vali lisalood backlog'i"],
  ]);
});
