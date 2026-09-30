import { listMessages } from '../conversation.js';
import { listRoles } from '../roles.js';

// AI kontekst koostatakse iga päringu jaoks andmebaasi hetkeseisust, mitte brauserist saadetud
// ajaloost, et AI näeks ka kasutaja käsitsi tehtud muudatusi. Rollidest on kontekstis ainult
// KINNITATUD rollid; pooleli AI ettepanek (ai_proposals) sinna ei jõua. Lood ja kriteeriumid
// lisanduvad kontekstile koos vastavate lugudega (L06, L09 …).
export function buildProjectContext(db, projectId) {
  const project = db.prepare('SELECT id, name, description, stage FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;
  return {
    project: { name: project.name, description: project.description, stage: project.stage },
    conversation: listMessages(db, projectId).map(({ role, kind, content }) => ({ role, kind, content })),
    roles: listRoles(db, projectId).map((r) => r.name),
  };
}
