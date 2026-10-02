import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Uus vaade promptist (L24), renderdus võltsandmetega. Klõpsamist ei testita.
let NewViewView;
before(async () => {
  ({ NewViewView } = await importJsx('src/components/NewViewPanel.jsx'));
});
const noop = () => {};
const PROPOSAL = {
  id: 'p1', demo: true, message: 'x', description: 'Tunniplaani vaade',
  story: { role: 'Külastaja', rolePhrase: 'Külastajana', want: 'näha tunniplaani', soThat: 'saaksin trenni valida', size: 'M', title: 'Külastajana soovin näha tunniplaani, et saaksin trenni valida.' },
  criteria: [
    { index: 0, text: 'Tunniplaanis on iga trenni algusaeg.', ref: 1, warnings: [], selfCheck: { status: 'rewritten', from: 'Tunniplaan on selge.', warnings: [] } },
    { index: 1, text: 'Lehel on nupp „Broneeri“.', ref: 2, warnings: [], selfCheck: null },
  ],
  mockup: { title: 'Tunniplaan', components: [{ type: 'heading', text: 'Nädala tunniplaan', items: [] }, { type: 'list', text: 'Tunniplaan', items: ['E 18:00'] }, { type: 'button', text: 'Broneeri', items: [] }] },
};
const DATA = { proposal: PROPOSAL, stories: [{ id: 7, number: 1, title: 'Külastajana soovin esitada taotluse, et saaksin liituda.' }], roles: ['Külastaja'] };
const render = (props = {}) => renderToStaticMarkup(createElement(NewViewView, {
  data: DATA, onDescription: noop, onPropose: noop, onApply: noop, onEdit: noop, onCancelEdit: noop, onReject: noop, onDraft: noop, onTarget: noop, ...props,
})).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");

test('eelvaade: lugu, kriteeriumid seose ja L18 märkega, mockup, sihtkoha valik ning Lisa/Muuda/Loobu', () => {
  const html = render();
  assert.match(html, /<strong>Lugu:<\/strong> Külastajana soovin näha tunniplaani, et saaksin trenni valida\./);
  assert.match(html, /<span class="tag tag--selfcheck">AI parandas<\/span> Algne: „Tunniplaan on selge\.“/);
  assert.match(html, /Seos: 2\. loend: Tunniplaan/);
  assert.match(html, /Uus lugu backlog'i lõppu/);
  assert.match(html, /Lisavaade olemasolevale loole:.*<option value="7">1\. Külastajana soovin esitada taotluse/);
  assert.match(html, /<button type="button">Lisa<\/button><button type="button" class="secondary">Muuda<\/button><button type="button" class="secondary">Loobu<\/button>/);
  assert.doesNotMatch(html, /Kirjelda uut vaadet/); // pooleli ettepaneku ajal uut kirjeldust ei küsita
});

test('„Muuda“: muudetud kriteeriumil vana AI märget pole, hoiatus arvutatakse uue teksti järgi; muutmata kriteeriumil märge jääb', () => {
  const draft = { story: { ...PROPOSAL.story, touchesView: true }, criteria: [{ index: 0, text: 'Tunniplaan on lihtne.' }, { index: 1, text: 'Lehel on nupp „Broneeri“.' }, { text: 'Uus kriteerium.' }] };
  const html = render({ editing: true, draft });
  assert.doesNotMatch(html, /AI parandas/);
  assert.match(html, /⚠ Hinnanguline sõna „lihtne“/);
  assert.match(html, /Seos mockup'iga puudub \(käsitsi lisatud\)/);
  assert.match(html, /Lisa muudetuna/);
  const unchanged = render({ editing: true, draft: { ...draft, criteria: [{ index: 0, text: PROPOSAL.criteria[0].text }] } });
  assert.match(unchanged, /AI parandas/);
});

test('ettepanekut pole: väli „Kirjelda uut vaadet“ ja nupp', () => {
  const html = render({ data: { ...DATA, proposal: null }, description: 'Tunniplaan' });
  assert.match(html, /<label for="uus-vaade">Kirjelda uut vaadet<\/label>/);
  assert.match(html, /<button type="submit" data-step="new-view-propose">Paku vaade \(AI\)<\/button>/);
});
