import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClaudeCliClient } from '../server/ai/claude-cli.js';
import { createConfiguredAi } from '../server/ai/provider.js';
import { runAiTask } from '../server/ai/run.js';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { appendStories } from '../server/stories.js';

// Claude Code CLI klient. Kasutatakse VÕLTSKÄSKU (test/helpers/fake-claude.mjs) – päris AI-d ei kutsuta.
const FAKE = resolve('test/helpers/fake-claude.mjs');
const SCHEMA = { type: 'object', required: ['status'], additionalProperties: false, properties: { status: { type: 'string', enum: ['ok'] } } };
const MESSAGES = [{ role: 'system', content: 'Süsteemi juhis.' }, { role: 'user', content: 'Projekti kontekst ja küsimus.' }];
let dir, record;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-cli-test-'));
  record = join(dir, 'record.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const client = (mode, { output = { status: 'ok' }, timeoutMs = 10_000, extraEnv = {}, spawnImpl } = {}) => createClaudeCliClient({
  command: process.execPath,
  prefixArgs: [FAKE],
  timeoutMs,
  spawnImpl,
  env: { ...process.env, FAKE_CLAUDE_MODE: mode, FAKE_CLAUDE_OUTPUT: JSON.stringify(output), FAKE_CLAUDE_RECORD: record, ...extraEnv },
});
const seen = () => JSON.parse(readFileSync(record, 'utf8'));

test('piiratud õigused: tööriistad, MCP ja kohandused välja; sessiooni ei salvestata; ei kasutata --bare režiimi', async () => {
  await client('ok').complete({ messages: MESSAGES, schema: SCHEMA });
  const { args } = seen();
  const value = (flag) => args[args.indexOf(flag) + 1];
  assert.ok(args.includes('-p'));
  assert.equal(value('--output-format'), 'json');
  assert.equal(value('--model'), 'sonnet');
  assert.equal(value('--tools'), ''); // kõik tööriistad keelatud (failid, käsud, veeb)
  assert.equal(value('--permission-mode'), 'dontAsk');
  for (const flag of ['--strict-mcp-config', '--safe-mode', '--disable-slash-commands', '--no-session-persistence']) assert.ok(args.includes(flag), flag);
  for (const flag of ['--bare', '--mcp-config', '--dangerously-skip-permissions', '--allowedTools', '--add-dir']) assert.ok(!args.includes(flag), flag);
  assert.deepEqual(JSON.parse(value('--json-schema')), SCHEMA);
  assert.match(value('--system-prompt'), /^Süsteemi juhis\.\n\nVasta ainult JSON-objektiga/);
});

test('kontekst läheb standardsisendisse; töökaust on tühi ajutine kaust, mis pärast kustutatakse', async () => {
  await client('ok').complete({ messages: MESSAGES, schema: SCHEMA });
  const s = seen();
  assert.equal(s.stdin, 'Projekti kontekst ja küsimus.');
  assert.deepEqual(s.cwdFiles, []);
  assert.notEqual(resolve(s.cwd), resolve('.'));
  assert.equal(existsSync(s.cwd), false);
});

test('API-võtmeid ei anta CLI-le edasi: kasutatakse tellimuse sisselogimist', async () => {
  await client('ok', { extraEnv: { ANTHROPIC_API_KEY: 'ei-tohi', ANTHROPIC_AUTH_TOKEN: 'ei-tohi' } }).complete({ messages: MESSAGES, schema: SCHEMA });
  assert.deepEqual([seen().hasApiKey, seen().hasAuthToken], [false, false]);
});

test('käsk käivitatakse ilma shellita', async () => {
  const calls = [];
  const spy = (cmd, args, opts) => { calls.push(opts); return spawn(cmd, args, opts); };
  await client('ok', { spawnImpl: spy }).complete({ messages: MESSAGES, schema: SCHEMA });
  assert.equal(calls[0].shell, false);
});

test('õnnestunud vastus: struktureeritud väljund või JSON tekst; tokenite arv', async () => {
  assert.deepEqual(await client('ok').complete({ messages: MESSAGES, schema: SCHEMA }), { content: '{"status":"ok"}', finishReason: 'stop', outputTokens: 42 });
  assert.deepEqual(await client('ok_text').complete({ messages: MESSAGES, schema: SCHEMA }), { content: '{"status":"ok"}', finishReason: 'stop', outputTokens: 7 });
});

test('puuduv sisselogimine (vastuses või veaväljundis) → not_logged_in; teade on meie oma, mitte CLI tekst', async () => {
  for (const mode of ['not_logged_in', 'not_logged_in_stderr']) {
    await assert.rejects(client(mode).complete({ messages: MESSAGES, schema: SCHEMA }), (err) => {
      assert.equal(err.code, 'not_logged_in', mode);
      assert.equal(err.status, 503);
      assert.match(err.message, /Käivita terminalis „claude“, logi oma kontoga sisse/);
      assert.doesNotMatch(err.message, /\/login|API key/);
      return true;
    });
  }
});

test('kasutuslimiit → usage_limit (429) koos ligikaudse vabanemisajaga', async () => {
  await assert.rejects(client('limit').complete({ messages: MESSAGES, schema: SCHEMA }), (err) => {
    assert.equal(err.code, 'usage_limit');
    assert.equal(err.status, 429);
    assert.ok(err.retryAfterSeconds > 1700 && err.retryAfterSeconds <= 1800, String(err.retryAfterSeconds));
    return true;
  });
});

test('arusaamatu väljund → unavailable; aegumine → timeout (protsess peatatakse)', async () => {
  await assert.rejects(client('garbage').complete({ messages: MESSAGES, schema: SCHEMA }), { code: 'unavailable' });
  const started = Date.now();
  await assert.rejects(client('hang', { timeoutMs: 300 }).complete({ messages: MESSAGES, schema: SCHEMA }), { code: 'timeout' });
  assert.ok(Date.now() - started < 5000);
});

test('käsu käivitamine viskab kohe vea → unavailable (mitte serveri krahh)', async () => {
  const throwing = () => { throw new Error('spawn ebaõnnestus'); };
  await assert.rejects(client('ok', { spawnImpl: throwing }).complete({ messages: MESSAGES, schema: SCHEMA }), { code: 'unavailable' });
});

test('käsku pole: cli_missing (nii käivitamisel kui juba käivitusel teada olles)', async () => {
  const missing = createClaudeCliClient({ command: join(dir, 'pole-olemas-claude'), timeoutMs: 5000 });
  await assert.rejects(missing.complete({ messages: MESSAGES, schema: SCHEMA }), { code: 'cli_missing' });
  const off = createClaudeCliClient({ available: false });
  assert.equal(off.configured, false);
  await assert.rejects(off.complete({ messages: MESSAGES, schema: SCHEMA }), { code: 'cli_missing' });
});

test('teenuse valik: vaikimisi Claude CLI + sonnet; off lülitab välja; puuduv käsk on kirjas', () => {
  const def = createConfiguredAi({}, { commandExists: () => true });
  assert.deepEqual([def.ai.provider, def.ai.model, def.ai.configured], ['claude-cli', 'sonnet', true]);
  assert.match(def.description, /Claude Code CLI, mudel sonnet/);
  const off = createConfiguredAi({ AI_PROVIDER: 'off' }, { commandExists: () => true });
  assert.equal(off.ai.configured, false);
  const unknown = createConfiguredAi({ AI_PROVIDER: 'midagi' }, { commandExists: () => true });
  assert.equal(unknown.ai.configured, false);
  assert.match(unknown.description, /tundmatu AI_PROVIDER/);
  const missing = createConfiguredAi({}, { commandExists: () => false });
  assert.equal(missing.ai.configured, false);
  assert.match(missing.description, /ei leitud/);
});

test('rakenduse AI-samm võltskäsuga: prioriteedisoovitus jõuab kasutajale; logis ainult ohutud mõõdikud', async () => {
  const db = openDb(join(dir, 'app.db'));
  const projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  appendStories(db, projectId, [{ role: 'Külastaja', rolePhrase: 'Külastajana', want: 'näha hindu', soThat: 'saaksin valida', size: 'S', origin: 'manual', touchesView: true }], null);
  const storyId = db.prepare('SELECT id FROM stories').get().id;
  const ai = client('ok', { output: { message: 'Alustame sellest.', storyId, reason: 'Ilma hindadeta ei saa külastaja paketti valida.' } });
  const logs = [];
  const original = console.info;
  console.info = (line) => logs.push(line);
  const server = createApp({ db, ai }).listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/projects/${projectId}/priority/propose`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).proposal.storyId, storyId);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /^\[ai\] \{"task":"priority","attempt":1,"result":"ok","durationMs":\d+,"outputTokens":42\}$/);
  } finally {
    console.info = original;
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    db.close();
  }
});

test('runAiTask: CLI veakood läbib muutmata (kordust ei tehta)', async () => {
  let count = 0;
  const counting = { ...client('not_logged_in'), complete: async (o) => { count++; return client('not_logged_in').complete(o); } };
  await assert.rejects(runAiTask(counting, { task: 't', messages: MESSAGES, schema: SCHEMA, log: () => {} }), { code: 'not_logged_in' });
  assert.equal(count, 1);
});
