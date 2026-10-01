import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Lugude käsitsi haldus (L15), renderdus võltsandmetega. Klõpsamist ei testita.
let StoryForm, DeleteStoryConfirm, BacklogView;
before(async () => {
  ({ default: StoryForm } = await importJsx('src/components/StoryForm.jsx'));
  ({ default: DeleteStoryConfirm } = await importJsx('src/components/DeleteStoryConfirm.jsx'));
  ({ BacklogView } = await importJsx('src/components/BacklogPanel.jsx'));
});
const noop = () => {};
const STORY = { id: 3, role: 'Külastaja', rolePhrase: 'Külastajana', want: 'esitada taotluse', soThat: 'saaksin liituda', size: 'M', touchesView: true, status: 'idee', origin: 'ai', title: 'Külastajana soovin esitada taotluse, et saaksin liituda.' };
const clean = (html) => html.replace(/<!-- -->/g, '');

test('vorm: rolli soovitused, kõik väljad, pealkirja eelvaade ja serveri viga väljal', () => {
  const html = clean(renderToStaticMarkup(createElement(StoryForm, { idBase: 'x', initial: STORY, roles: ['Külastaja', 'Administraator'], submitLabel: 'Salvesta muudatus', onSubmit: noop, onCancel: noop, error: { message: 'Tegevus ei tohi alata sõnaga „soovin“.', field: 'want' } })));
  assert.match(html, /<datalist id="x-roles"><option value="Külastaja"><\/option><option value="Administraator"><\/option><\/datalist>/);
  for (const label of ['Roll', 'Roll olevas käändes', 'soovin …', 'et …', 'Suurus']) assert.match(html, new RegExp(`>${label}</label>`));
  assert.match(html, /<input type="checkbox" checked=""[^>]*\/> Puudutab vaadet/);
  assert.match(html, /Pealkiri: Külastajana soovin esitada taotluse, et saaksin liituda\./);
  assert.match(html, /id="x-want"[^>]*aria-invalid="true"/);
  assert.match(html, /<p class="error" role="alert">Tegevus ei tohi alata sõnaga „soovin“\.<\/p>/);
});

test('kustutamise kinnitus: alustamise lugu, seotud andmed, ootel ettepanekud, MVP joon ja lõplikkus', () => {
  const html = clean(renderToStaticMarkup(createElement(DeleteStoryConfirm, { story: STORY, impact: { isFocus: true, aboveMvpLine: true, criteria: 4, mockupVersions: 3, questions: 1, pendingProposals: 2 }, onConfirm: noop, onCancel: noop })));
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /See on alustamise lugu\.<\/strong> Alustamise valik tühjeneb/);
  assert.match(html, /Koos looga kustuvad: 4 kriteeriumi, 3 mockup&#x27;i versiooni, 1 küsimust\./);
  assert.match(html, /Selle loo ootel ettepanekud \(2\) lükatakse tagasi\./);
  assert.match(html, /joon nihkub ühe loo võrra üles/);
  assert.match(html, /Tagasivõtmist pole – kustutamine on lõplik\./);
  assert.match(html, /<button type="button" class="danger">Kustuta lõplikult<\/button>/);
  const plain = clean(renderToStaticMarkup(createElement(DeleteStoryConfirm, { story: STORY, impact: { isFocus: false, aboveMvpLine: false, criteria: 0, mockupVersions: 0, questions: 0, pendingProposals: 0 }, onConfirm: noop, onCancel: noop })));
  assert.match(plain, /Lool pole kriteeriume, mockup&#x27;i ega küsimusi\./);
  assert.doesNotMatch(plain, /alustamise lugu|MVP|ootel/);
});

test('backlog: „+ Lisa lugu“ ning iga loo juures „✎ Muuda“ ja „Kustuta“', () => {
  const manage = { mode: null, roles: [], error: null, onAdd: noop, onEdit: noop, onDelete: noop, onCancel: noop };
  const html = clean(renderToStaticMarkup(createElement(BacklogView, { stories: [STORY], onMove: noop, manage })));
  assert.match(html, /<button type="button" class="secondary backlog__add">\+ Lisa lugu<\/button>/);
  assert.match(html, /aria-label="Muuda lugu 1: Külastajana soovin esitada taotluse, et saaksin liituda\.">✎ Muuda<\/button>/);
  assert.match(html, /aria-label="Kustuta lugu 1: [^"]+">Kustuta<\/button>/);
  const adding = clean(renderToStaticMarkup(createElement(BacklogView, { stories: [STORY], onMove: noop, manage: { ...manage, mode: { type: 'add' } } })));
  assert.match(adding, /Uus lugu \(lisatakse backlog&#x27;i lõppu\)/);
  assert.doesNotMatch(adding, /\+ Lisa lugu/);
});
