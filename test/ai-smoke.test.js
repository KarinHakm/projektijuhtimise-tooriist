import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDisabledAi } from '../server/ai/client.js';
import { runSmoke, formatSmoke } from '../scripts/ai-smoke.js';
import { aiFail, aiText, fakeAi } from './helpers/fake-ai.js';

// npm run ai:smoke: täpselt üks päring, väljundis ainult ohutud väljad. Võlts-AI; päris AI-d ei kutsuta.
const SECRET_CONTENT = 'SALAJANE-AI-VASTUS';
const smoke = async (response) => {
  const ai = fakeAi();
  ai.push(response);
  return { r: await runSmoke(ai.client), calls: ai.calls };
};
function assertNoSecrets(line) {
  assert.ok(!line.includes(SECRET_CONTENT), 'väljundis on AI vastuse tekst');
}

test('õnnestunud vastus: täpselt üks päring, tulemus ok', async () => {
  const { r, calls } = await smoke(aiText('{"status":"ok","keel":"et"}', { tokens: 12 }));
  assert.equal(calls.length, 1);
  assert.equal(r.result, 'ok');
  assert.equal(r.schema, 'korras');
  assert.equal(r.outputTokens, 12);
  assert.match(formatSmoke(r), /^AI smoke-test: tulemus=ok \| kestus=\d+ ms \| väljundtokeneid=12 \| skeem=korras$/);
});

test('päring on fikseeritud ja väike: projekti andmeid ei saadeta, maxTokens 100', async () => {
  const { calls } = await smoke(aiText('{"status":"ok","keel":"et"}'));
  assert.equal(calls[0].maxTokens, 100);
  assert.equal(calls[0].messages.length, 2);
});

test('mitte-JSON vastus: ainult üks päring, kordust ei tehta', async () => {
  const { r, calls } = await smoke(aiText(`vabatekst ${SECRET_CONTENT}`));
  assert.equal(calls.length, 1);
  assert.equal(r.result, 'invalid_response');
  assert.equal(r.schema, 'ei ole JSON');
  assertNoSecrets(formatSmoke(r));
});

test('skeemile mittevastav vastus: ainult üks päring, kordust ei tehta', async () => {
  const { r } = await smoke(aiText(JSON.stringify({ status: SECRET_CONTENT, keel: 'et' })));
  assert.equal(r.schema, 'vigane');
  assertNoSecrets(formatSmoke(r));
});

test('katkenud vastus: ainult üks päring, kordust ei tehta', async () => {
  const { r } = await smoke(aiText(`{"status":"${SECRET_CONTENT}`, { finish: 'length' }));
  assert.equal(r.schema, 'katkenud');
  assertNoSecrets(formatSmoke(r));
});

test('teenuse viga (nt sisselogimata): väljundis ainult meie teade', async () => {
  const { r, calls } = await smoke(aiFail('not_logged_in'));
  assert.equal(calls.length, 1);
  assert.equal(r.result, 'not_logged_in');
  assert.match(formatSmoke(r), /teade=Claude Code ei ole serveri arvutis sisse logitud/);
});

test('AI välja lülitatud: tulemus not_configured', async () => {
  const r = await runSmoke(createDisabledAi());
  assert.equal(r.result, 'not_configured');
});
