import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanField, composeTitle, validateStoryText } from '../shared/story-format.js';

const EXAMPLE = { rolePhrase: 'Potentsiaalse liikmena', want: 'näha liikmepakette ja nende hindu', soThat: 'saaksin valida endale sobiva paketi' };
const count = (text, re) => (text.match(re) ?? []).length;
const errorFields = (fields) => validateStoryText(fields).errors.map((e) => e.field);

test('näide rolliga "Potentsiaalne liige" annab täpselt oodatud pealkirja', () => {
  assert.equal(composeTitle(EXAMPLE), 'Potentsiaalse liikmena soovin näha liikmepakette ja nende hindu, et saaksin valida endale sobiva paketi.');
  assert.deepEqual(validateStoryText(EXAMPLE), { value: EXAMPLE, errors: [], warnings: [] });
});

test('tegevus ei tohi alata sõnaga "soovin" (ka suure algustähega)', () => {
  assert.deepEqual(errorFields({ ...EXAMPLE, want: 'soovin näha pakette' }), ['want']);
  assert.deepEqual(errorFields({ ...EXAMPLE, want: 'Soovin näha pakette' }), ['want']);
  assert.deepEqual(errorFields({ ...EXAMPLE, want: 'soovitusi näha' }), []); // sõnapiir: "soovitusi" on lubatud
});

test('kasu ei tohi alata sõnaga "et" (ka suure algustähega); "etendus…" on lubatud', () => {
  assert.deepEqual(errorFields({ ...EXAMPLE, soThat: 'et saaksin valida' }), ['soThat']);
  assert.deepEqual(errorFields({ ...EXAMPLE, soThat: 'Et saaksin valida' }), ['soThat']);
  assert.deepEqual(errorFields({ ...EXAMPLE, soThat: 'etendusel osaleda' }), []);
});

test('rolli vorm peab lõppema "-na" ega tohi sisaldada sõna "soovin"', () => {
  assert.deepEqual(errorFields({ ...EXAMPLE, rolePhrase: 'Potentsiaalne liige' }), ['rolePhrase']);
  assert.deepEqual(errorFields({ ...EXAMPLE, rolePhrase: 'Külastajana soovin' }), ['rolePhrase', 'rolePhrase']);
});

test('tühjad ja liiga pikad väljad lükatakse tagasi', () => {
  assert.deepEqual(errorFields({ rolePhrase: ' ', want: '', soThat: undefined }), ['rolePhrase', 'want', 'soThat']);
  assert.deepEqual(errorFields({ ...EXAMPLE, want: 'x'.repeat(201) }), ['want']);
});

test('lubatud näidete pealkirjas on täpselt üks "soovin" ja täpselt üks ", et"', () => {
  const samples = [
    EXAMPLE,
    { rolePhrase: 'külastajana', want: 'vaadata treeningute tunniplaani', soThat: 'teaksin, millal treeningud toimuvad' },
    { rolePhrase: 'Administraatorina', want: 'lisada uue paketi.', soThat: 'hinnakiri oleks ajakohane.' },
    { rolePhrase: '  Klubi liikmena ', want: ' registreeruda treeningule ', soThat: ' mul oleks koht tagatud ' },
  ];
  for (const s of samples) {
    assert.deepEqual(validateStoryText(s).errors, [], JSON.stringify(s));
    const title = composeTitle(s);
    assert.equal(count(title, /(^|\s)soovin(\s|$)/giu), 1, title);
    assert.equal(count(title, /, et /gu), 1, title);
    assert.match(title, /^\p{Lu}/u, title); // suur algustäht
    assert.doesNotMatch(title, /\.\.|,,|, ,|\s{2}/u, title);
    assert.match(title, /[^.]\.$/u, title); // lõpeb ühe punktiga
  }
});

test('lõpu kirjavahemärgid ja lisatühikud eemaldatakse', () => {
  assert.equal(cleanField('  näha   pakette ,. '), 'näha pakette');
  assert.equal(composeTitle({ rolePhrase: 'Külastajana', want: 'näha hindu,', soThat: 'saaksin valida.' }), 'Külastajana soovin näha hindu, et saaksin valida.');
});

test('tegevuse "et"-kõrvallause annab hoiatuse, mitte vea', () => {
  const r = validateStoryText({ ...EXAMPLE, want: 'näha pakette, et valida' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map((w) => w.field), ['want']);
  assert.deepEqual(validateStoryText({ ...EXAMPLE, want: 'näha etenduste kava' }).warnings, []);
});

// Brauseri pool (src/) lisandub kasutajaliidese etapis ja siis laiendatakse seda testi.
test('serveri lugude failid kasutavad ühist vormingu moodulit', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['server/stories.js', 'server/ai/tasks/stories.js', 'server/routes/stories.js']) {
    assert.match(readFileSync(file, 'utf8'), /shared\/story-format\.js/, file);
  }
});
