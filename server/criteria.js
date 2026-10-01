// Loo kriteeriumid (L09) ja kinnitatud mockup'id (L10). Siia jõuab ainult kasutaja kinnitatu.
import { CRITERION_MAX, checkCriterion, cleanCriterion } from '../shared/criteria-check.js';
import { analyzeConsistency, reviewFingerprint } from '../shared/consistency.js';

export const CRITERIA_MAX_COUNT = 10;

export function listCriteria(db, storyId) {
  return db
    .prepare(`SELECT id, position, text, origin, ref_kind AS refKind, ref_index AS refIndex, ref_version AS refVersion, ref_source AS refSource
              FROM criteria WHERE story_id = ? ORDER BY position`)
    .all(storyId)
    .map(({ refKind, refIndex, refVersion, refSource, ...r }) => ({
      ...r,
      ref: refKind ? { kind: refKind, index: refIndex, version: refVersion, source: refSource } : null,
      warnings: checkCriterion(r.text).map((w) => w.message),
    }));
}

export function latestMockup(db, storyId) {
  const row = db.prepare('SELECT version, spec, created_at AS createdAt FROM mockups WHERE story_id = ? ORDER BY version DESC LIMIT 1').get(storyId);
  return row ? { version: row.version, createdAt: row.createdAt, ...JSON.parse(row.spec) } : null;
}

// Kontrollib salvestatavaid kriteeriume ettepaneku vastu. raw = [{ index?, text }]:
// index viitab ettepaneku kriteeriumile, ilma indeksita kriteerium on käsitsi lisatud.
// Päritolu määrab server. Brauser saadab ainult kinnitatud või muudetud kriteeriumid;
// eemaldatud kriteeriumi siin ei ole, seega seda ei salvestata. Tagastab { criteria } või { error }.
export function validateCriteriaSave(raw, proposed) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Vali vähemalt üks kriteerium.' };
  if (raw.length > CRITERIA_MAX_COUNT) return { error: `Kriteeriume võib olla kuni ${CRITERIA_MAX_COUNT}.` };
  const seenIndex = new Set();
  const seenText = new Set();
  const criteria = [];
  for (const c of raw) {
    const text = cleanCriterion(c?.text);
    if (!text) return { error: 'Kriteerium ei tohi olla tühi.' };
    if (text.length > CRITERION_MAX) return { error: `Kriteerium võib olla kuni ${CRITERION_MAX} märki.` };
    const key = text.toLocaleLowerCase('et');
    if (seenText.has(key)) return { error: 'Sama kriteerium on kaks korda.' };
    seenText.add(key);

    let origin = 'manual';
    let index;
    if (c.index !== undefined && c.index !== null) {
      if (!Number.isInteger(c.index) || c.index < 0 || c.index >= proposed.length) return { error: 'Kriteerium ei ole selles ettepanekus.' };
      if (seenIndex.has(c.index)) return { error: 'Sama kriteerium on kaks korda.' };
      seenIndex.add(c.index);
      index = c.index;
      origin = text === cleanCriterion(proposed[c.index]) ? 'ai' : 'ai_edited';
    }
    criteria.push({ text, origin, index });
  }
  return { criteria };
}

// Kutsuda transaktsiooni sees (applyProposal). Lisab kriteeriumid loo olemasolevate lõppu.
// c.ref (valikuline) = { kind, index, version, source } – viide mockup'i elemendile (L23).
export function appendCriteria(db, storyId, criteria) {
  const last = db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM criteria WHERE story_id = ?').get(storyId).p;
  const insert = db.prepare(`INSERT INTO criteria (story_id, position, text, origin, ref_kind, ref_index, ref_version, ref_source)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  criteria.forEach((c, i) => insert.run(storyId, last + i + 1, c.text, c.origin,
    c.ref?.kind ?? null, c.ref?.kind === 'element' ? c.ref.index : null, c.ref?.kind === 'element' ? c.ref.version ?? null : null, c.ref?.kind ? c.ref.source : null));
}

// AI viide (-1 = ei puuduta vaadet, muidu komponendi indeks) andmebaasi kujule.
export const aiRef = (ref, version) => {
  if (!Number.isInteger(ref)) return null;
  return ref < 0 ? { kind: 'no_view', source: 'ai' } : { kind: 'element', index: ref, version, source: 'ai' };
};

// Kooskõla vihjed ja kasutaja ülevaatuse kinnituse seis (L23). Ainult lugemine.
export function consistencyFor(db, storyId) {
  const criteria = listCriteria(db, storyId);
  const mockup = latestMockup(db, storyId);
  const analysis = analyzeConsistency(criteria, mockup);
  const fingerprint = reviewFingerprint(criteria, mockup);
  const raw = db.prepare('SELECT consistency_review AS r FROM stories WHERE id = ?').get(storyId)?.r;
  const saved = raw ? JSON.parse(raw) : null;
  const review = saved ? { mockupVersion: saved.mockupVersion, at: saved.at, valid: saved.fingerprint === fingerprint } : null;
  return { ...analysis, fingerprint, review };
}

// Kutsuda transaktsiooni sees. Uus kinnitatud mockup saab järgmise versiooninumbri (esimene = 1).
export function saveMockup(db, storyId, mockup) {
  const next = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM mockups WHERE story_id = ?').get(storyId).v;
  db.prepare('INSERT INTO mockups (story_id, version, spec) VALUES (?, ?, ?)').run(storyId, next, JSON.stringify(mockup));
  return next;
}
