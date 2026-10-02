// Üldine tagasivõtmine (L21): projekti viimane TOETATUD muudatus. Üks kirje projekti kohta (undo_journal).
// undoable() teeb ühes SQLite transaktsioonis: enne-seisu hetktõmmis → toiming → pärast-seisu räsi → kirje.
// Kui kirje kirjutamine ebaõnnestub, võetakse ka toiming tagasi (rollback); vastus saadetakse alles pärast COMMIT'i.
// Tagasivõtmine taastab hetktõmmise ainult siis, kui praeguse seisu räsi on sama mis kohe pärast toimingut.
import { createHash } from 'node:crypto';

// Hetktõmmises on projekti backlog'i read (ka ettepanekud, sest L24/L28/L29 muudavad neid) ning alustamise lugu ja
// MVP joon. Rollid, vestlus ja etapi märked jäävad välja – need tagasivõtmist ei mõjuta.
const TABLES = [
  ['ai_proposals', 'SELECT * FROM ai_proposals WHERE project_id = ?'],
  ['stories', 'SELECT * FROM stories WHERE project_id = ?'],
  ['criteria', 'SELECT c.* FROM criteria c JOIN stories s ON s.id = c.story_id WHERE s.project_id = ?'],
  ['story_questions', 'SELECT q.* FROM story_questions q JOIN stories s ON s.id = q.story_id WHERE s.project_id = ?'],
  ['mockups', 'SELECT m.* FROM mockups m JOIN stories s ON s.id = m.story_id WHERE s.project_id = ?'],
  ['story_overlaps', 'SELECT * FROM story_overlaps WHERE project_id = ?'],
];
// Ajatemplid ei ole räsi osa (ainult nende muutus ei tähenda sisulist muudatust).
const TIMESTAMPS = new Set(['created_at', 'updated_at', 'decided_at']);

const byId = (a, b) => (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id).localeCompare(String(b.id)));

export function captureProject(db, projectId) {
  const project = { ...db.prepare('SELECT focus_story_id, mvp_count FROM projects WHERE id = ?').get(projectId) };
  const tables = Object.fromEntries(TABLES.map(([name, sql]) => [name, db.prepare(sql).all(projectId).map((r) => ({ ...r })).sort(byId)]));
  return { project, tables };
}

// Kanooniline JSON: võtmed tähestiku järjekorras, read id järjekorras, ajatemplid välja jäetud.
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => !TIMESTAMPS.has(k)).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};
export const stateHash = (snapshot) => createHash('sha256').update(canonical(snapshot)).digest('hex');

// Taastab hetktõmmise samade id-dega. Kutsuda transaktsiooni sees.
function restoreProject(db, projectId, snapshot) {
  db.prepare('DELETE FROM stories WHERE project_id = ?').run(projectId); // kaskaad: kriteeriumid, küsimused, mockup'id, märked
  db.prepare('DELETE FROM ai_proposals WHERE project_id = ?').run(projectId);
  for (const [name] of TABLES) {
    for (const row of snapshot.tables[name]) {
      const cols = Object.keys(row);
      db.prepare(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => row[c]));
    }
  }
  db.prepare("UPDATE projects SET focus_story_id = ?, mvp_count = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .run(snapshot.project.focus_story_id, snapshot.project.mvp_count, projectId);
}

const journalRow = (db, projectId) => db.prepare('SELECT label, snapshot, after_hash AS afterHash, created_at AS at FROM undo_journal WHERE project_id = ?').get(projectId);

// Seis brauserile: kas viimast toetatud muudatust saab tagasi võtta ja miks mitte.
export function undoState(db, projectId) {
  const row = journalRow(db, projectId);
  if (!row) return { available: false, label: null, at: null, reason: 'Tagasivõetavat toetatud muudatust pole.' };
  const current = stateHash(captureProject(db, projectId));
  return current === row.afterHash
    ? { available: true, label: row.label, at: row.at, reason: null }
    : { available: false, label: row.label, at: row.at, reason: 'Pärast seda muudatust on tehtud teisi muudatusi – seda ei saa enam tagasi võtta.' };
}

export class UndoError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Võtab viimase toetatud muudatuse tagasi. expectedAt = brauseri nähtud kirje aeg (topeltklõpsu kaitse).
export function undoLast(db, projectId, expectedAt) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = journalRow(db, projectId);
    if (!row) throw new UndoError(409, 'nothing', 'Tagasivõetavat toetatud muudatust pole.');
    if (expectedAt !== row.at) throw new UndoError(409, 'changed', 'Viimane muudatus on vahepeal muutunud – värskenda lehte.');
    if (stateHash(captureProject(db, projectId)) !== row.afterHash) {
      throw new UndoError(409, 'stale', `Pärast muudatust „${row.label}“ on tehtud teisi muudatusi – seda ei saa enam tagasi võtta. Osalist taastamist ei tehta.`);
    }
    restoreProject(db, projectId, JSON.parse(row.snapshot));
    db.prepare('DELETE FROM undo_journal WHERE project_id = ?').run(projectId);
    db.exec('COMMIT');
    return row.label;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Express'i töötleja mähis toetatud toimingule. labelOf(req) annab sildi või null (siis toimingut ei salvestata,
// nt ülevaatuse leid, mis pole jagamine ega ühendamine). Töötleja peab olema sünkroonne.
export function undoable(db, labelOf, handler) {
  return (req, res, next) => {
    const label = labelOf(req);
    if (!label) return handler(req, res, next);
    const send = res.json.bind(res);
    let body;
    let sent = false;
    res.json = (b) => { body = b; sent = true; return res; };
    db.exec('BEGIN IMMEDIATE');
    try {
      const before = captureProject(db, req.projectId);
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') throw new Error('undoable: töötleja peab olema sünkroonne');
      if (sent && res.statusCode < 300) {
        db.prepare(`INSERT INTO undo_journal (project_id, label, snapshot, after_hash) VALUES (?, ?, ?, ?)
                    ON CONFLICT(project_id) DO UPDATE SET label = excluded.label, snapshot = excluded.snapshot,
                    after_hash = excluded.after_hash, created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
          .run(req.projectId, label, JSON.stringify(before), stateHash(captureProject(db, req.projectId)));
        db.exec('COMMIT');
      } else {
        db.exec('ROLLBACK');
      }
    } catch (err) {
      if (db.isTransaction) db.exec('ROLLBACK');
      res.json = send;
      throw err;
    }
    res.json = send;
    if (sent) send(body);
    return undefined;
  };
}
