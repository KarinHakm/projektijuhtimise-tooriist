import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Backlog'i paneel (L07) renderdatakse võltsandmetega HTML-iks. See ei klõpsa nuppe ega kasuta brauserit;
// tõstmise ja fookuse käitumist kontrollitakse brauseris.
let BacklogView;
before(async () => {
  ({ BacklogView } = await importJsx('src/components/BacklogPanel.jsx'));
});

const STORIES = [
  { id: 7, position: 1, title: 'Potentsiaalse liikmena soovin näha tunniplaani, et saaksin valida treeningu.', status: 'idee', size: 'M', origin: 'ai' },
  { id: 3, position: 2, title: 'Potentsiaalse liikmena soovin näha hindu, et saaksin valida paketi.', status: 'idee', size: 'S', origin: 'ai_edited' },
  { id: 9, position: 3, title: 'Administraatorina soovin vaadata taotlusi, et saaksin kiiresti vastata.', status: 'vajab_tapsustamist', size: 'M', origin: 'manual' },
];
const noop = () => {};
const render = (props = {}) => renderToStaticMarkup(createElement(BacklogView, { stories: STORIES, onMove: noop, ...props }));
const button = (html, label) => html.match(new RegExp(`<button[^>]*aria-label="${label}[^"]*"[^>]*>`))?.[0];

test('igal real on järjekorranumber, pealkiri, staatus, suurus ja päritolu loendi järjekorras', () => {
  const html = render();
  const items = [...html.matchAll(/<li class="backlog__item">(.*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(items.length, 3);
  assert.match(items[0], /backlog__number">1\.<.*soovin näha tunniplaani.*Staatus: Idee · Suurus: M · Päritolu: AI ettepanek</);
  assert.match(items[1], /backlog__number">2\.<.*soovin näha hindu.*Staatus: Idee · Suurus: S · Päritolu: AI ettepanek, muudetud</);
  assert.match(items[2], /backlog__number">3\.<.*Administraatorina.*Staatus: Vajab täpsustamist · Suurus: M · Päritolu: Käsitsi lisatud</);
  assert.match(html, /<ol class="backlog">/);
});

test('päises on lugude arv ja S/M/L jaotus', () => {
  assert.match(render(), /3 lugu · S 1 · M 2 · L 0/);
});

test('esimese loo ↑ ja viimase loo ↓ on keelatud, ülejäänud nupud lubatud', () => {
  const html = render();
  assert.match(button(html, 'Tõsta lugu 1 üles'), /disabled/);
  assert.doesNotMatch(button(html, 'Tõsta lugu 1 alla'), /disabled/);
  assert.doesNotMatch(button(html, 'Tõsta lugu 2 üles'), /disabled/);
  assert.doesNotMatch(button(html, 'Tõsta lugu 2 alla'), /disabled/);
  assert.doesNotMatch(button(html, 'Tõsta lugu 3 üles'), /disabled/);
  assert.match(button(html, 'Tõsta lugu 3 alla'), /disabled/);
});

test('nuppude nimed ekraanilugejale sisaldavad numbrit, suunda ja pealkirja', () => {
  const html = render();
  assert.ok(button(html, 'Tõsta lugu 2 alla: Potentsiaalse liikmena soovin näha hindu, et saaksin valida paketi\\.'));
  assert.equal((html.match(/>↑<\/button>/g) ?? []).length, 3);
  assert.equal((html.match(/>↓<\/button>/g) ?? []).length, 3);
});

test('tõstmise päringu ajal on kõik ↑/↓ nupud keelatud', () => {
  const html = render({ busy: true });
  assert.equal((html.match(/<button[^>]*disabled=""[^>]*>[↑↓]<\/button>/g) ?? []).length, 6);
});

test('õnnestunud tõste: teade on aria-live piirkonnas ja tõstetud rida on esile tõstetud', () => {
  const html = render({ status: 'Lugu tõsteti kohale 2.', highlightId: 3 });
  assert.match(html, /<p class="backlog__status" role="status" aria-live="polite">Lugu tõsteti kohale 2\.<\/p>/);
  assert.equal((html.match(/backlog__item--moved/g) ?? []).length, 1);
  assert.match(html, /<li class="backlog__item backlog__item--moved"><span class="backlog__number">2\./);
});

test('viga kuvatakse role="alert" teatena; ilma veata teadet pole', () => {
  assert.match(render({ error: 'Lugu on juba esimene.' }), /<p class="error" role="alert">Lugu on juba esimene\.<\/p>/);
  assert.doesNotMatch(render(), /role="alert"/);
});

test('tühi backlog näitab teksti ja päises on 0 lugu', () => {
  const html = render({ stories: [] });
  assert.match(html, /Backlog on tühi\./);
  assert.match(html, /0 lugu · S 0 · M 0 · L 0/);
  assert.doesNotMatch(html, /<button/);
});

test('üheloolises backlog’is on mõlemad nupud keelatud', () => {
  const html = render({ stories: [STORIES[0]] });
  assert.match(button(html, 'Tõsta lugu 1 üles'), /disabled/);
  assert.match(button(html, 'Tõsta lugu 1 alla'), /disabled/);
});
