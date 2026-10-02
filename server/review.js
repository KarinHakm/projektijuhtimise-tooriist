// Backlog'i ülevaatus (L27): leiud, nende kontroll ja ühe leiu rakendamine või ignoreerimine.
// Ülevaatuse käivitamine ei muuda backlog'i. Ülevaatus salvestatakse ai_proposals tabelisse (kind 'review'),
// leidude olek (open / applied / ignored) on payload'is. Iga leid mäletab seisu, mille põhjal see koostati;
// kui lugu on vahepeal muutunud, on leid aegunud ja seda ei rakendata.
import { checkCriterion, cleanCriterion, CRITERION_MAX } from '../shared/criteria-check.js';
import { validateStoryText } from '../shared/story-format.js';
import { CRITERIA_MAX_COUNT, appendCriteria, latestMockup, listCriteria } from './criteria.js';
import { insertStoryQuestion } from './readiness.js';
import { listStories, updateManualStory } from './stories.js';
import { VIEW_DECISIONS } from './ai/tasks/review.js';

export const KIND = 'review';
export const NEEDS_MOCKUP_QUESTION = "Vajab mockup'i";
export const CODE_TYPES = ['connextra', 'no_criteria', 'untestable', 'no_mockup'];
export const AI_TYPES = ['too_large', 'overlap'];

const textOf = (s) => ({ rolePhrase: s.rolePhrase, want: s.want, soThat: s.soThat });
const sameText = (a, b) => a.rolePhrase === b.rolePhrase && a.want === b.want && a.soThat === b.soThat;

// Leiud, mille kood leiab ilma AI-ta (L27 tüübid 1–4). Ainult lugemine.
export function codeFindings(db, projectId) {
  const findings = [];
  for (const s of listStories(db, projectId)) {
    const criteria = listCriteria(db, s.id);
    const textErrors = validateStoryText(s).errors;
    if (textErrors.length) {
      findings.push({
        id: `connextra-${s.id}`, type: 'connextra', storyIds: [s.id], before: textOf(s),
        problem: 'Pealkiri ei ole Connextra kujul („{roll}na soovin …, et …“).', reason: textErrors.map((e) => e.message).join(' '),
      });
    }
    if (criteria.length === 0) {
      findings.push({
        id: `no_criteria-${s.id}`, type: 'no_criteria', storyIds: [s.id], before: {},
        problem: 'Lool pole vastuvõtukriteeriume.', reason: 'Ilma kriteeriumideta ei saa kontrollida, millal lugu on valmis.',
      });
    }
    for (const c of criteria) {
      const warnings = checkCriterion(c.text).map((w) => w.message);
      if (!warnings.length) continue;
      findings.push({
        id: `untestable-${c.id}`, type: 'untestable', storyIds: [s.id], criterionId: c.id, before: { text: c.text }, warnings,
        problem: `Kriteerium „${c.text}“ ei ole kontrollitav.`, reason: warnings.join(' '),
      });
    }
    if (s.touchesView && !latestMockup(db, s.id)) {
      findings.push({
        id: `no_mockup-${s.id}`, type: 'no_mockup', storyIds: [s.id], before: {},
        problem: "Vaatelool pole mockup'i.", reason: "Lugu on märgitud kasutajaliidese vaadet puudutavaks, kuid kinnitatud mockup'i pole.",
      });
    }
  }
  return findings.map((f) => ({ ...f, source: 'code', suggestion: null, status: 'open' }));
}

const cleanList = (list) => {
  const seen = new Set();
  return list.map(cleanCriterion).filter((t) => {
    const key = t.toLocaleLowerCase('et');
    if (!t || t.length > CRITERION_MAX || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Seob AI vastuse koodi leidudega ja lisab AI leiud. Vigane või olematule loole viitav ettepanek jäetakse välja.
export function mergeAiReview(db, projectId, findings, data) {
  const stories = new Map(listStories(db, projectId).map((s) => [s.id, s]));
  const byId = new Map(findings.map((f) => [f.id, f]));
  const attach = (id, reason, suggestion) => {
    const f = byId.get(id);
    if (f && !f.suggestion) f.suggestion = { reason: reason.trim(), ...suggestion };
  };

  for (const fix of data.storyFixes) {
    const checked = validateStoryText(fix);
    if (!checked.errors.length) attach(`connextra-${fix.storyId}`, fix.reason, checked.value);
  }
  for (const add of data.criteriaAdds) {
    const criteria = cleanList(add.criteria).slice(0, CRITERIA_MAX_COUNT);
    if (criteria.length) attach(`no_criteria-${add.storyId}`, add.reason, { criteria });
  }
  for (const fix of data.criterionFixes) {
    const text = cleanCriterion(fix.text);
    const f = byId.get(`untestable-${fix.criterionId}`);
    if (f && text && text.length <= CRITERION_MAX && text !== f.before.text) attach(f.id, fix.reason, { text });
  }
  for (const d of data.viewDecisions) {
    if (VIEW_DECISIONS.includes(d.decision)) attach(`no_mockup-${d.storyId}`, d.reason, { decision: d.decision });
  }

  const list = [...stories.values()];
  const nextId = (id) => list[list.findIndex((s) => s.id === id) + 1]?.id ?? null;
  const extra = [];
  for (const t of data.tooLarge) {
    const s = stories.get(t.storyId);
    if (!s || extra.some((f) => f.id === `too_large-${s.id}`)) continue;
    const first = validateStoryText({ rolePhrase: s.rolePhrase, ...t.first });
    const second = validateStoryText({ rolePhrase: s.rolePhrase, ...t.second });
    const valid = !first.errors.length && !second.errors.length && first.value.want !== second.value.want;
    extra.push({
      id: `too_large-${s.id}`, type: 'too_large', source: 'ai', storyIds: [s.id], before: { title: s.title, nextId: nextId(s.id) }, status: 'open',
      problem: t.problem.trim(), reason: t.reason.trim(),
      suggestion: valid ? { first: { want: first.value.want, soThat: first.value.soThat }, second: { want: second.value.want, soThat: second.value.soThat } } : null,
    });
  }
  for (const o of data.overlaps) {
    const keep = stories.get(o.keepId);
    const remove = stories.get(o.removeId);
    if (!keep || !remove || keep.id === remove.id) continue;
    const pair = [keep.id, remove.id].sort((a, b) => a - b).join('-');
    if (extra.some((f) => f.id === `overlap-${pair}`)) continue;
    extra.push({
      id: `overlap-${pair}`, type: 'overlap', source: 'ai', storyIds: [keep.id, remove.id], before: { titles: [keep.title, remove.title] }, status: 'open',
      problem: o.problem.trim(), reason: o.reason.trim(), suggestion: { keepId: keep.id, removeId: remove.id, text: o.suggestion.trim() },
    });
  }
  return [...findings, ...extra];
}

// Kas leiu aluseks olnud seis kehtib veel. Ainult lugemine.
export function findingIsCurrent(db, projectId, f) {
  const stories = listStories(db, projectId);
  const story = stories.find((s) => s.id === f.storyIds[0]);
  if (!story) return false;
  switch (f.type) {
    case 'connextra': return sameText(textOf(story), f.before);
    case 'no_criteria': return listCriteria(db, story.id).length === 0;
    case 'untestable': return listCriteria(db, story.id).some((c) => c.id === f.criterionId && c.text === f.before.text);
    case 'no_mockup': return story.touchesView && !latestMockup(db, story.id);
    // Jagamine lisab uue loo kohe algse järele, seega muutub ka järgmise loo id.
    case 'too_large': return story.title === f.before.title && (stories[stories.indexOf(story) + 1]?.id ?? null) === f.before.nextId;
    case 'overlap': return f.storyIds.every((id, i) => stories.find((s) => s.id === id)?.title === f.before.titles[i]);
    default: return false;
  }
}

export class ReviewError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// Kontrollib rakendatava väärtuse: Muuda korral kasutaja muudetud väärtus, muidu AI ettepanek.
function valueFor(f, raw) {
  const s = f.suggestion;
  if (raw === undefined && !s) throw new ReviewError(400, 'no_suggestion', 'Sellel leiul pole AI ettepanekut. Vajuta „Muuda“ ja sisesta parandus ise.');
  const v = raw ?? s;
  if (f.type === 'connextra') {
    const checked = validateStoryText(v);
    if (checked.errors.length) throw new ReviewError(400, 'invalid_value', checked.errors[0].message, checked.errors[0].field);
    return checked.value;
  }
  if (f.type === 'no_criteria') {
    if (!Array.isArray(v?.criteria)) throw new ReviewError(400, 'invalid_value', 'Kriteeriumid puuduvad.', 'criteria');
    if (v.criteria.some((t) => cleanCriterion(t).length > CRITERION_MAX)) throw new ReviewError(400, 'invalid_value', `Kriteerium võib olla kuni ${CRITERION_MAX} märki.`, 'criteria');
    const criteria = cleanList(v.criteria);
    if (criteria.length !== v.criteria.length) throw new ReviewError(400, 'invalid_value', 'Kriteerium ei tohi olla tühi ega korduda.', 'criteria');
    if (!criteria.length) throw new ReviewError(400, 'invalid_value', 'Lisa vähemalt üks kriteerium.', 'criteria');
    if (criteria.length > CRITERIA_MAX_COUNT) throw new ReviewError(400, 'invalid_value', `Kriteeriume võib olla kuni ${CRITERIA_MAX_COUNT}.`, 'criteria');
    return { criteria };
  }
  if (f.type === 'untestable') {
    const text = cleanCriterion(v?.text);
    if (!text) throw new ReviewError(400, 'invalid_value', 'Kriteerium ei tohi olla tühi.', 'text');
    if (text.length > CRITERION_MAX) throw new ReviewError(400, 'invalid_value', `Kriteerium võib olla kuni ${CRITERION_MAX} märki.`, 'text');
    return { text };
  }
  if (!VIEW_DECISIONS.includes(v?.decision)) throw new ReviewError(400, 'invalid_value', 'Vali, kas lugu ei puuduta vaadet või vajab mockup\'i.', 'decision');
  return { decision: v.decision };
}

const aiOrigin = (text, suggested) => (suggested === undefined ? 'manual' : text === suggested ? 'ai' : 'ai_edited');

// Rakendab ühe koodi leiu (tüübid 1–4) ühes transaktsioonis. Muudab ainult selle leiu loo.
// Tagastab rakendatud tulemuse kirjelduse.
export function applyFinding(db, projectId, f, raw) {
  // Jagamine ja ühendamine tehakse olemasolevas eelvaatega vormis (L25, L26); siin märgitakse leid ainult
  // rakendatuks ja ainult siis, kui muutus on backlog'is näha (ühendamisel kadus eemaldatav lugu, jagamisel tekkis uus lugu).
  if (f.type === 'too_large' || f.type === 'overlap') {
    const stories = listStories(db, projectId);
    const done = f.type === 'overlap' ? !stories.some((s) => s.id === f.storyIds[1]) : !findingIsCurrent(db, projectId, f);
    if (!done) throw new ReviewError(409, 'use_form', 'Jagamine ja ühendamine tehakse eelvaatega vormis – vajuta „Rakenda“ või „Muuda“ ja kinnita vormis.');
    return f.type === 'overlap' ? 'Lood ühendati.' : 'Lugu jagati.';
  }
  const value = valueFor(f, raw);
  if (!findingIsCurrent(db, projectId, f)) {
    throw new ReviewError(409, 'stale_finding', 'Lugu on pärast ülevaatust muutunud – see leid on aegunud. Käivita ülevaatus uuesti.');
  }
  const story = listStories(db, projectId).find((s) => s.id === f.storyIds[0]);
  if (f.type === 'connextra') {
    updateManualStory(db, projectId, story.id, { role: story.role, size: story.size, touchesView: story.touchesView, ...value });
    return 'Loo sõnastus parandati.';
  }
  if (f.type === 'no_criteria') {
    const suggested = new Map((f.suggestion?.criteria ?? []).map((t) => [t.toLocaleLowerCase('et'), t]));
    appendCriteria(db, story.id, value.criteria.map((text) => ({ text, origin: aiOrigin(text, suggested.get(text.toLocaleLowerCase('et'))) })));
    return `Loole lisati ${value.criteria.length} kriteeriumi.`;
  }
  if (f.type === 'untestable') {
    db.prepare("UPDATE criteria SET text = ?, origin = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND story_id = ?")
      .run(value.text, value.text === f.suggestion?.text ? 'ai' : 'ai_edited', f.criterionId, story.id);
    return 'Kriteerium asendati.';
  }
  if (value.decision === 'not_view') {
    db.prepare("UPDATE stories SET touches_view = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(story.id);
    return 'Lugu märgiti mitte-vaatelooks.';
  }
  insertStoryQuestion(db, story.id, NEEDS_MOCKUP_QUESTION);
  return `Loole lisati avatud küsimus „${NEEDS_MOCKUP_QUESTION}“.`;
}
