import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiFail, aiOk, aiText, fakeAi } from './helpers/fake-ai.js';
import { selfCheckCriteria } from '../server/ai/tasks/criteria-fix.js';

// L18: AI kriteeriumide enesekontroll – piirjuhud võlts-AI-ga (päris AI-d ei kutsuta).
const ITEMS = [
  { key: '0', text: 'Paketi juures on hind eurodes.' },
  { key: '1', text: 'Hinnad on selgelt näha.', element: 'Hinnad' },
];

test('kõik kriteeriumid kontrollitavad: AI-kutset ei tehta', async () => {
  const ai = fakeAi();
  const r = await selfCheckCriteria(ai.client, { storyTitle: 'Lugu', items: [ITEMS[0]] });
  assert.equal(ai.calls.length, 0);
  assert.deepEqual(r.marks, {});
});

test('üks päring: kehtiv parandus asendab teksti, endiselt vigane või kordav parandus jätab algse koos märkega', async () => {
  const ai = fakeAi();
  ai.push(aiOk({ criteria: [{ key: '1', text: 'Iga paketi juures on hind eurodes.' }, { key: '2', text: 'Vorm on lihtne.' }, { key: '3', text: 'Paketi juures on hind eurodes.' }] }));
  const r = await selfCheckCriteria(ai.client, {
    storyTitle: 'Lugu',
    items: [...ITEMS, { key: '2', text: 'Vorm on mugav.' }, { key: '3', text: 'Hind on kiiresti leitav.' }],
  });
  assert.equal(ai.calls.length, 1);
  assert.match(ai.calls[0].messages[1].content, /võti 1: "Hinnad on selgelt näha\." – Hinnanguline sõna „selge“.*„selgelt“.* \(mockup'i element: "Hinnad"\)/);
  assert.equal(r.texts.get('1'), 'Iga paketi juures on hind eurodes.');
  assert.deepEqual([r.marks['1'].status, r.marks['1'].from], ['rewritten', 'Hinnad on selgelt näha.']);
  assert.deepEqual([r.texts.get('2'), r.marks['2'].status], ['Vorm on mugav.', 'still_untestable']); // parandus on ka hinnanguline
  assert.deepEqual([r.texts.get('3'), r.marks['3'].status], ['Hind on kiiresti leitav.', 'still_untestable']); // kordaks K0
});

test('AI tõrge või vigane vastus: täpselt üks päring, algne tekst jääb märkega „not_checked“', async () => {
  for (const response of [aiFail('timeout'), aiText('ei ole JSON')]) {
    const ai = fakeAi();
    ai.push(response, aiOk({ criteria: [{ key: '1', text: 'Iga paketi juures on hind eurodes.' }] })); // teist katset ei tohi tulla
    const r = await selfCheckCriteria(ai.client, { storyTitle: 'Lugu', items: ITEMS });
    assert.equal(ai.calls.length, 1);
    assert.deepEqual([r.texts.get('1'), r.marks['1'].status], ['Hinnad on selgelt näha.', 'not_checked']);
  }
});
