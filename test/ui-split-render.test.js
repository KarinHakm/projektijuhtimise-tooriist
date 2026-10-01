import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Loo jagamise vorm (L25), renderdus võltsandmetega. Klõpsamist ei testita.
let SplitStoryForm, BacklogView;
before(async () => {
  ({ default: SplitStoryForm } = await importJsx('src/components/SplitStoryForm.jsx'));
  ({ BacklogView } = await importJsx('src/components/BacklogPanel.jsx'));
});
const noop = () => {};
const STORY = { id: 3, role: 'Külastaja', rolePhrase: 'Külastajana', want: 'registreeruda ja maksta', soThat: 'saaksin liituda', size: 'L', touchesView: true, status: 'idee', origin: 'ai', title: 'Külastajana soovin registreeruda ja maksta, et saaksin liituda.' };
const INFO = {
  criteria: [{ id: 11, text: "Vormil on väli 'E-post'.", linked: true }, { id: 12, text: "Vormil on nupp 'Maksa'.", linked: true }],
  questions: [{ id: 21, text: 'Milline makseviis?', resolvedAt: null }],
  mockupVersions: 2, pendingProposals: 1, isFocus: true, aboveMvpLine: true,
};
const clean = (html) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
const render = (props = {}) => clean(renderToStaticMarkup(createElement(SplitStoryForm, { story: STORY, info: INFO, onSubmit: noop, onCancel: noop, ...props })));

test('kaks osa väljadega; osa 1 eeltäidetud algse looga, osa 2 tühi tegevuse ja kasuga', () => {
  const html = render();
  assert.match(html, /<section aria-label="Osa 1" class="split-part split-part--first"><p class="split-form__part"><span class="split-part__badge">1<\/span> Algne lugu – muuda sõnastust ainult vajadusel<\/p>/);
  assert.match(html, /<section aria-label="Osa 2" class="split-part split-part--second"><p class="split-form__part"><span class="split-part__badge">2<\/span> Uus lugu – täida tegevus ja kasu<\/p>/);
  assert.match(html, /id="jaga-3-1-want"[^>]*value="registreeruda ja maksta"/);
  assert.match(html, /id="jaga-3-2-want"[^>]*value=""/);
});

test('kriteeriumide ja küsimuste jaotus: igaühe juures Osa 1 / Osa 2 (vaikimisi osa 1)', () => {
  const html = render();
  assert.match(html, /<legend>Kriteeriumid<\/legend>.*K1\. Vormil on väli 'E-post'\..*K2\. Vormil on nupp 'Maksa'\./);
  assert.match(html, /<legend>Küsimused<\/legend>.*Milline makseviis\?/);
  assert.equal((html.match(/type="radio"[^>]*checked=""/g) ?? []).length, 3);
});

test('eelvaade: mõlema osa pealkiri ja mis algse looga juhtub (mockup, ettepanekud, alustamise lugu, MVP, midagi ei kustutata)', () => {
  const html = render();
  assert.match(html, /<li><strong>Osa 1:<\/strong> Külastajana soovin registreeruda ja maksta, et saaksin liituda\.<\/li><li><strong>Osa 2:<\/strong> \(täida väljad\)<\/li>/);
  assert.match(html, /Algne lugu jääb osaks 1 \(sama lugu, uus sõnastus\)\. Osa 2 lisatakse kohe selle järele/);
  assert.match(html, /Kriteeriumid: osale 1 jääb 2, osale 2 läheb 0\./);
  assert.match(html, /Mockup'i versioonid \(2\) jäävad osale 1\. Osal 2 mockup'i pole\./);
  assert.match(html, /Küsimused: osale 1 jääb 1, osale 2 läheb 0\./);
  assert.match(html, /ootel ettepanekud \(1: kriteeriumid, mockup või täpsustus\) lükatakse tagasi/);
  assert.match(html, /Alustamise lugu jääb osaks 1\./);
  assert.match(html, /ka osa 2 läheb joone kohale/);
  assert.match(html, /Midagi ei kustutata\./);
  assert.match(html, /<button type="submit">Jaga kaheks<\/button>/);
});

test('ilma seotud andmeteta pole jaotusplokke ega vastavaid eelvaate ridu; backlog’is on nupp „✂ Jaga“', () => {
  const html = render({ info: { criteria: [], questions: [], mockupVersions: 0, pendingProposals: 0, isFocus: false, aboveMvpLine: false } });
  assert.doesNotMatch(html, /<legend>|Mockup'i versioonid|ootel ettepanekud|Alustamise lugu|MVP/);
  const list = clean(renderToStaticMarkup(createElement(BacklogView, { stories: [STORY], onMove: noop, manage: { mode: null, roles: [], error: null, onAdd: noop, onEdit: noop, onSplit: noop, onDelete: noop, onCancel: noop } })));
  assert.match(list, /aria-label="Jaga lugu 1 kaheks: [^"]+">✂ Jaga<\/button>/);
});
