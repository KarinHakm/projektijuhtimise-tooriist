import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// MVP joon backlog'is (L17), renderdus võltsandmetega. Klõpsamist ei testita.
let BacklogView;
before(async () => {
  ({ BacklogView } = await importJsx('src/components/BacklogPanel.jsx'));
});
const STORIES = [1, 2, 3, 4].map((id) => ({ id, title: `Lugu ${id}`, status: 'idee', size: 'M', origin: 'manual' }));
const noop = () => {};
const render = (props) => renderToStaticMarkup(createElement(BacklogView, { stories: STORIES, onMove: noop, onMvp: noop, ...props })).replace(/<!-- -->/g, '');
const order = (html) => [...html.matchAll(/<li class="(mvp-line|backlog__item)[^"]*"/g)].map((m) => (m[1] === 'mvp-line' ? '—' : 'L'));

test('joon kolme loo all: rida õiges kohas, kolmel loo märk „MVP“, kokkuvõttes „MVP: 3 lugu“', () => {
  const html = render({ mvpCount: 3 });
  assert.deepEqual(order(html), ['L', 'L', 'L', '—', 'L']);
  assert.equal((html.match(/<span class="tag tag--mvp">MVP<\/span>/g) ?? []).length, 3);
  assert.match(html, /4 lugu · S 0 · M 4 · L 0 · MVP: 3 lugu/);
  assert.match(html, /<span class="mvp-line__label">MVP joon<\/span><span class="mvp-line__hint">ülalpool 3 lugu<\/span>/);
  assert.doesNotMatch(html, /Lisa MVP joon/);
});

test('servad: üleval on „Joon üles“ keelatud, all „Joon alla“ keelatud', () => {
  const top = render({ mvpCount: 0 });
  assert.deepEqual(order(top), ['—', 'L', 'L', 'L', 'L']);
  assert.match(top, /<button[^>]*disabled=""[^>]*aria-label="Liiguta MVP joont ühe loo võrra üles"/);
  assert.match(top, /MVP-s lugusid pole/);
  const bottom = render({ mvpCount: 4 });
  assert.deepEqual(order(bottom), ['L', 'L', 'L', 'L', '—']);
  assert.match(bottom, /<button[^>]*disabled=""[^>]*aria-label="Liiguta MVP joont ühe loo võrra alla"/);
});

test('joont pole: nupp „Lisa MVP joon“, märke ega joone rida ei ole', () => {
  const html = render({ mvpCount: null });
  assert.match(html, /<button type="button" class="secondary mvp-add">Lisa MVP joon<\/button>/);
  assert.doesNotMatch(html, /mvp-line|tag--mvp|MVP: /);
});
