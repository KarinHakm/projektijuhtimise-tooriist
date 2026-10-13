import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { analyzeConsistency, reviewFingerprint } from '../shared/consistency.js';

// Mockup'i esitus „Veeb | Mobiil“ (nõudmata lisa) võltsandmetega HTML-iks. Lüliti muudab ainult raami;
// sisu, K-sildid, seosed ja ülevaatus jäävad samaks.
let MockupView, DeviceToggle, CriteriaView, RefinementView;
before(async () => {
  ({ default: MockupView, DeviceToggle } = await importJsx('src/components/MockupView.jsx'));
  ({ CriteriaView } = await importJsx('src/components/CriteriaPanel.jsx'));
  ({ RefinementView } = await importJsx('src/components/RefinementPanel.jsx'));
});

const MOCKUP = { version: 3, title: 'Vaade', components: [
  { type: 'heading', text: 'Pealkiri', items: [] },
  { type: 'input', text: 'Esimene väli', items: [] },
  { type: 'list', text: 'Loend', items: ['Rida A', 'Rida B'] },
  { type: 'button', text: 'Kinnita', items: [] },
] };
const CRITERIA = [
  { id: 1, text: 'Lehel on väli „Esimene väli“.', origin: 'ai', ref: { kind: 'element', index: 1, version: 3, source: 'user' }, warnings: [] },
  { id: 2, text: 'Nupule „Kinnita“ vajutamisel salvestub vorm.', origin: 'ai', ref: { kind: 'element', index: 3, version: 3, source: 'ai' }, warnings: [] },
];
const REVIEW = { mockupVersion: 3, at: '2026-10-13T09:00:00.000Z', valid: true };
const consistency = { ...analyzeConsistency(CRITERIA, MOCKUP), fingerprint: reviewFingerprint(CRITERIA, MOCKUP), review: REVIEW };
const noop = () => {};
const clean = (html) => html.replace(/<!-- -->/g, '');
const renderMockup = (props) => clean(renderToStaticMarkup(createElement(MockupView, { mockup: MOCKUP, ...props })));
// Raami sisu ilma raami klassita – peab mõlemas esituses olema sama.
const body = (html) => html.match(/<figure class="mockup mockup--(?:web|mobile)"(.*)<\/figure>/s)[1];
const renderCriteria = (props = {}) => clean(renderToStaticMarkup(createElement(CriteriaView, {
  data: { story: { id: 9, title: 'Lugu' }, criteria: CRITERIA, mockup: MOCKUP, criteriaProposal: null, mockupProposal: null, consistency },
  items: [], onNewText: noop, onAdd: noop, onAccept: noop, onEdit: noop, onRemove: noop, onSave: noop, onPropose: noop,
  onAcceptMockup: noop, onRejectMockup: noop, onProposeMockup: noop, onLink: noop, onReview: noop, onRestore: noop, ...props,
})));

test('vaikimisi „Veeb“: lüliti kahe nupuga, valitud on Veeb, raam mockup--web', () => {
  const html = renderMockup();
  assert.match(html, /<div class="device-toggle" role="group" aria-label="Mockup&#x27;i esitus"><button type="button" class="device-toggle__button" aria-pressed="true">Veeb<\/button><button type="button" class="device-toggle__button" aria-pressed="false">Mobiil<\/button><\/div>/);
  assert.match(html, /<figure class="mockup mockup--web" aria-label="Mockup: Vaade">/);
});

test('veebi ja mobiili esituses on sama sisu, K-sildid, hoiatused ja eelvaate märgid', () => {
  const notes = consistency.components;
  const marks = [false, false, false, true];
  const web = renderMockup({ notes, device: 'web' });
  const mobile = renderMockup({ notes, device: 'mobile' });
  assert.match(mobile, /<figure class="mockup mockup--mobile"/);
  assert.equal(body(mobile), body(web));
  assert.match(body(mobile), /<span class="mock-badge">K1<\/span>/);
  assert.match(body(mobile), /<span class="mock-badge">K2<\/span>/);
  assert.equal(body(renderMockup({ marks, mark: 'added', device: 'mobile' })), body(renderMockup({ marks, mark: 'added', device: 'web' })));
  // Kutsuja hoiab valikut: mockup'il endal lülitit pole.
  assert.doesNotMatch(mobile, /device-toggle/);
});

test('lüliti teatab ainult valitud esituse – andmeid ega päringut see ei puuduta', () => {
  const calls = [];
  const el = DeviceToggle({ device: 'web', onChange: (d) => calls.push(d) });
  el.props.children.forEach((b) => b.props.onClick());
  assert.deepEqual(calls, ['web', 'mobile']);
});

test('kriteeriumid ja mockup: üks lüliti; veebis üksteise all, mobiilis kõrvuti; K-sildid, seosed ja ülevaatus samad', () => {
  const web = renderCriteria();
  const mobile = renderCriteria({ initialDevice: 'mobile' });
  assert.equal((web.match(/class="device-toggle"/g) ?? []).length, 1);
  assert.match(web, /<div class="criteria-mockup__columns criteria-mockup__columns--stacked">/);
  assert.match(mobile, /<div class="criteria-mockup__columns">/);
  assert.match(web, /aria-pressed="true">Veeb</);
  assert.match(mobile, /aria-pressed="true">Mobiil</);
  assert.match(web, /<figure class="mockup mockup--web"/);
  assert.match(mobile, /<figure class="mockup mockup--mobile"/);
  // Peale lüliti, paigutuse ja raami klassi on HTML identne (sh K-sildid, „Seotud: …“, „Seo ise“ ja ülevaatuse kinnitus).
  const strip = (html) => html
    .replace(/ criteria-mockup__columns--stacked/, '')
    .replace(/mockup--(?:web|mobile)/g, 'mockup--X')
    .replace(/aria-pressed="(?:true|false)"/g, '');
  assert.equal(strip(mobile), strip(web));
  assert.match(mobile, /<span class="mock-badge">K1<\/span>/);
  assert.match(mobile, /Seotud: 2\. sisestusväli: Esimene väli <span class="tag">sina<\/span>/);
  assert.match(mobile, /✓ Vaatasid üle: mockup&#x27;i versioon 3/);
});

test('kliendi täpsustuse eelvaade: üks lüliti enne → pärast kohal, veebis üksteise all', () => {
  const after = { ...MOCKUP, components: [...MOCKUP.components, { type: 'text', text: 'Uus tekst', items: [] }] };
  const proposal = {
    id: 1, demo: false, message: 'Lisasin teksti.', clarification: 'Lisa tekst',
    before: { want: 'teha', soThat: 'saaks', criteria: [], mockup: MOCKUP },
    after: { want: 'teha', soThat: 'saaks', criteria: [], mockup: after },
    preview: {
      storyChanged: false, criteria: { items: [], removed: [] },
      mockup: { removed: MOCKUP.components.map(() => false), added: [false, false, false, false, true] }, consistency: null,
    },
    otherStories: [],
  };
  const html = clean(renderToStaticMarkup(createElement(RefinementView, {
    data: { story: { id: 9, title: 'Lugu', rolePhrase: 'Rollina' }, proposal, consistency: null },
    onText: noop, onPropose: noop, onApply: noop, onEdit: noop, onCancelEdit: noop, onReject: noop, onOpenStory: noop, onBackToFocus: noop,
  })));
  assert.equal((html.match(/class="device-toggle"/g) ?? []).length, 1);
  assert.match(html, /<div class="before-after before-after--stacked">/);
  assert.equal((html.match(/<figure class="mockup mockup--web"/g) ?? []).length, 2);
});
