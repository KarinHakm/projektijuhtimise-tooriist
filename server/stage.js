// Etapi faktid andmebaasist (L13, L14). Ainult lugemine; tulemuse arvutab shared/stage.js.
import { computeStage } from '../shared/stage.js';
import { consistencyFor, hasAnyMockup } from './criteria.js';
import { findPendingProposal } from './proposals.js';
import { getFocusStoryId, storyInProject } from './priority.js';
import { findingIsCurrent, KIND as REVIEW_KIND } from './review.js';

const count = (db, sql, ...args) => db.prepare(sql).get(...args).n;

function conversationState(db, projectId) {
  const last = db.prepare('SELECT role, kind FROM conversation_messages WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId);
  if (count(db, "SELECT COUNT(*) AS n FROM conversation_messages WHERE project_id = ? AND kind = 'summary'", projectId) > 0) return 'done';
  if (!last) return 'empty';
  return last.role === 'user' ? 'unanswered' : 'questions';
}

// Projekti uusim AI väljund: vestluse AI sõnum või mis tahes AI ettepanek (ka rakendatud või tagasi lükatud).
// Backlog'i ülevaatus (L27) ei ole eraldi kaardi väljund – selle leiud on backlog'is –, seega seda ei arvestata.
function latestAiOutput(db, projectId) {
  return db.prepare(`SELECT kind, at FROM (
      SELECT kind, created_at AS at, id AS ord FROM conversation_messages WHERE project_id = ? AND role = 'assistant'
      UNION ALL
      SELECT kind, created_at AS at, 0 AS ord FROM ai_proposals WHERE project_id = ? AND kind != 'review'
    ) ORDER BY at DESC, ord DESC LIMIT 1`).get(projectId, projectId) ?? null;
}

// Kasutaja vahele jäetud etapid ja aktiivne etapp (L14, migratsioon v11).
export function stageState(db, projectId) {
  const row = db.prepare('SELECT skipped_stages AS skipped, active_stage AS active FROM projects WHERE id = ?').get(projectId);
  let skipped = [];
  try { skipped = JSON.parse(row?.skipped ?? '[]'); } catch { skipped = []; }
  return { skipped: Array.isArray(skipped) ? skipped : [], active: row?.active ?? null };
}

// Groomimise etapi seis backlog'i ülevaatuse (L27) andmetest: avatud ja aegumata leidude arv. Ainult lugemine.
function reviewState(db, projectId) {
  const p = findPendingProposal(db, projectId, REVIEW_KIND);
  if (!p) return null;
  return { open: p.payload.findings.filter((f) => f.status === 'open' && findingIsCurrent(db, projectId, f)).length };
}

export function stageFacts(db, projectId) {
  const savedFocus = getFocusStoryId(db, projectId);
  const focus = savedFocus !== null && storyInProject(db, projectId, savedFocus) ? savedFocus : null;
  const pendingForFocus = (kind) => {
    if (focus === null) return false;
    return db.prepare("SELECT payload FROM ai_proposals WHERE project_id = ? AND kind = ? AND status = 'pending'").all(projectId, kind)
      .some((r) => JSON.parse(r.payload).storyId === focus);
  };
  const criteria = focus === null ? 0 : count(db, 'SELECT COUNT(*) AS n FROM criteria WHERE story_id = ?', focus);
  const mockup = focus !== null && hasAnyMockup(db, focus); // L22: ükskõik milline vaade
  let consistency = null;
  if (criteria > 0 && mockup) {
    const c = consistencyFor(db, focus);
    consistency = { warnings: c.warningCount, reviewValid: Boolean(c.review?.valid) };
  }
  return {
    conversation: conversationState(db, projectId),
    roles: count(db, 'SELECT COUNT(*) AS n FROM project_roles WHERE project_id = ?', projectId),
    stories: count(db, 'SELECT COUNT(*) AS n FROM stories WHERE project_id = ?', projectId),
    focus: focus !== null,
    criteria,
    mockup,
    refinements: focus === null ? 0 : count(db,
      "SELECT COUNT(*) AS n FROM ai_proposals WHERE project_id = ? AND kind = 'refinement' AND status = 'applied' AND json_extract(payload, '$.storyId') = ?",
      projectId, focus),
    pending: {
      roles: Boolean(findPendingProposal(db, projectId, 'roles')),
      stories: Boolean(findPendingProposal(db, projectId, 'stories')),
      priority: Boolean(findPendingProposal(db, projectId, 'priority')),
      criteria: pendingForFocus('criteria'),
      mockup: pendingForFocus('mockup'),
      refinement: pendingForFocus('refinement'),
    },
    consistency,
    latestAi: latestAiOutput(db, projectId),
    ...stageState(db, projectId),
    review: reviewState(db, projectId),
    conversationAiLast: db.prepare('SELECT role FROM conversation_messages WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId)?.role === 'assistant',
  };
}

export const stageFor = (db, projectId) => computeStage(stageFacts(db, projectId));

// Avalehe projektikaardi lühike etapiseis (sama loogika mis projekti päises).
export function progressFor(db, projectId) {
  const r = stageFor(db, projectId);
  const first = r.steps[0] ?? null;
  return {
    stages: r.stages.map(({ key, label, status }) => ({ key, label, status })),
    lastDone: r.lastDone?.label ?? null,
    next: r.next?.label ?? null,
    nextStep: first ? `${first.label}${first.optional ? ' (valikuline)' : ''}` : null,
    allBuiltDone: r.allBuiltDone,
    storyCount: r.storyCount,
  };
}
