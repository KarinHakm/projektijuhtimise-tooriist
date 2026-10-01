// Backlog'i lood (L06): loend, AI ettepanekust lisamine ja lisamise sisendi kontroll.
import { composeTitle, validateStoryText } from '../shared/story-format.js';
import { listRoles, roleKey } from './roles.js';

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
  db.exec('BEGIN IMMEDIATE');
  try {
    const story = db.prepare('SELECT id, position FROM stories WHERE id = ? AND project_id = ?').get(storyId, projectId);
    if (!story) {
      db.exec('ROLLBACK');
      return { status: 404, code: 'not_found', error: 'Lugu ei leitud.' };
    }
    const neighbour = direction === 'up'
      ? db.prepare('SELECT id, position FROM stories WHERE project_id = ? AND position < ? ORDER BY position DESC LIMIT 1').get(projectId, story.position)
      : db.prepare('SELECT id, position FROM stories WHERE project_id = ? AND position > ? ORDER BY position ASC LIMIT 1').get(projectId, story.position);
    if (!neighbour) {
      db.exec('ROLLBACK');
      return { status: 409, code: 'at_edge', error: direction === 'up' ? 'Lugu on juba esimene.' : 'Lugu on juba viimane.' };
    }
    const setPosition = db.prepare('UPDATE stories SET position = ? WHERE id = ?');
    setPosition.run(neighbour.position, story.id);
    setPosition.run(story.position, neighbour.id);
    db.exec('COMMIT');
    return { ok: true };
  } catch (err) {
    db.exec('ROLLBACK');
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
  };
}

// Kustutab loo koos kriteeriumide, mockup'i versioonide ja küsimustega (andmebaasi kaskaad).
// Alustamise valik tühjeneb (ON DELETE SET NULL), selle loo ootel ettepanekud lükatakse tagasi,
// MVP joon nihkub üles, kui lugu oli joone kohal, ja järjekord tihendatakse. Kõik ühes transaktsioonis.
export function deleteManualStory(db, projectId, storyId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const impact = deletionImpact(db, projectId, storyId);
    if (!impact) {
      db.exec('ROLLBACK');
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
    db.exec('COMMIT');
    return impact;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
