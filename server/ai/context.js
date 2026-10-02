import { listMessages } from '../conversation.js';
import { listRoles } from '../roles.js';
import { listStories } from '../stories.js';
import { listCriteria, latestMockup } from '../criteria.js';
import { withReadiness } from '../readiness.js';
import { progressFor } from '../stage.js';
import { getFocusStoryId } from '../priority.js';

// AI kontekst koostatakse iga päringu jaoks andmebaasi hetkeseisust, mitte brauserist saadetud
// ajaloost, et AI näeks ka kasutaja käsitsi tehtud muudatusi. Rollidest ja lugudest on kontekstis
// ainult KINNITATUD/backlog'is olevad; pooleli AI ettepanekud (ai_proposals) sinna ei jõua.
// Etapp arvutatakse samamoodi nagu projekti päises (projects.stage veergu ei kasutata).
export function buildProjectContext(db, projectId) {
  const project = db.prepare('SELECT id, name, description FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;
  const progress = progressFor(db, projectId);
  const focusId = getFocusStoryId(db, projectId);
  return {
    project: {
      name: project.name,
      description: project.description,
      stage: { lastDone: progress.lastDone, next: progress.next, nextStep: progress.nextStep },
    },
    conversation: listMessages(db, projectId).map(({ role, kind, content }) => ({ role, kind, content })),
    roles: listRoles(db, projectId).map((r) => r.name),
    stories: withReadiness(db, listStories(db, projectId)).map((s) => ({
      id: s.id,
      role: s.role,
      title: s.title,
      size: s.size,
      status: s.status,
      ready: s.readiness.ready,
      focus: s.id === focusId,
      criteria: listCriteria(db, s.id).map((c) => c.text),
      hasMockup: latestMockup(db, s.id) !== null,
      openQuestions: s.questions.filter((q) => !q.resolvedAt).map((q) => q.text),
    })),
  };
}
