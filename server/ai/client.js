import { AiError } from './errors.js';

// Ainus fail, mis teab AI-teenusest (Hetzner Inference API, OpenAI-ühilduv).
// Token antakse sisse loomisel ja seda ei tagastata, logita ega panda üheski veas kaasa.

export const HETZNER_CHAT_URL = 'https://inference.hetzner.com/api/v1/chat/completions';
export const DEFAULT_TIMEOUT_MS = 150_000;

export function createAiClient({ token, model, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch, url = HETZNER_CHAT_URL } = {}) {
  return {
    configured: Boolean(token && model),
    timeoutMs,

    // Saadab ühe päringu. Tagastab { content, finishReason, outputTokens } või viskab AiError'i.
    async complete({ messages, schema, schemaName = 'vastus', maxTokens = 4096, temperature = 0.3, timeoutMs: attemptTimeout = timeoutMs }) {
      if (!token || !model) throw new AiError('not_configured');

      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
            chat_template_kwargs: { enable_thinking: false },
          }),
          signal: AbortSignal.timeout(attemptTimeout),
        });
      } catch (err) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw new AiError('timeout');
        throw new AiError('unavailable');
      }

      if (!res.ok) {
        // Veavastuse sisu ei loeta: see võib sisaldada midagi, mida ei tohi logida ega kasutajale näidata.
        res.body?.cancel?.().catch(() => {});
        if (res.status === 429) throw new AiError('rate_limited', { retryAfterSeconds: parseRetryAfter(res.headers.get('retry-after')) });
        if (res.status === 401 || res.status === 403) throw new AiError('auth_failed');
        throw new AiError('unavailable');
      }

      let body;
      try {
        body = await res.json();
      } catch (err) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw new AiError('timeout');
        throw new AiError('invalid_response');
      }
      const choice = body?.choices?.[0];
      return {
        content: typeof choice?.message?.content === 'string' ? choice.message.content : '',
        finishReason: choice?.finish_reason ?? null,
        outputTokens: Number.isFinite(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null,
      };
    },
  };
}

function parseRetryAfter(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined;
}
