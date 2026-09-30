import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Skeemi muudatused järjekorras. Uus muudatus lisatakse loendi lõppu, olemasolevaid ei muudeta.
// Andmebaasi versioon hoitakse SQLite'i PRAGMA user_version väärtuses.
const MIGRATIONS = [
  `CREATE TABLE projects (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     name        TEXT    NOT NULL CHECK (length(trim(name)) > 0),
     description TEXT    NOT NULL DEFAULT '',
     stage       TEXT    NOT NULL DEFAULT 'idee',
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   )`,
  // AI ettepanekud: salvestatakse olekuga 'pending' ja muudavad backlog'i alles inimese kinnitusel.
  `CREATE TABLE ai_proposals (
     id          TEXT    PRIMARY KEY,
     project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     kind        TEXT    NOT NULL,
     payload     TEXT    NOT NULL,
     status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     decided_at  TEXT
   );
   CREATE INDEX ai_proposals_project ON ai_proposals(project_id)`,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

// Avab (vajadusel loob) andmebaasi faili ja viib skeemi ajakohaseks.
export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
