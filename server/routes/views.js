import { Router } from 'express';
import { checkCriterion, cleanCriterion, CRITERION_MAX } from '../../shared/criteria-check.js';
import { composeTitle } from '../../shared/story-format.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { selfCheckCriteria } from '../ai/tasks/criteria-fix.js';
import { resolveRef } from '../ai/tasks/criteria.js';
import { buildNewViewMessages, buildNewViewSchema, checkNewView, DESCRIPTION_MAX } from '../ai/tasks/new-view.js';
import { aiRef, appendCriteria, CRITERIA_MAX_COUNT, listCriteria, saveMockup } from '../criteria.js';
import { applyProposal, createProposal, findPendingProposal, getProposal, ProposalError, rejectProposal } from '../proposals.js';
import { listRoles } from '../roles.js';
import { appendStories, listStories, validateManualStory } from '../stories.js';
import { undoable } from '../undo.js';

const KIND = 'new_view';

class ViewError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// Uus vaade promptist (L24). /propose koostab AI ettepaneku (ootele, midagi ei salvestata); /apply („Lisa“) lisab kas uue
// loo koos mockup'i (vaade 1) ja kriteeriumidega või olemasolevale loole UUE vaate (vaade 1 jääb puutumata);
// /reject („Loobu“). Vaate number ja versioon arvutatakse /apply tehingu sees – klient neid ei määra.
export function viewsRouter({ db, ai }) {
  const router = Router({ mergeParams: true });
  const running = new Set();

  const publicProposal = (p) => ({
    id: p.id,
    demo: p.payload.demo === true, // käsitsi koostatud näidisettepanek, mitte AI vastus
    message: p.payload.message,
    description: p.payload.description,
    story: { ...p.payload.story, title: composeTitle(p.payload.story) },
    criteria: p.payload.criteria.map((c, index) => ({
      index, text: c.text, ref: c.ref, warnings: checkCriterion(c.text).map((w) => w.message), selfCheck: p.payload.selfCheck?.[String(index)] ?? null,
    })),
    mockup: p.payload.mockup,
  });
  const snapshot = (projectId) => {
    const p = findPendingProposal(db, projectId, KIND);
    return {
      proposal: p ? publicProposal(p) : null,
      stories: listStories(db, projectId).map((s, i) => ({ id: s.id, number: i + 1, title: s.title })), // sihtkoha valik
      roles: listRoles(db, projectId).map((r) => r.name), // „Muuda“ vormi rollisoovitused
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

  // L21: „Lisa“ on toetatud muudatus (tagasivõetav). AI propose ei ole.
  const applyLabel = (req) => {
    if (req.body?.target?.kind === 'story') {
      const i = listStories(db, req.projectId).findIndex((st) => st.id === Number(req.body.target.storyId));
      return `Lisasid loole ${i < 0 ? '?' : i + 1} uue vaate`;
    }
    return 'Lisasid uue vaate põhjal uue loo';
  };

  router.post('/propose', async (req, res) => {
    const projectId = req.projectId;
    const description = typeof req.body?.description === 'string' ? req.body.description.replace(/\s+/g, ' ').trim() : '';
    if (!description) return res.status(400).json({ error: 'Kirjelda uut vaadet.', field: 'description' });
    if (description.length > DESCRIPTION_MAX) return res.status(400).json({ error: `Kirjeldus võib olla kuni ${DESCRIPTION_MAX} märki.`, field: 'description' });
    if (findPendingProposal(db, projectId, KIND)) {
      return res.status(409).json({ error: 'Pooleli on uue vaate ettepanek – lisa see või loobu enne uut kirjeldust.', code: 'pending_exists' });
    }
    if (running.has(projectId)) return res.status(409).json({ error: 'AI juba koostab ettepanekut. Oota hetk.', code: 'in_progress' });

    running.add(projectId);
    let data;
    let selfCheck;
    try {
      const roleNames = listRoles(db, projectId).map((r) => r.name);
      ({ data } = await runAiTask(ai, {
        task: 'new_view',
        messages: buildNewViewMessages(buildProjectContext(db, projectId), description),
        schema: buildNewViewSchema(roleNames),
        check: checkNewView,
      }));
      // L18: kehtiva vastuse mittekontrollitavad kriteeriumid – üks ümbersõnastuse päring; tõrge ei katkesta ettepanekut.
      const check = await selfCheckCriteria(ai, {
        storyTitle: composeTitle(data.story),
        items: data.criteria.map((c, i) => ({ key: String(i), text: c.text, element: c.ref || null })),
      });
      data = { ...data, criteria: data.criteria.map((c, i) => ({ ...c, text: check.texts.get(String(i)) })) };
      selfCheck = check.marks;
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    createProposal(db, {
      projectId,
      kind: KIND,
      payload: {
        description,
        message: data.message,
        story: data.story,
        criteria: data.criteria.map((c) => ({ text: cleanCriterion(c.text), ref: resolveRef(c.ref, data.mockup) })),
        mockup: data.mockup,
        selfCheck,
      },
    });
    res.json(snapshot(projectId));
  });

  // Kasutaja kinnitatud kriteeriumid: raw = [{ index?, text }] („Muuda“) või AI ettepanek. index viitab ettepaneku
  // kriteeriumile (seos ja päritolu sealt); ilma indeksita kriteerium on käsitsi lisatud (seost pole).
  const criteriaFor = (payload, raw) => {
    const list = raw === undefined ? payload.criteria.map((c, index) => ({ index, text: c.text })) : raw;
    if (!Array.isArray(list) || list.length === 0) throw new ViewError(400, 'invalid_criteria', 'Lisa vähemalt üks kriteerium.', 'criteria');
    const seen = new Set();
    return list.map((c) => {
      const text = cleanCriterion(c?.text);
      if (!text) throw new ViewError(400, 'invalid_criteria', 'Kriteerium ei tohi olla tühi.', 'criteria');
      if (text.length > CRITERION_MAX) throw new ViewError(400, 'invalid_criteria', `Kriteerium võib olla kuni ${CRITERION_MAX} märki.`, 'criteria');
      const key = text.toLocaleLowerCase('et');
      if (seen.has(key)) throw new ViewError(400, 'duplicate_criterion', 'Sama kriteerium on kaks korda.', 'criteria');
      seen.add(key);
      const ai = Number.isInteger(c?.index) ? payload.criteria[c.index] : undefined;
      if (Number.isInteger(c?.index) && !ai) throw new ViewError(400, 'invalid_criteria', 'Kriteerium ei ole selles ettepanekus.', 'criteria');
      return { text, origin: !ai ? 'manual' : ai.text === text ? 'ai' : 'ai_edited', ref: ai ? ai.ref : null };
    });
  };

  router.post('/apply', undoable(db, applyLabel, (req, res) => {
    const projectId = req.projectId;
    const proposal = getProposal(db, String(req.body?.proposalId ?? ''));
    if (!proposal || proposal.projectId !== projectId || proposal.kind !== KIND) {
      return res.status(404).json({ error: 'Ettepanekut ei leitud.', code: 'not_found' });
    }
    const target = req.body?.target;
    let result;
    try {
      if (target?.kind !== 'new' && target?.kind !== 'story') throw new ViewError(400, 'invalid_target', 'Vali, kas lisada uus lugu või lisavaade olemasolevale loole.', 'target');
      const criteria = criteriaFor(proposal.payload, req.body?.criteria);
      applyProposal(db, proposal.id, (tx) => {
        const { mockup } = proposal.payload;
        let storyId;
        let viewNo;
        if (target.kind === 'new') {
          const ai = proposal.payload.story;
          const checked = validateManualStory({ ...ai, ...(req.body?.story ?? {}), touchesView: true });
          if (checked.error) throw new ViewError(400, 'invalid_story', checked.error, `story.${checked.field}`);
          const v = checked.value;
          const edited = ['role', 'rolePhrase', 'want', 'soThat', 'size'].some((k) => v[k] !== ai[k]);
          if (criteria.length > CRITERIA_MAX_COUNT) throw new ViewError(400, 'too_many_criteria', `Loos võib olla kuni ${CRITERIA_MAX_COUNT} kriteeriumi.`, 'criteria');
          appendStories(tx, projectId, [{ ...v, origin: edited ? 'ai_edited' : 'ai' }], proposal.id); // backlog'i lõppu, MVP joone alla
          storyId = tx.prepare('SELECT id FROM stories WHERE project_id = ? ORDER BY position DESC LIMIT 1').get(projectId).id;
          viewNo = 1;
        } else {
          storyId = Number(target.storyId);
          if (!tx.prepare('SELECT 1 FROM stories WHERE id = ? AND project_id = ?').get(storyId, projectId)) {
            throw new ViewError(404, 'not_found', 'Lugu ei leitud selle projekti backlog\'ist.', 'target');
          }
          const existing = listCriteria(tx, storyId).map((c) => c.text.toLocaleLowerCase('et'));
          const dup = criteria.find((c) => existing.includes(c.text.toLocaleLowerCase('et')));
          if (dup) throw new ViewError(400, 'duplicate_criterion', `Kriteerium „${dup.text}“ on selles loos juba olemas.`, 'criteria');
          if (existing.length + criteria.length > CRITERIA_MAX_COUNT) {
            throw new ViewError(400, 'too_many_criteria', `Loos on juba ${existing.length} kriteeriumi; kokku võib olla kuni ${CRITERIA_MAX_COUNT}.`, 'criteria');
          }
          // Uus vaade: järgmine vaate number; versioon tuleb saveMockup'ist (loo piires ühine) – vaade 1 jääb puutumata.
          viewNo = tx.prepare('SELECT COALESCE(MAX(view_no), 0) + 1 AS v FROM mockups WHERE story_id = ?').get(storyId).v;
        }
        const version = saveMockup(tx, storyId, mockup, viewNo);
        appendCriteria(tx, storyId, criteria.map((c) => ({ text: c.text, origin: c.origin, ref: aiRef(c.ref, version) })));
        result = { storyId, viewNo, version, created: target.kind === 'new' };
      }, { projectId, kind: KIND });
    } catch (err) {
      if (err instanceof ViewError || err instanceof ProposalError) return res.status(err.status).json({ error: err.message, code: err.code, field: err.field });
      throw err;
    }
    res.json({ ...snapshot(projectId), result });
  }));

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
