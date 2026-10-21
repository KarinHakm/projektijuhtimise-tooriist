import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Vabatekst (L37): vestluse kast ja „Mida teeme edasi?“ tulemus, renderdus võltsandmetega. Klõpsamist ei testita.
let ChatComposerView, NextStepResult;
before(async () => {
  ({ ChatComposerView } = await importJsx('src/components/ChatComposer.jsx'));
  ({ NextStepResult } = await importJsx('src/components/NextSteps.jsx'));
});
const html = (C, props) => renderToStaticMarkup(createElement(C, { onText: () => {}, onTarget: () => {}, onSubmit: () => {}, onGo: () => {}, onGoResult: () => {}, ...props })).replace(/<!-- -->/g, '');

test('vestluse kast näitab sihtkohta; mitme võimaluse korral saab seda muuta; tühja tekstiga nupp on keelatud', () => {
  const one = html(ChatComposerView, { target: 'roles', options: ['roles'], text: 'lisa treeneri roll' });
  assert.match(one, /<form class="chat-composer" aria-label="Vestluse kast" noValidate="">/);
  assert.match(one, /<p class="chat-composer__target">Saadan: <strong>rollid<\/strong><\/p>/);
  assert.match(one, /<textarea id="chat-text" rows="2" maxLength="500" aria-label="Kirjuta vabalt: vastus, täpsustus või küsimus" placeholder="Kirjuta vabalt: vastus, täpsustus või küsimus">lisa treeneri roll<\/textarea><button type="submit">Saada<\/button>/);
  const many = html(ChatComposerView, { target: 'refinement', options: ['roles', 'stories', 'refinement', 'next'], text: ' ' });
  assert.match(many, /<label for="chat-target">Saadan:<\/label> <select id="chat-target">/);
  assert.match(many, /<option value="refinement" selected="">kliendi täpsustus<\/option><option value="next">mida teeme edasi \(AI soovitab sammu\)<\/option>/);
  assert.match(many, /<button type="submit" disabled="">Saada<\/button>/);
});

test('idee on pikem (2000 märki) ja näitega; küsimuste ajal on kast suletud ja juhis ütleb, kuidas vastata', () => {
  assert.match(html(ChatComposerView, { target: 'conversation', options: ['conversation'] }), /maxLength="2000"[^>]*placeholder="Nt: Tahame hambaarsti kabinetile veebi/);
  const closed = html(ChatComposerView, { target: null, hint: 'Vasta AI küsimustele ülal.' });
  assert.match(closed, /<p class="muted chat-composer__target">Vasta AI küsimustele ülal\.<\/p>/);
  assert.match(closed, /<textarea id="chat-text" rows="2" maxLength="500" disabled=""/);
  assert.match(html(ChatComposerView, { target: 'roles', options: ['roles'], text: 'x', busy: true }), /<button type="submit" disabled="">AI koostab…<\/button>/);
});

test('„Mida teeme edasi?“ tulemus: AI selgitus, märkus ja sammu nupp; andmeid ei muudetud', () => {
  const out = html(NextStepResult, {
    result: { message: 'Lähme lugude juurde.', note: 'Lisa lugusid treeneri kohta.', step: { id: 'stage:lood', label: 'Ava etapp „Lood“', card: 'stories' } },
  });
  assert.match(out, /<p>Lähme lugude juurde\.<\/p>/);
  assert.match(out, /Märkus, mis pannakse vestluse kasti: „Lisa lugusid treeneri kohta\.“/);
  assert.match(out, /<button type="button">Ava etapp „Lood“<\/button>/);
  assert.match(out, /Midagi ei muudetud\./);
});
