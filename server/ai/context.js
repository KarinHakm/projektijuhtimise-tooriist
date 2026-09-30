import { listMessages } from '../conversation.js';
import { listRoles } from '../roles.js';
import { listStories } from '../stories.js';

// AI kontekst koostatakse iga päringu jaoks andmebaasi hetkeseisust, mitte brauserist saadetud
// ajaloost, et AI näeks ka kasutaja käsitsi tehtud muudatusi. Rollidest ja lugudest on kontekstis
// ainult KINNITATUD/backlog'is olevad; pooleli AI ettepanekud (ai_proposals) sinna ei jõua.
export function buildProjectContext(db, projectId) {
  const project = db.prepare('SELECT id, name, description, stage FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;
  return {
    project: { name: project.name, description: project.description, stage: project.stage },
    conversation: listMessages(db, projectId).map(({ role, kind, content }) => ({ role, kind, content })),
    roles: listRoles(db, projectId).map((r) => r.name),
    stories: listStories(db, projectId).map((s) => ({ role: s.role, title: s.title })),
  };
}
