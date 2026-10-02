import { Router } from 'express';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildReviewMessages, REVIEW_SCHEMA } from '../ai/tasks/review.js';
import { createProposal, findPendingProposal } from '../proposals.js';
import { listStories } from '../stories.js';
import { applyFinding, codeFindings, findingIsCurrent, KIND, mergeAiReview, ReviewError, selfCheckReview, undoFinding } from '../review.js';
import { mergeInfo, splitInfo } from '../stories.js';
import { listCriteria } from '../criteria.js';
import { txBegin, txCommit, txRollback } from '../db.js';
import { undoable } from '../undo.js';

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
      findings: p.payload.findings.map(({ undo, ...f }) => {
        const stale = f.status === 'open' && !findingIsCurrent(db, projectId, f);
        return {
          ...f,
          stories: f.storyIds.map((id) => ({ id, title: titles.get(id) ?? null })),
          stale,
          // L28: jagamise eelvaade (mis algse looga juhtub) ja tagasivõtmise võimalus. Enne-seisu brauserisse ei saadeta.
          splitInfo: f.type === 'too_large' && f.status === 'open' && !stale ? splitInfo(db, projectId, f.storyIds[0]) : undefined,
          // L29: ühendamise eelvaade (koht, mockup, seosed, alustamise lugu, MVP; mõlema mockup'i korral blocked).
          mergeInfo: f.type === 'overlap' && f.status === 'open' && !stale ? mergeInfo(db, projectId, f.suggestion.keepId, f.suggestion.removeId) : undefined,
          canUndo: f.status === 'applied' && Boolean(undo),
        };
      }),
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
        messages: buildReviewMessages(buildProjectContext(db, projectId), findings,
          listStories(db, projectId).flatMap((st) => listCriteria(db, st.id).map((c) => ({ storyId: st.id, id: c.id, text: c.text })))),
        schema: REVIEW_SCHEMA,
      });
      findings = mergeAiReview(db, projectId, findings, data);
      findings = await selfCheckReview(ai, db, projectId, findings); // L18: enesekontroll ei katkesta ülevaatust
      message = data.message;
      aiDone = true;
    } catch (err) {
      // AI tõrge ei peata ülevaatust: koodi leiud kuvatakse ikka, AI osa kohta on selge märge.
      aiNote = `${toHttpError(err).body.error} Leiti ainult rakenduse kontrollide leiud; liiga suuri ja kattuvaid lugusid ei kontrollitud.`;
    } finally {
      running.delete(projectId);
    }

    const sp = txBegin(db);
    try {
      db.prepare("UPDATE ai_proposals SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE project_id = ? AND kind = ? AND status = 'pending'")
        .run(projectId, KIND);
      createProposal(db, { projectId, kind: KIND, payload: { ai: aiDone, aiNote, message, findings } });
      txCommit(db, sp);
    } catch (err) {
      txRollback(db, sp);
      throw err;
    }
    res.json(snapshot(projectId));
  });

  const decide = (req, res, status, action, from = 'open') => {
    const projectId = req.projectId;
    const sp = txBegin(db);
    try {
      const p = findPendingProposal(db, projectId, KIND);
      const f = p?.payload.findings.find((x) => x.id === req.params.findingId);
      if (!f) throw new ReviewError(404, 'not_found', 'Leidu ei leitud. Käivita ülevaatus uuesti.');
      if (from === 'open' && f.status !== 'open') throw new ReviewError(409, 'already_decided', 'See leid on juba rakendatud või ignoreeritud.');
      const result = action(f);
      f.status = status;
      savePayload(p.id, p.payload);
      txCommit(db, sp);
      res.json({ ...snapshot(projectId), result });
    } catch (err) {
      txRollback(db, sp);
      if (!(err instanceof ReviewError)) throw err;
      res.status(err.status).json({ error: err.message, code: err.code, field: err.field });
    }
  };

  // body.value (valikuline) = „Muuda“ järel kasutaja muudetud väärtus; ilma selleta rakendatakse AI ettepanek.
  // L21: leiust tehtud jagamine (L28) ja ühendamine (L29) on toetatud muudatused; teised leiutüübid mitte.
  const applyLabel = (req) => {
    const f = findPendingProposal(db, req.projectId, KIND)?.payload.findings.find((x) => x.id === req.params.findingId);
    if (f?.status !== 'open') return null;
    const no = (id) => { const i = listStories(db, req.projectId).findIndex((st) => st.id === id); return i < 0 ? '?' : i + 1; };
    if (f.type === 'too_large') return `Jagasid loo ${no(f.storyIds[0])} kaheks (ülevaatuse leid)`;
    if (f.type === 'overlap') return `Ühendasid lood ${no(f.storyIds[0])} ja ${no(f.storyIds[1])} (ülevaatuse leid)`;
    return null;
  };
  router.post('/findings/:findingId/apply', undoable(db, applyLabel, (req, res) => decide(req, res, 'applied', (f) => applyFinding(db, req.projectId, f, req.body?.value))));
  router.post('/findings/:findingId/ignore', (req, res) => decide(req, res, 'ignored', () => 'Leid ignoreeriti. Backlog jäi muutmata.'));
  // L28/L29: ülevaatuse kaudu tehtud jagamise või ühendamise tagasivõtmine (ainult muutmata seisu korral).
  // L21: leiu enda tagasivõtmise järel ei saa sama muudatust enam üldise „Võta tagasi“ kaudu uuesti peale panna.
  router.post('/findings/:findingId/undo', (req, res) => decide(req, res, 'undone', (f) => {
    const result = undoFinding(db, req.projectId, f);
    db.prepare('DELETE FROM undo_journal WHERE project_id = ?').run(req.projectId);
    return result;
  }, 'applied'));

  return router;
}
