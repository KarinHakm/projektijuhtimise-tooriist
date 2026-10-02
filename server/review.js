// Backlog'i ülevaatus (L27): leiud, nende kontroll ja ühe leiu rakendamine või ignoreerimine.
// Ülevaatuse käivitamine ei muuda backlog'i. Ülevaatus salvestatakse ai_proposals tabelisse (kind 'review'),
// leidude olek (open / applied / ignored) on payload'is. Iga leid mäletab seisu, mille põhjal see koostati;
// kui lugu on vahepeal muutunud, on leid aegunud ja seda ei rakendata.
import { checkCriterion, cleanCriterion, CRITERION_MAX } from '../shared/criteria-check.js';
import { validateStoryText } from '../shared/story-format.js';
import { CRITERIA_MAX_COUNT, appendCriteria, hasAnyMockup, listCriteria } from './criteria.js';
import { insertStoryQuestion } from './readiness.js';
import { listStories, mergeInfo, mergeStoriesInTx, splitInfo, splitStoryInTx, updateManualStory, validateMerge, validateSplit } from './stories.js';
import { VIEW_DECISIONS } from './ai/tasks/review.js';
import { selfCheckCriteria } from './ai/tasks/criteria-fix.js';

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
    if (s.touchesView && !hasAnyMockup(db, s.id)) {
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

// L28: iga algne kriteerium peab olema täpselt ühes osas (mitte kummaski või mõlemas, ega võõras kriteerium).
export function exactPartition(ids, first, second) {
  const all = [...first, ...second];
  return all.length === ids.length && new Set(all).size === all.length && all.every((id) => ids.includes(id));
}

// L29: AI ühendamisettepanek. Iga mõlema loo kriteerium on täpselt üks kord: alles (keep) või kordus (duplicate),
// mille duplicateOf on alles jääv kriteerium. Muidu null (leid jääb, „Muuda“ avab tühja vormi). Kriteeriumide teksti ei muudeta.
function mergeProposal(keep, o, criteria) {
  const text = validateStoryText({ rolePhrase: keep.rolePhrase, ...o.story });
  const all = [...criteria.keep, ...criteria.remove].map((c) => c.id);
  const ids = o.criteria.map((c) => c.criterionId);
  if (text.errors.length || ids.length !== all.length || new Set(ids).size !== ids.length || !ids.every((id) => all.includes(id))) return null;
  const kept = o.criteria.filter((c) => c.action === 'keep').map((c) => c.criterionId);
  const duplicates = o.criteria.filter((c) => c.action === 'duplicate').map((c) => ({ id: c.criterionId, of: c.duplicateOf }));
  if (duplicates.some((d) => !kept.includes(d.of))) return null;
  return {
    story: { want: text.value.want, soThat: text.value.soThat },
    keepCriteria: all.filter((id) => kept.includes(id)), // säilitatava loo omad ees, siis eemaldatava omad (nagu L26)
    duplicates,
  };
}

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

  const criteriaOf = (id) => listCriteria(db, id).map((c) => ({ id: c.id, text: c.text }));
  const list = [...stories.values()];
  const nextId = (id) => list[list.findIndex((s) => s.id === id) + 1]?.id ?? null;
  const extra = [];
  for (const t of data.tooLarge) {
    const s = stories.get(t.storyId);
    if (!s || extra.some((f) => f.id === `too_large-${s.id}`)) continue;
    const criteria = listCriteria(db, s.id).map((c) => ({ id: c.id, text: c.text }));
    const first = validateStoryText({ rolePhrase: s.rolePhrase, ...t.first });
    const second = validateStoryText({ rolePhrase: s.rolePhrase, ...t.second });
    const valid = !first.errors.length && !second.errors.length && first.value.want !== second.value.want
      && exactPartition(criteria.map((c) => c.id), t.firstCriteria, t.secondCriteria);
    extra.push({
      id: `too_large-${s.id}`, type: 'too_large', source: 'ai', storyIds: [s.id], status: 'open',
      before: { title: s.title, nextId: nextId(s.id), criteria },
      problem: t.problem.trim(), reason: t.reason.trim(),
      suggestion: valid ? {
        first: { want: first.value.want, soThat: first.value.soThat }, second: { want: second.value.want, soThat: second.value.soThat },
        criteriaToSecond: criteria.map((c) => c.id).filter((id) => t.secondCriteria.includes(id)), // algses järjekorras
      } : null,
    });
  }
  for (const o of data.overlaps) {
    const keep = stories.get(o.keepId);
    const remove = stories.get(o.removeId);
    if (!keep || !remove || keep.id === remove.id) continue;
    const pair = [keep.id, remove.id].sort((a, b) => a - b).join('-');
    if (extra.some((f) => f.id === `overlap-${pair}`)) continue;
    const criteria = { keep: criteriaOf(keep.id), remove: criteriaOf(remove.id) };
    extra.push({
      id: `overlap-${pair}`, type: 'overlap', source: 'ai', storyIds: [keep.id, remove.id], status: 'open',
      before: { titles: [keep.title, remove.title], criteria },
      problem: o.problem.trim(), reason: o.reason.trim(),
      suggestion: { keepId: keep.id, removeId: remove.id, text: o.suggestion.trim(), merge: mergeProposal(keep, o, criteria) },
    });
  }
  return [...findings, ...extra];
}

// L18: AI enesekontroll ülevaatuse kriteeriumide ettepanekutele. Ainult juba kontrollitud ettepanekud (mergeAiReview
// järel alles jäänud): „kriteeriumid puuduvad“ lisatavad kriteeriumid ja „mittekontrollitav“ asendustekst.
// Üks päring kõigi vigaste jaoks; parandamata või kontrollimata tekst jääb ettepanekusse koos märkega (selfCheck).
export async function selfCheckReview(ai, db, projectId, findings) {
  const titles = new Map(listStories(db, projectId).map((st) => [st.id, st.title]));
  const items = [];
  for (const f of findings) {
    if (!f.suggestion) continue;
    const base = { story: titles.get(f.storyIds[0]), group: f.storyIds[0], element: null };
    if (f.type === 'no_criteria') f.suggestion.criteria.forEach((text, i) => items.push({ ...base, key: `${f.id}#${i}`, text }));
    if (f.type === 'untestable') items.push({ ...base, key: f.id, text: f.suggestion.text });
  }
  const { texts, marks } = await selfCheckCriteria(ai, { storyTitle: null, items });
  for (const f of findings) {
    if (f.type === 'no_criteria' && f.suggestion) {
      f.suggestion.criteria = f.suggestion.criteria.map((_, i) => texts.get(`${f.id}#${i}`));
      const own = f.suggestion.criteria.map((_, i) => marks[`${f.id}#${i}`] ?? null);
      if (own.some(Boolean)) f.suggestion.selfCheck = own;
    }
    if (f.type === 'untestable' && f.suggestion) {
      f.suggestion.text = texts.get(f.id);
      if (marks[f.id]) f.suggestion.selfCheck = marks[f.id];
    }
  }
  return findings;
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
    case 'no_mockup': return story.touchesView && !hasAnyMockup(db, story.id);
    // Jagamine lisab uue loo kohe algse järele, seega muutub ka järgmise loo id.
    case 'too_large': return story.title === f.before.title && (stories[stories.indexOf(story) + 1]?.id ?? null) === f.before.nextId
      && JSON.stringify(listCriteria(db, story.id).map((c) => ({ id: c.id, text: c.text }))) === JSON.stringify(f.before.criteria ?? []);
    case 'overlap': return f.storyIds.every((id, i) => stories.find((s) => s.id === id)?.title === f.before.titles[i])
      && ['keep', 'remove'].every((k, i) => !f.before.criteria
        || JSON.stringify(listCriteria(db, f.storyIds[i]).map((c) => ({ id: c.id, text: c.text }))) === JSON.stringify(f.before.criteria[k]));
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
  if (f.type === 'overlap') return applyMerge(db, projectId, f, raw);
  if (f.type === 'too_large') return applySplit(db, projectId, f, raw);
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

// --- L28: AI jagamisettepanek ja selle tagasivõtmine ---
// Rakenda (raw puudub) kasutab AI ettepanekut, Muuda saadab vormi väärtuse samal kujul nagu käsitsi jagamine (L25).
// Enne jagamist salvestatakse leiu juurde algse loo seis; tagasivõtmine on lubatud ainult siis, kui kumbagi osa pole muudetud.
function applySplit(db, projectId, f, raw) {
  if (!findingIsCurrent(db, projectId, f)) {
    throw new ReviewError(409, 'stale_finding', 'Lugu on pärast ülevaatust muutunud – see leid on aegunud. Käivita ülevaatus uuesti.');
  }
  if (raw === undefined && !f.suggestion) throw new ReviewError(400, 'no_suggestion', 'Sellel leiul pole AI jagamisettepanekut. Vajuta „Muuda“ ja jaga ise.');
  const story = listStories(db, projectId).find((s) => s.id === f.storyIds[0]);
  const info = splitInfo(db, projectId, story.id);
  const base = { role: story.role, rolePhrase: story.rolePhrase, size: story.size, touchesView: story.touchesView };
  const body = raw ?? {
    first: { ...base, ...f.suggestion.first }, second: { ...base, ...f.suggestion.second },
    criteriaToSecond: f.suggestion.criteriaToSecond, questionsToSecond: [],
  };
  const split = validateSplit(body, info);
  if (split.error) throw new ReviewError(400, 'invalid_value', split.error, split.field);
  const firstIds = info.criteria.map((c) => c.id).filter((id) => !split.criteriaToSecond.includes(id));
  if (!exactPartition(info.criteria.map((c) => c.id), firstIds, split.criteriaToSecond)) {
    throw new ReviewError(400, 'invalid_value', 'Iga algne kriteerium peab olema täpselt ühes uues loos.', 'criteria');
  }

  const before = {
    story: { ...db.prepare('SELECT * FROM stories WHERE id = ?').get(story.id) },
    criteria: db.prepare('SELECT * FROM criteria WHERE story_id = ?').all(story.id).map((r) => ({ ...r })),
    questionIds: db.prepare('SELECT id FROM story_questions WHERE story_id = ?').all(story.id).map((r) => r.id),
    mvpShift: info.aboveMvpLine ? 1 : 0,
  };
  const result = splitStoryInTx(db, projectId, story.id, split);
  f.undo = { before, secondId: result.secondId, after: partsState(db, projectId, story.id, result.secondId) };
  return `Lugu jagati kaheks: osa 2 lisati kohe osa 1 järele.${result.rejectedProposals ? ` Ootel ettepanekuid lükati tagasi: ${result.rejectedProposals}.` : ''}`;
}

// Mõlema osa täielik seis (sõnastus, staatus, koht, kriteeriumid ja seosed, küsimused, mockup) ja alustamise loo valik.
function partsState(db, projectId, firstId, secondId) {
  const part = (id) => JSON.stringify({
    story: db.prepare('SELECT * FROM stories WHERE id = ?').get(id) ?? null,
    criteria: db.prepare('SELECT * FROM criteria WHERE story_id = ? ORDER BY id').all(id),
    questions: db.prepare('SELECT * FROM story_questions WHERE story_id = ? ORDER BY id').all(id),
    mockups: db.prepare('SELECT version FROM mockups WHERE story_id = ? ORDER BY version').all(id),
  });
  return { first: part(firstId), second: part(secondId), focus: db.prepare('SELECT focus_story_id AS f FROM projects WHERE id = ?').get(projectId).f };
}

// Ülevaatuse kaudu tehtud jagamise (L28) või ühendamise (L29) tagasivõtmine.
export function undoFinding(db, projectId, f) {
  if (f.status !== 'applied' || !f.undo || !['too_large', 'overlap'].includes(f.type)) {
    throw new ReviewError(409, 'cannot_undo', 'Seda leidu ei saa tagasi võtta – tagasi saab võtta ainult ülevaatuse kaudu tehtud jagamise või ühendamise.');
  }
  return f.type === 'too_large' ? undoSplit(db, projectId, f) : undoMerge(db, projectId, f);
}

function undoSplit(db, projectId, f) {
  const { before, secondId, after } = f.undo;
  const storyId = before.story.id;
  const now = partsState(db, projectId, storyId, secondId);
  const changed = [now.first !== after.first && 'osa 1', now.second !== after.second && 'osa 2'].filter(Boolean);
  if (changed.length || now.focus !== after.focus) {
    const what = changed.length ? `${changed.join(' ja ')} on pärast jagamist muutunud (sõnastus, staatus, koht backlog'is, kriteeriumid, küsimused või mockup)`
      : 'alustamise lugu on pärast jagamist muudetud';
    throw new ReviewError(409, 'parts_changed', `Jagamist ei saa tagasi võtta: ${what}. Osalist taastamist ei tehta, et ükski muudatus vaikselt ei kaoks.`);
  }

  // Kriteeriumid ja küsimused enne osa 2 kustutamist tagasi (muidu kustuksid need koos osaga 2).
  const restoreCriterion = db.prepare(`UPDATE criteria SET story_id = ?, position = ?, text = ?, origin = ?, ref_kind = ?, ref_index = ?, ref_version = ?,
                                       ref_source = ?, updated_at = ? WHERE id = ?`);
  for (const c of before.criteria) {
    restoreCriterion.run(storyId, c.position, c.text, c.origin, c.ref_kind, c.ref_index, c.ref_version, c.ref_source, c.updated_at, c.id);
  }
  const restoreQuestion = db.prepare('UPDATE story_questions SET story_id = ? WHERE id = ?');
  for (const id of before.questionIds) restoreQuestion.run(storyId, id);
  const secondPosition = db.prepare('SELECT position FROM stories WHERE id = ?').get(secondId).position;
  db.prepare('DELETE FROM stories WHERE id = ? AND project_id = ?').run(secondId, projectId);
  db.prepare('UPDATE stories SET position = position - 1 WHERE project_id = ? AND position > ?').run(projectId, secondPosition);
  const s = before.story;
  db.prepare(`UPDATE stories SET role = ?, role_phrase = ?, want = ?, so_that = ?, size = ?, status = ?, origin = ?, touches_view = ?,
              consistency_review = ?, updated_at = ? WHERE id = ?`)
    .run(s.role, s.role_phrase, s.want, s.so_that, s.size, s.status, s.origin, s.touches_view, s.consistency_review, s.updated_at, storyId);
  if (before.mvpShift) db.prepare('UPDATE projects SET mvp_count = MAX(mvp_count - ?, 0) WHERE id = ? AND mvp_count IS NOT NULL').run(before.mvpShift, projectId);
  db.prepare("UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(projectId);
  return 'Jagamine võeti tagasi: algne lugu on taastatud oma kohal koos kriteeriumide, küsimuste ja mockup\'i seostega.';
}

// --- L29: AI ühendamisettepanek ja selle tagasivõtmine ---
// Rakenda kasutab AI ettepanekut; Muuda saadab vormi väärtuse samal kujul nagu käsitsi ühendamine (L26, ka vahetatud
// säilitatava looga), kuid ainult leiu kahe loo vahel. Mockup ainult ühel lool ei takista; mõlemal → keeldumine (nagu L26).
function applyMerge(db, projectId, f, raw) {
  if (!findingIsCurrent(db, projectId, f)) {
    throw new ReviewError(409, 'stale_finding', 'Lood on pärast ülevaatust muutunud või üks neist on kustutatud – see leid on aegunud. Käivita ülevaatus uuesti.');
  }
  const m = f.suggestion?.merge;
  if (raw === undefined && !m) throw new ReviewError(400, 'no_suggestion', 'Sellel leiul pole AI ühendamisettepanekut. Vajuta „Muuda“ ja ühenda ise.');
  const keepId = raw?.keepId ?? f.suggestion.keepId;
  const removeId = raw?.withId ?? f.suggestion.removeId;
  if (new Set([keepId, removeId, ...f.storyIds]).size !== 2) {
    throw new ReviewError(400, 'invalid_value', 'Leiu kaudu saab ühendada ainult selle leiu kahte lugu.', 'criteria');
  }
  const info = mergeInfo(db, projectId, keepId, removeId);
  if (info.blocked) {
    throw new ReviewError(409, 'both_mockups', 'Nende lugude ühendamine pole praegu võimalik, sest mõlemal lool on mockup\'i versioonid ja mõlema ajaloo turvaline ühendamine puudub.');
  }
  const keep = listStories(db, projectId).find((s) => s.id === keepId);
  const remove = listStories(db, projectId).find((s) => s.id === removeId);
  const body = raw ?? {
    story: { role: keep.role, rolePhrase: keep.rolePhrase, size: keep.size, touchesView: keep.touchesView || remove.touchesView, ...m.story },
    keepCriteria: m.keepCriteria,
  };
  const merge = validateMerge(body, info);
  if (merge.error) throw new ReviewError(400, 'invalid_value', merge.error, merge.field);

  const ids = [keepId, removeId];
  const rows = (sql) => db.prepare(sql).all(...ids).map((r) => ({ ...r }));
  const before = {
    keepId, removeId,
    stories: rows('SELECT * FROM stories WHERE id IN (?, ?)'),
    criteria: rows('SELECT * FROM criteria WHERE story_id IN (?, ?)'),
    questions: rows('SELECT id, story_id FROM story_questions WHERE story_id IN (?, ?)'),
    mockups: rows('SELECT id, story_id FROM mockups WHERE story_id IN (?, ?)'),
    backlog: backlogState(db, projectId),
  };
  const result = mergeStoriesInTx(db, projectId, keepId, removeId, merge);
  f.undo = { before, after: mergedState(db, projectId, keepId) };
  return `Lood ühendati: alles jäi lugu „${keep.title}“ uue sõnastusega.${result.removedCriteria ? ` Eemaldatud kriteeriume: ${result.removedCriteria}.` : ''}`
    + `${result.rejectedProposals ? ` Ootel ettepanekuid lükati tagasi: ${result.rejectedProposals}.` : ''}`;
}

// Backlog'i seis, mida ühendamine muudab ja tagasivõtmine taastab: lugude järjekord, MVP joon, alustamise lugu.
const backlogState = (db, projectId) => ({
  order: db.prepare('SELECT id, position FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => ({ ...r })),
  project: { ...db.prepare('SELECT focus_story_id, mvp_count FROM projects WHERE id = ?').get(projectId) },
});
const mergedState = (db, projectId, keepId) => JSON.stringify({
  story: db.prepare('SELECT * FROM stories WHERE id = ?').get(keepId) ?? null,
  criteria: db.prepare('SELECT * FROM criteria WHERE story_id = ? ORDER BY id').all(keepId),
  questions: db.prepare('SELECT * FROM story_questions WHERE story_id = ? ORDER BY id').all(keepId),
  mockups: db.prepare('SELECT * FROM mockups WHERE story_id = ? ORDER BY id').all(keepId),
  backlog: backlogState(db, projectId),
});

// Kirjutab rea täpselt salvestatud kujule (sama id); puuduva rea lisab.
function restoreRow(db, table, row) {
  const cols = Object.keys(row).filter((c) => c !== 'id');
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(row.id);
  if (exists) db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => row[c]), row.id);
  else db.prepare(`INSERT INTO ${table} (id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(row.id, ...cols.map((c) => row[c]));
}

function undoMerge(db, projectId, f) {
  const { before, after } = f.undo;
  if (mergedState(db, projectId, before.keepId) !== after) {
    throw new ReviewError(409, 'parts_changed', 'Ühendamist ei saa tagasi võtta: ühendatud lugu (sõnastus, staatus, kriteeriumid, küsimused või mockup) '
      + 'või backlog\'i järjekord, MVP joon või alustamise lugu on pärast ühendamist muutunud. Osalist taastamist ei tehta, et ükski muudatus vaikselt ei kaoks.');
  }
  // Järjekord: eemaldatud lugu tagasi sama id-ga, siis kriteeriumid (ka kustutatud), küsimused, mockup'id, kohad ja projekti väljad.
  for (const st of before.stories) restoreRow(db, 'stories', st);
  for (const c of before.criteria) restoreRow(db, 'criteria', c);
  const setQuestion = db.prepare('UPDATE story_questions SET story_id = ? WHERE id = ?');
  for (const q of before.questions) setQuestion.run(q.story_id, q.id);
  const setMockup = db.prepare('UPDATE mockups SET story_id = ? WHERE id = ?');
  for (const m of before.mockups) setMockup.run(m.story_id, m.id);
  const setPosition = db.prepare('UPDATE stories SET position = ? WHERE id = ? AND project_id = ?');
  for (const o of before.backlog.order) setPosition.run(o.position, o.id, projectId);
  const p = before.backlog.project;
  db.prepare("UPDATE projects SET focus_story_id = ?, mvp_count = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .run(p.focus_story_id, p.mvp_count, projectId);
  return 'Ühendamine võeti tagasi: mõlemad algsed lood on taastatud oma kohtadel koos kriteeriumide, küsimuste ja mockup\'i seostega.';
}
