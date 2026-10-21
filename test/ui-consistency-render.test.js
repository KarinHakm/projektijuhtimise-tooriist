import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { analyzeConsistency, reviewFingerprint } from '../shared/consistency.js';

// Kooskõla kuvamine (L23) võltsandmetega HTML-iks. Klõpsamist ei testita.
let CriteriaView, ReviewBox;
before(async () => {
  ({ CriteriaView } = await importJsx('src/components/CriteriaPanel.jsx'));
  ({ ReviewBox } = await importJsx('src/components/Consistency.jsx'));
});

const MOCKUP = { version: 2, title: 'Taotlus', components: [
  { type: 'heading', text: 'Liikmeks astumise taotlus', items: [] },
  { type: 'input', text: 'E-posti aadress', items: [] },
  { type: 'button', text: 'Esita taotlus', items: [] },
  { type: 'button', text: 'Salvesta', items: [] },
] };
const CRITERIA = [
  { id: 1, text: "Kasutaja näeb nuppu 'Esita taotlus'.", origin: 'ai', ref: { kind: 'element', index: 2, version: 2, source: 'ai' }, warnings: [] },
  { id: 2, text: "Pärast nupu 'Esita taotlus' vajutamist kuvatakse kinnitusteade.", origin: 'ai_edited', ref: null, warnings: [] },
];
const consistency = (review = null) => ({ ...analyzeConsistency(CRITERIA, MOCKUP), fingerprint: reviewFingerprint(CRITERIA, MOCKUP), review });
const data = (review) => ({ story: { id: 9, title: 'Lugu' }, criteria: CRITERIA, mockup: MOCKUP, criteriaProposal: null, mockupProposal: null, consistency: consistency(review) });
const noop = () => {};
const render = (props = {}) => renderToStaticMarkup(createElement(CriteriaView, {
  data: data(null), items: [], onNewText: noop, onAdd: noop, onAccept: noop, onEdit: noop, onRemove: noop, onSave: noop,
  onPropose: noop, onAcceptMockup: noop, onRejectMockup: noop, onProposeMockup: noop, onLink: noop, onReview: noop, ...props,
}));

test('seos, kontrollimist vajav hoiatus ja viga on eristatavad', () => {
  const html = render({ linkError: 'Valitud elementi ei ole kehtivas mockup’is.' });
  assert.match(html, /<p class="consistency-link">Seotud: 3\. nupp: Esita taotlus <span class="tag">AI<\/span><\/p>/);
  assert.match(html, /<p class="consistency-link consistency-link--none">Seos mockup&#x27;iga puudub<\/p>/);
  assert.match(html, /<p class="consistency-warning">⚠ Kontrolli: Pole vastet: sõnadele „kinnitusteade“/);
  assert.match(html, /<p class="error" role="alert">Valitud elementi ei ole kehtivas mockup’is\.<\/p>/);
});

test('AI seose juures on nupp "Kinnitan selle seose"; seoseta kriteeriumi juures seda pole', () => {
  const html = render();
  const items = [...html.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
  assert.match(items[0], /Seotud: 3\. nupp: Esita taotlus <span class="tag">AI<\/span><\/p><button type="button" class="secondary link-confirm">Kinnitan selle seose<\/button>/);
  assert.doesNotMatch(items[1], /Kinnitan selle seose/);
});

test('kasutaja kinnitatud seosel nuppu pole ja allikas on "sina"', () => {
  const userCriteria = CRITERIA.map((c, i) => (i === 0 ? { ...c, ref: { ...c.ref, source: 'user' } } : c));
  const d = { ...data(null), criteria: userCriteria, consistency: { ...analyzeConsistency(userCriteria, MOCKUP), fingerprint: 'x', review: null } };
  const html = render({ data: d });
  assert.match(html, /Seotud: 3\. nupp: Esita taotlus <span class="tag">sina<\/span>/);
  assert.doesNotMatch(html, /Kinnitan selle seose/);
});

test('mockup’is on seotud kriteeriumi märgis; elemendi „ükski kriteerium ei nimeta seda“ on hall märkus, mitte hoiatus', () => {
  const html = render();
  assert.match(html, /Esita taotlus<\/span><span class="mock-notes"><span class="mock-badge">K1<\/span>/);
  assert.match(html, /Salvesta<\/span><span class="mock-notes"><span class="mock-hint">ükski kriteerium ei nimeta seda<\/span>/);
  assert.doesNotMatch(html, /Põhjendamata|mock-flag/);
});

test('iga kriteeriumi juures saab seose ise valida: puudub, ei puuduta vaadet või mockup’i element', () => {
  const html = render();
  assert.match(html, /<option value="none">— seos puudub —<\/option><option value="no_view">ei puuduta vaadet<\/option><option value="element-0">1\. pealkiri: Liikmeks astumise taotlus<\/option>/);
  assert.match(html, /<select[^>]*><option value="none"[^]*?<option value="element-2" selected="">3\. nupp: Esita taotlus/);
});

test('ülevaatuse kinnitus on sõnastatud kasutaja ülevaatusena konkreetsele versioonile, mitte automaatse tõendina', () => {
  const html = render();
  assert.match(html, /<strong>sina<\/strong> vaatasid selle loo kriteeriumid ja mockup&#x27;i versiooni 2 üle/);
  assert.match(html, /See ei ole automaatne tõend täieliku kooskõla kohta\. Kinnitus aegub, kui kriteeriumid, viited või mockup muutuvad\./);
  assert.match(html, /Kontrollimist vajavaid hoiatusi: 1\./); // K2 pole vastet (seoseta); elementide märkused ei loe
  assert.ok(html.includes('>Kinnitan: vaatasin mockup&#x27;i versiooni 2 ja kriteeriumid üle</button>'));
});

test('kehtiv ülevaatus näitab versiooni; aegunud ülevaatus on märgitud ja lubab uuesti kinnitada', () => {
  const ok = renderToStaticMarkup(createElement(ReviewBox, { consistency: consistency({ valid: true, mockupVersion: 2, at: '2026-10-01T12:00:00.000Z' }), mockupVersion: 2, onReview: noop }));
  assert.match(ok, /✓ Vaatasid üle: mockup&#x27;i versioon 2/);
  assert.doesNotMatch(ok, /<button/);
  const stale = renderToStaticMarkup(createElement(ReviewBox, { consistency: consistency({ valid: false, mockupVersion: 1, at: '2026-10-01T12:00:00.000Z' }), mockupVersion: 2, onReview: noop }));
  assert.match(stale, /Varasem ülevaatus \(mockup&#x27;i versioon 1\) on aegunud/);
  assert.ok(stale.includes('versiooni 2 ja kriteeriumid üle</button>'));
});

// L37: kriteeriumid salvestati enne mockup'i kinnitamist – AI seos ootab mockup'i versiooni, see ei ole aegunud viide.
test('ootel mockup: AI seos ilma versioonita näitab neutraalset rida, mitte hoiatust; päris aegunud viide jääb hoiatuseks', () => {
  const awaiting = [
    { id: 1, text: 'Vormil on nupp „Esita taotlus“.', origin: 'ai', ref: { kind: 'element', index: 2, version: null, source: 'ai' }, warnings: [] },
    { id: 2, text: 'Vormil on e-posti väli.', origin: 'ai', ref: { kind: 'element', index: 1, version: 1, source: 'user' }, warnings: [] },
  ];
  const cons = { ...analyzeConsistency(awaiting, null), fingerprint: 'x', review: null };
  const html = render({ data: { story: { id: 9, title: 'Lugu' }, criteria: awaiting, mockup: null, criteriaProposal: null, mockupProposal: { id: 5, message: '', mockup: MOCKUP }, consistency: cons } });
  const [first, second] = html.split('<li').slice(1, 3);
  assert.match(first, /Seotakse mockup&#x27;i elemendiga, kui kinnitad allpool mockup&#x27;i\./);
  assert.doesNotMatch(first, /Viide on mõne teise mockup/);
  assert.match(second, /Viide on mõne teise mockup&#x27;i versiooni elemendile/); // versiooniga viide, mida pole – päris aegunud
});

// L37: hoiatusteta ja kinnitamata ülevaatus on kokku volditud (valikuline); kehtiv ülevaatus ja hoiatused on avatud.
test('hoiatusteta ülevaatus on kokku volditud ja avaneb klõpsuga; hoiatustega või kinnitatud ülevaatus on avatud', () => {
  const quiet = renderToStaticMarkup(createElement(ReviewBox, { consistency: { warningCount: 0, review: null }, mockupVersion: 2, onReview: noop })).replace(/&#x27;/g, "'");
  assert.match(quiet, /^<details class="review-box review-box--quiet"><summary>Ülevaatus \(valikuline\) – kontrollimist vajavaid hoiatusi pole<\/summary>/);
  assert.match(quiet, /Kinnitan: vaatasin mockup'i versiooni 2 ja kriteeriumid üle/);
  const warned = renderToStaticMarkup(createElement(ReviewBox, { consistency: { warningCount: 2, review: null }, mockupVersion: 2, onReview: noop }));
  assert.match(warned, /^<section class="review-box"/);
  const ok = renderToStaticMarkup(createElement(ReviewBox, { consistency: { warningCount: 0, review: { valid: true, mockupVersion: 2, at: '2026-10-01T12:00:00.000Z' } }, mockupVersion: 2, onReview: noop }));
  assert.match(ok, /^<section class="review-box"/);
});

// L37: AI seos elemendiga, mida kriteerium sõnasõnaliselt ei nimeta, on hall märkus (mitte kollane hoiatus).
test('AI seose nimevihje on hall märkus kriteeriumi juures', () => {
  const crit = [{ id: 1, text: 'Vormil on väli kassi soo jaoks.', origin: 'ai', ref: { kind: 'element', index: 1, version: 2, source: 'ai' }, warnings: [] }];
  const m = { version: 2, title: 'Kass', components: [{ type: 'heading', text: 'Kass', items: [] }, { type: 'input', text: 'Sugu', items: [] }] };
  const cons = { ...analyzeConsistency(crit, m), fingerprint: 'x', review: null };
  const html = render({ data: { story: { id: 9, title: 'Lugu' }, criteria: crit, mockup: m, criteriaProposal: null, mockupProposal: null, consistency: cons } });
  assert.match(html, /<p class="consistency-hint">AI seos – kriteerium ei nimeta elementi „Sugu“ sõnasõnaliselt; kinnita või vali ise\.<\/p>/);
  assert.doesNotMatch(html, /Võimalik probleem/);
});

// L37: alustamise loo silt on ainult „Millest alustada?“ plokis; kriteeriumide plokis on lihtne rida „Lugu: …“.
test('kriteeriumide ja mockup’i plokis on „Lugu: …“, mitte alustamise loo silt', () => {
  const html = render();
  assert.match(html, /<p><strong>Lugu:<\/strong> Lugu<\/p>/);
  assert.doesNotMatch(html, /tag--focus/);
});
