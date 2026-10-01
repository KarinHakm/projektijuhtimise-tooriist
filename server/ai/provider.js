import { spawnSync } from 'node:child_process';
import { createDisabledAi, DEFAULT_TIMEOUT_MS } from './client.js';
import { CLAUDE_DEFAULT_MODEL, createClaudeCliClient } from './claude-cli.js';

// Valib rakenduse AI keskkonnamuutujate järgi:
//   AI_PROVIDER=claude-cli (vaikimisi) – serveri arvutis sisse logitud Claude Code, mudel CLAUDE_MODEL (vaikimisi sonnet)
//   AI_PROVIDER=off – AI välja lülitatud (npm run demo)
export function createConfiguredAi(env = process.env, { commandExists = defaultCommandExists } = {}) {
  const provider = env.AI_PROVIDER || 'claude-cli';
  const timeoutMs = Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  if (provider === 'off') return { ai: createDisabledAi({ timeoutMs }), description: 'välja lülitatud (AI nupud annavad teate, käsitsi saab edasi töötada)' };
  if (provider !== 'claude-cli') {
    return { ai: createDisabledAi({ timeoutMs }), description: `tundmatu AI_PROVIDER „${provider}“ – AI välja lülitatud (lubatud: claude-cli, off)` };
  }
  const command = env.CLAUDE_COMMAND || 'claude';
  const model = env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL;
  const available = commandExists(command);
  const ai = createClaudeCliClient({ command, model, timeoutMs, available, env });
  return {
    ai,
    description: available
      ? `Claude Code CLI, mudel ${model} (sisselogimist kontrollitakse esimese AI päringu ajal)`
      : `Claude Code CLI-d („${command}“) ei leitud – AI nupud annavad teate, käsitsi saab edasi töötada`,
  };
}

// Kontrollib ainult, kas käsk on olemas (`claude --version`). AI päringut ei tehta.
function defaultCommandExists(command) {
  const r = spawnSync(command, ['--version'], { shell: false, timeout: 10_000, stdio: 'ignore' });
  return r.status === 0;
}
