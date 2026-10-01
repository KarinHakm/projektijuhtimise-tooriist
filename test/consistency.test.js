import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConsistency, reviewFingerprint, stem } from '../shared/consistency.js';

// Kooskõla vihjed (L23). Need on kontrollimist vajavad hoiatused, mitte semantilised otsused.
// Näide on testandmebaasi projekti 101 mockup'i versioon 2.
const MOCKUP = {
  version: 2,
  components: [
    { type: 'heading', text: 'Liikmeks astumise taotlus', items: [] },
    { type: 'input', text: 'Eesnimi', items: [] },
    { type: 'input', text: 'Perekonnanimi', items: [] },
    { type: 'input', text: 'E-posti aadress', items: [] },
    { type: 'button', text: 'Esita taotlus', items: [] },
    { type: 'button', text: 'Salvesta', items: [] },
  ],
};
const CRITERIA = [
  { text: "Kasutaja näeb nuppu 'Esita taotlus'." },
  { text: "Kasutaja näeb sisestusvälja 'E-posti aadress'." },
  { text: "Pärast nupu 'Esita taotlus' vajutamist kuvatakse kinnitusteade." },
];
const codes = (list) => list.map((w) => w.code);

test('projekti 101 vana vastuolu: kinnitusteade pole mockup’is; "Salvesta" on põhjendamata', () => {
  const r = analyzeConsistency(CRITERIA, MOCKUP);
  assert.deepEqual(r.criteria.map((c) => codes(c.warnings)), [[], [], ['no_match']]);
  assert.match(r.criteria[2].warnings[0].message, /„kinnitusteade“/);
  assert.deepEqual(codes(r.components[5].warnings), ['unjustified']);
  assert.deepEqual(codes(r.components[4].warnings), []); // "Esita taotlus" on kriteeriumides nimetatud
  assert.deepEqual(codes(r.components[0].warnings), []); // pealkiri ei ole interaktiivne
});

test('vastuolu leitakse ka ilma jutumärkideta; käänded klapivad tüve järgi', () => {
  const r = analyzeConsistency([{ text: 'Pärast esitamist kuvatakse kinnitusteade.' }], { version: 1, components: [{ type: 'text', text: 'Kinnitusteate tekst: taotlus on esitatud', items: [] }] });
  assert.deepEqual(codes(r.criteria[0].warnings), []);
  assert.equal(stem('kinnitusteade'), stem('kinnitusteate'));
});

test('AI seos ei kustuta hoiatust vaikselt: seos on näha, hoiatus jääb', () => {
  const criteria = CRITERIA.map((c, i) => ({ ...c, ref: i === 2 ? { kind: 'element', index: 4, version: 2, source: 'ai' } : null }));
  const r = analyzeConsistency(criteria, MOCKUP);
  assert.deepEqual(r.criteria[2].link, { kind: 'element', index: 4, label: '5. nupp: Esita taotlus', source: 'ai' });
  assert.deepEqual(codes(r.criteria[2].warnings), ['no_match']);
  assert.deepEqual(r.components[4].linkedBy, [3]);
});

test('AI hinnang "ei puuduta vaadet" ei kustuta hoiatust; kasutaja enda otsus kustutab', () => {
  const ai = analyzeConsistency([{ ...CRITERIA[2], ref: { kind: 'no_view', source: 'ai' } }], MOCKUP);
  assert.deepEqual(codes(ai.criteria[0].warnings), ['no_match']);
  assert.match(ai.criteria[0].warnings[0].message, /AI hinnangul ei puuduta kriteerium vaadet/);
  const user = analyzeConsistency([{ ...CRITERIA[2], ref: { kind: 'no_view', source: 'user' } }], MOCKUP);
  assert.deepEqual(user.criteria[0].warnings, []);
  assert.equal(user.criteria[0].link.label, 'ei puuduta vaadet');
});

test('nuppu nimetav kriteerium, mis on seotud mitte-nupuga, saab hoiatuse', () => {
  const r = analyzeConsistency([{ text: "Kasutaja näeb nuppu 'Esita taotlus'.", ref: { kind: 'element', index: 3, version: 2, source: 'user' } }], MOCKUP);
  assert.deepEqual(codes(r.criteria[0].warnings), ['button_type']);
});

test('nupp ainult päästikuna: seos teatega, mida kriteerium nimetab, ei anna nupu hoiatust', () => {
  const mockup = { version: 3, components: [...MOCKUP.components.slice(0, 5), { type: 'text', text: 'Kinnitusteade: taotlus on esitatud', items: [] }] };
  const r = analyzeConsistency([{ ...CRITERIA[2], ref: { kind: 'element', index: 5, version: 3, source: 'ai' } }], mockup);
  assert.deepEqual(r.criteria[0].warnings, []);
});

test('viide teise mockup’i versiooni elemendile on aegunud ja seda ei arvestata seosena', () => {
  const r = analyzeConsistency([{ text: "Kasutaja näeb nuppu 'Salvesta'.", ref: { kind: 'element', index: 5, version: 1, source: 'user' } }], MOCKUP);
  assert.equal(r.criteria[0].link, null);
  assert.ok(codes(r.criteria[0].warnings).includes('stale_ref'));
});

test('kasutaja seos elemendiga põhjendab elementi ja eemaldab "pole vastet" hoiatuse', () => {
  const criteria = [...CRITERIA.slice(0, 2), { ...CRITERIA[2], ref: { kind: 'element', index: 5, version: 2, source: 'user' } }];
  const r = analyzeConsistency(criteria, MOCKUP);
  assert.deepEqual(r.criteria[2].warnings, []);
  assert.deepEqual(r.components[5].warnings, []);
  assert.deepEqual(r.components[5].linkedBy, [3]);
});

test('ülevaatuse sõrmejälg muutub, kui muutub kriteeriumi tekst, viide või mockup’i versioon', () => {
  const base = reviewFingerprint(CRITERIA, MOCKUP);
  assert.equal(reviewFingerprint(CRITERIA, MOCKUP), base);
  assert.notEqual(reviewFingerprint([{ text: 'Muu.' }, ...CRITERIA.slice(1)], MOCKUP), base);
  assert.notEqual(reviewFingerprint([{ ...CRITERIA[0], ref: { kind: 'no_view', source: 'user' } }, ...CRITERIA.slice(1)], MOCKUP), base);
  assert.notEqual(reviewFingerprint(CRITERIA, { ...MOCKUP, version: 3 }), base);
});

test('võimalik probleem: AI seos elemendiga, mida kriteerium ei nimeta (K2 → nupp); õige AI seos ja kasutaja seos hoiatust ei saa', () => {
  const v3 = { version: 3, components: [MOCKUP.components[0], MOCKUP.components[3], MOCKUP.components[4]] }; // pealkiri, E-posti aadress, Esita taotlus
  const ai = (index) => ({ kind: 'element', index, version: 3, source: 'ai' });
  const r = analyzeConsistency([{ ...CRITERIA[0], ref: ai(2) }, { ...CRITERIA[1], ref: ai(2) }], v3);
  assert.deepEqual(codes(r.criteria[0].warnings), []);
  assert.deepEqual(codes(r.criteria[1].warnings), ['ai_link_unnamed']);
  assert.match(r.criteria[1].warnings[0].message, /^Võimalik probleem: AI seos – kriteerium ei nimeta seotud elementi „Esita taotlus“/);
  const user = analyzeConsistency([{ ...CRITERIA[1], ref: { ...ai(2), source: 'user' } }], v3);
  assert.ok(!codes(user.criteria[0].warnings).includes('ai_link_unnamed'));
});
