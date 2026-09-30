import { AiError } from './errors.js';
import { validateAgainst } from './validate.js';

// Vähim aeg (ms), mis peab ajaeelarvest alles olema, et korduspäringut üldse proovida.
const MIN_RETRY_BUDGET_MS = 5_000;

// Käivitab ühe AI-ülesande: päring → vastuse kontroll → vajaduse korral üks kordus.
// Vigase vastuse (katkenud, tühi, mitte-JSON, skeemile või reeglitele mittevastav) korral proovitakse
// üks kord uuesti. Ajalimiidi, päringupiiri ja teenuse vigade korral ei korrata (kasutaja otsustab ise).
// Tagastab { data, meta: { durationMs, outputTokens, attempts } }. Midagi ei salvestata.
export async function runAiTask(client, { task, messages, schema, check, maxTokens, log = logAiMetrics }) {
  const started = Date.now();
  let outputTokens = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptStarted = Date.now();
    let result;
    try {
      result = await client.complete({ messages, schema, maxTokens, timeoutMs: client.timeoutMs - (attemptStarted - started) });
    } catch (err) {
      const aiErr = err instanceof AiError ? err : new AiError('unavailable');
      log({ task, attempt, result: aiErr.code, durationMs: Date.now() - attemptStarted });
      throw aiErr;
    }
    outputTokens += result.outputTokens ?? 0;

    const checked = checkResponse(result, schema, check);
    log({ task, attempt, result: checked.reason ? `invalid:${checked.reason}` : 'ok', durationMs: Date.now() - attemptStarted, outputTokens: result.outputTokens });
    if (!checked.reason) {
      return { data: checked.data, meta: { durationMs: Date.now() - started, outputTokens, attempts: attempt } };
    }
    if (client.timeoutMs - (Date.now() - started) < MIN_RETRY_BUDGET_MS) break;
  }
  throw new AiError('invalid_response');
}

// Tagastab { data } korrektse vastuse korral, muidu { reason } (reason on ohutu logida).
function checkResponse(result, schema, check) {
  if (result.finishReason !== 'stop') return { reason: `finish_${result.finishReason ?? 'missing'}` };
  const content = result.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!content) return { reason: 'empty' };
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return { reason: 'not_json' };
  }
  if (!validateAgainst(schema, data).valid) return { reason: 'schema' };
  if (check && check(data).length > 0) return { reason: 'rules' };
  return { data };
}

// Logib ainult ohutud mõõdikud: ülesande nimi, katse number, tulemuse kood, kestus ja tokenite arv.
// Päringu sisu, AI vastust ega teenuse veateksti ei logita.
export function logAiMetrics({ task, attempt, result, durationMs, outputTokens }) {
  const safe = { task, attempt, result, durationMs };
  if (Number.isFinite(outputTokens)) safe.outputTokens = outputTokens;
  console.info(`[ai] ${JSON.stringify(safe)}`);
}
