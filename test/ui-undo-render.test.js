import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// L21: tagasivõtmise riba, renderdus võltsandmetega. Klõpsamist ei testita.
let UndoView;
before(async () => {
  ({ UndoView } = await importJsx('src/components/UndoBar.jsx'));
});
const render = (props) => renderToStaticMarkup(createElement(UndoView, { onUndo: () => {}, ...props })).replace(/<!-- -->/g, '');

test('saadaval: nupp „Võta tagasi viimane muudatus“ koos muudatuse sildiga', () => {
  const html = render({ state: { available: true, label: 'Kustutasid loo 2 „Lugu“', at: 'x', reason: null } });
  assert.match(html, /<button type="button" class="secondary">↶ Võta tagasi viimane muudatus<\/button><span class="undo-bar__label">Kustutasid loo 2 „Lugu“<\/span>/);
});

test('pole saadaval: nupp keelatud ja põhjus nähtav', () => {
  const html = render({ state: { available: false, label: 'Muutsid lugu 1', at: 'x', reason: 'Pärast seda muudatust on tehtud teisi muudatusi – seda ei saa enam tagasi võtta.' } });
  assert.match(html, /<button type="button" class="secondary" disabled="">↶ Võta tagasi viimane muudatus<\/button>/);
  assert.match(html, /<p class="muted undo-bar__reason">Pärast seda muudatust on tehtud teisi muudatusi/);
  assert.match(render({ state: { available: false, label: null, at: null, reason: 'Tagasivõetavat muudatust pole.' } }), /Tagasivõetavat muudatust pole\./);
});
