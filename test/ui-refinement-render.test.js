import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { diffCriteria, diffMockup } from '../shared/refine-diff.js';
import { analyzeConsistency } from '../shared/consistency.js';

// Kliendi täpsustuse vaade (L11, L12) renderdatakse võltsandmetega HTML-iks. Klõpsamist ei testita.
let RefinementView;
before(async () => {
  ({ RefinementView } = await importJsx('src/components/RefinementPanel.jsx'));
});

const M1 = { version: 1, title: 'Paketid', components: [{ type: 'heading', text: 'Paketid', items: [] }, { type: 'input', text: 'Sünniaeg', items: [] }] };
const M2 = { title: 'Paketid', components: [{ type: 'heading', text: 'Paketid', items: [] }, { type: 'text', text: 'Hinnad sh km', items: [] }] };
const BEFORE = { want: 'näha hindu', soThat: 'saaksin valida', criteria: [{ text: 'Hind on eurodes.', origin: 'ai' }, { text: 'Kuvatakse sünniaeg.', origin: 'ai' }], mockup: M1 };
const AFTER = { want: 'näha hindu koos käibemaksuga', soThat: 'saaksin valida', criteria: [{ from: 0, text: 'Hind on eurodes.' }, { from: -1, text: 'Hinna juures on märge „sh km“.' }], mockup: M2 };
const PROPOSAL = {
  id: 'r1', message: 'Lisasin käibemaksu.', clarification: 'Hinnas peab olema näha käibemaks.', before: BEFORE, after: AFTER,
  preview: { storyChanged: true, criteria: diffCriteria(BEFORE.criteria, AFTER.criteria), mockup: diffMockup(M1, M2), consistency: analyzeConsistency(AFTER.criteria.map((c) => ({ text: c.text, ref: null })), { version: 'uus', components: M2.components }) },
  otherStories: [{ storyId: 9, title: 'Külastajana soovin registreeruda, et saaksin osaleda.', suggestion: 'Kinnituses võiks olla märge „sh km“.' }],
};
const DATA = { story: { id: 1, title: 'Külastajana soovin näha hindu, et saaksin valida.', rolePhrase: 'Külastajana' }, criteria: [], mockup: M1, consistency: null, proposal: PROPOSAL, stories: [] };
const noop = () => {};
const render = (props = {}) => renderToStaticMarkup(createElement(RefinementView, {
  data: DATA, focusStoryId: 1, onText: noop, onPropose: noop, onApply: noop, onEdit: noop, onCancelEdit: noop, onReject: noop, onOpenStory: noop, onBackToFocus: noop, ...props,
}));

test('ilma ettepanekuta on väli "Kliendi täpsustus" ja nupp, mis on tühja tekstiga keelatud', () => {
  const html = render({ data: { ...DATA, proposal: null } });
  assert.match(html, /<label for="kliendi-tapsustus">Kliendi täpsustus<\/label>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Koosta muudatusettepanek<\/button>/);
  assert.doesNotMatch(render({ data: { ...DATA, proposal: null }, text: 'Lisa km' }), /disabled=""[^>]*>Koosta muudatusettepanek/);
});

test('eelvaade: loo sõnastus enne ja pärast kõrvuti; kriteeriumid eri värviga (lisandub, muutmata, eemaldub)', () => {
  const html = render();
  assert.match(html, /Enne<\/p><p>Külastajana soovin näha hindu, et saaksin valida\.<\/p>/);
  assert.match(html, /Pärast<\/p><p class="diff--modified">Külastajana soovin näha hindu koos käibemaksuga, et saaksin valida\.<\/p>/);
  assert.match(html, /<li class="diff--unchanged"><span class="diff__label">Muutmata<\/span> K1\. Hind on eurodes\./);
  assert.match(html, /<li class="diff--added"><span class="diff__label">Lisandub<\/span> K2\. Hinna juures on märge „sh km“\./);
  assert.match(html, /<li class="diff--removed"><span class="diff__label">Eemaldub<\/span> Kuvatakse sünniaeg\./);
});

test('vana ja uus mockup kõrvuti; eemalduv ja lisanduv komponent on märgitud', () => {
  const html = render();
  assert.match(html, /Enne \(versioon 1\)/);
  assert.match(html, /mock-mark--removed"><span class="mock-mark__label">Eemaldub<\/span><div class="mock-input"><span>Sünniaeg/);
  assert.match(html, /mock-mark--added"><span class="mock-mark__label">Lisandub<\/span><p class="mock-text">Hinnad sh km/);
});

test('soovitused teistele lugudele on ainult tekst koos nupuga "Täpsusta seda lugu"', () => {
  const html = render();
  assert.match(html, /Soovitused teistele lugudele/);
  assert.match(html, /Ainult soovitused – see ettepanek ei muuda ühtegi teist lugu\./);
  assert.match(html, /Kinnituses võiks olla märge „sh km“\./);
  assert.ok(html.includes('>Täpsusta seda lugu</button>'));
});

test('nupud Rakenda, Muuda ja Loobu; päringu ajal keelatud', () => {
  const html = render();
  for (const b of ['Rakenda', 'Muuda', 'Loobu']) assert.ok(html.includes(`>${b}</button>`), b);
  assert.match(render({ busy: 'apply' }), /<button[^>]*disabled=""[^>]*>Rakendan…<\/button>/);
});

test('"Muuda" avab loo sõnastuse ja kriteeriumide muutmise enne rakendamist', () => {
  const html = render({ editing: true });
  assert.match(html, /id="refine-want"[^>]*value="näha hindu koos käibemaksuga"/);
  assert.match(html, /<textarea[^>]*aria-label="Kriteerium 2"[^>]*>Hinna juures on märge „sh km“\.<\/textarea>/);
  assert.ok(html.includes('>Rakenda muudetuna</button>'));
});

test('teise loo täpsustusvoog on märgitud eraldi; alustamise lugu ei muutu', () => {
  const html = render({ focusStoryId: 5, data: { ...DATA, proposal: null } });
  assert.match(html, /eraldi täpsustusvoog – alustamise lugu ei muutu/);
  assert.ok(html.includes('>Tagasi alustamise loo juurde</button>'));
});
