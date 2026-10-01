import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accept, addManual, buildSave, edit, fromProposal, remove, visible } from '../src/criteria/selection.js';

// Kriteeriumide valiku loogika (L09) ilma brauseri, serveri ja AI-ta.
const PROPOSAL = { id: 'p1', criteria: ['A on olemas.', 'B on olemas.', 'C on olemas.', 'D on olemas.'].map((text, index) => ({ index, text })) };
const key = (i) => `ai-${i}`;

test('alguses on kõik ootel; "Salvesta kinnitatud" ei saada midagi, "Kinnita kõik" saadab kõik', () => {
  const items = fromProposal(PROPOSAL);
  assert.deepEqual(buildSave(items, 'confirmed'), []);
  assert.deepEqual(buildSave(items, 'all').map((c) => c.index), [0, 1, 2, 3]);
});

test('osa kinnitamine, üks eemaldamine ja üks muutmine: salvestatakse ainult kinnitatud ja muudetud', () => {
  let items = fromProposal(PROPOSAL);
  items = accept(items, key(0));
  items = remove(items, key(1));
  items = edit(items, key(2), 'C on olemas koos hinnaga.').items;
  assert.deepEqual(buildSave(items, 'confirmed'), [{ index: 0, text: 'A on olemas.' }, { index: 2, text: 'C on olemas koos hinnaga.' }]);
});

test('eemaldatud kriteerium ei tule tagasi ka "Kinnita kõik" korral ega ole nähtav', () => {
  let items = remove(fromProposal(PROPOSAL), key(1));
  items = accept(items, key(1)); // ka hilisem ✓ ei too eemaldatut tagasi
  assert.deepEqual(buildSave(items, 'all').map((c) => c.index), [0, 2, 3]);
  assert.deepEqual(buildSave(items, 'confirmed'), []);
  assert.ok(!visible(items).some((i) => i.index === 1));
});

test('muutmine: sama tekst = kinnitatud, erinev = muudetud; tühi tekst annab vea', () => {
  const items = fromProposal(PROPOSAL);
  assert.equal(edit(items, key(0), '  A on   olemas. ').items[0].state, 'accepted');
  assert.equal(edit(items, key(0), 'A on olemas alati.').items[0].state, 'edited');
  assert.ok(edit(items, key(0), '   ').error);
  const edited = edit(items, key(0), 'A on olemas alati.').items;
  assert.equal(accept(edited, key(0))[0].state, 'edited'); // ✓ ei kaota muudatust
});

test('käsitsi lisatud kriteerium salvestub ilma indeksita; korduvat ja tühja ei lisata', () => {
  const result = addManual(fromProposal(PROPOSAL), 'E on olemas.');
  assert.deepEqual(buildSave(result.items, 'confirmed'), [{ text: 'E on olemas.' }]);
  assert.ok(addManual(result.items, 'e on olemas.').error);
  assert.ok(addManual(result.items, '  ').error);
});
