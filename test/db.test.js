import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, openDb, SCHEMA_VERSION } from '../server/db.js';

// Iga test saab oma ajutise kausta; arendaja data/app.db faili ei puututa.
let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pjt-db-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test('openDb loob puuduva kausta ja andmebaasi faili', () => {
  const path = join(dir, 'alamkaust', 'app.db');
  assert.equal(existsSync(path), false);
  const db = openDb(path);
  db.close();
  assert.equal(existsSync(path), true);
});

test('andmebaasis on projects tabel oodatud veergudega', () => {
  const db = openDb(join(dir, 'app.db'));
  const cols = db.prepare('PRAGMA table_info(projects)').all().map((c) => c.name);
  db.close();
  assert.deepEqual(cols, ['id', 'name', 'description', 'stage', 'created_at', 'updated_at', 'focus_story_id', 'mvp_count', 'skipped_stages', 'active_stage']);
});

test('lisatud projekt on alles pärast andmebaasi sulgemist ja uuesti avamist', () => {
  const path = join(dir, 'app.db');
  const db1 = openDb(path);
  db1.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run('Spordiklubi veeb', 'Treeningud ja liikmeks astumine');
  db1.close();

  const db2 = openDb(path);
  const rows = db2.prepare('SELECT name, description, stage FROM projects').all();
  db2.close();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { name: 'Spordiklubi veeb', description: 'Treeningud ja liikmeks astumine', stage: 'idee' },
  ]);
});

test('uuesti avamine ei käivita skeemi loomist teist korda', () => {
  const path = join(dir, 'app.db');
  openDb(path).close();
  const db = openDb(path);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  db.close();
  assert.equal(version, SCHEMA_VERSION);
  assert.deepEqual(tables, ['ai_proposals', 'conversation_messages', 'criteria', 'mockups', 'project_roles', 'projects', 'stories', 'story_questions']);
});

test('andmebaas ei luba tühja nime ega ainult tühikutest nime', () => {
  const db = openDb(join(dir, 'app.db'));
  const insert = db.prepare('INSERT INTO projects (name) VALUES (?)');
  assert.throws(() => insert.run(''), /CHECK constraint failed/);
  assert.throws(() => insert.run('   '), /CHECK constraint failed/);
  const n = db.prepare('SELECT count(*) AS n FROM projects').get().n;
  db.close();
  assert.equal(n, 0);
});

// data/app.db on skeemiversioonil 5: esimesel avamisel rakenduvad migratsioonid v6–v11 korraga ja andmed jäävad alles.
test('versioonil 5 andmebaas viiakse versioonile 11; projekt ja lood jäävad, uued etapi väljad saavad vaikeväärtused', () => {
  const path = join(dir, 'v5.db');
  const old = new DatabaseSync(path);
  for (const m of MIGRATIONS.slice(0, 5)) old.exec(m);
  old.exec('PRAGMA user_version = 5');
  const pid = old.prepare("INSERT INTO projects (name) VALUES ('Vana projekt') RETURNING id").get().id;
  old.prepare("INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin) VALUES (?, 1, 'Külastaja', 'Külastajana', 'näha hindu', 'saaksin valida', 'S', 'ai')").run(pid);
  old.close();

  const db = openDb(path);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const project = { ...db.prepare('SELECT name, skipped_stages, active_stage, mvp_count FROM projects WHERE id = ?').get(pid) };
  const stories = db.prepare('SELECT want, status FROM stories').all().map((r) => ({ ...r }));
  db.close();
  assert.equal(SCHEMA_VERSION, 11);
  assert.equal(version, 11);
  assert.deepEqual(project, { name: 'Vana projekt', skipped_stages: '[]', active_stage: null, mvp_count: null });
  assert.deepEqual(stories, [{ want: 'näha hindu', status: 'idee' }]);
});
