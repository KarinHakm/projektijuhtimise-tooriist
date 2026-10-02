// Loo staatus, avatud küsimused ja valmisolek (L19, L20).
import { evaluateDor, READY } from '../shared/dor.js';
import { latestMockup, listCriteria } from './criteria.js';
import { linkLabel } from './stories.js';

export function listQuestions(db, storyId) {
  return db.prepare('SELECT id, text, created_at AS createdAt, resolved_at AS resolvedAt FROM story_questions WHERE story_id = ? ORDER BY id').all(storyId)
    .map((r) => ({ ...r }));
}

// Lisab igale loole küsimused ja valmisoleku. readiness.expired: salvestatud staatus on „Valmis arenduseks“,
// kuid DoR ei ole enam täidetud – sellist lugu ei käsitleta valmis loona.
export function withReadiness(db, stories) {
  return stories.map((s) => {
    const questions = listQuestions(db, s.id);
    // L15: kriteeriumid koos hoiatuste ja mockup'i seose sildiga (käsitsi halduseks backlog'is).
    const criteria = listCriteria(db, s.id).map((c) => ({
      ...c,
      linkLabel: linkLabel(db, s.id, { ref_kind: c.ref?.kind ?? null, ref_index: c.ref?.index ?? null, ref_version: c.ref?.version ?? null }),
    }));
    const dor = evaluateDor({
      story: s,
      criteria,
      hasMockup: latestMockup(db, s.id) !== null,
      openQuestions: questions.filter((q) => !q.resolvedAt).length,
    });
    return { ...s, criteria, questions, readiness: { ...dor, ready: s.status === READY && dor.ok, expired: s.status === READY && !dor.ok } };
  });
}

// Avatud küsimuse lisamine: lugu saab staatuse „Vajab täpsustamist“ (ka siis, kui see oli valmis).
// Kutsuda transaktsiooni sees.
export function insertStoryQuestion(db, storyId, text) {
  db.prepare('INSERT INTO story_questions (story_id, text) VALUES (?, ?)').run(storyId, text);
  db.prepare("UPDATE stories SET status = 'vajab_tapsustamist', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(storyId);
}
