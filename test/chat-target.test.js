import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStage } from '../shared/stage.js';
import { pickTarget, preferredTarget, startsOfferedAbove, stepsForBlock, visibleBlocks } from '../src/chat/target.js';

// L37: ühe vestluse plokid ja vestluse kasti sihtkoht etapiseisu järgi (päringuid pole).
const NO_PENDING = { roles: false, stories: false, priority: false, criteria: false, mockup: false, refinement: false };
const facts = (over = {}) => ({
  conversation: 'empty', roles: 0, stories: 0, focus: false, criteria: 0, mockup: false, refinements: 0,
  consistency: null, latestAi: null, ...over, pending: { ...NO_PENDING, ...over.pending },
});

test('plokk ilmub alles siis, kui selle etapini on jõutud; lukus etappe vestluses pole', () => {
  assert.deepEqual(visibleBlocks(null), []);
  assert.deepEqual(visibleBlocks(computeStage(facts())), []);
  assert.deepEqual(visibleBlocks(computeStage(facts({ conversation: 'done' }))), ['roles']);
  assert.deepEqual(visibleBlocks(computeStage(facts({ conversation: 'done', roles: 2 }))), ['roles', 'stories']);
  assert.deepEqual(visibleBlocks(computeStage(facts({ conversation: 'done', roles: 2, stories: 5 }))), ['roles', 'stories', 'priority']);
  assert.deepEqual(visibleBlocks(computeStage(facts({ conversation: 'done', roles: 2, stories: 5, focus: true }))), ['roles', 'stories', 'priority', 'criteria']);
  assert.deepEqual(visibleBlocks(computeStage(facts({ conversation: 'done', roles: 2, stories: 5, focus: true, criteria: 3, mockup: true }))),
    ['roles', 'stories', 'priority', 'criteria', 'refinement']);
});

test('kasti sihtkoht järgib vestluse kohta: idee → pooleli otsus või järgmine samm → täpsustus → „Mida teeme edasi?“', () => {
  assert.equal(preferredTarget(computeStage(facts()), 'empty'), 'conversation');
  for (const phase of ['questions', 'waiting', 'unanswered', null]) assert.equal(preferredTarget(computeStage(facts()), phase), null, phase);
  assert.equal(preferredTarget(computeStage(facts({ conversation: 'done' })), 'done'), 'roles');
  assert.equal(preferredTarget(computeStage(facts({ conversation: 'done', roles: 2, pending: { stories: true } })), 'done'), 'stories');
  assert.equal(preferredTarget(computeStage(facts({ conversation: 'done', roles: 2, stories: 5 })), 'done'), 'priority');
  assert.equal(preferredTarget(computeStage(facts({ conversation: 'done', roles: 2, stories: 5, focus: true })), 'done'), 'criteria');
  const built = facts({ conversation: 'done', roles: 2, stories: 5, focus: true, criteria: 3, mockup: true, consistency: { warnings: 0, reviewValid: true } });
  assert.equal(preferredTarget(computeStage(built), 'done'), 'refinement');
  assert.equal(preferredTarget(computeStage({ ...built, refinements: 1 }), 'done'), 'next'); // groomimine: backlog'i veerus
});

test('kui samm teksti vastu ei võta, valitakse järgmine sobiv; „Mida teeme edasi?“ on alati varuks', () => {
  assert.equal(pickTarget(null, new Set()), null);
  assert.equal(pickTarget('roles', new Set(['roles'])), 'roles');
  assert.equal(pickTarget('roles', new Set()), 'next');
  assert.equal(pickTarget('criteria', new Set(['refinement'])), 'refinement'); // kinnitatud kriteeriume muudab täpsustus
  assert.equal(pickTarget('conversation', new Set()), null); // ideed ei suunata mujale
  assert.equal(pickTarget('next', new Set()), 'next');
});

test('ploki all ei korrata sama ploki nähtava otsuse sammu; sammud edasi ja teise plokki jäävad', () => {
  const pending = computeStage(facts({ conversation: 'done', roles: 2, pending: { stories: true }, latestAi: { kind: 'stories' } }));
  assert.equal(pending.stepsByCard.stories[0].id, 'review-stories'); // „Vali lood backlog'i“
  assert.deepEqual(stepsForBlock('stories', pending.stepsByCard.stories).map((s) => s.id), []);
  const questions = computeStage(facts({ conversation: 'questions' }));
  assert.deepEqual(stepsForBlock('conversation', questions.stepsByCard.conversation).map((s) => s.id), []);
  const built = computeStage(facts({ conversation: 'done', roles: 2, stories: 5, focus: true, criteria: 3, mockup: true, consistency: { warnings: 0, reviewValid: true }, latestAi: { kind: 'mockup' } }));
  assert.deepEqual(stepsForBlock('criteria', built.stepsByCard.criteria).map((s) => s.id), built.stepsByCard.criteria.map((s) => s.id)); // „Sisesta kliendi täpsustus“ jääb
  assert.deepEqual(stepsForBlock('roles', [{ id: 'review-stories', card: 'stories' }]).map((s) => s.id), ['review-stories']); // teise ploki otsus jääb
  assert.deepEqual(stepsForBlock('roles', undefined), []);
});

test('järgmise ploki algusnupp peidetakse, kui sama samm on teise ploki „Mida teeme edasi?“ all', () => {
  const st = computeStage(facts({ conversation: 'done', roles: 2, latestAi: { kind: 'roles' } }));
  const shown = Object.fromEntries(Object.entries(st.stepsByCard).map(([c, steps]) => [c, stepsForBlock(c, steps)]));
  assert.deepEqual(startsOfferedAbove(shown), { stories: ['stories-propose'] }); // „Paku lugusid“ peidus
  assert.deepEqual(startsOfferedAbove({ stories: [{ id: 'propose-stories', card: 'stories', ai: true, focus: '[data-step="stories-propose"]' }] }), {}); // oma ploki samm ei peida
  assert.deepEqual(startsOfferedAbove({ roles: [{ id: 'refine', card: 'refinement', ai: true, focus: '#chat-text' }] }), {});
});
