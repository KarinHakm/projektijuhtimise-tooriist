import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { evaluateDor } from '../shared/dor.js';

// Valmisoleku lahter (L19, L20) renderdatakse võltsandmetega. Klõpsamist ei testita.
let StoryReadiness, BacklogList;
before(async () => {
  ({ default: StoryReadiness } = await importJsx('src/components/StoryReadiness.jsx'));
  ({ default: BacklogList } = await importJsx('src/components/BacklogList.jsx'));
});

const STORY = { id: 3, rolePhrase: 'Külastajana', want: 'esitada taotluse', soThat: 'saaksin liituda', touchesView: true, title: 'Külastajana soovin esitada taotluse, et saaksin liituda.', size: 'M', origin: 'manual' };
const C3 = [{ text: "Vormil on väli 'E-post'." }, { text: "Vormil on nupp 'Saada'." }, { text: 'Pärast saatmist kuvatakse kinnitusteade.' }];
const withDor = (status, input, questions = []) => {
  const dor = evaluateDor({ story: STORY, criteria: C3, hasMockup: true, openQuestions: questions.filter((q) => !q.resolvedAt).length, ...input });
  return { ...STORY, status, questions, readiness: { ...dor, ready: status === 'valmis_arenduseks' && dor.ok, expired: status === 'valmis_arenduseks' && !dor.ok } };
};
const noop = () => {};
const render = (story) => renderToStaticMarkup(createElement(StoryReadiness, { story, onStatus: noop, onAddQuestion: noop, onResolve: noop })).replace(/<!-- -->/g, '');

test('avatud küsimus: „Valmis arenduseks“ on valikus keelatud, DoR-is ✗ ja küsimuse juures nupp „Vastatud“', () => {
  const html = render(withDor('vajab_tapsustamist', {}, [{ id: 1, text: 'Klient täpsustab maksevõimalused.', resolvedAt: null }]));
  assert.match(html, /<option value="valmis_arenduseks" disabled="">Valmis arenduseks – DoR pole täidetud<\/option>/);
  assert.match(html, /<li class="dor-list__missing"><span aria-hidden="true">✗<\/span> Avatud küsimusi ei ole – Avatud küsimusi: 1\.<span class="visually-hidden"> \(puudu\)<\/span><\/li>/);
  assert.match(html, /Klient täpsustab maksevõimalused\.<\/span> <button[^>]*>Vastatud<\/button>/);
  assert.match(html, /Vastatuks märkimine staatust ei muuda/);
});

test('DoR täidetud: „Valmis arenduseks“ on lubatud; vastatud küsimus on läbikriipsutatud märkega', () => {
  const html = render(withDor('vajab_tapsustamist', {}, [{ id: 1, text: 'Küsimus', resolvedAt: '2026-10-01T10:00:00Z' }]));
  assert.match(html, /<option value="valmis_arenduseks">Valmis arenduseks<\/option>/);
  assert.match(html, /<span class="story-questions__resolved">Küsimus<\/span> <span class="tag">vastatud<\/span>/);
  assert.equal((html.match(/dor-list__ok/g) ?? []).length, 5);
});

test('valmisolek aegunud: hoiatus lahtris ja backlog’i real', () => {
  const story = withDor('valmis_arenduseks', { criteria: C3.slice(0, 2) });
  assert.match(render(story), /Valmisolek aegunud: lugu ei vasta enam valmisoleku definitsioonile, seda ei loeta valmis olevaks\./);
  const list = renderToStaticMarkup(createElement(BacklogList, { stories: [story], readiness: { onStatus: noop, onAddQuestion: noop, onResolve: noop }, initialOpenId: 3 })).replace(/<!-- -->/g, '');
  assert.match(list, /<span class="backlog__expired">Valmis arenduseks – valmisolek aegunud<\/span>/);
  assert.match(list, /aria-expanded="true"[^>]*>Peida \(DoR puudu: 1\)<\/button>/);
  assert.match(list, /class="story-ready"/);
});
