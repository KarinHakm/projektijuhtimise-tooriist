import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { composeTitle, validateStoryText } from '../../shared/story-format.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildStoriesMessages, buildStoriesSchema, checkStories } from '../ai/tasks/stories.js';
import { applyProposal, findPendingProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { getFocusStoryId } from '../priority.js';
import { listRoles } from '../roles.js';
import {
  appendStories, createManualStory, deleteManualStory, deletionImpact, listStories, moveStory, updateManualStory, validateApply, validateManualStory,
} from '../stories.js';
import { withReadiness } from '../readiness.js';
import { dorMissing, READY, STORY_STATUSES } from '../../shared/dor.js';

const QUESTION_MAX = 300;

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

  // Kuvatav MVP joone koht: salvestatud väärtus piiratakse lugude arvuga. Lugemine andmebaasi ei muuda.
  const shownMvpCount = (projectId) => {
    const stored = db.prepare('SELECT mvp_count AS n FROM projects WHERE id = ?').get(projectId)?.n ?? null;
    if (stored === null) return null;
    const total = db.prepare('SELECT COUNT(*) AS n FROM stories WHERE project_id = ?').get(projectId).n;
    return Math.min(stored, total);
  };

  const snapshot = (projectId) => {
    const proposal = findPendingProposal(db, projectId, KIND);
    return {
      stories: withReadiness(db, listStories(db, projectId)), // L19/L20: avatud küsimused ja valmisolek
      focusStoryId: getFocusStoryId(db, projectId), // L08: backlog'is märge "Alustame sellest"
      mvpCount: shownMvpCount(projectId), // L17: null = joont pole
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

  // L15: lugude käsitsi lisamine, muutmine ja kustutamine. Ei kasuta AI-d.
  router.post('/', (req, res) => {
    const result = validateManualStory(req.body);
    if (result.error) return res.status(400).json({ error: result.error, field: result.field, code: 'invalid_story' });
    const id = createManualStory(db, req.projectId, result.value);
    res.status(201).json({ ...snapshot(req.projectId), createdId: id });
  });

  router.put('/:storyId', (req, res) => {
    const storyId = Number(req.params.storyId);
    const result = validateManualStory(req.body);
    if (!Number.isInteger(storyId) || !storyIn(req.projectId, storyId)) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    if (result.error) return res.status(400).json({ error: result.error, field: result.field, code: 'invalid_story' });
    updateManualStory(db, req.projectId, storyId, result.value);
    res.json(snapshot(req.projectId));
  });

  // Mida kustutamine kaasa toob (kinnituse jaoks). Ainult lugemine.
  router.get('/:storyId/delete-impact', (req, res) => {
    const impact = deletionImpact(db, req.projectId, Number(req.params.storyId));
    if (!impact) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    res.json(impact);
  });

  router.delete('/:storyId', (req, res) => {
    const impact = deleteManualStory(db, req.projectId, Number(req.params.storyId));
    if (!impact) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    res.json({ ...snapshot(req.projectId), deleted: impact });
  });

  // L17: MVP joone koht (count = mitu lugu on joonest ülalpool, 0…lugude arv) või null (joon eemaldatakse).
  router.post('/mvp', (req, res) => {
    const count = req.body?.count;
    const total = db.prepare('SELECT COUNT(*) AS n FROM stories WHERE project_id = ?').get(req.projectId).n;
    if (count !== null && !(Number.isInteger(count) && count >= 0 && count <= total)) {
      return res.status(400).json({ error: `MVP joone koht peab olema 0–${total} või joon eemaldatakse.`, code: 'invalid_mvp' });
    }
    db.prepare("UPDATE projects SET mvp_count = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(count, req.projectId);
    res.json(snapshot(req.projectId));
  });

  // L19/L20: staatus, valmisolek ja avatud küsimused. Käsitsi tegevused, töötavad ka ilma AI-ta.
  const storyIn = (projectId, raw) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return null;
    return withReadiness(db, listStories(db, projectId).filter((s) => s.id === id))[0] ?? null;
  };
  const touch = "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

  // Staatuse muutmine. „Valmis arenduseks“ ainult siis, kui DoR on täidetud; muidu 409 koos puuduste loendiga.
  router.post('/:storyId/status', (req, res) => {
    const story = storyIn(req.projectId, req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    const status = req.body?.status;
    if (!STORY_STATUSES.includes(status)) return res.status(400).json({ error: 'Tundmatu staatus.', code: 'invalid_status' });
    if (status === READY && !story.readiness.ok) {
      const missing = dorMissing(story.readiness);
      return res.status(409).json({ error: `Lugu ei vasta valmisoleku definitsioonile: ${missing.join('; ')}.`, code: 'not_ready', missing });
    }
    db.prepare(`UPDATE stories SET status = ?, ${touch} WHERE id = ? AND project_id = ?`).run(status, story.id, req.projectId);
    res.json(snapshot(req.projectId));
  });

  // Avatud küsimuse lisamine: lugu saab staatuse „Vajab täpsustamist“ (ka siis, kui see oli valmis).
  router.post('/:storyId/questions', (req, res) => {
    const story = storyIn(req.projectId, req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    const text = typeof req.body?.text === 'string' ? req.body.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) return res.status(400).json({ error: 'Kirjuta küsimus.', field: 'text' });
    if (text.length > QUESTION_MAX) return res.status(400).json({ error: `Küsimus võib olla kuni ${QUESTION_MAX} märki.`, field: 'text' });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO story_questions (story_id, text) VALUES (?, ?)').run(story.id, text);
      db.prepare(`UPDATE stories SET status = 'vajab_tapsustamist', ${touch} WHERE id = ?`).run(story.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json(snapshot(req.projectId));
  });

  // Küsimus vastatuks. Staatust ei muudeta: „Valmis arenduseks“ määrab kasutaja ise.
  router.post('/:storyId/questions/:questionId/resolve', (req, res) => {
    const story = storyIn(req.projectId, req.params.storyId);
    const question = story?.questions.find((q) => q.id === Number(req.params.questionId));
    if (!question) return res.status(404).json({ error: 'Küsimust ei leitud.', code: 'not_found' });
    if (question.resolvedAt) return res.status(409).json({ error: 'Küsimus on juba vastatud.', code: 'already_resolved' });
    db.prepare("UPDATE story_questions SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND resolved_at IS NULL").run(question.id);
    res.json(snapshot(req.projectId));
  });

  return router;
}
