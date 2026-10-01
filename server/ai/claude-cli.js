import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiError } from './errors.js';

// AI-teenus Claude Code CLI kaudu (`claude -p`). Kasutab serveri arvutis sisse logitud kasutaja
// Claude'i tellimust – mitte API-võtit. Sama liides mis teistel klientidel: complete() → { content, finishReason, outputTokens }.
//
// Õigused on võimalikult piiratud: tööriistad keelatud (failide lugemine, käsud, veeb), MCP-serverid ja
// kohandused (CLAUDE.md, oskused, pluginad, hook'id) välja lülitatud, sessiooni ei salvestata, töökaust on
// tühi ajutine kaust. Kogu vajalik kontekst on päringus endas; CLI ei uuri projekti.
// Käsk käivitatakse ilma shellita, prompt läheb standardsisendisse. Päringu sisu, AI vastust ega CLI
// veateksti ei logita ega näidata kasutajale – ainult meie enda veakoodid.

export const CLAUDE_DEFAULT_MODEL = 'sonnet';
const MAX_OUTPUT_BYTES = 2_000_000;

// API-võtmed eemaldatakse lapsprotsessi keskkonnast, et CLI kasutaks tellimuse sisselogimist.
const STRIPPED_ENV = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

export function claudeArgs({ model, system, schema }) {
  return [
    '-p',
    '--output-format', 'json',
    '--model', model,
    '--tools', '', // kõik sisseehitatud tööriistad keelatud
    '--permission-mode', 'dontAsk', // midagi, mis pole lubatud, ei käivitata
    '--strict-mcp-config', // MCP-servereid ei laadita (--mcp-config puudub)
    '--safe-mode', // CLAUDE.md, oskused, pluginad, hook'id, kohandatud käsud välja lülitatud; sisselogimist ei puuduta
    '--disable-slash-commands',
    '--no-session-persistence',
    '--system-prompt', system,
    '--json-schema', JSON.stringify(schema),
  ];
}

// Süsteemiteade eraldi; ülejäänud sõnumid üheks tekstiks (praegu on igas ülesandes üks kasutaja sõnum).
export function splitMessages(messages, schema) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  const prompt = rest.length === 1 ? rest[0].content : rest.map((m) => `${m.role === 'assistant' ? 'AI' : 'Kasutaja'}: ${m.content}`).join('\n\n');
  // Kui struktureeritud väljund ei rakendu, peab vastus ikkagi olema skeemile vastav JSON (server kontrollib).
  return { system: `${system}\n\nVasta ainult JSON-objektiga, mis vastab sellele JSON-skeemile:\n${JSON.stringify(schema)}`, prompt };
}

// CLI veateate liigitus (tekst ise jääb serverisse ja seda ei logita).
export function classifyCliError(text) {
  const t = String(text ?? '');
  if (/not logged in|please run \/login|\/login|invalid api key|oauth token (has )?(expired|revoked)|authentication[_ ]error|unauthori[sz]ed/i.test(t)) {
    return new AiError('not_logged_in');
  }
  if (/usage limit|limit reached|hit your (usage |session |weekly )?limit|rate[_ -]?limit|too many requests/i.test(t)) {
    const reset = t.match(/\|(\d{10})\b/);
    const retryAfterSeconds = reset ? Math.max(0, Number(reset[1]) - Math.floor(Date.now() / 1000)) : undefined;
    return new AiError('usage_limit', { retryAfterSeconds });
  }
  return new AiError('unavailable');
}

export function createClaudeCliClient({
  command = 'claude', prefixArgs = [], model = CLAUDE_DEFAULT_MODEL, timeoutMs, available = true, spawnImpl = spawn, env = process.env,
} = {}) {
  const childEnv = Object.fromEntries(Object.entries(env).filter(([k]) => !STRIPPED_ENV.includes(k)));
  return {
    configured: available,
    provider: 'claude-cli',
    model,
    timeoutMs,

    async complete({ messages, schema, timeoutMs: attemptTimeout = timeoutMs }) {
      if (!available) throw new AiError('cli_missing');
      const { system, prompt } = splitMessages(messages, schema);
      const cwd = mkdtempSync(join(tmpdir(), 'pjt-claude-')); // tühi töökaust: midagi pole uurida
      try {
        const { code, stdout, stderr, timedOut, spawnError } = await runOnce({
          spawnImpl, command, args: [...prefixArgs, ...claudeArgs({ model, system, schema })], cwd, env: childEnv, input: prompt, timeoutMs: attemptTimeout,
        });
        if (spawnError) throw new AiError(spawnError.code === 'ENOENT' ? 'cli_missing' : 'unavailable');
        if (timedOut) throw new AiError('timeout');

        let body;
        try {
          body = JSON.parse(stdout);
        } catch {
          throw classifyCliError(`${stderr}\n${stdout}`);
        }
        if (body?.is_error || (body?.subtype && body.subtype !== 'success') || code !== 0) {
          throw classifyCliError(`${typeof body?.result === 'string' ? body.result : ''}\n${stderr}`);
        }
        const structured = body?.structured_output;
        const content = structured && typeof structured === 'object' ? JSON.stringify(structured) : typeof body?.result === 'string' ? body.result : '';
        const outputTokens = Number.isFinite(body?.usage?.output_tokens) ? body.usage.output_tokens : null;
        return { content, finishReason: 'stop', outputTokens };
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

function runOnce({ spawnImpl, command, args, cwd, env, input, timeoutMs }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let timer;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, ...result });
    };
    let child;
    try {
      child = spawnImpl(command, args, { cwd, env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      done({ spawnError: err });
      return;
    }
    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000).unref();
      done({ code: null });
    }, Math.max(1, timeoutMs ?? 150_000));
    const cap = (s, chunk) => (s.length < MAX_OUTPUT_BYTES ? s + chunk : s);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => { stdout = cap(stdout, c); });
    child.stderr.on('data', (c) => { stderr = cap(stderr, c); });
    child.on('error', (err) => done({ spawnError: err }));
    child.on('close', (code) => done({ code }));
    child.stdin.on('error', () => {}); // protsess võib lõppeda enne, kui sisend on kirjutatud
    child.stdin.end(input);
  });
}
