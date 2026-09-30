import { Router } from 'express';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildClarifyMessages, checkClarify, CLARIFY_SCHEMA } from '../ai/tasks/clarify.js';
import {
  addMessage, countAskedQuestions, findIdea, getMessage, latestQuestions, listMessages, pendingUserMessage, replyTo,
} from '../conversation.js';

const IDEA_MAX = 2000;
const OTHER_MAX = 500;

// Juhitud vestluse marsruudid (L04). Kõik kordused on idempotentsed: sama idee või samad vastused
// ei lisa uut rida ja AI-d kutsutakse ainult siis, kui viimasel kasutaja sõnumil vastus puudub.
export function conversationRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set(); // projektid, mille AI-kutse käib praegu

  const snapshot = (projectId) => ({ messages: listMessages(db, projectId), aiRunning: running.has(projectId) });

  router.use((req, res, next) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    req.projectId = id;
    next();
  });

  router.get('/', (req, res) => res.json(snapshot(req.projectId)));

  router.post('/idea', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Kirjelda ideed vähemalt ühe lausega.', field: 'text' });
    if (text.length > IDEA_MAX) return res.status(400).json({ error: `Idee võib olla kuni ${IDEA_MAX} märki.`, field: 'text' });

    let idea = findIdea(db, req.projectId);
    if (!idea) idea = addMessage(db, { projectId: req.projectId, role: 'user', kind: 'idea', content: { text } }) ?? findIdea(db, req.projectId);
    if (idea.content.text !== text) return res.status(409).json({ error: 'Selle projekti vestlus on juba alustatud.', code: 'already_started' });
    await respondWithAi(req.projectId, res);
  });

  router.post('/answers', async (req, res) => {
    const questionsMessageId = Number(req.body?.questionsMessageId);
    const questions = getMessage(db, req.projectId, questionsMessageId);
    if (!questions || questions.kind !== 'questions') return res.status(400).json({ error: 'Küsimusi ei leitud.', code: 'unknown_questions' });
    if (latestQuestions(db, req.projectId).id !== questions.id) return res.status(409).json({ error: 'Need küsimused on juba aegunud.', code: 'stale_questions' });

    const result = normalizeAnswers(questions.content.questions, req.body?.answers);
    if (result.error) return res.status(400).json({ error: result.error, code: 'invalid_answers' });

    const existing = replyTo(db, questions.id);
    if (existing && JSON.stringify(existing.content.answers) !== JSON.stringify(result.answers)) {
      return res.status(409).json({ error: 'Nendele küsimustele on juba vastatud.', code: 'already_answered' });
    }
    if (!existing) addMessage(db, { projectId: req.projectId, role: 'user', kind: 'answers', content: { answers: result.answers }, replyTo: questions.id });
    await respondWithAi(req.projectId, res);
  });

  router.post('/continue', async (req, res) => {
    await respondWithAi(req.projectId, res);
  });

  // Käivitab AI ainult siis, kui viimasel kasutaja sõnumil vastus puudub. Vastus salvestatakse
  // ka siis, kui brauser on vahepeal ühenduse katkestanud.
  async function respondWithAi(projectId, res) {
    const pending = pendingUserMessage(db, projectId);
    if (!pending) return res.json(snapshot(projectId));
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab vastust. Oota hetk.', code: 'in_progress' });

    running.add(projectId);
    try {
      const asked = countAskedQuestions(db, projectId);
      const context = buildProjectContext(db, projectId);
      const { data } = await runAiTask(ai, {
        task: 'clarify',
        messages: buildClarifyMessages(context, { asked }),
        schema: CLARIFY_SCHEMA,
        check: (d) => checkClarify(d, { asked }),
      });
      if (data.questions.length > 0) {
        const questions = data.questions.map((q, i) => ({ id: `k${asked + i + 1}`, ...q }));
        addMessage(db, { projectId, role: 'assistant', kind: 'questions', content: { message: data.message, questions }, replyTo: pending.id });
      } else {
        addMessage(db, { projectId, role: 'assistant', kind: 'summary', content: { message: data.message, summary: data.summary }, replyTo: pending.id });
      }
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    res.json(snapshot(projectId));
  }

  return router;
}

// Kontrollib vastuseid küsimuste vastu ja viib need ühtsele kujule (sama järjekord kui küsimustel).
function normalizeAnswers(questions, raw) {
  if (!Array.isArray(raw)) return { error: 'Vastused puuduvad.' };
  const byId = new Map(raw.map((a) => [a?.questionId, a]));
  if (byId.size !== raw.length || raw.length !== questions.length) return { error: 'Igale küsimusele peab olema täpselt üks vastus.' };

  const answers = [];
  for (const q of questions) {
    const a = byId.get(q.id);
    if (!a) return { error: 'Igale küsimusele peab olema täpselt üks vastus.' };
    if (a.skipped === true) {
      answers.push({ questionId: q.id, selected: [], other: null, skipped: true });
      continue;
    }
    const selected = Array.isArray(a.selected) ? a.selected : [];
    if (selected.some((s) => !q.options.includes(s)) || new Set(selected).size !== selected.length) {
      return { error: 'Valitud variant ei ole pakutud variantide seas.' };
    }
    let other = null;
    if (a.other != null) {
      if (typeof a.other !== 'string' || !a.other.trim()) return { error: 'Kirjuta oma vastus või vali mõni variant.' };
      if (a.other.trim().length > OTHER_MAX) return { error: `Oma vastus võib olla kuni ${OTHER_MAX} märki.` };
      other = a.other.trim();
    }
    const count = selected.length + (other ? 1 : 0);
    if (count === 0) return { error: 'Vali vastus, kirjuta oma vastus või jäta küsimus vahele.' };
    if (!q.multiSelect && count > 1) return { error: 'Sellele küsimusele saab valida ainult ühe vastuse.' };
    answers.push({ questionId: q.id, selected: q.options.filter((o) => selected.includes(o)), other, skipped: false });
  }
  return { answers };
}
