import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allAnswered, buildAnswers, conversationPhase, describeAnswer, emptyDraft, isAnswered, setOther, toggleOption, toggleOther, toggleSkip,
} from '../src/conversation/answers.js';

// Vestluse vaate loogika testid (ilma brauseri ja AI-ta).
const MULTI = { id: 'k1', text: 'Kes on kasutajad?', multiSelect: true, options: ['Külastaja', 'Klubi liige', 'Administraator'] };
const SINGLE = { id: 'k2', text: 'Kas tasu makstakse veebis?', multiSelect: false, options: ['Jah, veebis', 'Ei, kohapeal'] };

test('mitmikvalikus saab valida mitu varianti ja valiku uuesti vajutamine eemaldab selle', () => {
  let d = emptyDraft();
  d = toggleOption(MULTI, d, 'Külastaja');
  d = toggleOption(MULTI, d, 'Administraator');
  assert.deepEqual(d.selected, ['Külastaja', 'Administraator']);
  d = toggleOption(MULTI, d, 'Külastaja');
  assert.deepEqual(d.selected, ['Administraator']);
});

test('üksikvalikus asendab uus valik eelmise', () => {
  let d = toggleOption(SINGLE, emptyDraft(), 'Jah, veebis');
  d = toggleOption(SINGLE, d, 'Ei, kohapeal');
  assert.deepEqual(d.selected, ['Ei, kohapeal']);
});

test('üksikvalikus tühistab "Muu" teised valikud ja variant sulgeb "Muu"', () => {
  let d = toggleOption(SINGLE, emptyDraft(), 'Jah, veebis');
  d = setOther(toggleOther(SINGLE, d), 'Osaliselt veebis');
  assert.deepEqual(d.selected, []);
  assert.equal(d.otherOpen, true);
  d = toggleOption(SINGLE, d, 'Ei, kohapeal');
  assert.equal(d.otherOpen, false);
  assert.equal(d.other, '');
});

test('mitmikvalikus võib "Muu" olla koos valikutega', () => {
  let d = toggleOption(MULTI, emptyDraft(), 'Külastaja');
  d = setOther(toggleOther(MULTI, d), 'Treener');
  assert.deepEqual(buildAnswers([MULTI], { k1: d }), [{ questionId: 'k1', selected: ['Külastaja'], other: 'Treener', skipped: false }]);
});

test('"Jäta vahele" tühistab valikud; uuesti vajutamine võtab vahelejätmise tagasi', () => {
  let d = toggleOption(MULTI, emptyDraft(), 'Külastaja');
  d = toggleSkip(d);
  assert.deepEqual(d, { selected: [], otherOpen: false, other: '', skipped: true });
  assert.deepEqual(toggleSkip(d), emptyDraft());
  // Variandi valimine pärast vahelejätmist tühistab vahelejätmise.
  assert.equal(toggleOption(MULTI, d, 'Külastaja').skipped, false);
});

test('vastatuks loetakse valik, mittetühi oma vastus või vahelejätmine', () => {
  assert.equal(isAnswered(emptyDraft()), false);
  assert.equal(isAnswered(toggleOther(MULTI, emptyDraft())), false); // "Muu" avatud, aga tühi
  assert.equal(isAnswered(setOther(toggleOther(MULTI, emptyDraft()), '   ')), false);
  assert.equal(isAnswered(setOther(toggleOther(MULTI, emptyDraft()), 'Treener')), true);
  assert.equal(isAnswered(toggleSkip(emptyDraft())), true);
  assert.equal(allAnswered([MULTI, SINGLE], { k1: toggleSkip(emptyDraft()) }), false);
  assert.equal(allAnswered([MULTI, SINGLE], { k1: toggleSkip(emptyDraft()), k2: toggleOption(SINGLE, emptyDraft(), 'Jah, veebis') }), true);
});

test('buildAnswers: serveri kuju, valikud variantide järjekorras, suletud "Muu" tekst ei lähe kaasa', () => {
  let d1 = toggleOption(MULTI, emptyDraft(), 'Administraator');
  d1 = toggleOption(MULTI, d1, 'Külastaja');
  let d2 = setOther(toggleOther(SINGLE, emptyDraft()), '  Hiljem  ');
  assert.deepEqual(buildAnswers([MULTI, SINGLE], { k1: d1, k2: d2 }), [
    { questionId: 'k1', selected: ['Külastaja', 'Administraator'], other: null, skipped: false },
    { questionId: 'k2', selected: [], other: 'Hiljem', skipped: false },
  ]);
  d2 = toggleOther(SINGLE, d2); // "Muu" suletud
  assert.equal(buildAnswers([SINGLE], { k2: d2 })[0].other, null);
});

test('conversationPhase määrab vaate oleku viimase sõnumi järgi', () => {
  const idea = { role: 'user', kind: 'idea' };
  assert.equal(conversationPhase([], false), 'empty');
  assert.equal(conversationPhase([idea], true), 'waiting');
  assert.equal(conversationPhase([idea], false), 'unanswered');
  assert.equal(conversationPhase([idea, { role: 'assistant', kind: 'questions' }], false), 'questions');
  assert.equal(conversationPhase([idea, { role: 'assistant', kind: 'summary' }], false), 'done');
});

test('describeAnswer näitab valikud, oma vastuse ja vahelejätmise', () => {
  assert.equal(describeAnswer(MULTI, { selected: ['Külastaja'], other: 'Treener', skipped: false }), 'Külastaja, muu: Treener');
  assert.equal(describeAnswer(SINGLE, { selected: [], other: null, skipped: true }), 'jäetud vahele');
});
