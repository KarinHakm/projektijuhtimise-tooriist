// Loo kriteeriumid (L09) ja kinnitatud mockup'id (L10). Siia jõuab ainult kasutaja kinnitatu.
import { CRITERION_MAX, checkCriterion, cleanCriterion } from '../shared/criteria-check.js';

export const CRITERIA_MAX_COUNT = 10;

export function listCriteria(db, storyId) {
  return db
    .prepare('SELECT id, position, text, origin FROM criteria WHERE story_id = ? ORDER BY position')
    .all(storyId)
    .map((r) => ({ ...r, warnings: checkCriterion(r.text).map((w) => w.message) }));
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
    if (c.index !== undefined && c.index !== null) {
      if (!Number.isInteger(c.index) || c.index < 0 || c.index >= proposed.length) return { error: 'Kriteerium ei ole selles ettepanekus.' };
      if (seenIndex.has(c.index)) return { error: 'Sama kriteerium on kaks korda.' };
      seenIndex.add(c.index);
      origin = text === cleanCriterion(proposed[c.index]) ? 'ai' : 'ai_edited';
    }
    criteria.push({ text, origin });
  }
  return { criteria };
}

// Kutsuda transaktsiooni sees (applyProposal). Lisab kriteeriumid loo olemasolevate lõppu.
export function appendCriteria(db, storyId, criteria) {
  const last = db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM criteria WHERE story_id = ?').get(storyId).p;
  const insert = db.prepare('INSERT INTO criteria (story_id, position, text, origin) VALUES (?, ?, ?, ?)');
  criteria.forEach((c, i) => insert.run(storyId, last + i + 1, c.text, c.origin));
}

// Kutsuda transaktsiooni sees. Uus kinnitatud mockup saab järgmise versiooninumbri (esimene = 1).
export function saveMockup(db, storyId, mockup) {
  const next = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM mockups WHERE story_id = ?').get(storyId).v;
  db.prepare('INSERT INTO mockups (story_id, version, spec) VALUES (?, ?, ?)').run(storyId, next, JSON.stringify(mockup));
  return next;
}
