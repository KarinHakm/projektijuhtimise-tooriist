// Loo staatus, avatud küsimused ja valmisolek (L19, L20).
import { evaluateDor, READY } from '../shared/dor.js';
import { latestMockup, listCriteria } from './criteria.js';

export function listQuestions(db, storyId) {
  return db.prepare('SELECT id, text, created_at AS createdAt, resolved_at AS resolvedAt FROM story_questions WHERE story_id = ? ORDER BY id').all(storyId)
    .map((r) => ({ ...r }));
}

// Lisab igale loole küsimused ja valmisoleku. readiness.expired: salvestatud staatus on „Valmis arenduseks“,
// kuid DoR ei ole enam täidetud – sellist lugu ei käsitleta valmis loona.
export function withReadiness(db, stories) {
  return stories.map((s) => {
    const questions = listQuestions(db, s.id);
    const dor = evaluateDor({
      story: s,
      criteria: listCriteria(db, s.id),
      hasMockup: latestMockup(db, s.id) !== null,
      openQuestions: questions.filter((q) => !q.resolvedAt).length,
    });
    return { ...s, questions, readiness: { ...dor, ready: s.status === READY && dor.ok, expired: s.status === READY && !dor.ok } };
  });
}
