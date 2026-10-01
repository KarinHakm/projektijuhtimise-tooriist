import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDisabledAi } from '../server/ai/client.js';
import { runAiTask } from '../server/ai/run.js';
import { AiError, toHttpError } from '../server/ai/errors.js';
import { validateAgainst } from '../server/ai/validate.js';
import { aiFail, aiHang, aiText, fakeAi } from './helpers/fake-ai.js';

// AI-ülesande käivitus (päring → kontroll → üks kordus). Kõik testid kasutavad võlts-AI-d; päris AI-d ei kutsuta.
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
const good = (opts) => aiText(JSON.stringify(GOOD), opts);

function setup(responses, { timeoutMs, check } = {}) {
  const ai = fakeAi(timeoutMs ? { timeoutMs } : {});
  ai.push(...responses);
  const logs = [];
  const run = () => runAiTask(ai.client, { task: 'proov', messages: MESSAGES, schema: SCHEMA, check, log: (m) => logs.push(m) });
  return { ai, run, logs };
}

test('päringus on sõnumid ja JSON-skeem', async () => {
  const { ai, run } = setup([good()]);
  await run();
  assert.deepEqual(ai.calls[0].messages, MESSAGES);
  assert.deepEqual(ai.calls[0].schema, SCHEMA);
});

test('korrektne vastus: andmed ja mõõdikud, üks katse', async () => {
  const { data, meta } = await setup([good({ tokens: 50 })]).run();
  assert.deepEqual(data, GOOD);
  assert.equal(meta.attempts, 1);
  assert.equal(meta.outputTokens, 50);
});

test('mitte-JSON vastuse järel tehakse üks kordus ja see õnnestub', async () => {
  const { ai, run } = setup([aiText('see ei ole json'), good()]);
  const { data, meta } = await run();
  assert.deepEqual(data, GOOD);
  assert.equal(meta.attempts, 2);
  assert.equal(ai.calls.length, 2);
});

test('kaks skeemile mittevastavat vastust annavad invalid_response ja rohkem ei proovita', async () => {
  const bad = aiText(JSON.stringify({ message: 'x', items: ['ainult üks'] }));
  const { ai, run } = setup([bad, bad, bad]);
  await assert.rejects(run(), (e) => e instanceof AiError && e.code === 'invalid_response');
  assert.equal(ai.calls.length, 2);
});

test('katkenud vastus loetakse vigaseks ja korratakse', async () => {
  assert.equal((await setup([aiText('{"message":"poo', { finish: 'length' }), good()]).run()).meta.attempts, 2);
});

test('tühi vastus loetakse vigaseks ja korratakse', async () => {
  assert.equal((await setup([aiText(''), good()]).run()).meta.attempts, 2);
});

test('<think> plokk eemaldatakse enne JSON-i parsimist', async () => {
  const { data } = await setup([aiText(`<think>arutlen</think>\n${JSON.stringify(GOOD)}`)]).run();
  assert.deepEqual(data, GOOD);
});

test('ülesande reeglite rikkumine põhjustab korduse', async () => {
  const { ai, run, logs } = setup([good(), good()], { check: () => ['reegel rikutud'] });
  await assert.rejects(run(), (e) => e.code === 'invalid_response');
  assert.equal(ai.calls.length, 2);
  assert.deepEqual(logs.map((l) => l.result), ['invalid:rules', 'invalid:rules']);
});

test('reeglite rikkumise logis on reeglite koodid (numbrid asendatud), mitte AI vastuse sisu', async () => {
  const check = () => ['lugu 2: vorming', 'lugu 5: vorming', 'loo vorming', 'a', 'b', 'c'];
  const { run, logs } = setup([good(), good()], { check });
  await assert.rejects(run());
  assert.deepEqual(logs[0].rules, ['lugu #: vorming', 'loo vorming', 'a', 'b', 'c']);
  assert.ok(!JSON.stringify(logs).includes(JSON.stringify(GOOD)));
});

test('teenuse vead (sisselogimata, kasutuslimiit, kättesaamatu) lähevad läbi muutmata ja kordust ei tehta', async () => {
  for (const [code, opts] of [['not_logged_in'], ['usage_limit', { retryAfterSeconds: 600 }], ['unavailable'], ['cli_missing']]) {
    const { ai, run } = setup([aiFail(code, opts), good()]);
    await assert.rejects(run(), (e) => e.code === code && (code !== 'usage_limit' || e.retryAfterSeconds === 600));
    assert.equal(ai.calls.length, 1, code);
  }
});

test('ajalimiidi ületamine annab timeout ja kordust ei tehta', async () => {
  const { ai, run } = setup([aiHang(), good()], { timeoutMs: 50 });
  await assert.rejects(run(), (e) => e.code === 'timeout');
  assert.equal(ai.calls.length, 1);
});

test('AI välja lülitatud: tulemus not_configured', async () => {
  const off = createDisabledAi();
  assert.equal(off.configured, false);
  await assert.rejects(runAiTask(off, { task: 'proov', messages: MESSAGES, schema: SCHEMA, log: () => {} }), (e) => e.code === 'not_configured');
});

test('sisu ei jõua kasutajale saadetavasse vigasse ega logidesse', async () => {
  for (const responses of [[aiFail('unavailable')], [aiText(`mitte json ${SECRET_CONTENT}`), aiText(`mitte json ${SECRET_CONTENT}`)], [() => { throw new Error(`viga ${SECRET_CONTENT}`); }]]) {
    const { run, logs } = setup(responses);
    const err = await run().catch((e) => e);
    const sentToBrowser = JSON.stringify(toHttpError(err));
    assert.ok(!sentToBrowser.includes(SECRET_CONTENT), 'vastuses on sisu');
    assert.ok(!err.message.includes(SECRET_CONTENT), 'veateates on sisu');
    assert.ok(!JSON.stringify(logs).includes(SECRET_CONTENT), 'logis on sisu');
  }
});

test('õnnestunud päringu log sisaldab ainult ohutuid mõõdikuid', async () => {
  const { run, logs } = setup([good()]);
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
    const ai = fakeAi();
    ai.push(good());
    await runAiTask(ai.client, { task: 'proov', messages: MESSAGES, schema: SCHEMA });
  } finally {
    console.info = orig;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[ai\] \{"task":"proov","attempt":1,"result":"ok","durationMs":\d+,"outputTokens":42\}$/);
});

test('toHttpError: igal veakoodil on eestikeelne teade ja õige HTTP staatus', () => {
  const expected = { not_configured: 503, timeout: 504, unavailable: 502, invalid_response: 502, cli_missing: 503, not_logged_in: 503, usage_limit: 429 };
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
