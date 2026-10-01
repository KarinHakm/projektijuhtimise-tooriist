import { Router } from 'express';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildPriorityMessages, buildPrioritySchema, checkPriority } from '../ai/tasks/priority.js';
import { applyProposal, createProposal, findPendingProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { getFocusStoryId, setFocusStory, storyInProject } from '../priority.js';
import { listStories } from '../stories.js';

const KIND = 'priority';

// Prioriteedi marsruudid (L08). AI soovitus salvestatakse olekuga "pending" ega muuda midagi;
// alustamise lugu määratakse ainult kasutaja kinnitusel (/accept) või tema enda valikuga (/choose).
export function priorityRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const snapshot = (projectId) => {
    const stories = listStories(db, projectId);
    const titleOf = (id) => stories.find((s) => s.id === id)?.title ?? null;
    const proposal = findPendingProposal(db, projectId, KIND);
    const focusStoryId = getFocusStoryId(db, projectId);
    return {
      focusStoryId,
      focusTitle: titleOf(focusStoryId),
      proposal: proposal
        ? { id: proposal.id, message: proposal.payload.message, storyId: proposal.payload.storyId, reason: proposal.payload.reason, title: titleOf(proposal.payload.storyId) }
        : null,
      stories: stories.map((s) => ({ id: s.id, title: s.title })),
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

  // Küsib AI soovitust. Kui pooleli soovitus on juba olemas, tagastab selle ilma AI-kutseta.
  router.post('/propose', async (req, res) => {
    const projectId = req.projectId;
    const stories = listStories(db, projectId);
    if (stories.length === 0) return res.status(409).json({ error: 'Prioriteeti saab küsida pärast lugude lisamist backlog\'i.', code: 'no_stories' });
    if (findPendingProposal(db, projectId, KIND)) return res.json(snapshot(projectId));
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab soovitust. Oota hetk.', code: 'in_progress' });

    const storyIds = stories.map((s) => s.id);
    running.add(projectId);
    try {
      const { data } = await runAiTask(ai, {
        task: 'priority',
        messages: buildPriorityMessages(buildProjectContext(db, projectId), stories),
        schema: buildPrioritySchema(storyIds),
        check: (d) => checkPriority(d, storyIds),
      });
      createProposal(db, { projectId, kind: KIND, payload: { message: data.message, storyId: data.storyId, reason: data.reason } });
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    res.json(snapshot(projectId));
  });

  // "Nõus, alustame sellest": soovitatud lugu saab alustamise looks (ettepanek rakendatakse üks kord).
  router.post('/accept', (req, res) => {
    const projectId = req.projectId;
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== KIND) {
      return res.status(404).json({ error: 'Soovitust ei leitud.', code: 'not_found' });
    }
    try {
      applyProposal(db, proposal.id, (tx) => {
        if (!storyInProject(tx, projectId, proposal.payload.storyId)) throw new ProposalError('not_found');
        setFocusStory(tx, projectId, proposal.payload.storyId);
      }, { projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
    res.json(snapshot(projectId));
  });

  // "Valin ise teise": kasutaja valib alustamise loo ise; pooleli AI soovitus lükatakse tagasi.
  router.post('/choose', (req, res) => {
    const projectId = req.projectId;
    const storyId = req.body?.storyId;
    if (!storyInProject(db, projectId, storyId)) return res.status(404).json({ error: 'Lugu ei leitud selle projekti backlog\'ist.', code: 'not_found' });
    setFocusStory(db, projectId, storyId);
    const pending = findPendingProposal(db, projectId, KIND);
    if (pending) {
      try {
        rejectProposal(db, pending.id, { projectId, kind: KIND });
      } catch (err) {
        if (!(err instanceof ProposalError)) throw err; // vahepeal otsustatud – valik kehtib siiski
      }
    }
    res.json(snapshot(projectId));
  });

  return router;
}
