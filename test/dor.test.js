import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dorMissing, evaluateDor } from '../shared/dor.js';

// Valmisoleku definitsioon (L19): iga tingimus eraldi.
const STORY = { rolePhrase: 'Külastajana', want: 'esitada liikmeks astumise taotluse', soThat: 'saaksin klubiga liituda', touchesView: true };
const C3 = [{ text: "Vormil on väli 'E-post'." }, { text: "Vormil on nupp 'Saada'." }, { text: 'Pärast saatmist kuvatakse kinnitusteade.' }];
const ok = { story: STORY, criteria: C3, hasMockup: true, openQuestions: 0 };
const failing = (input) => evaluateDor(input).checks.filter((c) => !c.ok).map((c) => c.key);

test('kõik tingimused täidetud → DoR ok', () => {
  assert.equal(evaluateDor(ok).ok, true);
  assert.deepEqual(dorMissing(evaluateDor(ok)), []);
});

test('iga tingimus eraldi: Connextra, ≥3 kriteeriumi, kontrollitavus, mockup, avatud küsimused', () => {
  assert.deepEqual(failing({ ...ok, story: { ...STORY, rolePhrase: 'Külastaja' } }), ['connextra']);
  assert.deepEqual(failing({ ...ok, criteria: C3.slice(0, 2) }), ['criteria_count']);
  assert.deepEqual(failing({ ...ok, criteria: [...C3.slice(0, 2), { text: 'Vorm on kasutajasõbralik.' }] }), ['criteria_testable']);
  assert.deepEqual(failing({ ...ok, hasMockup: false }), ['mockup']);
  assert.deepEqual(failing({ ...ok, story: { ...STORY, touchesView: false }, hasMockup: false }), []); // vaadet mitte puudutav lugu
  assert.deepEqual(failing({ ...ok, openQuestions: 1 }), ['questions']);
  assert.deepEqual(failing({ ...ok, criteria: [] }), ['criteria_count', 'criteria_testable']);
});

test('puuduste tekst nimetab tingimuse ja põhjuse', () => {
  const missing = dorMissing(evaluateDor({ ...ok, criteria: [...C3.slice(0, 2), { text: 'Vorm on kiire ja lihtne.' }], openQuestions: 2 }));
  assert.deepEqual(missing, ['Kõik kriteeriumid läbivad kontrollitavuse kontrolli – Hoiatus: K3.', 'Avatud küsimusi ei ole – Avatud küsimusi: 2.']);
});
