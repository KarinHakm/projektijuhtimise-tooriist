import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Prioriteedi paneel (L08) ja backlog'i märge renderdatakse võltsandmetega HTML-iks (brauserit, serverit ega AI-d pole vaja).
let PriorityView, BacklogView;
before(async () => {
  ({ PriorityView } = await importJsx('src/components/PriorityPanel.jsx'));
  ({ BacklogView } = await importJsx('src/components/BacklogPanel.jsx'));
});

const STORIES = [
  { id: 7, title: 'Külastajana soovin näha tunniplaani, et saaksin valida treeningu.' },
  { id: 3, title: 'Külastajana soovin näha hindu, et saaksin valida paketi.' },
];
const PROPOSAL = { id: 'p1', message: 'Milline lugu on kõige olulisem?', storyId: 3, title: STORIES[1].title, reason: 'Ilma hindadeta ei saa paketti valida.' };
const noop = () => {};
const render = (data, props = {}) => renderToStaticMarkup(createElement(PriorityView, {
  data: { focusStoryId: null, focusTitle: null, proposal: null, stories: STORIES, aiRunning: false, ...data },
  onPropose: noop, onAccept: noop, onStartChoosing: noop, onPick: noop, onChoose: noop, onCancel: noop, ...props,
}));
const button = (html, text) => html.match(new RegExp(`<button[^>]*>${text}</button>`))?.[0];

test('soovitusel on loo pealkiri, põhjendus ning nupud "Nõus, alustame sellest" ja "Valin ise teise"', () => {
  const html = render({ proposal: PROPOSAL });
  assert.match(html, /AI soovitus – ei ole veel kinnitatud/);
  assert.match(html, /Soovitan alustada loost:<\/strong> Külastajana soovin näha hindu/);
  assert.match(html, /Põhjendus:<\/strong> Ilma hindadeta ei saa paketti valida\./);
  assert.ok(button(html, 'Nõus, alustame sellest'));
  assert.ok(button(html, 'Valin ise teise'));
});

test('"Valin ise teise" näitab backlog’i lugude valikut; ilma valikuta on kinnitus keelatud', () => {
  const html = render({ proposal: PROPOSAL }, { choosing: true });
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.match(html, /1\. Külastajana soovin näha tunniplaani/);
  assert.match(button(html, 'Alustame sellest'), /disabled/);
  assert.doesNotMatch(html, /AI soovitus – ei ole veel kinnitatud/);
  assert.doesNotMatch(button(render({ proposal: PROPOSAL }, { choosing: true, chosenId: 7 }), 'Alustame sellest'), /disabled/);
});

test('ilma soovituseta küsitakse, milline lugu on kõige olulisem, ja pakutakse AI soovitust või oma valikut', () => {
  const html = render({});
  assert.match(html, /Milline lugu on kliendile kõige olulisem\?/);
  assert.ok(button(html, 'Küsi AI soovitust'));
  assert.ok(button(html, 'Valin ise'));
});

test('kinnitatud alustamise lugu on näha koos märgiga "Alustame sellest"', () => {
  const html = render({ focusStoryId: 3, focusTitle: STORIES[1].title });
  assert.match(html, /<span class="tag tag--focus">Alustame sellest<\/span> Külastajana soovin näha hindu/);
  assert.ok(button(html, 'Vali teine lugu'));
});

test('päringu ajal on nupud keelatud; tühja backlog’i korral selgitus', () => {
  assert.match(button(render({ proposal: PROPOSAL }, { busy: 'accept' }), 'Kinnitan…'), /disabled/);
  assert.match(button(render({ proposal: PROPOSAL }, { busy: 'accept' }), 'Valin ise teise'), /disabled/);
  assert.match(render({ stories: [] }), /Prioriteeti saab küsida pärast lugude lisamist backlog&#x27;i\./);
});

test('backlog’is on märge "Alustame sellest" ainult valitud loo juures', () => {
  const stories = STORIES.map((s, i) => ({ ...s, position: i + 1, status: 'idee', size: 'M', origin: 'ai' }));
  const html = renderToStaticMarkup(createElement(BacklogView, { stories, focusStoryId: 3, onMove: noop }));
  assert.equal((html.match(/tag--focus/g) ?? []).length, 1);
  assert.match(html, /backlog__number">2\.<.*Alustame sellest<\/span> Külastajana soovin näha hindu/);
});
