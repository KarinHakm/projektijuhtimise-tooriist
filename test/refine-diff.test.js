import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffCriteria, diffMockup } from '../shared/refine-diff.js';

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

// L37: kliendi täpsustus muudab ainult küsitut – AI juhis ei nõua enam „põhjendamata“ elementide eemaldamist.
test('täpsustuse AI juhis: muuda ainult seda, mida täpsustus nõuab; ära eemalda puudutamata elemente ega kriteeriume', async () => {
  const { buildRefineMessages } = await import('../server/ai/tasks/refine.js');
  const context = { project: { name: 'P', stage: { lastDone: null, next: null } }, conversation: [], stories: [] };
  const target = { title: 'Lugu', criteria: [{ text: 'Vormil on nimi.' }], mockup: { title: 'V', components: [{ type: 'input', text: 'Nimi', items: [] }] } };
  const text = buildRefineMessages(context, target, [], 'Lisa steriliseerimise valik.').map((m) => m.content).join('\n');
  assert.match(text, /Muuda ainult seda, mida kliendi täpsustus nõuab\. Ära eemalda ega muuda olemasolevaid mockup'i elemente ega kriteeriume, mida täpsustus ei puuduta/);
  assert.doesNotMatch(text, /mida ükski kriteerium ei nõua/);
});

// L37: täpsustavate küsimuste juhis – mittevälistavad variandid (nt makseviisid) on mitmikvalik.
test('täpsustavate küsimuste AI juhis nõuab mittevälistavate variantide korral mitmikvalikut (mõlemas voorus)', async () => {
  const { buildClarifyMessages } = await import('../server/ai/tasks/clarify.js');
  const context = { project: { name: 'P', stage: { lastDone: null, next: null } }, conversation: [], stories: [] };
  for (const asked of [0, 2]) {
    const text = buildClarifyMessages(context, { asked }).map((m) => m.content).join('\n');
    assert.match(text, /Kui vastusevariandid ei välista üksteist \(nt makseviisid, funktsioonid, kanalid\), on küsimus mitmikvalik \(multiSelect = true\)/, String(asked));
  }
});
