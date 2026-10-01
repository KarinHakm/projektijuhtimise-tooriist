import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { composeTitle, validateStoryText } from '../../shared/story-format.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildStoriesMessages, buildStoriesSchema, checkStories } from '../ai/tasks/stories.js';
import { applyProposal, findPendingProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { listRoles } from '../roles.js';
import { appendStories, listStories, moveStory, validateApply } from '../stories.js';

const KIND = 'stories';

// Lugude marsruudid (L06, L07). AI ettepanek salvestatakse olekuga "pending" ega muuda backlog'i;
// lood lisanduvad ainult /apply kaudu, täpselt üks kord ettepaneku kohta. /:storyId/move muudab ainult järjekorda.
export function storiesRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const publicProposal = (p) => ({
    id: p.id,
    demo: p.payload.demo === true, // käsitsi koostatud näidisettepanek (npm run demo), mitte AI vastus
    message: p.payload.message,
    primaryRole: p.payload.primaryRole,
    stories: p.payload.stories.map((s, index) => ({ index, ...s, title: composeTitle(s) })),
  });

  const snapshot = (projectId) => {
    const proposal = findPendingProposal(db, projectId, KIND);
    return {
      stories: listStories(db, projectId),
      proposal: proposal ? publicProposal(proposal) : null,
      roles: listRoles(db, projectId).map((r) => r.name),
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

  // Küsib AI-lt lugude ettepaneku. Ilma "replace"-ita tagastab olemasoleva pooleli ettepaneku ilma AI-kutseta.
  // "replace": vana ettepanek jääb alles, kuni uus on edukalt kontrollitud; siis vahetatakse need ühes transaktsioonis.
  router.post('/propose', async (req, res) => {
    const projectId = req.projectId;
    const roleNames = listRoles(db, projectId).map((r) => r.name);
    if (roleNames.length === 0) return res.status(409).json({ error: 'Kinnita enne lugude pakkumist projekti rollid.', code: 'roles_not_confirmed' });

    const pending = findPendingProposal(db, projectId, KIND);
    const replace = req.body?.replace ? String(req.body.replace) : null;
    if (!replace && pending) return res.json(snapshot(projectId));
    if (replace && pending?.id !== replace) {
      return res.status(409).json({ error: 'See ettepanek ei ole enam pooleli.', code: 'stale_proposal' });
    }
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab lugusid. Oota hetk.', code: 'in_progress' });

    running.add(projectId);
    let data;
    try {
      ({ data } = await runAiTask(ai, {
        task: 'stories',
        messages: buildStoriesMessages(buildProjectContext(db, projectId)),
        schema: buildStoriesSchema(roleNames),
        check: (d) => checkStories(d, roleNames),
      }));
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body); // vana ettepanek (kui oli) jääb muutmata
    } finally {
      running.delete(projectId);
    }

    const payload = {
      message: data.message,
      primaryRole: data.primaryRole,
      stories: data.stories.map((s) => {
        const { value, warnings } = validateStoryText(s);
        return { role: s.role, ...value, size: s.size, touchesView: s.touchesView, warnings: warnings.map((w) => w.message) };
      }),
    };

    db.exec('BEGIN IMMEDIATE');
    try {
      if (replace) {
        const { changes } = db
          .prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND project_id = ? AND kind = ? AND status = 'pending'")
          .run(replace, projectId, KIND);
        if (changes !== 1) {
          db.exec('ROLLBACK');
          return res.status(409).json({ error: 'See ettepanek ei ole enam pooleli.', code: 'stale_proposal' });
        }
      }
      db.prepare('INSERT INTO ai_proposals (id, project_id, kind, payload) VALUES (?, ?, ?, ?)').run(randomUUID(), projectId, KIND, JSON.stringify(payload));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json(snapshot(projectId));
  });

  // Lisab valitud lood backlog'i. Sama ettepanekut saab rakendada ainult üks kord (teine kord 409).
  router.post('/apply', (req, res) => {
    const projectId = req.projectId;
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== KIND) {
      return res.status(404).json({ error: 'Ettepanekut ei leitud.', code: 'not_found' });
    }
    const selection = validateApply(db, projectId, req.body?.stories, proposal.payload.stories);
    if (selection.error) return res.status(400).json({ error: selection.error, code: 'invalid_stories' });
    // Näidisettepanek on käsitsi koostatud, seega ei märgita lugusid AI päritoluga.
    const stories = proposal.payload.demo === true ? selection.stories.map((s) => ({ ...s, origin: 'manual' })) : selection.stories;
    try {
      applyProposal(db, proposal.id, (tx) => appendStories(tx, projectId, stories, proposal.id), { projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
    res.json(snapshot(projectId));
  });

  router.post('/reject', (req, res) => {
    try {
      rejectProposal(db, String(req.body?.proposalId ?? ''), { projectId: req.projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
    res.json(snapshot(req.projectId));
  });

  // Tõstab backlog'i loo ühe koha võrra (L07). Teise projekti lugu ei leita (404).
  router.post('/:storyId/move', (req, res) => {
    const storyId = Number(req.params.storyId);
    if (!Number.isInteger(storyId) || storyId <= 0) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    const result = moveStory(db, req.projectId, storyId, req.body?.direction);
    if (result.error) return res.status(result.status).json({ error: result.error, code: result.code });
    res.json(snapshot(req.projectId));
  });

  return router;
}
