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
  // Juhitud vestlus. reply_to seob vastuse sõnumiga, millele vastatakse; UNIQUE tagab, et ühele
  // sõnumile on kõige rohkem üks vastus (ka topeltpäringu või serveri taaskäivituse korral).
  `CREATE TABLE conversation_messages (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     role        TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
     kind        TEXT    NOT NULL CHECK (kind IN ('idea', 'questions', 'answers', 'summary')),
     content     TEXT    NOT NULL,
     reply_to    INTEGER UNIQUE REFERENCES conversation_messages(id) ON DELETE CASCADE,
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX conversation_messages_project ON conversation_messages(project_id, id);
   CREATE UNIQUE INDEX conversation_one_idea ON conversation_messages(project_id) WHERE kind = 'idea'`,
  // Kinnitatud rollid (L05). AI ettepanek on eraldi tabelis ai_proposals; siia jõuavad rollid
  // alles kasutaja kinnitusega. name_key on tõstutundetu võti (ka täpitähtedega).
  `CREATE TABLE project_roles (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     name        TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
     name_key    TEXT    NOT NULL,
     source      TEXT    NOT NULL CHECK (source IN ('ai', 'manual')),
     position    INTEGER NOT NULL,
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     UNIQUE (project_id, name_key)
   )`,
  // Backlog'i lood (L06). AI ettepanek on ai_proposals tabelis; siia jõuavad lood alles kasutaja lisamisel.
  `CREATE TABLE stories (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     position     INTEGER NOT NULL,
     role         TEXT    NOT NULL,
     role_phrase  TEXT    NOT NULL,
     want         TEXT    NOT NULL,
     so_that      TEXT    NOT NULL,
     size         TEXT    NOT NULL CHECK (size IN ('S', 'M', 'L')),
     status       TEXT    NOT NULL DEFAULT 'idee' CHECK (status IN ('idee', 'vajab_tapsustamist', 'labivaadatud', 'valmis_arenduseks')),
     origin       TEXT    NOT NULL CHECK (origin IN ('ai', 'ai_edited', 'manual')),
     touches_view INTEGER NOT NULL DEFAULT 0 CHECK (touches_view IN (0, 1)),
     proposal_id  TEXT    REFERENCES ai_proposals(id) ON DELETE SET NULL,
     created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX stories_project ON stories(project_id, position)`,
  // Lugu, millest alustatakse (L08). Määratakse ainult kasutaja kinnitusel (AI soovitus või oma valik).
  `ALTER TABLE projects ADD COLUMN focus_story_id INTEGER REFERENCES stories(id) ON DELETE SET NULL`,
  // Loo vastuvõtukriteeriumid (L09) ja kinnitatud mockup'id versioonidena (L10). Siia jõuab ainult kasutaja kinnitatu.
  `CREATE TABLE criteria (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     story_id    INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
     position    INTEGER NOT NULL,
     text        TEXT    NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 200),
     origin      TEXT    NOT NULL CHECK (origin IN ('ai', 'ai_edited', 'manual')),
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   );
   CREATE INDEX criteria_story ON criteria(story_id, position);
   CREATE TABLE mockups (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     story_id    INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
     version     INTEGER NOT NULL,
     spec        TEXT    NOT NULL,
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     UNIQUE (story_id, version)
   )`,
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
