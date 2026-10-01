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
