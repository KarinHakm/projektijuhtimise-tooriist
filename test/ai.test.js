import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiClient, HETZNER_CHAT_URL } from '../server/ai/client.js';
import { runAiTask } from '../server/ai/run.js';
import { AiError, toHttpError } from '../server/ai/errors.js';
import { validateAgainst } from '../server/ai/validate.js';

// Kõik testid kasutavad võltsvastuseid: võrku ei saadeta midagi ja päris tokenit pole vaja.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const SECRET_CONTENT = 'SALAJANE-SISU';

const SCHEMA = {
  type: 'object',
  required: ['message', 'items'],
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    items: { type: 'array', minItems: 2, items: { type: 'string' } },
  },
};
const MESSAGES = [
  { role: 'system', content: 'Vasta JSON-iga.' },
  { role: 'user', content: `Kasutaja tekst: ${SECRET_CONTENT}` },
];
const GOOD = { message: `vastus ${SECRET_CONTENT}`, items: ['a', 'b'] };

const ok = (content, { finish = 'stop', tokens = 42 } = {}) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }], usage: { completion_tokens: tokens } }), { status: 200 });

// Võlts-fetch: tagastab järjest etteantud vastused ja jätab meelde, millega seda kutsuti.
function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return typeof next === 'function' ? next(init) : next.clone();
  };
  fn.calls = calls;
  return fn;
}

function setup(fetchImpl, opts = {}) {
  const logs = [];
  const client = createAiClient({ token: FAKE_TOKEN, model: 'Qwen3.8-27B', fetchImpl, ...opts });
  const run = () => runAiTask(client, { task: 'proov', messages: MESSAGES, schema: SCHEMA, log: (m) => logs.push(m), ...opts.run });
  return { client, run, logs };
}

test('päring saadab skeemi, lülitab mõtlemise välja ja kasutab serveri tokenit', async () => {
  const fetchImpl = fakeFetch(ok(JSON.stringify(GOOD)));
  await setup(fetchImpl).run();
  const [call] = fetchImpl.calls;
  assert.equal(call.url, HETZNER_CHAT_URL);
  assert.equal(call.init.headers.authorization, `Bearer ${FAKE_TOKEN}`);
  assert.equal(call.body.model, 'Qwen3.8-27B');
  assert.deepEqual(call.body.response_format, { type: 'json_schema', json_schema: { name: 'vastus', strict: true, schema: SCHEMA } });
  assert.deepEqual(call.body.chat_template_kwargs, { enable_thinking: false });
});

test('korrektne vastus: andmed ja mõõdikud, üks katse', async () => {
  const { run } = setup(fakeFetch(ok(JSON.stringify(GOOD), { tokens: 50 })));
  const { data, meta } = await run();
  assert.deepEqual(data, GOOD);
  assert.equal(meta.attempts, 1);
  assert.equal(meta.outputTokens, 50);
});

test('mitte-JSON vastuse järel tehakse üks kordus ja see õnnestub', async () => {
  const fetchImpl = fakeFetch(ok('see ei ole json'), ok(JSON.stringify(GOOD)));
  const { data, meta } = await setup(fetchImpl).run();
  assert.deepEqual(data, GOOD);
  assert.equal(meta.attempts, 2);
  assert.equal(fetchImpl.calls.length, 2);
});

test('kaks skeemile mittevastavat vastust annavad invalid_response ja rohkem ei proovita', async () => {
  const fetchImpl = fakeFetch(ok(JSON.stringify({ message: 'x', items: ['ainult üks'] })));
  await assert.rejects(setup(fetchImpl).run(), (e) => e instanceof AiError && e.code === 'invalid_response');
  assert.equal(fetchImpl.calls.length, 2);
});

test('katkenud vastus (finish_reason length) loetakse vigaseks ja korratakse', async () => {
  const fetchImpl = fakeFetch(ok('{"message":"poo', { finish: 'length' }), ok(JSON.stringify(GOOD)));
  const { meta, } = await setup(fetchImpl).run();
  assert.equal(meta.attempts, 2);
});

test('tühi vastus loetakse vigaseks ja korratakse', async () => {
  const fetchImpl = fakeFetch(ok(''), ok(JSON.stringify(GOOD)));
  assert.equal((await setup(fetchImpl).run()).meta.attempts, 2);
});

test('<think> plokk eemaldatakse enne JSON-i parsimist', async () => {
  const { data } = await setup(fakeFetch(ok(`<think>arutlen</think>\n${JSON.stringify(GOOD)}`))).run();
  assert.deepEqual(data, GOOD);
});

test('ülesande reeglite rikkumine põhjustab korduse', async () => {
  const fetchImpl = fakeFetch(ok(JSON.stringify(GOOD)));
  const logs = [];
  const client = createAiClient({ token: FAKE_TOKEN, model: 'm', fetchImpl });
  await assert.rejects(
    runAiTask(client, { task: 'proov', messages: MESSAGES, schema: SCHEMA, check: () => ['reegel rikutud'], log: (m) => logs.push(m) }),
    (e) => e.code === 'invalid_response',
  );
  assert.equal(fetchImpl.calls.length, 2);
  assert.deepEqual(logs.map((l) => l.result), ['invalid:rules', 'invalid:rules']);
});

test('429 annab rate_limited koos ooteajaga ja kordust ei tehta', async () => {
  const fetchImpl = fakeFetch(new Response('piir täis', { status: 429, headers: { 'retry-after': '30' } }));
  await assert.rejects(setup(fetchImpl).run(), (e) => e.code === 'rate_limited' && e.retryAfterSeconds === 30);
  assert.equal(fetchImpl.calls.length, 1);
});

test('500 annab unavailable ja kordust ei tehta', async () => {
  const fetchImpl = fakeFetch(new Response('sisemine viga', { status: 500 }));
  await assert.rejects(setup(fetchImpl).run(), (e) => e.code === 'unavailable');
  assert.equal(fetchImpl.calls.length, 1);
});

test('401 annab auth_failed', async () => {
  await assert.rejects(setup(fakeFetch(new Response('', { status: 401 }))).run(), (e) => e.code === 'auth_failed');
});

test('võrguviga annab unavailable', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(setup(fetchImpl).run(), (e) => e.code === 'unavailable');
});

test('ajalimiidi ületamine annab timeout ja kordust ei tehta', async () => {
  let calls = 0;
  // Vastust ei tule kunagi; päring katkeb ainult ajalimiidi signaali peale.
  const fetchImpl = (url, init) => {
    calls++;
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  };
  // AbortSignal.timeout ei hoia protsessi elus; päris serveris teeb seda kuulav HTTP server.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(setup(fetchImpl, { timeoutMs: 50 }).run(), (e) => e.code === 'timeout');
  } finally {
    clearInterval(keepAlive);
  }
  assert.equal(calls, 1);
});

test('token puudub: päringut ei saadeta ja tulemus on not_configured', async () => {
  let called = false;
  const client = createAiClient({ token: '', model: 'm', fetchImpl: async () => { called = true; } });
  assert.equal(client.configured, false);
  await assert.rejects(runAiTask(client, { task: 'proov', messages: MESSAGES, schema: SCHEMA, log: () => {} }), (e) => e.code === 'not_configured');
  assert.equal(called, false);
});

test('token ega sisu ei jõua kasutajale saadetavasse vigasse ega logidesse', async () => {
  const scenarios = [
    fakeFetch(new Response(`viga ${FAKE_TOKEN} ${SECRET_CONTENT}`, { status: 500 })),
    fakeFetch(new Response(`viga ${FAKE_TOKEN}`, { status: 429 })),
    fakeFetch(new Response(`viga ${FAKE_TOKEN}`, { status: 401 })),
    fakeFetch(ok(`mitte json ${SECRET_CONTENT} ${FAKE_TOKEN}`)),
    async () => { throw new Error(`võrguviga ${FAKE_TOKEN}`); },
  ];
  for (const fetchImpl of scenarios) {
    const { run, logs } = setup(fetchImpl);
    const err = await run().catch((e) => e);
    const sentToBrowser = JSON.stringify(toHttpError(err));
    const logged = JSON.stringify(logs);
    for (const secret of [FAKE_TOKEN, SECRET_CONTENT]) {
      assert.ok(!sentToBrowser.includes(secret), `vastuses on ${secret}`);
      assert.ok(!err.message.includes(secret), `veateates on ${secret}`);
      assert.ok(!logged.includes(secret), `logis on ${secret}`);
    }
  }
});

test('õnnestunud päringu log sisaldab ainult ohutuid mõõdikuid', async () => {
  const { run, logs } = setup(fakeFetch(ok(JSON.stringify(GOOD))));
  await run();
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(logs[0]).sort(), ['attempt', 'durationMs', 'outputTokens', 'result', 'task']);
  assert.ok(!JSON.stringify(logs).includes(SECRET_CONTENT));
});

test('vaikimisi logija kirjutab konsooli ainult mõõdikud', async () => {
  const lines = [];
  const orig = console.info;
  console.info = (...a) => lines.push(a.join(' '));
  try {
    const client = createAiClient({ token: FAKE_TOKEN, model: 'm', fetchImpl: fakeFetch(ok(JSON.stringify(GOOD))) });
    await runAiTask(client, { task: 'proov', messages: MESSAGES, schema: SCHEMA });
  } finally {
    console.info = orig;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[ai\] \{"task":"proov","attempt":1,"result":"ok","durationMs":\d+,"outputTokens":42\}$/);
});

test('toHttpError: igal veakoodil on eestikeelne teade ja õige HTTP staatus', () => {
  const expected = { not_configured: 503, auth_failed: 502, timeout: 504, rate_limited: 429, unavailable: 502, invalid_response: 502 };
  for (const [code, status] of Object.entries(expected)) {
    const { status: s, body } = toHttpError(new AiError(code));
    assert.equal(s, status);
    assert.equal(body.code, code);
    assert.ok(body.error.length > 10);
  }
  assert.equal(toHttpError(new Error('midagi muud')).body.code, 'unavailable');
});

test('Ajv validaator: veateadetes on ainult asukoht ja reegel, mitte andmed', () => {
  const res = validateAgainst(SCHEMA, { message: SECRET_CONTENT, items: [SECRET_CONTENT], lisa: 1 });
  assert.equal(res.valid, false);
  assert.ok(res.errors.includes('/items minItems'));
  assert.ok(res.errors.includes('/ additionalProperties'));
  assert.ok(!JSON.stringify(res.errors).includes(SECRET_CONTENT));
});
