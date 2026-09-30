import { listMessages } from '../conversation.js';

// AI kontekst koostatakse iga päringu jaoks andmebaasi hetkeseisust, mitte brauserist saadetud
// ajaloost, et AI näeks ka kasutaja käsitsi tehtud muudatusi. Rollid, lood ja kriteeriumid
// lisanduvad kontekstile koos vastavate lugudega (L05, L06, L09 …).
export function buildProjectContext(db, projectId) {
  const project = db.prepare('SELECT id, name, description, stage FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;
  return {
    project: { name: project.name, description: project.description, stage: project.stage },
    conversation: listMessages(db, projectId).map(({ role, kind, content }) => ({ role, kind, content })),
  };
}
