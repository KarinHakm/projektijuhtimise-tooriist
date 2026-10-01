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
