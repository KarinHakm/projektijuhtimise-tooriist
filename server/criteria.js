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

// L22: lool võib olla mitu vaadet (mockup'i) 1, 2, …; versiooni number on loo piires ühine kõigile vaadetele.
// Vaate uusim kinnitatud versioon (vaikimisi vaade 1 – alustamise loo mockup, kliendi täpsustus).
export function latestMockup(db, storyId, viewNo = 1) {
  const row = db.prepare('SELECT version, view_no AS viewNo, spec, created_at AS createdAt FROM mockups WHERE story_id = ? AND view_no = ? ORDER BY version DESC LIMIT 1')
    .get(storyId, viewNo);
  return row ? { version: row.version, viewNo: row.viewNo, createdAt: row.createdAt, ...JSON.parse(row.spec) } : null;
}

// Kas lool on vähemalt üks kinnitatud mockup (ükskõik milline vaade) – DoR, ülevaatus, etapp, AI kontekst.
export const hasAnyMockup = (db, storyId) => Boolean(db.prepare('SELECT 1 FROM mockups WHERE story_id = ? LIMIT 1').get(storyId));

// Loo vaated järjekorras, igaühe uusim versioon: [{ viewNo, mockup }].
export function listViews(db, storyId) {
  return db.prepare('SELECT DISTINCT view_no AS v FROM mockups WHERE story_id = ? ORDER BY view_no').all(storyId)
    .map((r) => ({ viewNo: r.v, mockup: latestMockup(db, storyId, r.v) }));
}

// Vaate kõik kinnitatud versioonid, uusim eespool (L22). Vanu versioone ei muudeta ega kustutata.
export function listMockupVersions(db, storyId, viewNo = 1) {
  return db.prepare('SELECT version, view_no AS viewNo, spec, created_at AS createdAt FROM mockups WHERE story_id = ? AND view_no = ? ORDER BY version DESC')
    .all(storyId, viewNo)
    .map((r) => ({ version: r.version, viewNo: r.viewNo, createdAt: r.createdAt, ...JSON.parse(r.spec) }));
}

// Taastab varasema versiooni UUE versioonina (ajalugu jääb alles). Kriteeriumide viited taastatud versiooni
// elementidele viiakse uuele versioonile (elemendid on samad); viited teistele versioonidele jäävad ja on aegunud.
// Kutsuda transaktsiooni sees. Tagastab uue versiooni numbri.
// Taastatud versioon jääb samasse vaatesse, kuhu vana versioon kuulus.
export function restoreMockup(db, storyId, version) {
  const row = db.prepare('SELECT spec, view_no AS viewNo FROM mockups WHERE story_id = ? AND version = ?').get(storyId, version);
  const next = saveMockup(db, storyId, JSON.parse(row.spec), row.viewNo);
  db.prepare("UPDATE criteria SET ref_version = ? WHERE story_id = ? AND ref_kind = 'element' AND ref_version = ?").run(next, storyId, version);
  return next;
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
// L22: kõik vaated – seos kontrollitakse oma vaate uusima versiooni vastu; ühe vaatega loo tulemus on sama mis varem.
export function consistencyFor(db, storyId) {
  const criteria = listCriteria(db, storyId);
  const views = listViews(db, storyId).map((v) => v.mockup);
  const mockups = views.length > 1 ? views : views[0] ?? null;
  const analysis = analyzeConsistency(criteria, mockups);
  const fingerprint = reviewFingerprint(criteria, mockups);
  const raw = db.prepare('SELECT consistency_review AS r FROM stories WHERE id = ?').get(storyId)?.r;
  const saved = raw ? JSON.parse(raw) : null;
  const review = saved ? { mockupVersion: saved.mockupVersion, at: saved.at, valid: saved.fingerprint === fingerprint } : null;
  return { ...analysis, fingerprint, review };
}

// Kutsuda transaktsiooni sees. Uus kinnitatud mockup saab järgmise versiooninumbri (esimene = 1). Number võetakse loo
// KÕIGI vaadete pealt, seega eri vaadete versioonid ei kattu ja ref_version määrab ühemõtteliselt vaate (L22).
export function saveMockup(db, storyId, mockup, viewNo = 1) {
  const next = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM mockups WHERE story_id = ?').get(storyId).v;
  db.prepare('INSERT INTO mockups (story_id, version, view_no, spec) VALUES (?, ?, ?, ?)').run(storyId, next, viewNo, JSON.stringify(mockup));
  return next;
}

// --- L15: kriteeriumide käsitsi lisamine, muutmine ja kustutamine (ilma AI-ta) ---
// Seos mockup'iga on kriteeriumi enda väli: muutmisel jääb alles (kooskõla hoiatused arvutatakse uue teksti järgi
// uuesti, ülevaatus aegub sõrmejälje kaudu), kustutamisel kaob ainult selle kriteeriumi seos.

// Kontrollib käsitsi kriteeriumi teksti. exceptId = muudetav kriteerium (iseendaga kordust ei loeta).
// Tagastab { text } või { status, code, error }.
export function validateManualCriterion(db, storyId, raw, exceptId = null) {
  const text = cleanCriterion(raw?.text);
  if (!text) return { status: 400, code: 'invalid_criterion', error: 'Kriteerium ei tohi olla tühi.' };
  if (text.length > CRITERION_MAX) return { status: 400, code: 'invalid_criterion', error: `Kriteerium võib olla kuni ${CRITERION_MAX} märki.` };
  const key = text.toLocaleLowerCase('et');
  if (listCriteria(db, storyId).some((c) => c.id !== exceptId && c.text.toLocaleLowerCase('et') === key)) {
    return { status: 400, code: 'duplicate_criterion', error: 'Sama kriteerium on selles loos juba olemas.' };
  }
  return { text };
}

// Kutsuda transaktsiooni sees. Tagastab { id } või { status, code, error } (10 kriteeriumi piir).
export function addManualCriterion(db, storyId, text) {
  if (listCriteria(db, storyId).length >= CRITERIA_MAX_COUNT) {
    return { status: 409, code: 'too_many_criteria', error: `Loos võib olla kuni ${CRITERIA_MAX_COUNT} kriteeriumi.` };
  }
  appendCriteria(db, storyId, [{ text, origin: 'manual' }]);
  return { id: db.prepare('SELECT id FROM criteria WHERE story_id = ? ORDER BY position DESC LIMIT 1').get(storyId).id };
}

// Kutsuda transaktsiooni sees. AI kriteeriumi muutmisel päritolu "ai_edited"; seos jääb alles.
export function updateCriterionText(db, criterionId, text) {
  db.prepare(`UPDATE criteria SET text = ?, origin = CASE WHEN origin = 'ai' THEN 'ai_edited' ELSE origin END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND text <> ?`).run(text, criterionId, text);
}

// Kutsuda transaktsiooni sees. Kustutab kriteeriumi (koos selle seosega) ja nummerdab järjekorra ümber.
export function deleteCriterion(db, storyId, criterionId) {
  db.prepare('DELETE FROM criteria WHERE id = ? AND story_id = ?').run(criterionId, storyId);
  const renumber = db.prepare('UPDATE criteria SET position = ? WHERE id = ?');
  db.prepare('SELECT id FROM criteria WHERE story_id = ? ORDER BY position, id').all(storyId).forEach((c, i) => renumber.run(i + 1, c.id));
}
