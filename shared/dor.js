// Valmisoleku definitsioon (Definition of Ready, L19), ühine serverile ja brauserile.
// Lugu võib olla „Valmis arenduseks“ ainult siis, kui kõik tingimused on täidetud. Kontroll tehakse
// iga lugemise ajal uuesti: kui hilisem muudatus tingimust rikub, on salvestatud valmisolek aegunud.
import { checkCriterion } from './criteria-check.js';
import { validateStoryText } from './story-format.js';

export const DOR_MIN_CRITERIA = 3;

export const STORY_STATUSES = ['idee', 'vajab_tapsustamist', 'labivaadatud', 'valmis_arenduseks'];
export const READY = 'valmis_arenduseks';
export const STORY_STATUS_LABELS = {
  idee: 'Idee', vajab_tapsustamist: 'Vajab täpsustamist', labivaadatud: 'Läbivaadatud', valmis_arenduseks: 'Valmis arenduseks',
};

// story = { rolePhrase, want, soThat, touchesView }, criteria = [{ text }], hasMockup, openQuestions (arv)
export function evaluateDor({ story, criteria, hasMockup, openQuestions }) {
  const titleErrors = validateStoryText(story).errors;
  const failing = criteria.map((c, i) => (checkCriterion(c.text).length ? `K${i + 1}` : null)).filter(Boolean);
  const checks = [
    { key: 'connextra', label: 'Pealkiri on Connextra kujul', ok: titleErrors.length === 0, detail: titleErrors[0]?.message ?? null },
    {
      key: 'criteria_count', label: `Kriteeriume on vähemalt ${DOR_MIN_CRITERIA}`, ok: criteria.length >= DOR_MIN_CRITERIA,
      detail: criteria.length >= DOR_MIN_CRITERIA ? null : `Kriteeriume on ${criteria.length}.`,
    },
    {
      key: 'criteria_testable', label: 'Kõik kriteeriumid läbivad kontrollitavuse kontrolli', ok: criteria.length > 0 && failing.length === 0,
      detail: criteria.length === 0 ? 'Kriteeriume pole.' : failing.length ? `Hoiatus: ${failing.join(', ')}.` : null,
    },
    {
      key: 'mockup', label: 'Vaadet puudutaval lool on kinnitatud mockup', ok: !story.touchesView || hasMockup,
      detail: story.touchesView && !hasMockup ? "Kinnitatud mockup'i pole." : null,
    },
    { key: 'questions', label: 'Avatud küsimusi ei ole', ok: openQuestions === 0, detail: openQuestions ? `Avatud küsimusi: ${openQuestions}.` : null },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

// Puuduvad tingimused lühikese tekstina (veateade ja kasutajaliides).
export const dorMissing = (dor) => dor.checks.filter((c) => !c.ok).map((c) => (c.detail ? `${c.label} – ${c.detail}` : c.label));
