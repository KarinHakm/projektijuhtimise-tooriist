import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Backlog'i ülevaatuse paneel (L27), renderdus võltsandmetega. Klõpsamist ei testita.
let ReviewView;
before(async () => {
  ({ ReviewView } = await importJsx('src/components/ReviewPanel.jsx'));
});
const noop = () => {};
const actions = { apply: noop, edit: noop, cancelEdit: noop, ignore: noop };
const STORIES = [{ id: 4, title: 'Külastajana soovin näha treenerite tutvustust, et saaksin treeneri valida.' }];
const mockupFinding = (suggestion) => ({
  id: 'no_mockup-4', type: 'no_mockup', source: 'code', status: 'open', stale: false, storyIds: [4], before: {},
  stories: [{ id: 4, title: STORIES[0].title }], problem: "Vaatelool pole mockup'i.", reason: 'Lugu puudutab vaadet.', suggestion,
});
const clean = (html) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
const render = (review) => clean(renderToStaticMarkup(createElement(ReviewView, { review, stories: STORIES, onRun: noop, actions })));

test('leiu kaardil on probleem, põhjendus, AI soovitatud tulemus ja kolm nuppu', () => {
  const html = render({ id: 'r', ai: true, findings: [mockupFinding({ reason: 'Eraldi leht.', decision: 'needs_mockup' })] });
  assert.match(html, /Lugu 1: Külastajana soovin näha treenerite tutvustust/);
  assert.match(html, /<strong>Probleem:<\/strong> Vaatelool pole mockup'i\./);
  assert.match(html, /<strong>Põhjendus:<\/strong> Lugu puudutab vaadet\./);
  assert.match(html, /<strong>AI soovitab:<\/strong> lisa küsimus „Vajab mockup'i“/);
  assert.match(html, /<button type="button">Rakenda<\/button><button type="button" class="secondary">Muuda<\/button><button type="button" class="secondary">Ignoreeri<\/button>/);
});

test('AI-ta mockupi leiul pole otsust ja Rakenda on keelatud', () => {
  const html = render({ id: 'r', ai: false, aiNote: 'AI ei ole serveris seadistatud.', findings: [mockupFinding(null)] });
  assert.match(html, /AI otsust pole – vajuta „Muuda“ ja vali ise/);
  assert.doesNotMatch(html, /AI soovitab/);
  assert.match(html, /<button type="button" disabled="">Rakenda<\/button>/);
  assert.match(html, /AI ei ole serveris seadistatud\./);
});

test('AI jagamise eelvaates on mõlema osa kriteeriumid ja kattuvushoiatus loo numbriga', () => {
  const stories = [
    { id: 4, role: 'Külastaja', rolePhrase: 'Külastajana', want: 'registreeruda ja broneerida trenni', title: 'L' },
    { id: 5, role: 'Külastaja', rolePhrase: 'Külastajana', want: 'broneerida trenni kalendrist', title: 'B' },
  ];
  const f = {
    id: 'too_large-4', type: 'too_large', source: 'ai', status: 'open', stale: false, storyIds: [4], stories: [{ id: 4, title: 'L' }],
    problem: 'Kaks tegevust.', reason: 'Eraldi töövood.',
    before: { criteria: [{ id: 1, text: 'Vormil on väli „Nimi“.' }, { id: 2, text: 'Kalendris on vabad ajad.' }] },
    suggestion: { first: { want: 'registreeruda liikmeks', soThat: 'saaksin liituda' }, second: { want: 'broneerida trenni', soThat: 'saaksin osaleda' }, criteriaToSecond: [2] },
    splitInfo: { criteria: [], questions: [], mockupVersions: 0, pendingProposals: 0, isFocus: false, aboveMvpLine: false },
  };
  const html = clean(renderToStaticMarkup(createElement(ReviewView, { review: { id: 'r', ai: true, findings: [f] }, stories, onRun: noop, actions })));
  assert.match(html, /Osa 1 \(algne lugu\):<\/strong> Külastajana soovin registreeruda liikmeks, et saaksin liituda\.<\/p><ol><li>Vormil on väli „Nimi“\.<\/li><\/ol>/);
  assert.match(html, /Osa 2 \(uus lugu\):<\/strong> Külastajana soovin broneerida trenni, et saaksin osaleda\.<\/p><ol><li>Kalendris on vabad ajad\.<\/li><\/ol>/);
  assert.match(html, /Võimalik kattuvus looga 2 – kontrolli enne rakendamist\. Jagamist see ei keela\./);
  assert.equal((html.match(/Võimalik kattuvus/g) ?? []).length, 1); // osa 1 ei kattu
});
