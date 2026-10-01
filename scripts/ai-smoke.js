// AI ühenduse kontroll: saadab AI-teenusele TÄPSELT ÜHE väikese päringu ja kuvab ainult ohutud mõõdikud.
// Kasutamine: npm run ai:smoke
//
// - Kasutab sama AI-klienti ja skeemi valideerimist mis rakendus (server/ai/*).
// - Kutsub otse client.complete() → üks päring, kordust ei tehta (runAiTask'i, mis kordab, ei kasutata).
// - Ei impordi andmebaasi moodulit → andmebaasi ei avata ega muudeta.
// - Ei kuva tokenit, päringu päiseid, AI vastuse teksti ega teenuse veateksti.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createConfiguredAi } from '../server/ai/provider.js';
import { validateAgainst } from '../server/ai/validate.js';
import { AiError } from '../server/ai/errors.js';

// Fikseeritud väike päring: projekti andmeid ega kasutaja sisendit ei saadeta.
const SCHEMA = {
  type: 'object',
  required: ['status', 'keel'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ok'] },
    keel: { type: 'string', enum: ['et'] },
  },
};
const MESSAGES = [
  { role: 'system', content: 'Vasta ainult JSON-iga, mis vastab etteantud skeemile.' },
  { role: 'user', content: 'Kinnita ühenduse toimimine: status "ok", keel "et".' },
];

// Tagastab ainult ohutud väljad: tulemuse kood, kestus, tokenite arv, skeemi kontrolli tulemus
// ja (vea korral) meie enda eestikeelne teade.
export async function runSmoke(client) {
  const started = Date.now();
  try {
    const res = await client.complete({ messages: MESSAGES, schema: SCHEMA, schemaName: 'smoke', maxTokens: 100 });
    const durationMs = Date.now() - started;
    let schema = 'korras';
    if (res.finishReason !== 'stop') {
      schema = 'katkenud';
    } else {
      try {
        const data = JSON.parse(res.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim());
        if (!validateAgainst(SCHEMA, data).valid) schema = 'vigane';
      } catch {
        schema = 'ei ole JSON';
      }
    }
    return { result: schema === 'korras' ? 'ok' : 'invalid_response', durationMs, outputTokens: res.outputTokens, schema };
  } catch (err) {
    const e = err instanceof AiError ? err : new AiError('unavailable');
    return { result: e.code, durationMs: Date.now() - started, message: e.message };
  }
}

export function formatSmoke(r) {
  const parts = [`tulemus=${r.result}`, `kestus=${r.durationMs} ms`];
  if (r.outputTokens != null) parts.push(`väljundtokeneid=${r.outputTokens}`);
  if (r.schema) parts.push(`skeem=${r.schema}`);
  if (r.message) parts.push(`teade=${r.message}`);
  return `AI smoke-test: ${parts.join(' | ')}`;
}

// Käivitatakse ainult otse (npm run ai:smoke), mitte importimisel.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync('.env')) process.loadEnvFile('.env');

  const { ai: client, description } = createConfiguredAi(process.env);
  console.log(`AI: ${description}`);
  const result = await runSmoke(client);
  console.log(formatSmoke(result));
  process.exitCode = result.result === 'ok' ? 0 : 1;
}
