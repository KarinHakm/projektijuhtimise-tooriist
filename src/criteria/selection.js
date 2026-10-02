import { CRITERION_MAX, checkCriterion, cleanCriterion } from '../../shared/criteria-check.js';

// Kriteeriumide valik enne salvestamist (L09). Olekud:
//   pending  – AI pakkus, kasutaja pole veel otsustanud
//   accepted – ✓ Nõus
//   edited   – ✎ muudetud (tekst erineb AI omast)
//   removed  – ✗ Eemalda; EI salvestata kunagi (ka mitte "Kinnita kõik" korral)
// Käsitsi lisatud kriteerium on kohe accepted ja ilma indeksita (päritolu "Käsitsi lisatud").

export const fromProposal = (proposal) =>
  proposal.criteria.map((c) => ({ key: `ai-${c.index}`, index: c.index, original: c.text, text: c.text, state: 'pending', selfCheck: c.selfCheck ?? null }));

const update = (items, key, patch) => items.map((i) => (i.key === key ? { ...i, ...patch } : i));

// ✓ ei muuda muudetud kriteeriumi tagasi AI tekstiks ega too eemaldatut tagasi.
export const accept = (items, key) => items.map((i) => (i.key === key && i.state === 'pending' ? { ...i, state: 'accepted' } : i));
export const remove = (items, key) => update(items, key, { state: 'removed' });

// Muutmine: tühja või liiga pikka teksti ei salvestata. Sama tekst kui AI-l = lihtsalt kinnitatud.
export function edit(items, key, text) {
  const clean = cleanCriterion(text);
  if (!clean) return { error: 'Kriteerium ei tohi olla tühi.' };
  if (clean.length > CRITERION_MAX) return { error: `Kriteerium võib olla kuni ${CRITERION_MAX} märki.` };
  const item = items.find((i) => i.key === key);
  const state = item.index !== undefined && clean === cleanCriterion(item.original) ? 'accepted' : 'edited';
  return { items: update(items, key, { text: clean, state }) };
}

let manualSeq = 0;
export function addManual(items, text) {
  const clean = cleanCriterion(text);
  if (!clean) return { error: 'Kirjuta kriteeriumi tekst.' };
  if (clean.length > CRITERION_MAX) return { error: `Kriteerium võib olla kuni ${CRITERION_MAX} märki.` };
  if (items.some((i) => i.state !== 'removed' && i.text.toLocaleLowerCase('et') === clean.toLocaleLowerCase('et'))) {
    return { error: 'Selline kriteerium on juba olemas.' };
  }
  manualSeq += 1;
  return { items: [...items, { key: `manual-${manualSeq}`, text: clean, state: 'accepted' }] };
}

export const visible = (items) => items.filter((i) => i.state !== 'removed');
export const warningsFor = (text) => checkCriterion(text).map((w) => w.message);

// mode 'confirmed' = "Salvesta kinnitatud": ainult ✓, ✎ ja käsitsi lisatud.
// mode 'all'       = "Kinnita kõik": kõik peale ✗ eemaldatute.
export function buildSave(items, mode) {
  const chosen = items.filter((i) => (mode === 'all' ? i.state !== 'removed' : i.state === 'accepted' || i.state === 'edited'));
  return chosen.map((i) => (i.index !== undefined ? { index: i.index, text: i.text } : { text: i.text }));
}

export const CRITERIA_ORIGIN_LABELS = { ai: 'AI ettepanek', ai_edited: 'AI ettepanek, muudetud', manual: 'Käsitsi lisatud' };
