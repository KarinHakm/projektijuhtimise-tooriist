import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiClient } from '../server/ai/client.js';
import { runSmoke, formatSmoke } from '../scripts/ai-smoke.js';

// Võltsvastused: võrku ei saadeta midagi ja päris tokenit pole vaja.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const SECRET_CONTENT = 'SALAJANE-AI-VASTUS';

const ok = (content, finish = 'stop') =>
  new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }], usage: { completion_tokens: 12 } }), { status: 200 });

function fakeFetch(response) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return typeof response === 'function' ? response() : response.clone();
  };
  fn.calls = calls;
  return fn;
}

const client = (fetchImpl, token = FAKE_TOKEN) => createAiClient({ token, model: 'Qwen3.8-27B', fetchImpl });

function assertNoSecrets(line) {
  assert.ok(!line.includes(FAKE_TOKEN), 'väljundis on token');
  assert.ok(!line.includes(SECRET_CONTENT), 'väljundis on AI vastuse tekst');
}

test('õnnestunud vastus: täpselt üks päring, tulemus ok', async () => {
  const fetchImpl = fakeFetch(ok('{"status":"ok","keel":"et"}'));
  const r = await runSmoke(client(fetchImpl));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(r.result, 'ok');
  assert.equal(r.schema, 'korras');
  assert.equal(r.outputTokens, 12);
  assert.match(formatSmoke(r), /^AI smoke-test: tulemus=ok \| kestus=\d+ ms \| väljundtokeneid=12 \| skeem=korras$/);
});

test('päring on fikseeritud ja väike: projekti andmeid ei saadeta, max_tokens 100', async () => {
  const fetchImpl = fakeFetch(ok('{"status":"ok","keel":"et"}'));
  await runSmoke(client(fetchImpl));
  const [body] = fetchImpl.calls;
  assert.equal(body.max_tokens, 100);
  assert.equal(body.messages.length, 2);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
});

test('mitte-JSON vastus: ainult üks päring, kordust ei tehta', async () => {
  const fetchImpl = fakeFetch(ok(`vabatekst ${SECRET_CONTENT} ${FAKE_TOKEN}`));
  const r = await runSmoke(client(fetchImpl));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(r.result, 'invalid_response');
  assert.equal(r.schema, 'ei ole JSON');
  assertNoSecrets(formatSmoke(r));
});

test('skeemile mittevastav vastus: ainult üks päring, kordust ei tehta', async () => {
  const fetchImpl = fakeFetch(ok(JSON.stringify({ status: SECRET_CONTENT, keel: 'et' })));
  const r = await runSmoke(client(fetchImpl));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(r.schema, 'vigane');
  assertNoSecrets(formatSmoke(r));
});

test('katkenud vastus: ainult üks päring, kordust ei tehta', async () => {
  const fetchImpl = fakeFetch(ok(`{"status":"${SECRET_CONTENT}`, 'length'));
  const r = await runSmoke(client(fetchImpl));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(r.schema, 'katkenud');
  assertNoSecrets(formatSmoke(r));
});

test('teenuse viga: üks päring, väljundis ainult meie teade, mitte teenuse veatekst', async () => {
  const fetchImpl = fakeFetch(new Response(`viga ${FAKE_TOKEN} ${SECRET_CONTENT}`, { status: 500 }));
  const r = await runSmoke(client(fetchImpl));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(r.result, 'unavailable');
  const line = formatSmoke(r);
  assert.match(line, /teade=AI-teenus ei ole praegu kättesaadav/);
  assertNoSecrets(line);
});

test('token puudub: päringut ei saadeta', async () => {
  const fetchImpl = fakeFetch(ok('{"status":"ok","keel":"et"}'));
  const r = await runSmoke(client(fetchImpl, ''));
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(r.result, 'not_configured');
});
