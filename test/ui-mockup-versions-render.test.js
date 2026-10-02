import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Mockup'i varasemate versioonide loend (L22), renderdus võltsandmetega. Klõpsamist ei testita.
let CriteriaView;
before(async () => {
  ({ CriteriaView } = await importJsx('src/components/CriteriaPanel.jsx'));
});
const V1 = { version: 1, createdAt: '2026-10-01T16:00:00.000Z', title: 'Taotlus', components: [{ type: 'input', text: 'E-post', items: [] }] };
const V2 = { version: 2, createdAt: '2026-10-01T17:00:00.000Z', title: 'Taotlus', components: [{ type: 'input', text: 'E-post', items: [] }, { type: 'input', text: 'Telefon', items: [] }] };
const DATA = { story: { id: 1, title: 'Lugu' }, criteria: [], mockup: V2, mockupVersions: [V1], criteriaProposal: null, mockupProposal: null, consistency: null };
const noop = () => {};
const render = (props) => renderToStaticMarkup(createElement(CriteriaView, { data: DATA, items: [], onRestore: noop, ...props })).replace(/<!-- -->/g, '');

test('praegune versioon ja lahti voldiv loend varasematest koos nupuga „Taasta see versioon“', () => {
  const html = render();
  assert.match(html, /Kinnitatud, versioon 2/);
  assert.match(html, /<details class="mockup-versions"><summary>Varasemad versioonid \(1\)<\/summary>/);
  assert.match(html, /<summary>Versioon 1 · [^<]+ · elemente 1<\/summary>/);
  assert.match(html, /<button type="button" class="secondary">Taasta see versioon<\/button><p class="muted">Taastamine loob uue versiooni 3\. Ajalugu jääb alles; kooskõla ülevaatus aegub\.<\/p>/);
});

test('ainult üks versioon: loendit pole; teade pärast taastamist on nähtav', () => {
  assert.doesNotMatch(render({ data: { ...DATA, mockup: V1, mockupVersions: [] } }), /Varasemad versioonid/);
  assert.match(render({ restoreNotice: 'Versioon 1 taastati uue versioonina 3.' }), /<p class="notice" role="status">Versioon 1 taastati uue versioonina 3\.<\/p>/);
});

// L22: lisavaade (vaade 2) oma pealkirja, versioonide ja täpsustuse piirangu märkega; „Seo ise“ valikud vaadete kaupa.
test('kaks vaadet: vaade 2 eraldi pealkirjaga, versiooni taastamise number arvestab kõiki vaateid, seose valik vaadete kaupa', () => {
  const W3 = { version: 3, viewNo: 2, createdAt: '2026-10-02T10:00:00.000Z', title: 'Kinnitus', components: [{ type: 'heading', text: 'Taotlus on esitatud', items: [] }] };
  const W4 = { ...W3, version: 4 };
  const criteria = [{ id: 9, text: 'Kuvatakse teade.', origin: 'ai', warnings: [], ref: { kind: 'element', index: 0, version: 4, source: 'user' } }];
  const html = render({ data: { ...DATA, criteria, extraViews: [{ viewNo: 2, mockup: W4, versions: [W3] }] } });
  assert.match(html, /<h4 class="mockup-view__title">Vaade 1: Taotlus<\/h4>/);
  assert.match(html, /<h4 class="mockup-view__title">Vaade 2: Kinnitus<\/h4><p class="muted">Kinnitatud, versioon 4\. Kliendi täpsustus muudab ainult vaadet 1\.<\/p>/);
  assert.match(html, /Taastamine loob uue versiooni 5\./); // ühine numeratsioon: max(2, 4) + 1
  assert.match(html, /<optgroup label="Vaade 2: Kinnitus"><option value="element-2-0" selected="">1\. pealkiri: Taotlus on esitatud<\/option><\/optgroup>/);
});

// L22: aegunud seos (vaate 2 vanem versioon) – „Seo ise“ näitab vaate 2 elementi; ülevaatuse tekst loetleb kõik vaated.
test('aegunud seos vaate 2 vanale versioonile: menüüs vaate 2 element; ülevaatus nimetab mõlema vaate versiooni', () => {
  const W5 = { version: 5, viewNo: 2, createdAt: '2026-10-02T10:00:00.000Z', title: 'Kinnitus', components: [{ type: 'heading', text: 'Taotlus on esitatud', items: [] }, { type: 'text', text: 'Võtame ühendust', items: [] }] };
  const W6 = { ...W5, version: 6 };
  const criteria = [{ id: 9, text: 'Kuvatakse teade.', origin: 'ai', warnings: [], ref: { kind: 'element', index: 1, version: 5, source: 'user' } }];
  const consistency = { criteria: [{ number: 1, link: null, warnings: [] }], components: [], warningCount: 0, fingerprint: 'x', review: null };
  const html = render({ data: { ...DATA, criteria, consistency, extraViews: [{ viewNo: 2, mockup: W6, versions: [W5] }] } }).replace(/&#x27;/g, "'");
  assert.match(html, /<option value="element-2-1" selected="">2\. tekst: Võtame ühendust<\/option>/);
  assert.doesNotMatch(html, /<option value="element-1" selected="">/);
  assert.match(html, /vaatasid selle loo kriteeriumid ja mockup'i versioonid \(vaate 1 v2, vaate 2 v6\) üle\./);
  assert.match(html, /Kinnitan: vaatasin mockup'i versioonid \(vaate 1 v2, vaate 2 v6\) ja kriteeriumid üle/);
  // ühe vaatega senine tekst
  assert.match(render({ data: { ...DATA, criteria: [], consistency } }).replace(/&#x27;/g, "'"), /Kinnitan: vaatasin mockup'i versiooni 2 ja kriteeriumid üle/);
});
