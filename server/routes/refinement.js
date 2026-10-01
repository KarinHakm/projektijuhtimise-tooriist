import { Router } from 'express';
import { cleanCriterion, CRITERION_MAX } from '../../shared/criteria-check.js';
import { analyzeConsistency } from '../../shared/consistency.js';
import { diffCriteria, diffMockup } from '../../shared/refine-diff.js';
import { validateStoryText } from '../../shared/story-format.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { buildRefineMessages, buildRefineSchema, checkRefine, CLARIFICATION_MAX } from '../ai/tasks/refine.js';
import { checkMockup, resolveRef } from '../ai/tasks/criteria.js';
import { aiRef, appendCriteria, consistencyFor, CRITERIA_MAX_COUNT, latestMockup, listCriteria, saveMockup } from '../criteria.js';
import { getFocusStoryId } from '../priority.js';
import { applyProposal, createProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { listStories } from '../stories.js';

const KIND = 'refinement';

class RefineError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const mockupSpec = (m) => (m ? { title: m.title, components: m.components } : null);

// Kliendi täpsustus (L11) ja ainult valitud loo muutmine (L12).
// AI ettepanek jääb ootele; rakendamisel muudetakse ühes transaktsioonis AINULT valitud loo ridu.
// Soovitused teistele lugudele on ainult tekst: neid ei salvestata andmemuudatusena ega rakendata.
export function refinementRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const storyOf = (projectId, storyId) => listStories(db, projectId).find((s) => s.id === storyId) ?? null;
  const currentState = (story) => ({
    want: story.want,
    soThat: story.soThat,
    // Viited on osa seisust: kui kasutaja seob kriteeriumi pärast ettepanekut ümber, on ettepanek aegunud.
    criteria: listCriteria(db, story.id).map((c) => ({ text: c.text, origin: c.origin, ref: c.ref })),
    mockup: latestMockup(db, story.id),
  });
  const sameState = (a, b) => JSON.stringify({ ...a, mockup: a.mockup?.version ?? null }) === JSON.stringify({ ...b, mockup: b.mockup?.version ?? null });

  const pendingFor = (projectId, storyId) => db
    .prepare("SELECT id FROM ai_proposals WHERE project_id = ? AND kind = ? AND status = 'pending' ORDER BY created_at DESC, rowid DESC")
    .all(projectId, KIND)
    .map((r) => getProposal(db, r.id))
    .find((p) => p.payload.storyId === storyId) ?? null;

  const publicProposal = (projectId, p) => {
    const { before, after } = p.payload;
    const titles = new Map(listStories(db, projectId).map((s) => [s.id, s.title]));
    return {
      id: p.id,
      demo: p.payload.demo === true, // käsitsi koostatud näidisettepanek (npm run demo), mitte AI vastus
      message: p.payload.message,
      clarification: p.payload.clarification,
      before: { want: before.want, soThat: before.soThat, criteria: before.criteria, mockup: before.mockup },
      after,
      preview: {
        storyChanged: before.want !== after.want || before.soThat !== after.soThat,
        criteria: diffCriteria(before.criteria, after.criteria),
        mockup: diffMockup(before.mockup, after.mockup),
        // Kooskõla vihjed uue seisu kohta (AI viited on nähtavad; hoiatusi need ei kustuta).
        consistency: analyzeConsistency(
          after.criteria.map((c) => ({ text: c.text, ref: aiRef(c.ref, 'uus') })),
          after.mockup ? { version: 'uus', components: after.mockup.components } : null,
        ),
      },
      // Ainult tekst: mitte ükski väli ei ole andmemuudatus teise loo jaoks.
      otherStories: p.payload.otherStories.map((o) => ({ storyId: o.storyId, title: titles.get(o.storyId) ?? null, suggestion: o.suggestion })),
    };
  };

  const snapshot = (projectId, storyId) => {
    const stories = listStories(db, projectId);
    const story = stories.find((s) => s.id === storyId) ?? null;
    if (!story) return { story: null, stories: stories.map((s) => ({ id: s.id, title: s.title })), aiRunning: running.has(projectId) };
    const proposal = pendingFor(projectId, story.id);
    const state = currentState(story);
    return {
      story: { id: story.id, title: story.title, rolePhrase: story.rolePhrase },
      criteria: state.criteria,
      mockup: state.mockup,
      consistency: consistencyFor(db, story.id),
      proposal: proposal ? publicProposal(projectId, proposal) : null,
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

  // ?storyId= valib täpsustatava loo; vaikimisi alustamise lugu. Lugemine ei muuda midagi.
  router.get('/', (req, res) => {
    const storyId = req.query.storyId !== undefined ? Number(req.query.storyId) : getFocusStoryId(db, req.projectId);
    res.json(snapshot(req.projectId, storyId));
  });

  router.post('/propose', async (req, res) => {
    const projectId = req.projectId;
    const storyId = req.body?.storyId;
    const story = Number.isInteger(storyId) ? storyOf(projectId, storyId) : null;
    if (!story) return res.status(404).json({ error: 'Lugu ei leitud selle projekti backlog\'ist.', code: 'not_found' });
    const clarification = typeof req.body?.clarification === 'string' ? req.body.clarification.trim() : '';
    if (!clarification) return res.status(400).json({ error: 'Kirjuta kliendi täpsustus.', field: 'clarification' });
    if (clarification.length > CLARIFICATION_MAX) return res.status(400).json({ error: `Täpsustus võib olla kuni ${CLARIFICATION_MAX} märki.`, field: 'clarification' });
    if (pendingFor(projectId, story.id)) {
      return res.status(409).json({ error: 'Sellel lool on pooleli muudatusettepanek – rakenda see või loobu enne uut täpsustust.', code: 'pending_exists' });
    }
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab ettepanekut. Oota hetk.', code: 'in_progress' });

    const before = currentState(story);
    const others = listStories(db, projectId).filter((s) => s.id !== story.id);
    const otherStoryIds = others.map((s) => s.id);
    running.add(projectId);
    let data;
    try {
      ({ data } = await runAiTask(ai, {
        task: 'refine',
        messages: buildRefineMessages(buildProjectContext(db, projectId), { title: story.title, ...before }, others, clarification),
        schema: buildRefineSchema(before.criteria.length, otherStoryIds),
        check: (d) => checkRefine(d, { rolePhrase: story.rolePhrase, criteriaCount: before.criteria.length, otherStoryIds }),
      }));
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    const story2 = validateStoryText({ rolePhrase: story.rolePhrase, want: data.story.want, soThat: data.story.soThat }).value;
    createProposal(db, {
      projectId,
      kind: KIND,
      payload: {
        storyId: story.id,
        clarification,
        message: data.message,
        before,
        after: {
          want: story2.want,
          soThat: story2.soThat,
          criteria: data.criteria.map((c) => ({ from: c.from, text: cleanCriterion(c.text), ref: resolveRef(c.ref, data.mockup) })),
          mockup: mockupSpec(data.mockup),
        },
        otherStories: data.otherStories,
      },
    });
    res.json(snapshot(projectId, story.id));
  });

  // [Rakenda]. Päring võib sisaldada ainult ettepaneku tunnust, valitud loo tunnust ja selle loo muudatusi ("Muuda").
  // Kõik, mis viitab teisele loole või on tundmatu, lükatakse tervikuna tagasi; midagi ei salvestata.
  router.post('/apply', (req, res) => {
    const projectId = req.projectId;
    const body = req.body ?? {};
    const proposal = getProposal(db, String(body.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== KIND) {
      return res.status(404).json({ error: 'Ettepanekut ei leitud.', code: 'not_found' });
    }
    const target = proposal.payload.storyId;
    const reject = (status, code, error) => res.status(status).json({ error, code });

    if (body.storyId !== target) return reject(409, 'other_story', 'Rakendamine on lubatud ainult ettepaneku loole; muudatust ei salvestatud.');
    if (Object.keys(body).some((k) => !['proposalId', 'storyId', 'changes'].includes(k))) {
      return reject(400, 'other_story', 'Päring sisaldab muid andmeid peale valitud loo muudatuse; muudatust ei salvestatud.');
    }
    const changes = body.changes ?? {};
    if (typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some((k) => !['want', 'soThat', 'criteria'].includes(k))) {
      return reject(400, 'other_story', 'Päring sisaldab muid andmeid peale valitud loo muudatuse; muudatust ei salvestatud.');
    }
    const { before, after } = proposal.payload;
    const criteriaIn = changes.criteria ?? after.criteria;
    if (!Array.isArray(criteriaIn)) return reject(400, 'invalid_changes', 'Kriteeriumid on vigased.');
    if (criteriaIn.some((c) => c && typeof c === 'object' && Object.keys(c).some((k) => !['from', 'text', 'ref'].includes(k)))) {
      return reject(400, 'other_story', 'Päring sisaldab muid andmeid peale valitud loo muudatuse; muudatust ei salvestatud.');
    }

    const story = storyOf(projectId, target);
    if (!story) return reject(404, 'not_found', 'Lugu ei leitud.');
    const text = validateStoryText({ rolePhrase: story.rolePhrase, want: changes.want ?? after.want, soThat: changes.soThat ?? after.soThat });
    if (text.errors.length) return reject(400, 'invalid_changes', text.errors[0].message);
    if (criteriaIn.length === 0 || criteriaIn.length > CRITERIA_MAX_COUNT) return reject(400, 'invalid_changes', `Kriteeriume peab olema 1–${CRITERIA_MAX_COUNT}.`);

    const aiTexts = new Set(after.criteria.map((c) => c.text));
    const seenFrom = new Set();
    const seenText = new Set();
    const criteria = [];
    for (const c of criteriaIn) {
      const t = cleanCriterion(c?.text);
      const from = Number.isInteger(c?.from) ? c.from : -1;
      if (!t || t.length > CRITERION_MAX) return reject(400, 'invalid_changes', 'Kriteerium on tühi või liiga pikk.');
      if (seenText.has(t.toLocaleLowerCase('et'))) return reject(400, 'invalid_changes', 'Sama kriteerium on kaks korda.');
      seenText.add(t.toLocaleLowerCase('et'));
      if (from >= before.criteria.length || (from >= 0 && seenFrom.has(from))) return reject(400, 'invalid_changes', 'Vigane viide kriteeriumile.');
      if (from >= 0) seenFrom.add(from);
      let origin;
      if (from >= 0 && cleanCriterion(before.criteria[from].text) === t) origin = before.criteria[from].origin;
      else if (proposal.payload.demo === true) origin = 'manual'; // näidisettepanek on käsitsi koostatud, mitte AI
      else if (from >= 0) origin = 'ai_edited';
      else origin = aiTexts.has(t) ? 'ai' : 'ai_edited';
      const ref = Number.isInteger(c?.ref) && c.ref >= -1 && c.ref < after.mockup.components.length ? c.ref : null;
      criteria.push({ text: t, origin, ref });
    }
    if (checkMockup(after.mockup).length) return reject(400, 'invalid_changes', 'Mockup on vigane; muudatust ei salvestatud.');

    try {
      applyProposal(db, proposal.id, (tx) => {
        const now = currentState(storyOf(projectId, target));
        if (!sameState(now, before)) throw new RefineError(409, 'stale', 'Lugu on pärast ettepanekut muutunud. Loobu ja koosta uus täpsustus.');
        const { changes: n } = tx
          .prepare("UPDATE stories SET want = ?, so_that = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND project_id = ?")
          .run(text.value.want, text.value.soThat, target, projectId);
        if (n !== 1) throw new RefineError(404, 'not_found', 'Lugu ei leitud.');
        const version = JSON.stringify(mockupSpec(before.mockup)) !== JSON.stringify(after.mockup)
          ? saveMockup(tx, target, after.mockup)
          : before.mockup.version;
        tx.prepare('DELETE FROM criteria WHERE story_id = ?').run(target);
        // AI viited uue mockup'i kohta; viidete kontroll tehakse rakendamisel uuesti (vihjed arvutatakse lugemisel).
        appendCriteria(tx, target, criteria.map((c) => ({ text: c.text, origin: c.origin, ref: aiRef(c.ref, version) })));
      }, { projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError || err instanceof RefineError) return reject(err.status, err.code, err.message);
      throw err;
    }
    res.json(snapshot(projectId, target));
  });

  // [Loobu]: lugu, kriteeriumid ja mockup jäävad muutmata.
  router.post('/reject', (req, res) => {
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    try {
      rejectProposal(db, String(req.body?.proposalId ?? ''), { projectId: req.projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
    res.json(snapshot(req.projectId, proposal.payload.storyId));
  });

  return router;
}
