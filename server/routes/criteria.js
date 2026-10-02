import { Router } from 'express';
import { checkCriterion } from '../../shared/criteria-check.js';
import { runAiTask } from '../ai/run.js';
import { toHttpError } from '../ai/errors.js';
import { buildProjectContext } from '../ai/context.js';
import { selfCheckCriteria } from '../ai/tasks/criteria-fix.js';
import {
  buildCriteriaMessages, buildMockupMessages, checkCriteria, checkMockup, CRITERIA_SCHEMA, MOCKUP_ONLY_SCHEMA, resolveRef,
} from '../ai/tasks/criteria.js';
import {
  aiRef, appendCriteria, consistencyFor, CRITERIA_MAX_COUNT, latestMockup, listCriteria, listMockupVersions, restoreMockup, saveMockup, validateCriteriaSave,
} from '../criteria.js';
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
      mockupVersions: listMockupVersions(db, story.id).slice(1), // L22: varasemad versioonid (uusim on "mockup")
      criteriaProposal: cp
        ? {
          id: cp.id,
          demo: cp.payload.demo === true, // käsitsi koostatud näidisettepanek, mitte AI vastus
          message: cp.payload.message,
          criteria: cp.payload.criteria.map((text, index) => ({
            index, text, ref: cp.payload.refs?.[index] ?? null, warnings: checkCriterion(text).map((w) => w.message), selfCheck: cp.payload.selfCheck?.[index] ?? null,
          })),
        }
        : null,
      consistency: consistencyFor(db, story.id),
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
      // L18: kehtiva vastuse mittekontrollitavad kriteeriumid – üks ümbersõnastuse päring; tõrge ei katkesta ettepanekut.
      const check = await selfCheckCriteria(ai, {
        storyTitle: story.title,
        items: data.criteria.map((c, i) => ({ key: String(i), text: c.text, element: c.ref || null })),
      });
      data = { ...data, criteria: data.criteria.map((c, i) => ({ ...c, text: check.texts.get(String(i)) })), selfCheck: check.marks };
    } catch (err) {
      const { status, body } = toHttpError(err);
      return res.status(status).json(body);
    } finally {
      running.delete(projectId);
    }
    rejectStale(projectId, CRITERIA, story.id);
    rejectStale(projectId, MOCKUP, story.id);
    const criteriaProposal = createProposal(db, {
      projectId,
      kind: CRITERIA,
      payload: {
        storyId: story.id, message: data.message, criteria: data.criteria.map((c) => c.text), refs: data.criteria.map((c) => resolveRef(c.ref, data.mockup)),
        selfCheck: data.selfCheck, // L18: { indeks: { status, from?, warnings } }
      },
    });
    if (!latestMockup(db, story.id) && !pendingFor(projectId, MOCKUP, story.id)) {
      // Kriteeriumide viited (L23) käivad selle mockup'i komponentide kohta.
      createProposal(db, { projectId, kind: MOCKUP, payload: { storyId: story.id, message: data.message, mockup: data.mockup, criteriaProposalId: criteriaProposal.id } });
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
    // L15: loole võis vahepeal käsitsi kriteeriume lisanduda – kordust ega 10 piiri ületamist ei lisata.
    // Ettepanek jääb ootele (kasutaja saab valikut muuta).
    const existing = listCriteria(db, proposal.payload.storyId);
    const dup = selection.criteria.find((c) => existing.some((e) => e.text.toLocaleLowerCase('et') === c.text.toLocaleLowerCase('et')));
    if (dup) return res.status(400).json({ error: `Kriteerium „${dup.text}“ on selles loos juba olemas. Eemalda see valikust.`, code: 'duplicate_criterion' });
    if (existing.length + selection.criteria.length > CRITERIA_MAX_COUNT) {
      return res.status(400).json({
        error: `Loos on juba ${existing.length} kriteeriumi; kokku võib olla kuni ${CRITERIA_MAX_COUNT}. Vali kuni ${Math.max(0, CRITERIA_MAX_COUNT - existing.length)}.`,
        code: 'too_many_criteria',
      });
    }
    try {
      applyProposal(db, proposal.id, (tx) => {
        const exists = tx.prepare('SELECT 1 FROM stories WHERE id = ? AND project_id = ?').get(proposal.payload.storyId, projectId);
        if (!exists) throw new ProposalError('not_found');
        // AI viited: kui seotud mockup on juba kinnitatud, saab viide selle versiooni; kui ootel, määratakse
        // versioon mockup'i kinnitamisel; kui mockup'ist loobuti, elemendiviidet ei salvestata.
        const linked = tx.prepare("SELECT status FROM ai_proposals WHERE kind = 'mockup' AND json_extract(payload, '$.criteriaProposalId') = ?").get(proposal.id);
        const version = linked?.status === 'applied' ? latestMockup(tx, proposal.payload.storyId)?.version ?? null : null;
        const refs = proposal.payload.refs ?? [];
        const rows = selection.criteria.map((c) => {
          const ref = c.index !== undefined ? aiRef(refs[c.index], version) : null;
          const usable = ref && (ref.kind === 'no_view' || linked?.status !== 'rejected');
          return { ...c, ref: usable ? ref : null };
        });
        appendCriteria(tx, proposal.payload.storyId, rows);
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
        const version = saveMockup(tx, proposal.payload.storyId, proposal.payload.mockup);
        if (proposal.payload.criteriaProposalId) {
          // Selle mockup'iga koos pakutud AI viited saavad nüüd versiooni.
          tx.prepare("UPDATE criteria SET ref_version = ? WHERE story_id = ? AND ref_kind = 'element' AND ref_version IS NULL AND ref_source = 'ai'")
            .run(version, proposal.payload.storyId);
        } else {
          // "Paku uus" mockup: varasemad AI viited ei käi selle kohta – seos puudub, hoiatus jääb nähtavaks.
          tx.prepare("UPDATE criteria SET ref_kind = NULL, ref_index = NULL, ref_version = NULL, ref_source = NULL WHERE story_id = ? AND ref_kind = 'element' AND ref_version IS NULL")
            .run(proposal.payload.storyId);
        }
      }, { projectId, kind: MOCKUP });
    } catch (err) {
      return fail(res, err);
    }
    res.json(snapshot(projectId));
  });

  // L22: varasema versiooni taastamine. Luuakse uus versioon; vana ajalugu jääb alles ja kooskõla ülevaatus aegub
  // (ülevaatuse sõrmejälg sisaldab mockup'i versiooni). Ainult alustamise loole, AI-d ei kasutata.
  router.post('/mockup/restore', (req, res) => {
    const projectId = req.projectId;
    const story = focusStory(projectId);
    if (!story || req.body?.storyId !== story.id) {
      return res.status(409).json({ error: 'Taastada saab ainult alustamise loo mockup\'i. Värskenda lehte.', code: 'not_focus' });
    }
    const version = req.body?.version;
    const versions = listMockupVersions(db, story.id);
    if (!Number.isInteger(version) || !versions.some((v) => v.version === version)) {
      return res.status(404).json({ error: 'Sellist mockup\'i versiooni ei leitud.', code: 'not_found' });
    }
    if (version === versions[0].version) return res.status(409).json({ error: 'See on juba praegune versioon.', code: 'already_current' });
    db.exec('BEGIN IMMEDIATE');
    let created;
    try {
      created = restoreMockup(db, story.id, version);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json({ ...snapshot(projectId), restored: { from: version, to: created } });
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

  // Kasutaja seob kriteeriumi mockup'i elemendiga või märgib "ei puuduta vaadet" (L23). Muudab ainult selle kriteeriumi viidet.
  router.post('/link', (req, res) => {
    const projectId = req.projectId;
    const { criterionId, kind, index } = req.body ?? {};
    const row = Number.isInteger(criterionId) && db
      .prepare('SELECT c.id, c.story_id AS storyId FROM criteria c JOIN stories s ON s.id = c.story_id WHERE c.id = ? AND s.project_id = ?')
      .get(criterionId, projectId);
    if (!row) return res.status(404).json({ error: 'Kriteeriumit ei leitud.', code: 'not_found' });
    const mockup = latestMockup(db, row.storyId);
    let values;
    if (kind === 'element') {
      if (!mockup || !Number.isInteger(index) || index < 0 || index >= mockup.components.length) {
        return res.status(400).json({ error: 'Valitud elementi ei ole kehtivas mockup\'is.', code: 'invalid_link' });
      }
      values = ['element', index, mockup.version, 'user'];
    } else if (kind === 'no_view') values = ['no_view', null, null, 'user'];
    else if (kind === 'none') values = [null, null, null, null];
    else return res.status(400).json({ error: 'Vigane seos.', code: 'invalid_link' });
    db.prepare('UPDATE criteria SET ref_kind = ?, ref_index = ?, ref_version = ?, ref_source = ? WHERE id = ?').run(...values, row.id);
    res.json(snapshot(projectId));
  });

  // "Vaatasin üle": kasutaja kinnitab, et vaatas selle seisu ise üle. See ei ole automaatne tõend kooskõla kohta
  // ja aegub, kui kriteeriumid, viited või mockup muutuvad (sõrmejälg ei klapi enam).
  router.post('/review', (req, res) => {
    const projectId = req.projectId;
    const story = focusStory(projectId);
    if (!story || req.body?.storyId !== story.id) return res.status(404).json({ error: 'Lugu ei leitud.', code: 'not_found' });
    const current = consistencyFor(db, story.id);
    if (req.body?.fingerprint !== current.fingerprint) {
      return res.status(409).json({ error: 'Kriteeriumid või mockup muutusid vahepeal. Vaata uus seis üle.', code: 'stale_review' });
    }
    const mockup = latestMockup(db, story.id);
    db.prepare('UPDATE stories SET consistency_review = ? WHERE id = ?')
      .run(JSON.stringify({ fingerprint: current.fingerprint, mockupVersion: mockup?.version ?? null, at: new Date().toISOString() }), story.id);
    res.json(snapshot(projectId));
  });

  return router;
}
