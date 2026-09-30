import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addManualRole, buildSelection, canConfirm, fromProposal, removeRole, roleKey, selectedCount, toggleRole,
} from '../src/roles/selection.js';
import { roleKey as serverRoleKey } from '../server/roles.js';

// Rollide valiku loogika testid (ilma brauseri, serveri ja AI-ta).
const PROPOSAL = {
  id: 'p1',
  roles: [
    { name: 'Külastaja', description: 'Tutvub treeningutega.' },
    { name: 'Klubi liige', description: 'Registreerub treeningutele.' },
    { name: 'Administraator', description: 'Haldab pakette.' },
  ],
};

test('ettepanekust tehtud loendis on kõik rollid vaikimisi märgitud ja päritoluga ai', () => {
  const items = fromProposal(PROPOSAL);
  assert.deepEqual(items.map((i) => [i.name, i.checked, i.source]), [
    ['Külastaja', true, 'ai'], ['Klubi liige', true, 'ai'], ['Administraator', true, 'ai'],
  ]);
});

test('märkeruut lülitab rolli valiku; eemaldamine kustutab rolli loendist', () => {
  let items = toggleRole(fromProposal(PROPOSAL), roleKey('Klubi liige'));
  assert.equal(items.find((i) => i.name === 'Klubi liige').checked, false);
  assert.equal(selectedCount(items), 2);
  items = removeRole(items, roleKey('Administraator'));
  assert.deepEqual(items.map((i) => i.name), ['Külastaja', 'Klubi liige']);
});

test('käsitsi lisatud roll on märgitud ja päritoluga manual', () => {
  const { items } = addManualRole(fromProposal(PROPOSAL), '  Treener ');
  assert.deepEqual(items.at(-1), { key: 'treener', name: 'Treener', description: '', source: 'manual', checked: true });
});

test('käsitsi lisamine keelab tühja, liiga pika ja korduva nime (ka täpitähtedega)', () => {
  const base = fromProposal(PROPOSAL);
  assert.ok(addManualRole(base, '   ').error);
  assert.ok(addManualRole(base, 'x'.repeat(41)).error);
  assert.match(addManualRole(base, 'KÜLASTAJA').error, /juba loendis/);
  const { items } = addManualRole(base, 'Õpetaja');
  assert.match(addManualRole(items, 'õpetaja').error, /juba loendis/);
});

test('eemaldatud AI rolli võib uuesti käsitsi lisada', () => {
  const items = removeRole(fromProposal(PROPOSAL), roleKey('Külastaja'));
  assert.equal(addManualRole(items, 'Külastaja').items.at(-1).source, 'manual');
});

test('kinnitada saab 1–10 valitud rolliga', () => {
  let items = fromProposal(PROPOSAL);
  assert.equal(canConfirm(items), true);
  items = items.map((i) => ({ ...i, checked: false }));
  assert.equal(canConfirm(items), false);
  let many = fromProposal(PROPOSAL);
  for (let n = 1; n <= 8; n++) many = addManualRole(many, `Roll ${n}`).items;
  assert.equal(selectedCount(many), 11);
  assert.equal(canConfirm(many), false);
});

test('buildSelection saadab ainult märgitud rollid õige päritoluga', () => {
  let items = toggleRole(fromProposal(PROPOSAL), roleKey('Klubi liige'));
  items = addManualRole(items, 'Treener').items;
  assert.deepEqual(buildSelection(items), [
    { name: 'Külastaja', source: 'ai' },
    { name: 'Administraator', source: 'ai' },
    { name: 'Treener', source: 'manual' },
  ]);
});

test('brauseri ja serveri rollivõti on sama (kordused tuvastatakse ühtemoodi)', () => {
  for (const name of ['Külastaja', '  ÕPETAJA ', 'Klubi Liige', 'ÄRIKLIENT']) assert.equal(roleKey(name), serverRoleKey(name));
});
