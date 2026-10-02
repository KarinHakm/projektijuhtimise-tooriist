import { Router } from 'express';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildReviewMessages, REVIEW_SCHEMA } from '../ai/tasks/review.js';
import { createProposal, findPendingProposal } from '../proposals.js';
import { listStories } from '../stories.js';
import { applyFinding, codeFindings, findingIsCurrent, KIND, mergeAiReview, ReviewError } from '../review.js';

// Backlog'i ülevaatus (L27). /run koostab leiud ega muuda backlog'i; /findings/:id/apply muudab ainult selle
// leiu loo; /findings/:id/ignore märgib leiu ignoreerituks (backlog muutumata).
// Kui AI pole kättesaadav, salvestatakse ainult koodi leiud ja põhjus, miks AI osa jäi tegemata.
export function reviewRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const publicReview = (projectId, p) => {
    const titles = new Map(listStories(db, projectId).map((s) => [s.id, s.title]));
    return {
      id: p.id,
      createdAt: p.createdAt,
      demo: p.payload.demo === true,
      ai: p.payload.ai,
      aiNote: p.payload.aiNote,
      message: p.payload.message,
      findings: p.payload.findings.map((f) => ({
        ...f,
        stories: f.storyIds.map((id) => ({ id, title: titles.get(id) ?? null })),
        stale: f.status === 'open' && !findingIsCurrent(db, projectId, f),
      })),
    };
  };
  const snapshot = (projectId) => {
    const p = findPendingProposal(db, projectId, KIND);
    return { review: p ? publicReview(projectId, p) : null, aiRunning: running.has(projectId) };
  };
  const savePayload = (id, payload) => db.prepare("UPDATE ai_proposals SET payload = ? WHERE id = ? AND status = 'pending'").run(JSON.stringify(payload), id);

  router.use((req, res, next) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    req.projectId = id;
    next();
  });

  router.get('/', (req, res) => res.json(snapshot(req.projectId)));

  router.post('/run', async (req, res) => {
    const projectId = req.projectId;
    if (listStories(db, projectId).length === 0) return res.status(409).json({ error: "Backlog'is pole lugusid, mida üle vaadata.", code: 'no_stories' });
    if (running.has(projectId)) return res.status(409).json({ error: 'Ülevaatus juba käib. Oota hetk.', code: 'in_progress' });

    running.add(projectId);
    let findings = codeFindings(db, projectId);
    let aiDone = false;
    let aiNote = null;
    let message = null;
    try {
      const { data } = await runAiTask(ai, {
        task: 'review',
        messages: buildReviewMessages(buildProjectContext(db, projectId), findings),
        schema: REVIEW_SCHEMA,
      });
      findings = mergeAiReview(db, projectId, findings, data);
      message = data.message;
      aiDone = true;
    } catch (err) {
      // AI tõrge ei peata ülevaatust: koodi leiud kuvatakse ikka, AI osa kohta on selge märge.
      aiNote = `${toHttpError(err).body.error} Leiti ainult rakenduse kontrollide leiud; liiga suuri ja kattuvaid lugusid ei kontrollitud.`;
    } finally {
      running.delete(projectId);
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE project_id = ? AND kind = ? AND status = 'pending'")
        .run(projectId, KIND);
      createProposal(db, { projectId, kind: KIND, payload: { ai: aiDone, aiNote, message, findings } });
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json(snapshot(projectId));
  });

  const decide = (req, res, status, action) => {
    const projectId = req.projectId;
    db.exec('BEGIN IMMEDIATE');
    try {
      const p = findPendingProposal(db, projectId, KIND);
      const f = p?.payload.findings.find((x) => x.id === req.params.findingId);
      if (!f) throw new ReviewError(404, 'not_found', 'Leidu ei leitud. Käivita ülevaatus uuesti.');
      if (f.status !== 'open') throw new ReviewError(409, 'already_decided', 'See leid on juba rakendatud või ignoreeritud.');
      const result = action(f);
      f.status = status;
      savePayload(p.id, p.payload);
      db.exec('COMMIT');
      res.json({ ...snapshot(projectId), result });
    } catch (err) {
      db.exec('ROLLBACK');
      if (!(err instanceof ReviewError)) throw err;
      res.status(err.status).json({ error: err.message, code: err.code, field: err.field });
    }
  };

  // body.value (valikuline) = „Muuda“ järel kasutaja muudetud väärtus; ilma selleta rakendatakse AI ettepanek.
  router.post('/findings/:findingId/apply', (req, res) => decide(req, res, 'applied', (f) => applyFinding(db, req.projectId, f, req.body?.value)));
  router.post('/findings/:findingId/ignore', (req, res) => decide(req, res, 'ignored', () => 'Leid ignoreeriti. Backlog jäi muutmata.'));

  return router;
}
