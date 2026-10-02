// Backlog'i lood (L06): loend, AI ettepanekust lisamine ja lisamise sisendi kontroll.
import { composeTitle, validateStoryText } from '../shared/story-format.js';
import { listRoles, roleKey } from './roles.js';
import { cleanCriterion } from '../shared/criteria-check.js';
import { componentLabel } from '../shared/consistency.js';
import { txBegin, txCommit, txRollback } from './db.js';

export const SIZES = ['S', 'M', 'L'];

export function listStories(db, projectId) {
  return db
    .prepare(`SELECT id, position, role, role_phrase AS rolePhrase, want, so_that AS soThat, size, status, origin,
                     touches_view AS touchesView FROM stories WHERE project_id = ? ORDER BY position`)
    .all(projectId)
    .map((r) => ({ ...r, touchesView: Boolean(r.touchesView), title: composeTitle(r) }));
}

// Lisab lood olemasolevate lõppu antud järjekorras. Kutsuda transaktsiooni sees (applyProposal).
export function appendStories(db, projectId, stories, proposalId) {
  const last = db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM stories WHERE project_id = ?').get(projectId).p;
  const insert = db.prepare(`INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin, touches_view, proposal_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stories.forEach((s, i) => insert.run(projectId, last + i + 1, s.role, s.rolePhrase, s.want, s.soThat, s.size, s.origin, s.touchesView ? 1 : 0, proposalId));
}

// Tõstab loo ühe koha võrra üles või alla, vahetades positsiooni naabriga (L07).
// Muudab ainult kahe loo positsiooni; järjekord ei ole loo sisu, seega updated_at jääb samaks.
// Tagastab { ok: true } või { status, code, error }.
export function moveStory(db, projectId, storyId, direction) {
  if (direction !== 'up' && direction !== 'down') {
    return { status: 400, code: 'invalid_direction', error: 'Suund peab olema "up" või "down".' };
  }
  const sp = txBegin(db);
  try {
    const story = db.prepare('SELECT id, position FROM stories WHERE id = ? AND project_id = ?').get(storyId, projectId);
    if (!story) {
      txRollback(db, sp);
      return { status: 404, code: 'not_found', error: 'Lugu ei leitud.' };
    }
    const neighbour = direction === 'up'
      ? db.prepare('SELECT id, position FROM stories WHERE project_id = ? AND position < ? ORDER BY position DESC LIMIT 1').get(projectId, story.position)
      : db.prepare('SELECT id, position FROM stories WHERE project_id = ? AND position > ? ORDER BY position ASC LIMIT 1').get(projectId, story.position);
    if (!neighbour) {
      txRollback(db, sp);
      return { status: 409, code: 'at_edge', error: direction === 'up' ? 'Lugu on juba esimene.' : 'Lugu on juba viimane.' };
    }
    const setPosition = db.prepare('UPDATE stories SET position = ? WHERE id = ?');
    setPosition.run(neighbour.position, story.id);
    setPosition.run(story.position, neighbour.id);
    txCommit(db, sp);
    return { ok: true };
  } catch (err) {
    txRollback(db, sp);
    throw err;
  }
}

// Kontrollib lisamise päringut ettepaneku ja kinnitatud rollide vastu. Tagastab { stories } või { error }.
// Päritolu määrab server: AI originaaliga identne lugu on "ai", muudetud lugu "ai_edited".
export function validateApply(db, projectId, raw, proposedStories) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Vali vähemalt üks lugu.' };
  const confirmed = new Map(listRoles(db, projectId).map((r) => [roleKey(r.name), r.name]));
  const seen = new Set();
  const result = [];
  for (const s of raw) {
    const index = s?.index;
    if (!Number.isInteger(index) || index < 0 || index >= proposedStories.length) return { error: 'Lugu ei ole selles ettepanekus.' };
    if (seen.has(index)) return { error: 'Sama lugu on valikus topelt.' };
    seen.add(index);

    const role = confirmed.get(roleKey(String(s.role ?? '')));
    if (!role) return { error: `Roll „${s.role}“ ei ole projekti kinnitatud rollide seas.` };
    if (!SIZES.includes(s.size)) return { error: 'Suurus peab olema S, M või L.' };
    const text = validateStoryText(s);
    if (text.errors.length) return { error: text.errors[0].message };

    const original = proposedStories[index];
    const story = { role, ...text.value, size: s.size, touchesView: Boolean(original.touchesView) };
    const same = story.role === original.role && story.rolePhrase === original.rolePhrase
      && story.want === original.want && story.soThat === original.soThat && story.size === original.size;
    result.push({ index, ...story, origin: same ? 'ai' : 'ai_edited' });
  }
  result.sort((a, b) => a.index - b.index); // happy path'i järjekord nagu ettepanekus
  return { stories: result };
}

// --- L15: lugude käsitsi haldus (töötab ka ilma AI-ta) ---

const ROLE_MAX = 40;

// Kontrollib käsitsi lisatava või muudetava loo välju. Roll võib olla ka kinnitamata (vabatekst),
// et backlog'i saaks hallata ka siis, kui AI rolle pakkuda ei saa. Tagastab { value } või { error, field }.
export function validateManualStory(raw) {
  const role = typeof raw?.role === 'string' ? raw.role.replace(/\s+/g, ' ').trim() : '';
  if (!role) return { error: 'Roll ei tohi olla tühi.', field: 'role' };
  if (role.length > ROLE_MAX) return { error: `Roll võib olla kuni ${ROLE_MAX} märki.`, field: 'role' };
  const text = validateStoryText({ rolePhrase: raw?.rolePhrase, want: raw?.want, soThat: raw?.soThat });
  if (text.errors.length) return { error: text.errors[0].message, field: text.errors[0].field };
  if (!SIZES.includes(raw?.size)) return { error: 'Suurus peab olema S, M või L.', field: 'size' };
  return { value: { role, ...text.value, size: raw.size, touchesView: raw?.touchesView !== false } };
}

// Lisab käsitsi loodud loo backlog'i lõppu (MVP joone alla); päritolu "manual".
export function createManualStory(db, projectId, value) {
  appendStories(db, projectId, [{ ...value, origin: 'manual' }], null);
  return db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position DESC LIMIT 1').get(projectId).id;
}

// Muudab loo sisu. Järjekord, staatus ja alustamise loo valik jäävad samaks. AI loo muutmisel päritolu "ai_edited".
export function updateManualStory(db, projectId, storyId, value) {
  const current = db.prepare('SELECT role, role_phrase AS rolePhrase, want, so_that AS soThat, size, touches_view AS tv, origin FROM stories WHERE id = ? AND project_id = ?')
    .get(storyId, projectId);
  if (!current) return false;
  const changed = ['role', 'rolePhrase', 'want', 'soThat', 'size'].some((k) => current[k] !== value[k]) || Boolean(current.tv) !== value.touchesView;
  const origin = changed && current.origin === 'ai' ? 'ai_edited' : current.origin;
  db.prepare(`UPDATE stories SET role = ?, role_phrase = ?, want = ?, so_that = ?, size = ?, touches_view = ?, origin = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND project_id = ?`)
    .run(value.role, value.rolePhrase, value.want, value.soThat, value.size, value.touchesView ? 1 : 0, origin, storyId, projectId);
  return true;
}

// --- L26: kattuvaks märgitud lood (kasutaja märge enne otsust ühendada või üks eemaldada) ---
// Loo märked: teiste lugude id-d, millega lugu on kattuvaks märgitud.
export function listOverlaps(db, storyId) {
  return db.prepare('SELECT CASE WHEN story_a = ? THEN story_b ELSE story_a END AS id FROM story_overlaps WHERE story_a = ? OR story_b = ? ORDER BY id')
    .all(storyId, storyId, storyId).map((r) => r.id);
}

const storyExists = (db, projectId, id) => Number.isInteger(id) && Boolean(db.prepare('SELECT 1 FROM stories WHERE id = ? AND project_id = ?').get(id, projectId));

// Märgib paari kattuvaks. Tagastab { ok: true } või { status, code, error }.
export function markOverlap(db, projectId, storyId, withId) {
  if (!storyExists(db, projectId, storyId) || !storyExists(db, projectId, withId)) return { status: 404, code: 'not_found', error: 'Lugu ei leitud selle projekti backlog\'ist.' };
  if (storyId === withId) return { status: 400, code: 'same_story', error: 'Lugu ei saa märkida kattuvaks iseendaga.' };
  const [a, b] = storyId < withId ? [storyId, withId] : [withId, storyId];
  if (db.prepare('SELECT 1 FROM story_overlaps WHERE story_a = ? AND story_b = ?').get(a, b)) {
    return { status: 409, code: 'already_marked', error: 'Need lood on juba kattuvaks märgitud.' };
  }
  db.prepare('INSERT INTO story_overlaps (project_id, story_a, story_b) VALUES (?, ?, ?)').run(projectId, a, b);
  return { ok: true };
}

// „Pole kattuv“: eemaldab ainult märke. Tagastab { ok: true } või { status, code, error }.
export function unmarkOverlap(db, projectId, storyId, withId) {
  const [a, b] = storyId < withId ? [storyId, withId] : [withId, storyId];
  const { changes } = db.prepare('DELETE FROM story_overlaps WHERE project_id = ? AND story_a = ? AND story_b = ?').run(projectId, a, b);
  return changes === 1 ? { ok: true } : { status: 404, code: 'not_found', error: 'Sellist kattuvusmärget ei leitud.' };
}

// Ootel ettepanekud, mis puudutavad seda lugu (prioriteedisoovitus sellele loole, kriteeriumid, mockup, täpsustus).
const pendingForStory = (db, projectId, storyId) => db
  .prepare("SELECT id, kind, payload FROM ai_proposals WHERE project_id = ? AND status = 'pending' AND kind IN ('priority', 'criteria', 'mockup', 'refinement')")
  .all(projectId)
  .filter((p) => JSON.parse(p.payload).storyId === storyId);

// Mis kustub või muutub koos looga – kuvatakse kinnituses enne kustutamist. Ainult lugemine.
export function deletionImpact(db, projectId, storyId) {
  const ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  const index = ids.indexOf(storyId);
  if (index < 0) return null;
  const n = (sql) => db.prepare(sql).get(storyId).n;
  const project = db.prepare('SELECT focus_story_id AS focus, mvp_count AS mvp FROM projects WHERE id = ?').get(projectId);
  return {
    isFocus: project.focus === storyId,
    aboveMvpLine: project.mvp !== null && index < project.mvp,
    criteria: n('SELECT COUNT(*) AS n FROM criteria WHERE story_id = ?'),
    mockupVersions: n('SELECT COUNT(*) AS n FROM mockups WHERE story_id = ?'),
    questions: n('SELECT COUNT(*) AS n FROM story_questions WHERE story_id = ?'),
    pendingProposals: pendingForStory(db, projectId, storyId).length,
    overlaps: listOverlaps(db, storyId), // L26: need kattuvusmärked kaovad koos looga
  };
}

// Kustutab loo koos kriteeriumide, mockup'i versioonide ja küsimustega (andmebaasi kaskaad).
// Alustamise valik tühjeneb (ON DELETE SET NULL), selle loo ootel ettepanekud lükatakse tagasi,
// MVP joon nihkub üles, kui lugu oli joone kohal, ja järjekord tihendatakse. Kõik ühes transaktsioonis.
export function deleteManualStory(db, projectId, storyId) {
  const sp = txBegin(db);
  try {
    const impact = deletionImpact(db, projectId, storyId);
    if (!impact) {
      txRollback(db, sp);
      return null;
    }
    for (const p of pendingForStory(db, projectId, storyId)) {
      db.prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'").run(p.id);
    }
    if (impact.aboveMvpLine) db.prepare('UPDATE projects SET mvp_count = mvp_count - 1 WHERE id = ?').run(projectId);
    db.prepare('DELETE FROM stories WHERE id = ? AND project_id = ?').run(storyId, projectId);
    const rest = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId);
    const setPosition = db.prepare('UPDATE stories SET position = ? WHERE id = ?');
    rest.forEach((r, i) => setPosition.run(i + 1, r.id));
    db.prepare("UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(projectId);
    txCommit(db, sp);
    return impact;
  } catch (err) {
    txRollback(db, sp);
    throw err;
  }
}

// --- L25: loo käsitsi jagamine kaheks (ilma AI-ta) ---
// Algne lugu jääb osaks 1 (sama id: mockup'i versioonid, alustamise valik ja prioriteedisoovitus jäävad selle juurde).
// Osa 2 on uus lugu kohe osa 1 järel. Kasutaja valib, millised kriteeriumid ja küsimused lähevad osale 2.

const SPLIT_REJECTED_KINDS = ['criteria', 'mockup', 'refinement']; // koostatud jagamiseelse loo põhjal

const pendingToReject = (db, projectId, storyId) => db
  .prepare("SELECT id, kind, payload FROM ai_proposals WHERE project_id = ? AND status = 'pending'")
  .all(projectId)
  .filter((p) => SPLIT_REJECTED_KINDS.includes(p.kind) && JSON.parse(p.payload).storyId === storyId);

// Jagamise eelvaate andmed (ainult lugemine).
export function splitInfo(db, projectId, storyId) {
  const ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  const index = ids.indexOf(storyId);
  if (index < 0) return null;
  const project = db.prepare('SELECT focus_story_id AS focus, mvp_count AS mvp FROM projects WHERE id = ?').get(projectId);
  return {
    criteria: db.prepare('SELECT id, text, ref_kind AS refKind FROM criteria WHERE story_id = ? ORDER BY position').all(storyId)
      .map((c) => ({ id: c.id, text: c.text, linked: c.refKind !== null })),
    questions: db.prepare('SELECT id, text, resolved_at AS resolvedAt FROM story_questions WHERE story_id = ? ORDER BY id').all(storyId).map((q) => ({ ...q })),
    mockupVersions: db.prepare('SELECT COUNT(*) AS n FROM mockups WHERE story_id = ?').get(storyId).n,
    pendingProposals: pendingToReject(db, projectId, storyId).length,
    isFocus: project.focus === storyId,
    aboveMvpLine: project.mvp !== null && index < project.mvp,
  };
}

const idList = (raw, allowed) => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((x) => !allowed.has(x)) || new Set(raw).size !== raw.length) return null;
  return raw;
};

// Kontrollib jagamise päringu. Tagastab { first, second, criteriaToSecond, questionsToSecond } või { error, field }.
export function validateSplit(raw, info) {
  const first = validateManualStory(raw?.first);
  if (first.error) return { error: `Osa 1: ${first.error}`, field: `first.${first.field}` };
  const second = validateManualStory(raw?.second);
  if (second.error) return { error: `Osa 2: ${second.error}`, field: `second.${second.field}` };
  const key = (v) => composeTitle(v).toLocaleLowerCase('et');
  if (key(first.value) === key(second.value)) return { error: 'Osa 1 ja osa 2 on samasugused – jagamisel peavad need erinema.', field: 'second.want' };
  const criteriaToSecond = idList(raw?.criteriaToSecond, new Set(info.criteria.map((c) => c.id)));
  if (!criteriaToSecond) return { error: 'Kriteeriumide jaotus on vigane.', field: 'criteria' };
  const questionsToSecond = idList(raw?.questionsToSecond, new Set(info.questions.map((q) => q.id)));
  if (!questionsToSecond) return { error: 'Küsimuste jaotus on vigane.', field: 'questions' };
  return { first: first.value, second: second.value, criteriaToSecond, questionsToSecond };
}

// Jagab loo ühes transaktsioonis. Teiste lugude sisu ei muutu; järgnevad lood nihkuvad ühe koha võrra.
export function splitStory(db, projectId, storyId, split) {
  const sp = txBegin(db);
  try {
    const result = splitStoryInTx(db, projectId, storyId, split);
    if (result) txCommit(db, sp); else txRollback(db, sp);
    return result;
  } catch (err) {
    txRollback(db, sp);
    throw err;
  }
}

// Sama jagamine olemasoleva transaktsiooni sees (L28: ülevaatuse leiu rakendamine salvestab samas ka tagasivõtmise seisu).
export function splitStoryInTx(db, projectId, storyId, split) {
  const info = splitInfo(db, projectId, storyId);
  if (!info) return null;
  const rejected = pendingToReject(db, projectId, storyId);
  for (const p of rejected) {
    db.prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'").run(p.id);
  }
  updateManualStory(db, projectId, storyId, split.first);
  const position = db.prepare('SELECT position FROM stories WHERE id = ?').get(storyId).position;
  db.prepare('UPDATE stories SET position = position + 1 WHERE project_id = ? AND position > ?').run(projectId, position);
  const s = split.second;
  const secondId = db.prepare(`INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin, touches_view)
                               VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?) RETURNING id`)
    .get(projectId, position + 1, s.role, s.rolePhrase, s.want, s.soThat, s.size, s.touchesView ? 1 : 0).id;
  // Osale 2 viidud kriteeriumid: seos osa 1 mockup'iga eemaldatakse (osal 2 mockup'i pole).
  const moveCriterion = db.prepare(`UPDATE criteria SET story_id = ?, ref_kind = NULL, ref_index = NULL, ref_version = NULL, ref_source = NULL,
                                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND story_id = ?`);
  for (const id of split.criteriaToSecond) moveCriterion.run(secondId, id, storyId);
  const renumber = db.prepare('UPDATE criteria SET position = ? WHERE id = ?');
  for (const sid of [storyId, secondId]) {
    db.prepare('SELECT id FROM criteria WHERE story_id = ? ORDER BY position, id').all(sid).forEach((c, i) => renumber.run(i + 1, c.id));
  }
  const moveQuestion = db.prepare('UPDATE story_questions SET story_id = ? WHERE id = ? AND story_id = ?');
  for (const id of split.questionsToSecond) moveQuestion.run(secondId, id, storyId);
  // Avatud küsimusega osa 2 vajab täpsustamist (nagu küsimuse lisamisel).
  if (db.prepare('SELECT 1 FROM story_questions WHERE story_id = ? AND resolved_at IS NULL').get(secondId)) {
    db.prepare("UPDATE stories SET status = 'vajab_tapsustamist' WHERE id = ?").run(secondId);
  }
  if (info.aboveMvpLine) db.prepare('UPDATE projects SET mvp_count = mvp_count + 1 WHERE id = ?').run(projectId);
  db.prepare("UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(projectId);
  return { secondId, rejectedProposals: rejected.length, movedCriteria: split.criteriaToSecond.length, movedQuestions: split.questionsToSecond.length };
}

// --- L26: kahe loo käsitsi ühendamine (ilma AI-ta) ---
// Säilitatav lugu (keep) jääb alles (ID, staatus); eemaldatava (remove) andmed viiakse üle ja selle rida kustutatakse.
// Ühendatud lugu jääb kahest eespool olevale kohale. Kui mõlemal lool on mockup'i versioone, ühendamist ei tehta.

const MERGE_REJECTED_KINDS = ['criteria', 'mockup', 'refinement'];

// Kriteeriumi mockup'i seose silt (c = kriteeriumi rida ref_kind/ref_index/ref_version väljadega). Ainult lugemine.
export function linkLabel(db, storyId, c) {
  if (c.ref_kind === 'no_view') return 'ei puuduta vaadet';
  if (c.ref_kind !== 'element') return null;
  const row = db.prepare('SELECT spec FROM mockups WHERE story_id = ? AND version = ?').get(storyId, c.ref_version);
  const component = row ? JSON.parse(row.spec).components?.[c.ref_index] : null;
  return component ? `${componentLabel(component, c.ref_index)} (mockup v${c.ref_version})` : `aegunud seos (mockup v${c.ref_version})`;
}

const mergePending = (db, projectId, keepId, removeId) => db
  .prepare("SELECT id, kind, payload FROM ai_proposals WHERE project_id = ? AND status = 'pending'")
  .all(projectId)
  .filter((p) => {
    const storyId = JSON.parse(p.payload).storyId;
    if (MERGE_REJECTED_KINDS.includes(p.kind)) return storyId === keepId || storyId === removeId;
    return p.kind === 'priority' && storyId === removeId;
  });

// Ühendamise eelvaate andmed (ainult lugemine). null, kui lugu pole projektis või lood on samad.
export function mergeInfo(db, projectId, keepId, removeId) {
  if (keepId === removeId) return null;
  const ids = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id);
  const keepIndex = ids.indexOf(keepId);
  const removeIndex = ids.indexOf(removeId);
  if (keepIndex < 0 || removeIndex < 0) return null;
  const project = db.prepare('SELECT focus_story_id AS focus, mvp_count AS mvp FROM projects WHERE id = ?').get(projectId);
  const mockups = (id) => db.prepare('SELECT COUNT(*) AS n FROM mockups WHERE story_id = ?').get(id).n;
  const mockupCounts = { keep: mockups(keepId), remove: mockups(removeId) };
  const blocked = mockupCounts.keep > 0 && mockupCounts.remove > 0;
  // Mockup jääb sellelt loolt, kellel see on (blocked korral mõlemal); teise loo elemendiseosed eemaldatakse.
  const mockupFrom = mockupCounts.keep > 0 ? 'keep' : mockupCounts.remove > 0 ? 'remove' : null;
  const criteria = ['keep', 'remove'].flatMap((from) => {
    const sid = from === 'keep' ? keepId : removeId;
    return db.prepare('SELECT id, text, ref_kind, ref_index, ref_version FROM criteria WHERE story_id = ? ORDER BY position').all(sid).map((c) => ({
      id: c.id,
      from,
      text: c.text,
      linkLabel: linkLabel(db, sid, c),
      linkSurvives: c.ref_kind === 'no_view' || (c.ref_kind === 'element' && mockupFrom === from),
    }));
  });
  const norm = (t) => cleanCriterion(t).toLocaleLowerCase('et');
  for (const c of criteria) c.duplicateWith = criteria.filter((o) => o.id !== c.id && norm(o.text) === norm(c.text)).map((o) => o.id);
  const questions = ['keep', 'remove'].flatMap((from) => db.prepare('SELECT id, text, resolved_at AS resolvedAt FROM story_questions WHERE story_id = ? ORDER BY id')
    .all(from === 'keep' ? keepId : removeId).map((q) => ({ ...q, from })));
  const pending = mergePending(db, projectId, keepId, removeId);
  const above = (i) => project.mvp !== null && i < project.mvp;
  return {
    keepId,
    removeId,
    blocked,
    mockups: { ...mockupCounts, from: mockupFrom },
    criteria,
    questions,
    pendingProposals: pending.length,
    focus: project.focus === keepId ? 'keep' : project.focus === removeId ? 'remove' : null,
    resultPosition: Math.min(keepIndex, removeIndex) + 1,
    mvp: { count: project.mvp, keepAbove: above(keepIndex), removeAbove: above(removeIndex) },
  };
}

// Kontrollib ühendamise päringu. keepCriteria = täpselt need kriteeriumid, mis kasutaja säilitas.
export function validateMerge(raw, info) {
  const story = validateManualStory(raw?.story);
  if (story.error) return { error: story.error, field: `story.${story.field}` };
  const allowed = new Set(info.criteria.map((c) => c.id));
  const keepCriteria = raw?.keepCriteria;
  if (!Array.isArray(keepCriteria) || keepCriteria.some((id) => !allowed.has(id)) || new Set(keepCriteria).size !== keepCriteria.length) {
    return { error: 'Kriteeriumide valik on vigane.', field: 'criteria' };
  }
  return { story: story.value, keepCriteria };
}

export function mergeStories(db, projectId, keepId, removeId, merge) {
  const sp = txBegin(db);
  try {
    const result = mergeStoriesInTx(db, projectId, keepId, removeId, merge);
    if (result?.keepId) txCommit(db, sp); else txRollback(db, sp);
    return result;
  } catch (err) {
    txRollback(db, sp);
    throw err;
  }
}

// Sama ühendamine olemasoleva transaktsiooni sees (L29: ülevaatuse leiu rakendamine salvestab samas ka tagasivõtmise seisu).
// null = lugu pole projektis; { blocked: true } = mõlemal lool on mockup'i versioonid.
export function mergeStoriesInTx(db, projectId, keepId, removeId, merge) {
  const info = mergeInfo(db, projectId, keepId, removeId);
  if (!info || info.blocked) return info ? { blocked: true } : null;
  const pending = mergePending(db, projectId, keepId, removeId);
  for (const p of pending) {
    db.prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'").run(p.id);
  }
  if (info.focus === 'remove') db.prepare('UPDATE projects SET focus_story_id = ? WHERE id = ?').run(keepId, projectId);
  updateManualStory(db, projectId, keepId, merge.story);

  // Kriteeriumid: täpselt kasutaja valik. Märkimata kriteeriumid eemaldatakse (eelvaates nimetatud).
  const kept = new Set(merge.keepCriteria);
  const removed = info.criteria.filter((c) => !kept.has(c.id));
  for (const c of removed) db.prepare('DELETE FROM criteria WHERE id = ?').run(c.id);
  const clearRef = db.prepare("UPDATE criteria SET ref_kind = NULL, ref_index = NULL, ref_version = NULL, ref_source = NULL WHERE id = ? AND ref_kind = 'element'");
  const ordered = info.criteria.filter((c) => kept.has(c.id));
  ordered.forEach((c, i) => {
    db.prepare('UPDATE criteria SET story_id = ?, position = ? WHERE id = ?').run(keepId, i + 1, c.id);
    if (!c.linkSurvives) clearRef.run(c.id);
  });
  db.prepare('UPDATE story_questions SET story_id = ? WHERE story_id = ?').run(keepId, removeId);
  if (info.mockups.from === 'remove') db.prepare('UPDATE mockups SET story_id = ? WHERE story_id = ?').run(keepId, removeId);
  if (db.prepare('SELECT 1 FROM story_questions WHERE story_id = ? AND resolved_at IS NULL').get(keepId)) {
    db.prepare("UPDATE stories SET status = 'vajab_tapsustamist' WHERE id = ?").run(keepId);
  }

  // Koht: ühendatud lugu kahest eespool olevale kohale; eemaldatav rida kustutatakse; järjekord tihendatakse.
  const order = db.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position').all(projectId).map((r) => r.id).filter((id) => id !== removeId);
  order.splice(order.indexOf(keepId), 1);
  order.splice(info.resultPosition - 1, 0, keepId);
  db.prepare('DELETE FROM stories WHERE id = ? AND project_id = ?').run(removeId, projectId);
  const setPosition = db.prepare('UPDATE stories SET position = ? WHERE id = ?');
  order.forEach((id, i) => setPosition.run(i + 1, id));
  if (info.mvp.keepAbove && info.mvp.removeAbove) db.prepare('UPDATE projects SET mvp_count = mvp_count - 1 WHERE id = ?').run(projectId);
  db.prepare("UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(projectId);
  return { keepId, removedCriteria: removed.length, rejectedProposals: pending.length, movedQuestions: info.questions.filter((q) => q.from === 'remove').length };
}
