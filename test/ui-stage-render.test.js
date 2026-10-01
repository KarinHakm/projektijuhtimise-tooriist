import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { AI_OUTPUT_CARD, computeStage } from '../shared/stage.js';

// Etappide paneel ja "Mida teeme edasi?" (L13, L14) renderdatakse võltsandmetega HTML-iks. Klõpsamist ei testita.
let StagePanel, NextSteps;
before(async () => {
  ({ default: StagePanel } = await importJsx('src/components/StagePanel.jsx'));
  ({ default: NextSteps } = await importJsx('src/components/NextSteps.jsx'));
});

const NO_PENDING = { roles: false, stories: false, priority: false, criteria: false, mockup: false, refinement: false };
const facts = (over) => ({ conversation: 'empty', roles: 0, stories: 0, focus: false, criteria: 0, mockup: false, refinements: 0, consistency: null, latestAi: null, ...over, pending: { ...NO_PENDING, ...over.pending } });
const P101 = computeStage(facts({ roles: 2, stories: 4, focus: true, criteria: 3, mockup: true, refinements: 3, consistency: { warnings: 0, reviewValid: true }, latestAi: { kind: 'refinement' } }));
const P102 = computeStage(facts({ roles: 2, stories: 3, latestAi: { kind: 'stories' } }));
const render = (stage) => renderToStaticMarkup(createElement(StagePanel, { stage, onGo: () => {} }));
const buttons = (html) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<!-- -->/g, '').replace(/&#x27;/g, "'"));

test('projekt 101: „Viimati läbitud etapp: Täpsustused“ ja valikuline järgmine samm; Groomimine hall, mitte nupp', () => {
  const html = render(P101).replace(/<!-- -->/g, '');
  assert.match(html, /<strong>Viimati läbitud etapp:<\/strong> Täpsustused/);
  assert.match(html, /<strong>Soovitatud järgmine samm:<\/strong> Sisesta uus kliendi täpsustus \(valikuline\) – etapp „Täpsustused“/);
  assert.match(html, /Kõik rakenduses olemasolevad etapid on läbitud; edasised sammud on valikulised\. Groomimist pole veel tehtud\./);
  assert.match(html, /<span class="stage__name" aria-disabled="true">7\. Groomimine<\/span><span class="stage__status">pole veel tehtud<\/span>/);
  assert.ok(!buttons(html).some((b) => b.includes('Groomimine')));
  assert.match(html, /<li class="stage stage--done">.*?5\. Kriteeriumid ja mockup<\/button><span class="stage__status">tehtud ✓<\/span>/);
  assert.match(html, /1\. Idee<\/button><span class="stage__status">andmed puuduvad<\/span>/);
});

test('projekt 102: soovitatud „Prioriteedid“; kriteeriumide etapp hall koos põhjusega ja ilma nuputa', () => {
  const html = render(P102).replace(/<!-- -->/g, '');
  assert.match(html, /<strong>Viimati läbitud etapp:<\/strong> Lood/);
  assert.match(html, /<li class="stage stage--next" aria-current="step">.*?4\. Prioriteedid<\/button><span class="stage__status">soovitatud järgmine<\/span>/);
  assert.match(html, /<span class="stage__name" aria-disabled="true">5\. Kriteeriumid ja mockup<\/span><span class="stage__status">eeldus puudub<\/span><span class="stage__reason">Vali enne alustamise lugu\.<\/span>/);
  assert.deepEqual(buttons(html).slice(-2), ['Küsi AI-lt prioriteedisoovitus (AI)', 'Vali alustamise lugu ise']);
  assert.ok(!buttons(html).some((b) => /kriteeri/i.test(b)));
});

test('vahelejätmise piirang on paneelis nähtav', () => {
  assert.match(render(P102), /Vahelejätmine: valikulise etapi „Täpsustused“ võib vahele jätta\. Teised etapid sõltuvad eelmistest/);
});

test('„Mida teeme edasi?“: 1–4 nuppu, AI tegevusel märge ja selgitus; tühja loendiga plokki pole', () => {
  const html = renderToStaticMarkup(createElement(NextSteps, { steps: P101.steps, onGo: () => {} }));
  assert.match(html, /<nav class="next-steps" aria-label="Mida teeme edasi\?"><p class="next-steps__title">Mida teeme edasi\?<\/p>/);
  assert.deepEqual(buttons(html), ['Sisesta uus kliendi täpsustus (valikuline) (AI)', "Vaata backlog'i üle (valikuline)", 'Vali teine alustamise lugu (valikuline)']);
  assert.match(html, /AI-kutse käivitub alles sealse nupuga/);
  assert.equal(renderToStaticMarkup(createElement(NextSteps, { steps: [], onGo: () => {} })), '');
});

test('projekti vaates on plokk ainult uusima AI väljundi kaardi lõpus (iga AI kaardi jaoks üks koht, backlog’is mitte)', () => {
  const view = readFileSync('src/pages/ProjectView.jsx', 'utf8');
  assert.match(view, /const stepsAfter = \(card\) => stage\?\.latestAiCard === card && <NextSteps/);
  for (const card of new Set(Object.values(AI_OUTPUT_CARD))) {
    assert.equal(view.split(`{stepsAfter('${card}')}`).length - 1, 1, card);
    // plokk on sama kaardi sees, kaardi viimase elemendina
    assert.match(view, new RegExp(`id=\\{CARDS\\.${card}\\}[^]*?\\{stepsAfter\\('${card}'\\)\\}\\s*</section>`));
  }
  assert.doesNotMatch(view, /stepsAfter\('backlog'\)/);
});
