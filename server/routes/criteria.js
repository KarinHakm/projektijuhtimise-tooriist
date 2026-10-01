import { Router } from 'express';
import { checkCriterion } from '../../shared/criteria-check.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import {
  buildCriteriaMessages, buildMockupMessages, checkCriteria, checkMockup, CRITERIA_SCHEMA, MOCKUP_ONLY_SCHEMA,
} from '../ai/tasks/criteria.js';
import { appendCriteria, latestMockup, listCriteria, saveMockup, validateCriteriaSave } from '../criteria.js';
import { getFocusStoryId } from '../priority.js';
import { applyProposal, createProposal, findPendingProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { listStories } from '../stories.js';

const CRITERIA = 'criteria';
const MOCKUP = 'mockup';

// Kriteeriumid ja mockup alustamise loole (L09, L10). Üks AI-kutse loob kaks eraldi ootel ettepanekut:
// kriteeriumid ja mockup. Need kinnitatakse eraldi – kriteeriumide salvestamine ei kinnita mockup'i.
export function criteriaRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const focusStory = (projectId) => {
    const id = getFocusStoryId(db, projectId);
    return listStories(db, projectId).find((s) => s.id === id) ?? null;
  };
  // Ainult praeguse alustamise loo ootel ettepanek; teise loo oma ei kuvata.
  const pendingFor = (projectId, kind, storyId) => {
    const p = findPendingProposal(db, projectId, kind);
    return p && p.payload.storyId === storyId ? p : null;
  };

  const snapshot = (projectId) => {
    const story = focusStory(projectId);
    if (!story) return { story: null, criteria: [], mockup: null, criteriaProposal: null, mockupProposal: null, aiRunning: running.has(projectId) };
    const cp = pendingFor(projectId, CRITERIA, story.id);
    const mp = pendingFor(projectId, MOCKUP, story.id);
    return {
      story: { id: story.id, title: story.title },
      criteria: listCriteria(db, story.id),
      mockup: latestMockup(db, story.id),
      criteriaProposal: cp
        ? { id: cp.id, message: cp.payload.message, criteria: cp.payload.criteria.map((text, index) => ({ index, text, warnings: checkCriterion(text).map((w) => w.message) })) }
        : null,
      mockupProposal: mp ? { id: mp.id, message: mp.payload.message, mockup: mp.payload.mockup } : null,
      aiRunning: running.has(projectId),
    };
  };

  const rejectStale = (projectId, kind, storyId) => {
    const p = findPendingProposal(db, projectId, kind);
    if (p && p.payload.storyId !== storyId) rejectProposal(db, p.id, { projectId, kind });
  };

  const fail = (res, err) => {
    if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  };

  router.use((req, res, next) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    req.projectId = id;
    next();
  });

  router.get('/', (req, res) => res.json(snapshot(req.projectId)));

  // Küsib AI-lt kriteeriumid ja mockup'i alustamise loole. Pooleli ettepanek tagastatakse ilma AI-kutseta.
  router.post('/propose', async (req, res) => {
    const projectId = req.projectId;
    const story = focusStory(projectId);
    if (!story) return res.status(409).json({ error: 'Vali enne prioriteedi juures lugu, millest alustada.', code: 'no_focus' });
    if (listCriteria(db, story.id).length > 0) {
      return res.status(409).json({ error: 'Sellel lool on juba kinnitatud kriteeriumid. Neid muudab kliendi täpsustus.', code: 'already_has_criteria' });
    }
    if (pendingFor(projectId, CRITERIA, story.id)) return res.json(snapshot(projectId));
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab ettepanekut. Oota hetk.', code: 'in_progress' });

    running.add(projectId);
    let data;
    try {
      ({ data } = await runAiTask(ai, {
        task: 'criteria',
        messages: buildCriteriaMessages(buildProjectContext(db, projectId), story),
        schema: CRITERIA_SCHEMA,
        check: checkCriteria,
      }));
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    rejectStale(projectId, CRITERIA, story.id);
    rejectStale(projectId, MOCKUP, story.id);
    createProposal(db, { projectId, kind: CRITERIA, payload: { storyId: story.id, message: data.message, criteria: data.criteria } });
    if (!latestMockup(db, story.id) && !pendingFor(projectId, MOCKUP, story.id)) {
      createProposal(db, { projectId, kind: MOCKUP, payload: { storyId: story.id, message: data.message, mockup: data.mockup } });
    }
    res.json(snapshot(projectId));
  });

  // Salvestab ainult brauseri saadetud kinnitatud/muudetud/lisatud kriteeriumid (eemaldatuid ei saadeta).
  router.post('/apply', (req, res) => {
    const projectId = req.projectId;
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== CRITERIA) {
      return res.status(404).json({ error: 'Ettepanekut ei leitud.', code: 'not_found' });
    }
    const selection = validateCriteriaSave(req.body?.criteria, proposal.payload.criteria);
    if (selection.error) return res.status(400).json({ error: selection.error, code: 'invalid_criteria' });
    try {
      applyProposal(db, proposal.id, (tx) => {
        const exists = tx.prepare('SELECT 1 FROM stories WHERE id = ? AND project_id = ?').get(proposal.payload.storyId, projectId);
        if (!exists) throw new ProposalError('not_found');
        appendCriteria(tx, proposal.payload.storyId, selection.criteria);
      }, { projectId, kind: CRITERIA });
    } catch (err) {
      return fail(res, err);
    }
    res.json(snapshot(projectId));
  });

  // [Kinnita mockup]: seotakse looga uue versioonina (esimene = 1).
  router.post('/mockup/accept', (req, res) => {
    const projectId = req.projectId;
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== MOCKUP) {
      return res.status(404).json({ error: 'Ettepanekut ei leitud.', code: 'not_found' });
    }
    try {
      applyProposal(db, proposal.id, (tx) => {
        const exists = tx.prepare('SELECT 1 FROM stories WHERE id = ? AND project_id = ?').get(proposal.payload.storyId, projectId);
        if (!exists) throw new ProposalError('not_found');
        saveMockup(tx, proposal.payload.storyId, proposal.payload.mockup);
      }, { projectId, kind: MOCKUP });
    } catch (err) {
      return fail(res, err);
    }
    res.json(snapshot(projectId));
  });

  // [Loobu]: mockup'i ei salvestata.
  router.post('/mockup/reject', (req, res) => {
    try {
      rejectProposal(db, String(req.body?.proposalId ?? ''), { projectId: req.projectId, kind: MOCKUP });
    } catch (err) {
      return fail(res, err);
    }
    res.json(snapshot(req.projectId));
  });

  // [Paku uus]: uus mockup'i ettepanek; senine jääb alles, kuni uus on edukalt kontrollitud.
  router.post('/mockup/propose', async (req, res) => {
    const projectId = req.projectId;
    const story = focusStory(projectId);
    if (!story) return res.status(409).json({ error: 'Vali enne prioriteedi juures lugu, millest alustada.', code: 'no_focus' });
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab ettepanekut. Oota hetk.', code: 'in_progress' });
    const criteria = listCriteria(db, story.id).map((c) => c.text);
    const proposed = pendingFor(projectId, CRITERIA, story.id)?.payload.criteria ?? [];

    running.add(projectId);
    let data;
    try {
      ({ data } = await runAiTask(ai, {
        task: 'mockup',
        messages: buildMockupMessages(buildProjectContext(db, projectId), story, criteria.length ? criteria : proposed),
        schema: MOCKUP_ONLY_SCHEMA,
        check: (d) => checkMockup(d.mockup),
      }));
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    const old = findPendingProposal(db, projectId, MOCKUP);
    if (old) {
      try { rejectProposal(db, old.id, { projectId, kind: MOCKUP }); } catch (err) { if (!(err instanceof ProposalError)) throw err; }
    }
    createProposal(db, { projectId, kind: MOCKUP, payload: { storyId: story.id, message: data.message, mockup: data.mockup } });
    res.json(snapshot(projectId));
  });

  return router;
}
