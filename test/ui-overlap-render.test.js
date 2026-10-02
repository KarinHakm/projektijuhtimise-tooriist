import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsx } from './helpers/jsx.js';

// L26: kattuvaks märgitud lood backlog'is, renderdus võltsandmetega. Klõpsamist ei testita.
let BacklogList;
before(async () => {
  ({ default: BacklogList } = await importJsx('src/components/BacklogList.jsx'));
});
const noop = () => {};
const story = (id, want, overlaps = []) => ({
  id, role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin aja valida', size: 'S', touchesView: false, status: 'idee', origin: 'ai',
  title: `Külastajana soovin ${want}, et saaksin aja valida.`, overlaps,
});
const LONG = 'vaadata kõiki nädala treeninguid koos treenerite, saalide, algus- ja lõpuaegade ning vabade kohtadega';
const STORIES = [story(1, 'näha nädalakava', [3]), story(2, 'näha hindu'), story(3, LONG, [1])];
const manage = (mode = null) => ({
  mode, roles: [], error: null, onAdd: noop, onEdit: noop, onCancel: noop, onSave: noop, onDelete: noop, onSplit: noop, onMerge: noop,
  onMarkOverlapStart: noop, onMarkOverlap: noop, onUnmarkOverlap: noop, onOverlapMerge: noop, onConfirmDelete: noop,
});
const render = (mode) => renderToStaticMarkup(createElement(BacklogList, { stories: STORIES, onMove: noop, manage: manage(mode) }))
  .replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");

test('mõlema loo juures on märge „≈ Kattub: lugu N“ koos Ühenda / Eemalda lugu N / Pole kattuv; märkimise nupp', () => {
  const html = render();
  assert.match(html, /<span class="tag tag--overlap">≈ Kattub: lugu 3<\/span> <button[^>]*>Ühenda<\/button><button[^>]*aria-label="Eemalda lugu 3">Eemalda lugu 3<\/button><button[^>]*>Pole kattuv<\/button>/);
  assert.match(html, /<span class="tag tag--overlap">≈ Kattub: lugu 1<\/span>.*aria-label="Eemalda lugu 1"/);
  assert.equal((html.match(/tag--overlap/g) ?? []).length, 2); // lool 2 märget pole
  assert.match(html, /aria-label="Märgi lugu 2 kattuvaks: [^"]+">≈ Märgi kattuvaks<\/button>/);
});

test('märkimise vorm: valikus ei ole lugu ennast ega juba märgitud lugu', () => {
  const html = render({ type: 'overlap', id: 1 });
  assert.match(html, /<label for="kattuv-1">Lugu 1 kattub looga<\/label>/);
  assert.match(html, /<option value="2">2\. Külastajana soovin näha hindu/);
  assert.doesNotMatch(html, /<option value="1">/);
  assert.doesNotMatch(html, /<option value="3">/);
});

test('„Eemalda lugu 3“: kinnitus on loo 3 kohta – number, lühendatud sõnastus ja kaduv kattuvusmärge', () => {
  const impact = { isFocus: false, aboveMvpLine: false, criteria: 0, mockupVersions: 0, questions: 0, pendingProposals: 0, overlaps: [1] };
  const html = render({ type: 'delete', id: 3, impact });
  assert.match(html, /<p id="kustuta-3" class="delete-confirm__title">Kustutad loo 3 „Külastajana soovin vaadata kõiki nädala treeninguid koos treenerite, saalide, a…“\?<\/p>/);
  assert.match(html, /<li>Kattuvusmärge looga 1 kaob koos selle looga\.<\/li>/);
});
