import { AiError } from './errors.js';

// Ühine osa AI klientidele. Rakenduse AI-teenus on Claude Code CLI (server/ai/claude-cli.js);
// teenuse valib server/ai/provider.js. Iga klient täidab sama liidest:
//   { configured, timeoutMs, complete({ messages, schema, maxTokens, timeoutMs }) → { content, finishReason, outputTokens } }

export const DEFAULT_TIMEOUT_MS = 150_000;

// AI välja lülitatud (npm run demo, AI_PROVIDER=off, testid): iga kutse annab not_configured, midagi ei saadeta.
export function createDisabledAi({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return {
    configured: false,
    provider: 'off',
    timeoutMs,
    async complete() {
      throw new AiError('not_configured');
    },
  };
}
