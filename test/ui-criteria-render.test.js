import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { accept, edit, fromProposal, remove } from '../src/criteria/selection.js';

// Kriteeriumide ja mockup'i vaade (L09, L10) renderdatakse võltsandmetega HTML-iks. Klõpsamist ei testita.
let CriteriaView, MockupView, CriterionRow;
before(async () => {
  ({ CriteriaView, CriterionRow } = await importJsx('src/components/CriteriaPanel.jsx'));
  ({ default: MockupView } = await importJsx('src/components/MockupView.jsx'));
});

const MOCKUP = {
  title: 'Paketid',
  components: [
    { type: 'heading', text: 'Liikmepaketid', items: [] },
    { type: 'text', text: '<script>alert(1)</script>', items: [] },
    { type: 'list', text: 'Paketid', items: ['Põhipakett', 'Täispakett'] },
    { type: 'input', text: 'E-post', items: [] },
    { type: 'button', text: 'Vali pakett', items: [] },
    { type: 'image', text: 'paketi foto', items: [] },
    { type: 'card', text: 'Täispakett 50 €', items: [] },
  ],
};
const PROPOSAL = { id: 'c1', message: 'Pakun.', criteria: ['Hind on eurodes.', 'Leht on kasutajasõbralik.', 'Nupp "Vali" on olemas.'].map((text, index) => ({ index, text, warnings: [] })) };
const DATA = { story: { id: 1, title: 'Külastajana soovin näha hindu, et saaksin valida.' }, criteria: [], mockup: null, criteriaProposal: PROPOSAL, mockupProposal: { id: 'm1', message: 'x', mockup: MOCKUP }, aiRunning: false };
const noop = () => {};
const render = (props = {}) => renderToStaticMarkup(createElement(CriteriaView, {
  data: DATA, items: fromProposal(PROPOSAL), onNewText: noop, onAdd: noop, onAccept: noop, onEdit: noop, onRemove: noop, onSave: noop,
  onPropose: noop, onAcceptMockup: noop, onRejectMockup: noop, onProposeMockup: noop, ...props,
}));
const buttonStarting = (html, text) => html.match(new RegExp(`<button[^>]*>${text}[^<]*</button>`))?.[0];

test('igal kriteeriumil on ✓ Nõus, ✎ Muuda ja ✗ Eemalda; all on salvestamise nupud ja "Lisa kriteerium"', () => {
  const html = render();
  assert.equal((html.match(/>✓ Nõus</g) ?? []).length, 3);
  assert.equal((html.match(/>✎ Muuda</g) ?? []).length, 3);
  assert.equal((html.match(/>✗ Eemalda</g) ?? []).length, 3);
  assert.match(buttonStarting(html, 'Salvesta kinnitatud \\(0\\)'), /disabled/);
  assert.ok(buttonStarting(html, 'Kinnita kõik \\(3\\)'));
  assert.ok(buttonStarting(html, 'Lisa kriteerium'));
});

test('kinnitatud, muudetud ja eemaldatud olek: eemaldatu kaob ja loendused arvestavad ainult lubatuid', () => {
  let items = accept(fromProposal(PROPOSAL), 'ai-0');
  items = remove(items, 'ai-1');
  items = edit(items, 'ai-2', 'Nupp "Vali pakett" on olemas.').items;
  const html = render({ items });
  assert.doesNotMatch(html, /Leht on kasutajasõbralik/);
  assert.match(html, /Eemaldatud: 1\. Neid ei salvestata\./);
  assert.ok(buttonStarting(html, 'Salvesta kinnitatud \\(2\\)'));
  assert.ok(buttonStarting(html, 'Kinnita kõik \\(2\\)'));
  assert.match(html, /✓ Kinnitatud/);
  assert.match(html, /✎ Muudetud/);
});

test('hinnangusõnaga kriteerium saab nähtava hoiatuse', () => {
  assert.match(render(), /⚠ Hinnanguline sõna „kasutajasõbralik“/);
});

test('✎ avab kriteeriumi samas kohas muutmiseks', () => {
  const [item] = fromProposal(PROPOSAL);
  const html = renderToStaticMarkup(createElement(CriterionRow, { item, number: 1, busy: false, onAccept: noop, onEdit: noop, onRemove: noop, initialEditing: true }));
  assert.match(html, /<textarea[^>]*>Hind on eurodes\.<\/textarea>/);
  assert.ok(html.includes('>Salvesta</button>'));
});

test('mockup on kriteeriumide kõrval eraldi ettepanekuna nuppudega Kinnita mockup, Paku uus ja Loobu', () => {
  const html = render();
  assert.match(html, /mockup ei ole veel looga seotud/);
  for (const b of ['Kinnita mockup', 'Paku uus', 'Loobu']) assert.ok(html.includes(`>${b}</button>`), b);
  assert.ok(html.indexOf('criteria-title') < html.indexOf('mockup-title'));
});

test('mockup kuvab kõik komponenditüübid ja "<script>" kuvatakse tavatekstina', () => {
  const html = renderToStaticMarkup(createElement(MockupView, { mockup: MOCKUP }));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  for (const cls of ['mock-heading', 'mock-text', 'mock-list', 'mock-input', 'mock-button', 'mock-image', 'mock-card']) assert.ok(html.includes(cls), cls);
});

test('kinnitatud mockup näitab versiooni 1; ilma alustamise loota suunatakse prioriteedi juurde', () => {
  const html = render({ data: { ...DATA, criteriaProposal: null, mockupProposal: null, mockup: { version: 1, ...MOCKUP } } });
  assert.match(html, /Kinnitatud, versioon 1/);
  assert.match(render({ data: { ...DATA, story: null } }), /Vali enne prioriteedi juures lugu/);
});

test('koodis ei ole innerHTML-i ega dangerouslySetInnerHTML-i', () => {
  const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  for (const file of [...files('src'), ...files('server'), ...files('shared')]) {
    const code = readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /innerHTML|dangerouslySetInnerHTML/, file);
  }
});
