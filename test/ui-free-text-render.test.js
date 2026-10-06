import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// Vabatekst: sammu väli ja „Mida teeme edasi?“ tulemus, renderdus võltsandmetega. Klõpsamist ei testita.
let NoteFieldView, NextStepTextView;
before(async () => {
  ({ NoteFieldView } = await importJsx('src/components/NoteField.jsx'));
  ({ NextStepTextView } = await importJsx('src/components/NextSteps.jsx'));
});
const html = (C, props) => renderToStaticMarkup(createElement(C, { onChange: () => {}, onText: () => {}, onSubmit: () => {}, onGoResult: () => {}, ...props })).replace(/<!-- -->/g, '');

test('sammu väli ütleb, kas uus ettepanek asendab ootel ettepaneku; tühja tekstiga nupp on keelatud', () => {
  const replacing = html(NoteFieldView, { card: 'stories', text: 'treeneri lood', replaces: true });
  assert.match(replacing, /<label for="note-stories">Või kirjuta oma sõnadega<\/label>/);
  assert.match(replacing, /asendab praeguse ootel ettepaneku\. Midagi ei rakendata enne sinu kinnitust\./);
  assert.match(replacing, /<button type="submit" class="secondary">Saada AI-le<\/button>/);
  const empty = html(NoteFieldView, { card: 'roles', text: ' ', replaces: false });
  assert.doesNotMatch(empty, /asendab/);
  assert.match(empty, /<button type="submit" class="secondary" disabled="">Saada AI-le<\/button>/);
});

test('„Mida teeme edasi?“ tulemus: AI selgitus, märkus ja sammu nupp; andmeid ei muudetud', () => {
  const out = html(NextStepTextView, {
    card: 'stories', text: 'treeneri lood', busy: false, error: null,
    result: { message: 'Lähme lugude juurde.', note: 'Lisa lugusid treeneri kohta.', step: { id: 'stage:lood', label: 'Ava etapp „Lood“', card: 'stories' } },
  });
  assert.match(out, /<p>Lähme lugude juurde\.<\/p>/);
  assert.match(out, /Märkus, mis kirjutatakse sammu vabateksti välja: „Lisa lugusid treeneri kohta\.“/);
  assert.match(out, /<button type="button">Ava etapp „Lood“<\/button>/);
  assert.match(out, /Midagi ei muudetud\./);
});
