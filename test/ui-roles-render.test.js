import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';
import { addManualRole, fromProposal, toggleRole } from '../src/roles/selection.js';

// RolesProposalCard renderdatakse võltsandmetega HTML-iks (brauserit, serverit ega AI-d pole vaja).
let RolesProposalCard;
before(async () => {
  ({ default: RolesProposalCard } = await importJsx('src/components/RolesProposalCard.jsx'));
});

const PROPOSAL = {
  id: 'p1',
  message: 'Pakun järgmised rollid.',
  roles: [
    { name: 'Külastaja', description: 'Tutvub treeningutega.' },
    { name: 'Klubi liige', description: 'Registreerub treeningutele.' },
  ],
};
const noop = () => {};

function render(props) {
  const items = props.items ?? fromProposal(PROPOSAL);
  return renderToStaticMarkup(createElement(RolesProposalCard, {
    message: PROPOSAL.message, items, newRole: '', addError: '', error: '', busy: null,
    onToggle: noop, onRemove: noop, onNewRoleChange: noop, onAdd: noop, onConfirm: noop, onReject: noop,
    ...props,
  }));
}

const buttonByText = (html, text) => html.match(new RegExp(`<button[^>]*>${text}</button>`))?.[0];

test('pealkiri ütleb, et ettepanek ei ole veel kinnitatud', () => {
  assert.match(render({}), /<h3[^>]*>AI ettepanek – ei ole veel kinnitatud<\/h3>/);
});

test('iga pakutud roll on märgitud märkeruut koos kirjelduse ja eemaldamise nupuga', () => {
  const html = render({});
  assert.equal((html.match(/type="checkbox" checked=""/g) ?? []).length, 2);
  assert.match(html, /Külastaja<\/strong>/);
  assert.match(html, /Tutvub treeningutega\./);
  assert.match(html, /aria-label="Eemalda roll Külastaja"/);
  assert.match(html, /aria-label="Eemalda roll Klubi liige"/);
});

test('märkimata roll kuvatakse märkimata märkeruuduga', () => {
  const html = render({ items: toggleRole(fromProposal(PROPOSAL), 'klubi liige') });
  assert.equal((html.match(/type="checkbox" checked=""/g) ?? []).length, 1);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
});

test('käsitsi lisatud rollil on silt "käsitsi"; lisamise väli ja nupp on olemas', () => {
  const html = render({ items: addManualRole(fromProposal(PROPOSAL), 'Treener').items });
  assert.match(html, /Treener<\/strong><span class="tag">käsitsi<\/span>/);
  assert.match(html, /placeholder="Lisa oma roll, nt Giid"/);
  assert.ok(buttonByText(html, 'Lisa'));
});

test('"Kinnita rollid" ja "Loobu" on lubatud, kui päringut ei käi', () => {
  const html = render({});
  assert.doesNotMatch(buttonByText(html, 'Kinnita rollid'), /disabled/);
  assert.doesNotMatch(buttonByText(html, 'Loobu'), /disabled/);
});

test('rakendamise päringu ajal on "Kinnita rollid" ja kõik muud nupud keelatud', () => {
  const html = render({ busy: 'apply' });
  assert.match(buttonByText(html, 'Kinnitan…'), /disabled/);
  assert.match(buttonByText(html, 'Loobu'), /disabled/);
  assert.match(buttonByText(html, 'Lisa'), /disabled/);
  assert.equal((html.match(/type="checkbox"[^>]*disabled/g) ?? []).length, 2);
});

test('ilma valitud rollita on "Kinnita rollid" keelatud ja kuvatakse vihje', () => {
  const items = fromProposal(PROPOSAL).map((i) => ({ ...i, checked: false }));
  const html = render({ items });
  assert.match(buttonByText(html, 'Kinnita rollid'), /disabled/);
  assert.match(html, /Vali vähemalt üks roll\./);
});

test('serveri veateade ja lisamise viga kuvatakse', () => {
  const html = render({ error: 'See ettepanek on juba rakendatud või tagasi lükatud.', addError: 'Roll „Külastaja“ on juba loendis.' });
  assert.match(html, /juba rakendatud või tagasi lükatud/);
  assert.match(html, /on juba loendis/);
});
