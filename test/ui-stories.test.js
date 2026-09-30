import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApply, fromProposal, isEdited, ORIGIN_LABELS, rejectStory, saveEdit, storyTitle, toggleChecked, visibleStories,
} from '../src/stories/selection.js';

// Lugude valiku loogika testid (ilma brauseri, serveri ja AI-ta).
const ROLES = ['Potentsiaalne liige', 'Administraator'];
const s = (index, want, soThat, role = 'Potentsiaalne liige', rolePhrase = 'Potentsiaalse liikmena', size = 'M') =>
  ({ index, role, rolePhrase, want, soThat, size, touchesView: true, warnings: [] });
const PROPOSAL = {
  id: 'p1',
  primaryRole: 'Potentsiaalne liige',
  stories: [
    s(0, 'näha treeningute tunniplaani', 'saaksin hinnata, kas treeningud sobivad'),
    s(1, 'näha liikmepakette ja nende hindu', 'saaksin valida endale sobiva paketi', undefined, undefined, 'S'),
    s(2, 'registreeruda valitud paketiga', 'saaksin klubi liikmeks', undefined, undefined, 'L'),
    s(3, 'lisada uue paketi', 'hinnakiri oleks ajakohane', 'Administraator', 'Administraatorina'),
  ],
};
const fields = (item, patch = {}) => ({ ...item.draft, ...patch });

test('ettepanekust tehtud loendis on kõik lood märgitud ja keegi pole tagasi lükatud', () => {
  const items = fromProposal(PROPOSAL);
  assert.deepEqual(items.map((i) => [i.index, i.checked, i.rejected]), [[0, true, false], [1, true, false], [2, true, false], [3, true, false]]);
  assert.equal(storyTitle(items[1]), 'Potentsiaalse liikmena soovin näha liikmepakette ja nende hindu, et saaksin valida endale sobiva paketi.');
});

test('"Lisa kõik" ei lisa tagasi lükatud lugusid; "Lisa valitud" lisab ainult märgitud', () => {
  let items = rejectStory(fromProposal(PROPOSAL), 1);
  items = toggleChecked(items, 2);
  assert.deepEqual(visibleStories(items).map((i) => i.index), [0, 2, 3]);
  assert.deepEqual(buildApply(items, 'all').map((r) => r.index), [0, 2, 3]);
  assert.deepEqual(buildApply(items, 'selected').map((r) => r.index), [0, 3]);
});

test('tagasi lükatud lugu ei tule tagasi ka siis, kui see oli märgitud', () => {
  const items = rejectStory(fromProposal(PROPOSAL), 0);
  assert.equal(items[0].checked, false);
  assert.ok(!buildApply(items, 'all').some((r) => r.index === 0));
  assert.ok(!buildApply(items, 'selected').some((r) => r.index === 0));
});

test('buildApply saadab serveri kuju: järjekorranumber ja väljad', () => {
  assert.deepEqual(buildApply(fromProposal(PROPOSAL), 'all')[3], {
    index: 3, role: 'Administraator', rolePhrase: 'Administraatorina', want: 'lisada uue paketi', soThat: 'hinnakiri oleks ajakohane', size: 'M',
  });
});

test('muutmine salvestab puhastatud väljad ja märgib loo muudetuks', () => {
  const items = fromProposal(PROPOSAL);
  const { items: edited } = saveEdit(items, 1, fields(items[1], { want: '  näha kõiki liikmepakette. ', size: 'L' }), ROLES);
  assert.equal(edited[1].draft.want, 'näha kõiki liikmepakette');
  assert.equal(edited[1].draft.size, 'L');
  assert.equal(isEdited(edited[1]), true);
  assert.equal(isEdited(edited[0]), false);
});

test('ainult tühikute või lõpu kirjavahemärgi muutmine ei loe muudatuseks', () => {
  const items = fromProposal(PROPOSAL);
  const { items: edited } = saveEdit(items, 0, fields(items[0], { want: 'näha treeningute tunniplaani.  ' }), ROLES);
  assert.equal(isEdited(edited[0]), false);
});

test('muutmisel lükatakse tagasi topelt-"soovin", topelt-"et", vale kääne, kinnitamata roll ja vale suurus', () => {
  const items = fromProposal(PROPOSAL);
  const cases = [
    [{ want: 'soovin näha pakette' }, 'want'],
    [{ soThat: 'et saaksin valida' }, 'soThat'],
    [{ rolePhrase: 'Potentsiaalne liige' }, 'rolePhrase'],
    [{ role: 'Treener' }, 'role'],
    [{ size: 'XL' }, 'size'],
  ];
  for (const [patch, field] of cases) {
    const result = saveEdit(items, 0, fields(items[0], patch), ROLES);
    assert.ok(result.errors, JSON.stringify(patch));
    assert.deepEqual(result.errors.map((e) => e.field), [field], JSON.stringify(patch));
  }
});

test('muutmisel võib valida teise kinnitatud rolli', () => {
  const items = fromProposal(PROPOSAL);
  const { items: edited } = saveEdit(items, 0, fields(items[0], { role: 'Administraator', rolePhrase: 'Administraatorina' }), ROLES);
  assert.equal(edited[0].draft.role, 'Administraator');
  assert.equal(storyTitle(edited[0]), 'Administraatorina soovin näha treeningute tunniplaani, et saaksin hinnata, kas treeningud sobivad.');
});

test('tegevuse "et"-kõrvallause annab muutmisel hoiatuse, mitte vea', () => {
  const items = fromProposal(PROPOSAL);
  const result = saveEdit(items, 0, fields(items[0], { want: 'näha tunniplaani, et valida aeg' }), ROLES);
  assert.ok(result.items);
  assert.equal(result.items[0].warnings.length, 1);
});

test('päritolu sildid vastavad backlog’i nõuetele', () => {
  assert.deepEqual(ORIGIN_LABELS, { ai: 'AI ettepanek', ai_edited: 'AI ettepanek, muudetud', manual: 'Käsitsi lisatud' });
});
