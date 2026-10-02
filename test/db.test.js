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
  assert.deepEqual(tables, ['ai_proposals', 'conversation_messages', 'criteria', 'mockups', 'project_roles', 'projects', 'stories', 'story_overlaps', 'story_questions', 'undo_journal']);
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
test('versioonil 5 andmebaas viiakse viimasele versioonile; projekt ja lood jäävad, uued etapi väljad saavad vaikeväärtused', () => {
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
  assert.equal(SCHEMA_VERSION, 14);
  assert.equal(version, 14);
  assert.deepEqual(project, { name: 'Vana projekt', skipped_stages: '[]', active_stage: null, mvp_count: null });
  assert.deepEqual(stories, [{ want: 'näha hindu', status: 'idee' }]);
});

// L22 (v12): senised mockup'id on vaade 1; versioon on loo piires ühine kõigile vaadetele ja ref_version jääb ühemõtteliseks.
test('v11 → v12: olemasolevad mockupid ja seosed jäävad, kõik saavad vaate 1', () => {
  const path = join(dir, 'v11.db');
  const old = new DatabaseSync(path);
  for (const m of MIGRATIONS.slice(0, 11)) old.exec(m);
  old.exec('PRAGMA user_version = 11');
  const pid = old.prepare("INSERT INTO projects (name) VALUES ('P') RETURNING id").get().id;
  const sid = old.prepare("INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin) VALUES (?, 1, 'K', 'Kna', 'näha', 'saaksin', 'S', 'ai') RETURNING id").get(pid).id;
  old.prepare("INSERT INTO mockups (story_id, version, spec) VALUES (?, 1, '{}'), (?, 2, '{}')").run(sid, sid);
  old.prepare("INSERT INTO criteria (story_id, position, text, origin, ref_kind, ref_index, ref_version, ref_source) VALUES (?, 1, 'Lehel on pealkiri.', 'ai', 'element', 0, 2, 'ai')").run(sid);
  old.close();
  const db = openDb(path);
  const mockups = db.prepare('SELECT version, view_no FROM mockups ORDER BY version').all().map((r) => ({ ...r }));
  const ref = { ...db.prepare('SELECT ref_kind, ref_index, ref_version FROM criteria').get() };
  db.close();
  assert.deepEqual(mockups, [{ version: 1, view_no: 1 }, { version: 2, view_no: 1 }]);
  assert.deepEqual(ref, { ref_kind: 'element', ref_index: 0, ref_version: 2 });
});

test('mockupi versioon on loo piires ühine kõigile vaadetele: vaadete versioonid ei kattu, UNIQUE(story_id, version) kehtib', async () => {
  const { saveMockup } = await import('../server/criteria.js');
  const db = openDb(join(dir, 'app.db'));
  const pid = db.prepare("INSERT INTO projects (name) VALUES ('P') RETURNING id").get().id;
  const sid = db.prepare("INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin) VALUES (?, 1, 'K', 'Kna', 'näha', 'saaksin', 'S', 'ai') RETURNING id").get(pid).id;
  const spec = { title: 'V', components: [] };
  const got = [saveMockup(db, sid, spec, 1), saveMockup(db, sid, spec, 2), saveMockup(db, sid, spec, 1), saveMockup(db, sid, spec, 2)];
  assert.deepEqual(got, [1, 2, 3, 4]); // vaated 1 ja 2 jagavad ühte numeratsiooni
  assert.throws(() => db.prepare("INSERT INTO mockups (story_id, version, view_no, spec) VALUES (?, 2, 1, '{}')").run(sid), /UNIQUE/);
  db.close();
});

// L26 (v13): kattuvusmärgid; kaskaad toimib ainult siis, kui ühendusel on välisvõtmete jõustamine sisse lülitatud.
test('openDb lülitab välisvõtmed sisse; v12 → v13 lisab story_overlaps ja märge kaob loo kustutamisel kaskaadiga', () => {
  const path = join(dir, 'v12.db');
  const old = new DatabaseSync(path);
  for (const m of MIGRATIONS.slice(0, 12)) old.exec(m);
  old.exec('PRAGMA user_version = 12');
  const pid = old.prepare("INSERT INTO projects (name) VALUES ('P') RETURNING id").get().id;
  const add = old.prepare("INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, origin) VALUES (?, ?, 'K', 'Kna', ?, 'saaksin', 'S', 'ai') RETURNING id");
  const [s1, s2] = [add.get(pid, 1, 'a').id, add.get(pid, 2, 'b').id];
  old.close();
  const db = openDb(path);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stories').get().n, 2);
  db.prepare('INSERT INTO story_overlaps (project_id, story_a, story_b) VALUES (?, ?, ?)').run(pid, s1, s2);
  assert.throws(() => db.prepare('INSERT INTO story_overlaps (project_id, story_a, story_b) VALUES (?, ?, ?)').run(pid, s1, s2), /UNIQUE/);
  assert.throws(() => db.prepare('INSERT INTO story_overlaps (project_id, story_a, story_b) VALUES (?, ?, ?)').run(pid, s2, s1), /CHECK/);
  db.prepare('DELETE FROM stories WHERE id = ?').run(s2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM story_overlaps').get().n, 0);
  db.close();
});
