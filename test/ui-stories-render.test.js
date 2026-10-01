import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { fromProposal, rejectStory, toggleChecked } from '../src/stories/selection.js';

// Lugude komponendid renderdatakse võltsandmetega HTML-iks (brauserit, serverit ega AI-d pole vaja).
let StoriesProposal, StoryCard;
before(async () => {
  ({ default: StoriesProposal } = await importJsx('src/components/StoriesProposal.jsx'));
  ({ default: StoryCard } = await importJsx('src/components/StoryCard.jsx'));
});

const ROLES = ['Potentsiaalne liige', 'Administraator'];
const st = (index, want, soThat, role = 'Potentsiaalne liige', rolePhrase = 'Potentsiaalse liikmena', warnings = []) =>
  ({ index, role, rolePhrase, want, soThat, size: 'M', touchesView: true, warnings });
const PROPOSAL = {
  id: 'p1',
  message: 'Pakun järgmised lood.',
  primaryRole: 'Potentsiaalne liige',
  stories: [
    st(0, 'näha treeningute tunniplaani', 'saaksin hinnata, kas treeningud sobivad'),
    st(1, 'näha liikmepakette ja nende hindu', 'saaksin valida endale sobiva paketi'),
    st(2, 'registreeruda valitud paketiga', 'saaksin klubi liikmeks', undefined, undefined, ['Tegevus sisaldab eraldi „et“-kõrvallauset; kasu kuulub välja „Kasu“.']),
    st(3, 'lisada uue paketi', 'hinnakiri oleks ajakohane', 'Administraator', 'Administraatorina'),
  ],
};
const noop = () => {};

function renderProposal(props = {}) {
  return renderToStaticMarkup(createElement(StoriesProposal, {
    proposal: PROPOSAL, items: fromProposal(PROPOSAL), roles: ROLES, busy: null, error: '', replaceError: null,
    onToggle: noop, onReject: noop, onSave: noop, onAddAll: noop, onAddSelected: noop, onReplace: noop, ...props,
  }));
}
const button = (html, text) => html.match(new RegExp(`<button[^>]*>${text}</button>`))?.[0];
const buttonStarting = (html, text) => html.match(new RegExp(`<button[^>]*>${text}[^<]*</button>`))?.[0];

test('pealkiri ütleb, et ettepanek ei ole veel backlog’is; peamine roll on nimetatud', () => {
  const html = renderProposal();
  assert.match(html, /<h3[^>]*>AI ettepanek – ei ole veel backlog&#x27;is<\/h3>/);
  assert.match(html, /peamise rolli \(Potentsiaalne liige\) põhitöövoo järjekorras/);
});

test('kaardid on nummerdatud, pealkiri on Connextra kujul ja märkeruut on vaikimisi märgitud', () => {
  const html = renderProposal();
  for (const n of [1, 2, 3, 4]) assert.match(html, new RegExp(`aria-label="Lugu ${n}">${n}\\.<`));
  assert.match(html, /Potentsiaalse liikmena soovin näha liikmepakette ja nende hindu, et saaksin valida endale sobiva paketi\./);
  assert.equal((html.match(/type="checkbox" checked=""/g) ?? []).length, 4);
  assert.equal((html.match(/✎ Muuda/g) ?? []).length, 4);
  assert.equal((html.match(/✗ Lükka tagasi/g) ?? []).length, 4);
});

test('hoiatus kuvatakse kaardil', () => {
  assert.match(renderProposal(), /⚠ Tegevus sisaldab eraldi/);
});

test('tagasi lükatud kaart kaob pakkumisest ja "Lisa kõik" arv ei sisalda seda', () => {
  const items = rejectStory(fromProposal(PROPOSAL), 1);
  const html = renderProposal({ items });
  assert.doesNotMatch(html, /näha liikmepakette ja nende hindu/);
  assert.equal((html.match(/story-card"/g) ?? []).length, 3);
  assert.ok(buttonStarting(html, "Lisa kõik backlog&#x27;i \\(3\\)"));
  assert.match(html, /Tagasi lükatud: 1\. Neid backlog&#x27;i ei lisata\./);
});

test('"Lisa valitud" arv sisaldab ainult märgitud lugusid; ilma valikuta on nupp keelatud', () => {
  let items = toggleChecked(fromProposal(PROPOSAL), 0);
  assert.ok(buttonStarting(renderProposal({ items }), 'Lisa valitud \\(3\\)'));
  items = items.map((i) => ({ ...i, checked: false }));
  assert.match(buttonStarting(renderProposal({ items }), 'Lisa valitud \\(0\\)'), /disabled/);
});

test('kolm nuppu on olemas ja lubatud, kui päringut ei käi', () => {
  const html = renderProposal();
  for (const b of [buttonStarting(html, 'Lisa kõik backlog'), buttonStarting(html, 'Lisa valitud'), button(html, 'Paku teistsuguseid')]) {
    assert.ok(b);
    assert.doesNotMatch(b, /disabled/);
  }
});

test('lisamise päringu ajal on kõik nupud ja märkeruudud keelatud', () => {
  const html = renderProposal({ busy: 'apply-all' });
  assert.match(button(html, 'Lisan…'), /disabled/);
  assert.match(buttonStarting(html, 'Lisa valitud'), /disabled/);
  assert.match(button(html, 'Paku teistsuguseid'), /disabled/);
  assert.equal((html.match(/<button[^>]*disabled=""[^>]*>✎ Muuda/g) ?? []).length, 4);
  assert.equal((html.match(/<button[^>]*disabled=""[^>]*>✗ Lükka tagasi/g) ?? []).length, 4);
  assert.equal((html.match(/type="checkbox"[^>]*disabled/g) ?? []).length, 4);
});

test('"Paku teistsuguseid" ajal on nupud keelatud, aga senised kaardid jäävad nähtavaks', () => {
  const html = renderProposal({ busy: 'replace' });
  assert.equal((html.match(/story-card"/g) ?? []).length, 4);
  assert.match(button(html, 'Paku teistsuguseid'), /disabled/);
  assert.match(buttonStarting(html, 'Lisa kõik'), /disabled/);
});

test('ebaõnnestunud "Paku teistsuguseid": senised kaardid on nähtavad, nupud lubatud ja kuvatakse veateade koos "Proovi uuesti"', () => {
  const replaceError = { message: 'AI-teenus ei ole praegu kättesaadav. Käsitsi saad edasi töötada.', code: 'unavailable' };
  const html = renderProposal({ replaceError });
  assert.equal((html.match(/story-card"/g) ?? []).length, 4);
  assert.doesNotMatch(buttonStarting(html, 'Lisa kõik'), /disabled/);
  assert.doesNotMatch(buttonStarting(html, 'Lisa valitud'), /disabled/);
  assert.match(html, /AI-teenus ei ole praegu kättesaadav/);
  assert.ok(button(html, 'Proovi uuesti'));
});

test('✎ Muuda vormis on rolli valikus ainult kinnitatud rollid ja väljade vihjed', () => {
  const [item] = fromProposal(PROPOSAL);
  const html = renderToStaticMarkup(createElement(StoryCard, {
    item, number: 1, roles: ROLES, busy: false, onToggle: noop, onReject: noop, onSave: noop, initialEditing: true,
  }));
  const options = [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(options.slice(0, 2), ROLES); // rolli valik
  assert.deepEqual(options.slice(2), ['S', 'M', 'L']); // suuruse valik
  assert.match(html, /Tegevus \(ilma sõnata „soovin“\)/);
  assert.match(html, /Kasu \(ilma sõnata „et“\)/);
  assert.ok(button(html, 'Salvesta'));
});

// Backlog'i loendi testid on failis ui-backlog-render.test.js (L07).
