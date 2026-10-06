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
const render = (stage) => renderToStaticMarkup(createElement(StagePanel, { name: 'TESTKOOPIA A', stage, onGo: () => {} })).replace(/<!-- -->/g, '');
const buttons = (html) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<!-- -->/g, '').replace(/&#x27;/g, "'"));
const stageItem = (html, n) => html.match(new RegExp(`<li class="stage [^"]*"[^>]*>(?:(?!</li>).)*<span class="stage__num">${n}</span>(?:(?!</li>).)*</li>`))[0];

test('päis: projekti nimi, link „Backlog (n)“ ja seitse etappi; iga etapi olek on ka tekstina', () => {
  const html = render(P101);
  assert.match(html, /<h2 class="project-header__title">TESTKOOPIA A<\/h2><a class="project-header__backlog" href="#kaart-backlog">Backlog \(4\)<\/a>/);
  assert.equal((html.match(/<li class="stage /g) ?? []).length, 7);
  assert.match(stageItem(html, 2), /class="stage stage--done".*<span class="stage__mark" aria-hidden="true">✓<\/span>.*Rollid.*<span class="visually-hidden"> – tehtud ✓<\/span>/);
});

test('projekt 101: „Viimati läbitud etapp: Täpsustused“, soovitatud Groomimine (backlog’i ülevaatus) nupuna', () => {
  const html = render(P101);
  assert.match(html, /<strong>Viimati läbitud etapp:<\/strong> Täpsustused/);
  assert.match(html, /<strong>Soovitatud järgmine samm:<\/strong> <button type="button" class="secondary stage-summary__go">Vaata backlog üle \(AI\)<\/button><span class="muted"> – etapp „Groomimine“<\/span>/);
  assert.match(stageItem(html, 7), /<li class="stage stage--next" aria-current="step"><button/);
  assert.match(stageItem(html, 1), /<button[^>]*>.*Idee.* – andmed puuduvad/);
});

test('L14: „Jäta vahele“ soovitatud etapile ja vahele jäetud etapp ribal märgiga »', () => {
  const html = renderToStaticMarkup(createElement(StagePanel, { name: 'P', stage: P101, onGo: () => {}, onSkip: () => {} })).replace(/<!-- -->/g, '');
  assert.match(html, /<button type="button" class="link-button stage-summary__skip">Jäta vahele etapp „Groomimine“<\/button>/);
  const passed = computeStage(facts({ roles: 2, stories: 3, skipped: ['prioriteedid'] }));
  assert.match(stageItem(render(passed), 4), /<li class="stage stage--passed"><button[^>]*>.*».*Prioriteedid.* – jäeti vahele/);
});

test('projekt 102: soovitatud „Prioriteedid“; kriteeriumide etapp hall, põhjus lahti voldiva rea all', () => {
  const html = render(P102);
  assert.match(html, /<strong>Viimati läbitud etapp:<\/strong> Lood/);
  assert.match(stageItem(html, 4), /<li class="stage stage--next" aria-current="step"><button/);
  assert.match(stageItem(html, 5), /stage__button--off.*aria-disabled="true"/);
  assert.match(html, /<details class="stage-details"><summary>Miks mõni etapp on hall\?<\/summary><ul>.*<li><strong>Kriteeriumid ja mockup<\/strong> – eeldus puudub: Vali enne alustamise lugu\.<\/li>/);
  assert.deepEqual(buttons(html).at(-1), 'Küsi AI-lt prioriteedisoovitus (AI)');
  assert.ok(!buttons(html).some((b) => /kriteeri/i.test(b)));
});

test('vahelejätmise piirang on päises (lahti voldiva rea all) olemas', () => {
  assert.match(render(P102), /<details class="stage-details">.*Vahelejätmine: soovitatud või aktiivse etapi saab „Jäta vahele“ nupuga vahele jätta\. See ei ava järgmisi etappe, mille\s+eeldus puudub/);
});

test('„Mida teeme edasi?“: 1–4 nuppu, AI tegevusel märge ja selgitus; tühja loendiga plokki pole', () => {
  const reviewed = computeStage(facts({ roles: 2, stories: 4, focus: true, criteria: 3, mockup: true, refinements: 3, consistency: { warnings: 0, reviewValid: true }, latestAi: { kind: 'refinement' }, review: { open: 0 } }));
  const html = renderToStaticMarkup(createElement(NextSteps, { steps: reviewed.steps, onGo: () => {} }));
  assert.match(html, /<nav class="next-steps" aria-label="Mida teeme edasi\?"><p class="next-steps__title">Mida teeme edasi\?<\/p>/);
  assert.deepEqual(buttons(html), ['Sisesta uus kliendi täpsustus (valikuline) (AI)', "Vaata backlog'i uuesti üle (valikuline) (AI)", 'Vali teine alustamise lugu (valikuline)']);
  assert.match(html, /AI-kutse käivitub alles sealse nupuga/);
  assert.equal(renderToStaticMarkup(createElement(NextSteps, { steps: [], onGo: () => {} })), '');
});

test('projekti vaates on plokk nähtavate AI väljundi kaartide lõpus (iga AI kaardi jaoks üks koht, backlog’is mitte)', () => {
  const view = readFileSync('src/pages/ProjectView.jsx', 'utf8');
  assert.match(view, /const stepsAfter = \(card\) => stage\?\.stepsByCard\?\.\[card\] && <NextSteps steps=\{stage\.stepsByCard\[card\]\}/);
  for (const card of new Set(Object.values(AI_OUTPUT_CARD))) {
    assert.equal(view.split(`{stepsAfter('${card}')}`).length - 1, 1, card);
    // plokk on sama kaardi sees, kaardi viimase elemendina
    assert.match(view, new RegExp(`id=\\{CARDS\\.${card}\\}[^]*?\\{stepsAfter\\('${card}'\\)\\}\\s*</section>`));
  }
  assert.doesNotMatch(view, /stepsAfter\('backlog'\)/);
});
