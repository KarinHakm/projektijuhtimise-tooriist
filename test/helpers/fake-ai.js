import { AiError } from '../../server/ai/errors.js';

// Võlts-AI testidele: sama liides mis rakenduse AI kliendil (complete), päris AI-d ei kutsuta.
// push() lisab järjekorda vastuseid; calls on saadud päringud ({ messages, schema, maxTokens, timeoutMs }).
export function fakeAi({ timeoutMs = 150_000 } = {}) {
  const queue = [];
  const calls = [];
  const client = {
    configured: true,
    provider: 'fake',
    timeoutMs,
    async complete(req) {
      calls.push(req);
      const next = queue.shift();
      if (!next) throw new Error('võlts-AI-l pole vastust');
      let timer;
      const limit = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new AiError('timeout')), Math.max(1, req.timeoutMs ?? timeoutMs));
      });
      try {
        return await Promise.race([Promise.resolve().then(() => next(req)), limit]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
  return { client, calls, push: (...responses) => queue.push(...responses) };
}

// Klient, mida ei tohi kutsuda: iga kutse loetakse ja lõpeb veaga.
export function forbiddenAi() {
  const state = { calls: 0 };
  state.client = { configured: true, provider: 'fake', timeoutMs: 1000, complete: async () => { state.calls++; throw new Error('AI-d ei tohi kutsuda'); } };
  return state;
}

export const aiOk = (data, outputTokens = 300) => () => ({ content: JSON.stringify(data), finishReason: 'stop', outputTokens });
export const aiText = (content, { finish = 'stop', tokens = 42 } = {}) => () => ({ content, finishReason: finish, outputTokens: tokens });
export const aiFail = (code, opts) => () => { throw new AiError(code, opts); };
export const aiHang = () => () => new Promise(() => {});
