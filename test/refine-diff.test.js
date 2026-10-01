import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageWarnings, diffCriteria, diffMockup } from '../shared/refine-diff.js';

// Täpsustuse eelvaate arvutus (L11) koodis, mitte AI kirjelduse põhjal.
const BEFORE = [{ text: 'A on olemas.' }, { text: 'B on olemas.' }, { text: 'C on olemas.' }];

test('lisatud, muudetud, muutmata ja eemaldatud kriteeriumid', () => {
  const d = diffCriteria(BEFORE, [{ from: 0, text: 'A on olemas.' }, { from: 1, text: 'B on olemas alati.' }, { from: -1, text: 'D on olemas.' }]);
  assert.deepEqual(d.items.map((i) => i.status), ['unchanged', 'modified', 'added']);
  assert.equal(d.items[1].oldText, 'B on olemas.');
  assert.deepEqual(d.removed, ['C on olemas.']);
});

test('AI viitab kriteeriumile, aga tekst ei muutunud: kuvatakse muutmatana (ainult tühikud ei loe)', () => {
  const d = diffCriteria(BEFORE, [{ from: 1, text: '  B on   olemas. ' }]);
  assert.equal(d.items[0].status, 'unchanged');
  assert.deepEqual(d.removed, ['A on olemas.', 'C on olemas.']);
});

test('kaks viidet samale kriteeriumile: teine loetakse lisatuks', () => {
  const d = diffCriteria(BEFORE, [{ from: 0, text: 'A on olemas.' }, { from: 0, text: 'A2 on olemas.' }]);
  assert.deepEqual(d.items.map((i) => i.status), ['unchanged', 'added']);
});

test('mockup: lisandunud ja eemaldatud komponendid märgitakse; puuduv vana mockup = kõik lisandub', () => {
  const a = { title: 'X', components: [{ type: 'heading', text: 'P', items: [] }, { type: 'input', text: 'Sünniaeg', items: [] }] };
  const b = { title: 'X', components: [{ type: 'heading', text: 'P', items: [] }, { type: 'text', text: 'Kinnitusteade', items: [] }] };
  assert.deepEqual(diffMockup(a, b), { added: [false, true], removed: [false, true] });
  assert.deepEqual(diffMockup(null, b), { added: [true, true], removed: [] });
});

test('kooskõla vihje: jutumärkides nimetus, mida mockup’is pole, annab hoiatuse; leiduv ei anna', () => {
  const mockup = { title: 'Taotlus', components: [{ type: 'button', text: 'Esita taotlus', items: [] }, { type: 'input', text: 'E-posti aadress', items: [] }] };
  const w = coverageWarnings([{ text: "Kasutaja näeb nuppu 'Esita taotlus'." }, { text: 'Hinna juures on märge „sh km“.' }, { text: 'Kuvatakse kinnitusteade.' }], mockup);
  assert.deepEqual(w.map((x) => x.term), ['sh km']);
  assert.deepEqual(coverageWarnings([{ text: '„X“' }], null), []);
});
