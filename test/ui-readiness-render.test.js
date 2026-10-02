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

// L15: kriteeriumide käsitsi halduse plokk (read, Muuda/Kustuta, lisamise väli). Klõpsamist ei testita.
test('kriteeriumide plokk: read päritolu, hoiatuse ja seosega, Muuda/Kustuta ning lisamise väli', () => {
  const criteria = [
    { id: 11, text: "Vormil on väli 'E-post'.", origin: 'ai', warnings: [], linkLabel: 'Sisestusväli „E-post“ (mockup v1)' },
    { id: 12, text: 'Vorm on lihtne.', origin: 'manual', warnings: ['Hinnanguline sõna „lihtne“ – seda ei saa jah/ei vastusega kontrollida.'], linkLabel: null },
  ];
  const story = { ...withDor('idee', {}), criteria };
  const html = renderToStaticMarkup(createElement(StoryReadiness, { story, onStatus: noop, onAddQuestion: noop, onResolve: noop, onAddCriterion: noop, onUpdateCriterion: noop, onDeleteCriterion: noop })).replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
  assert.match(html, /<p class="story-ready__heading">Vastuvõtukriteeriumid<\/p><ol class="story-criteria"><li><span><strong>K1\.<\/strong> Vormil on väli 'E-post'\. <span class="tag">AI<\/span><\/span>/);
  assert.match(html, /Seos: Sisestusväli „E-post“ \(mockup v1\)/);
  assert.match(html, /<strong>K2\.<\/strong> Vorm on lihtne\. <span class="tag">käsitsi<\/span><\/span><p class="warning">⚠ Hinnanguline sõna „lihtne“/);
  assert.match(html, /Seos mockup'iga puudub/);
  assert.match(html, /aria-label="Muuda kriteeriumi K1">✎ Muuda<\/button>.*aria-label="Kustuta kriteerium K1">Kustuta<\/button>/);
  assert.match(html, /<label for="loo-3-k-uus">Lisa kriteerium<\/label>/);
  assert.doesNotMatch(render(withDor('idee', {})), /Vastuvõtukriteeriumid/); // ilma halduse tegevusteta plokki pole
});
