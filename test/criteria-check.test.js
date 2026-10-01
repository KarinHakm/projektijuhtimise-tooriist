import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCriterion, SUBJECTIVE_WORDS } from '../shared/criteria-check.js';

// Kriteeriumi kontrollitavuse reegel (L18 hoiatusosa). Näited on õpetaja ülesande tabelist.
const CHECKABLE = [
  'Treeningute lehel on iga treeningu juures selle kestus minutites.',
  'Paketi hinna juures on märge, kas hind sisaldab käibemaksu.',
  'Pärast registreerumist kuvatakse kinnitusteade.',
  'Registreerumisvorm ei lase saata tühja e-posti väljaga.',
];
const NOT_CHECKABLE = [
  ['Treeningute leht on kasutajasõbralik.', 'kasutajasõbralik'],
  ['Hinnad on selgelt näha.', 'selgelt'],
  ['Registreerumine on kiire ja lihtne.', 'kiire'],
  ['Vorm kontrollib andmeid ja saadab meili.', 'ja'],
];

test('õpetaja tabeli neli kontrollitavat näidet ei saa hoiatust', () => {
  for (const text of CHECKABLE) assert.deepEqual(checkCriterion(text), [], text);
});

test('õpetaja tabeli neli mittekontrollitavat näidet saavad hoiatuse, mis nimetab probleemse sõna', () => {
  for (const [text, word] of NOT_CHECKABLE) {
    const warnings = checkCriterion(text);
    assert.ok(warnings.some((w) => w.word === word && w.message.includes(`„${word}“`)), text);
  }
});

test('mitut tingimust ühendavad "ja", "ning" ja "või" saavad hoiatuse; sõna osana mitte', () => {
  assert.ok(checkCriterion('Kuvatakse nimi ning hind.').some((w) => w.word === 'ning'));
  assert.ok(checkCriterion('Saab maksta kaardiga või sularahas.').some((w) => w.word === 'või'));
  assert.deepEqual(checkCriterion('Jaotuse lehel on paketi nimi.'), []);
});

test('hinnangusõnade loend on koodis ühes kohas ja brauser ning server kasutavad sama moodulit', () => {
  assert.ok(SUBJECTIVE_WORDS.includes('intuitiivne') && SUBJECTIVE_WORDS.includes('mugav'));
  for (const file of ['server/criteria.js', 'server/routes/criteria.js', 'src/criteria/selection.js']) {
    assert.match(readFileSync(file, 'utf8'), /shared\/criteria-check\.js/, file);
  }
});
