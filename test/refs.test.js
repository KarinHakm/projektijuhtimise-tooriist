import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRef } from '../server/ai/tasks/criteria.js';
import { analyzeConsistency } from '../shared/consistency.js';
import { aiRef } from '../server/criteria.js';

// AI tekstiviite sidumine mockup'i elemendiga (L23 parandus): ainult ühese vaste korral, arvamisi ei tehta.
const MOCKUP = { components: [
  { type: 'heading', text: 'Liikmeks astumise taotlus', items: [] },
  { type: 'input', text: 'E-posti aadress', items: [] },
  { type: 'button', text: 'Esita taotlus', items: [] },
  { type: 'button', text: 'Salvesta', items: [] },
  { type: 'button', text: 'Salvesta', items: [] },
] };

test('täpne tekst seob elemendiga; tühikud ja suurtähed ei loe', () => {
  assert.equal(resolveRef('Esita taotlus', MOCKUP), 2);
  assert.equal(resolveRef('  e-posti   AADRESS ', MOCKUP), 1);
});

test('puuduv või mitmene vaste annab seose puudumise (null), mitte arvatud elemendi', () => {
  assert.equal(resolveRef('Esita', MOCKUP), null); // osaline vaste ei loe
  assert.equal(resolveRef('Kinnitusteade', MOCKUP), null);
  assert.equal(resolveRef('Salvesta', MOCKUP), null); // kaks sama tekstiga nuppu
  assert.equal(resolveRef(3, MOCKUP), null); // vana numbriline kuju ei kehti
});

test('tühi viide on AI hinnang "ei puuduta vaadet" – K3 hoiatus ei kao', () => {
  assert.equal(resolveRef('', MOCKUP), -1);
  assert.equal(resolveRef('   ', MOCKUP), -1);
  const k3 = { text: "Pärast nupu 'Esita taotlus' vajutamist kuvatakse kinnitusteade 'Taotlus on esitatud'.", ref: aiRef(resolveRef('', MOCKUP), 3) };
  const r = analyzeConsistency([k3], { version: 3, components: MOCKUP.components.slice(0, 3) });
  assert.equal(r.criteria[0].link.label, 'ei puuduta vaadet');
  assert.equal(r.criteria[0].link.source, 'ai');
  assert.deepEqual(r.criteria[0].warnings.map((w) => w.code), ['no_match']);
});

test('projekti 101 katse tekstiviidetega: K1 → nupp, K2 → väli (nihet ei teki)', () => {
  const v3 = { version: 3, components: MOCKUP.components.slice(0, 3) };
  assert.equal(resolveRef('Esita taotlus', v3), 2);
  assert.equal(resolveRef('E-posti aadress', v3), 1);
});
