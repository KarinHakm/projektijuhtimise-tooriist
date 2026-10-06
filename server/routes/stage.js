import { Router } from 'express';
import { STAGE_KEYS } from '../../shared/stage.js';
import { stageFor, stageState } from '../stage.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildNextStepMessages, buildNextStepSchema, checkNextStep, NEXT_TEXT_MAX } from '../ai/tasks/next-step.js';

// Projekti etapp ja soovitatud järgmised sammud (L13, L14). GET ainult loeb. POST /skip ja /active salvestavad ainult
// etapi märke (vahele jäetud etapid, aktiivne etapp): need ei muuda backlog'i, ei leevenda eeldusi ega kutsu AI-d.
// POST /next: „Mida teeme edasi?“ vabatekst – AI valib ühe praegu lubatud sammu; andmeid ei muudeta.
export function stageRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  // Lubatud sammud: praegused järgmised sammud ja iga avatav etapp (selle kaardi juurde minek).
  const candidatesFor = (projectId) => {
    const stage = stageFor(db, projectId);
    const steps = stage.steps.map((s) => ({ id: s.id, label: s.label, card: s.card, focus: s.focus, ai: s.ai }));
    const stages = stage.stages.filter((s) => s.selectable && s.card)
      .map((s) => ({ id: `stage:${s.key}`, label: `Ava etapp „${s.label}“`, card: s.card, focus: null, ai: false }));
    return [...steps, ...stages];
  };

  router.use((req, res, next) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    req.projectId = id;
    next();
  });

  const stageOf = (req, res) => {
    const key = req.body?.key;
    if (!STAGE_KEYS.includes(key)) {
      res.status(400).json({ error: 'Tundmatu etapp.', code: 'invalid_stage' });
      return null;
    }
    return stageFor(db, req.projectId).stages.find((s) => s.key === key);
  };
  const save = (projectId, skipped, active) => db
    .prepare("UPDATE projects SET skipped_stages = ?, active_stage = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .run(JSON.stringify(skipped), active, projectId);

  router.get('/', (req, res) => res.json(stageFor(db, req.projectId)));

  // „Jäta vahele“: ainult aktiivne või soovitatud, veel tegemata ja mitte-lukus etapp.
  router.post('/skip', (req, res) => {
    const stage = stageOf(req, res);
    if (!stage) return undefined;
    if (!stage.skippable) {
      return res.status(409).json({ error: `Etappi „${stage.label}“ ei saa praegu vahele jätta – vahele saab jätta ainult aktiivse või soovitatud, veel tegemata ja eeldustega etapi.`, code: 'not_skippable' });
    }
    const { skipped } = stageState(db, req.projectId);
    save(req.projectId, [...new Set([...skipped, stage.key])], null);
    res.json(stageFor(db, req.projectId));
  });

  // Etapi juurde minek ribal (ka tagasiminek): salvestab aktiivse etapi; vahele jäetud etapp ei ole enam vahele jäetud.
  router.post('/active', (req, res) => {
    const stage = stageOf(req, res);
    if (!stage) return undefined;
    if (!stage.selectable) return res.status(409).json({ error: `Etapp „${stage.label}“ on lukus: ${stage.reason}`, code: 'blocked' });
    const { skipped } = stageState(db, req.projectId);
    save(req.projectId, skipped.filter((k) => k !== stage.key), stage.key);
    res.json(stageFor(db, req.projectId));
  });

  router.post('/next', async (req, res) => {
    const projectId = req.projectId;
    const text = typeof req.body?.text === 'string' ? req.body.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) return res.status(400).json({ error: 'Kirjuta, mida soovid edasi teha.', field: 'text' });
    if (text.length > NEXT_TEXT_MAX) return res.status(400).json({ error: `Tekst võib olla kuni ${NEXT_TEXT_MAX} märki.`, field: 'text' });
    const candidates = candidatesFor(projectId);
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba tõlgendab sinu soovi. Oota hetk.', code: 'in_progress' });
    const ids = candidates.map((c) => c.id);
    running.add(projectId);
    try {
      const { data } = await runAiTask(ai, {
        task: 'next-step',
        messages: buildNextStepMessages(buildProjectContext(db, projectId), candidates, text),
        schema: buildNextStepSchema(ids),
        check: (d) => checkNextStep(d, ids),
      });
      const step = candidates.find((c) => c.id === data.stepId);
      res.json({ message: data.message, step, note: data.note.replace(/\s+/g, ' ').trim() });
    } catch (err) {
      const { status, body } = toHttpError(err);
      res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
  });

  return router;
}
