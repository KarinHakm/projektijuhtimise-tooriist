import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Kahe loo ühendamise vorm (L26), renderdus võltsandmetega. Klõpsamist ei testita.
let MergeStoryForm, BacklogView;
before(async () => {
  ({ default: MergeStoryForm } = await importJsx('src/components/MergeStoryForm.jsx'));
  ({ BacklogView } = await importJsx('src/components/BacklogPanel.jsx'));
});
const noop = () => {};
const st = (id, want) => ({ id, role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin liituda', size: 'M', touchesView: true, status: 'idee', origin: 'manual', title: `Külastajana soovin ${want}, et saaksin liituda.` });
const STORIES = [st(1, 'üks'), st(2, 'registreeruda'), st(3, 'kolm'), st(4, 'tasuda')];
const INFO = {
  keepId: 2, removeId: 4, blocked: false, mockups: { keep: 0, remove: 2, from: 'remove' },
  criteria: [
    { id: 11, from: 'keep', text: "Vormil on väli 'E-post'.", linkLabel: null, linkSurvives: false, duplicateWith: [21] },
    { id: 12, from: 'keep', text: 'Kuvatakse kinnitus.', linkLabel: 'ei puuduta vaadet', linkSurvives: true, duplicateWith: [] },
    { id: 21, from: 'remove', text: "vormil on väli 'e-post'.", linkLabel: '1. sisestusväli: E-post (mockup v2)', linkSurvives: true, duplicateWith: [11] },
  ],
  questions: [{ id: 31, text: 'Milline makseviis?', resolvedAt: null, from: 'remove' }],
  pendingProposals: 2, focus: 'remove', resultPosition: 2, mvp: { count: 4, keepAbove: true, removeAbove: true },
};
const clean = (html) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const render = (props = {}) => clean(renderToStaticMarkup(createElement(MergeStoryForm, { story: STORIES[1], stories: STORIES, info: INFO, onPick: noop, onSubmit: noop, onCancel: noop, ...props })));

test('teise loo valik; säilib eespool olev lugu ja seda saab vahetada', () => {
  const html = render();
  assert.match(html, /<option value="">— vali lugu —<\/option><option value="1">1\. Külastajana soovin üks/);
  assert.match(html, /Säilib lugu 2 \(„Külastajana soovin registreeruda, et saaksin liituda\.“\)\. Lugu 4 ühendatakse sellesse ja selle rida eemaldatakse\./);
  assert.match(html, />Säilita hoopis lugu 4<\/button>/);
});

test('kriteeriumid: kõik vaikimisi valitud (ka duplikaadid); duplikaat märgitud; iga kirje juures seos', () => {
  const html = render();
  assert.equal((html.match(/type="checkbox" checked=""/g) ?? []).length, 4); // 3 kriteeriumi + „Puudutab vaadet“
  assert.match(html, /<strong>K1<\/strong> \(lugu 2\) Vormil on väli 'E-post'\.<span class="tag tag--dup">duplikaat: sama tekst kui K3<\/span><span class="merge-criterion__link">Seos mockup'iga puudub<\/span>/);
  assert.match(html, /<strong>K3<\/strong> \(lugu 4\) vormil on väli 'e-post'\.<span class="tag tag--dup">duplikaat: sama tekst kui K1<\/span><span class="merge-criterion__link">Seos: 1\. sisestusväli: E-post \(mockup v2\)<\/span>/);
  assert.match(html, /Seos: ei puuduta vaadet</);
});

test('eelvaade: uus pealkiri ja koht, kriteeriumide arv, küsimused, mockup, ettepanekud, alustamise lugu, MVP, eemaldatav rida', () => {
  const html = render();
  assert.match(html, /<strong>Ühendatud lugu \(kohal 2\):<\/strong> Külastajana soovin registreeruda, et saaksin liituda\./);
  assert.match(html, /Kriteeriumid: alles jääb 3, eemaldatakse 0\./);
  assert.match(html, /kõik 1 jäävad ühendatud loole; avatud küsimuse tõttu saab lugu staatuse „Vajab täpsustamist“/);
  assert.match(html, /Mockup: loo 4 2 versiooni jäävad ühendatud loole muutmata kujul\./);
  assert.match(html, /Ootel ettepanekud \(2\) lükatakse tagasi/);
  assert.match(html, /Alustamise lugu on ühendatud lugu \(alustamise lugu oli lugu 4\)\./);
  assert.match(html, /MVP joon: ühendatud lugu on joone kohal; joone kohal on ühe loo võrra vähem\./);
  assert.match(html, /Teiste lugude sisu ei muutu ega järjekord muutu\. Loo 4 \(„Külastajana soovin tasuda, et saaksin liituda\.“\) rida kustutatakse\. Tagasivõtmist veel pole\./);
  const middle = render({ info: { ...INFO, removeId: 3, keepId: 2 } });
  assert.match(middle, /eemaldatava loo järel olevad lood nihkuvad ühe koha võrra ettepoole/);
});

test('teadlikult märkimata duplikaat: eelvaade nimetab just selle kirje ja kaduva seose', () => {
  const html = render({ initialUnchecked: [21] });
  assert.match(html, /Kriteeriumid: alles jääb 2, eemaldatakse 1\./);
  assert.match(html, /<li class="merge-preview__removed">Eemaldatakse K3 „vormil on väli 'e-post'\.“ \(duplikaat\) – koos sellega kaob seos „1\. sisestusväli: E-post \(mockup v2\)“\.<\/li>/);
});

test('mõlemal mockup: selge keelu teade, ühendamise nuppu ega vormi pole', () => {
  const html = render({ info: { ...INFO, blocked: true, mockups: { keep: 3, remove: 2, from: 'keep' } } });
  assert.match(html, /Lugude 2 ja 4 ühendamine pole praegu võimalik, sest mõlemal lool on mockup'i versioonid \(3 ja 2\) ja mõlema ajaloo turvaline ühendamine puudub\. Teisi lugusid saab ühendada\./);
  assert.doesNotMatch(html, />Ühenda<\/button>|Ühendatud loo sõnastus/);
});

test('backlog’is on nupp „⇄ Ühenda“ (kui lugusid on üle ühe)', () => {
  const manage = { mode: null, roles: [], error: null, onAdd: noop, onEdit: noop, onSplit: noop, onMerge: noop, onDelete: noop, onCancel: noop };
  assert.match(clean(renderToStaticMarkup(createElement(BacklogView, { stories: STORIES, onMove: noop, manage }))), /aria-label="Ühenda lugu 1 teise looga: [^"]+">⇄ Ühenda<\/button>/);
  assert.doesNotMatch(clean(renderToStaticMarkup(createElement(BacklogView, { stories: [STORIES[0]], onMove: noop, manage }))), /⇄ Ühenda/);
});
