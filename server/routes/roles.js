import { Router } from 'express';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildRolesMessages, checkRoles, ROLES_SCHEMA } from '../ai/tasks/roles.js';
import { applyProposal, createProposal, findPendingProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { listRoles, replaceRoles, validateRoleSelection } from '../roles.js';

const KIND = 'roles';

// Rollide marsruudid (L05). AI ettepanek salvestatakse olekuga "pending" (ai_proposals) ega muuda
// kinnitatud rolle; project_roles muutub ainult /apply kaudu, täpselt üks kord ettepaneku kohta.
export function rolesRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const snapshot = (projectId) => {
    const proposal = findPendingProposal(db, projectId, KIND);
    return {
      roles: listRoles(db, projectId),
      proposal: proposal ? { id: proposal.id, message: proposal.payload.message, roles: proposal.payload.roles } : null,
      aiRunning: running.has(projectId),
    };
  };

  router.use((req, res, next) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    req.projectId = id;
    next();
  });

  router.get('/', (req, res) => res.json(snapshot(req.projectId)));

  // Küsib AI-lt rollide ettepaneku. Kui pooleli ettepanek on juba olemas, tagastab selle ilma AI-kutseta.
  router.post('/propose', async (req, res) => {
    const projectId = req.projectId;
    const hasSummary = db.prepare("SELECT 1 FROM conversation_messages WHERE project_id = ? AND kind = 'summary'").get(projectId);
    if (!hasSummary) return res.status(409).json({ error: 'Rolle saab pakkuda pärast vestluse kokkuvõtet.', code: 'conversation_not_ready' });
    if (findPendingProposal(db, projectId, KIND)) return res.json(snapshot(projectId));
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab rolle. Oota hetk.', code: 'in_progress' });

    running.add(projectId);
    try {
      const { data } = await runAiTask(ai, {
        task: 'roles',
        messages: buildRolesMessages(buildProjectContext(db, projectId)),
        schema: ROLES_SCHEMA,
        check: checkRoles,
      });
      createProposal(db, { projectId, kind: KIND, payload: { message: data.message, roles: data.roles } });
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    res.json(snapshot(projectId));
  });

  // Kinnitab kasutaja valitud rollid. Sama ettepanekut saab rakendada ainult üks kord (teine kord 409).
  router.post('/apply', (req, res) => {
    const projectId = req.projectId;
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== KIND) {
      return res.status(404).json({ error: 'Ettepanekut ei leitud.', code: 'not_found' });
    }
    const selection = validateRoleSelection(req.body?.roles, proposal.payload.roles);
    if (selection.error) return res.status(400).json({ error: selection.error, code: 'invalid_roles' });
    try {
      applyProposal(db, proposal.id, (tx) => replaceRoles(tx, projectId, selection.roles), { projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
    res.json(snapshot(projectId));
  });

  // Lükkab ettepaneku tagasi; kinnitatud rolle ei muudeta.
  router.post('/reject', (req, res) => {
    try {
      rejectProposal(db, String(req.body?.proposalId ?? ''), { projectId: req.projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
    res.json(snapshot(req.projectId));
  });

  return router;
}
