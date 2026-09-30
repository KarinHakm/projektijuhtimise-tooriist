import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createAiClient } from '../server/ai/client.js';
import { addMessage } from '../server/conversation.js';

// Ajutine andmebaas ja võlts-AI: arendaja data/app.db faili ei puututa ja võrku ei saadeta midagi.
const FAKE_TOKEN = 'test-TOKEN-ärge-lekitage';
const IDEA = 'Spordiklubi tahab veebi, kus saab treeningutega tutvuda ja liikmeks astuda.';

const QUESTIONS = {
  message: 'Täpsustan paari asja.',
  questions: [
    { text: 'Kes on rakenduse kasutajad?', multiSelect: true, options: ['Külastaja', 'Klubi liige', 'Administraator'] },
    { text: 'Kas liikmetasu makstakse rakenduses?', multiSelect: false, options: ['Jah, veebis', 'Ei, kohapeal'] },
  ],
  summary: '',
};
const SUMMARY = { message: 'Aitäh, sain aru.', questions: [], summary: 'Kasutajad on külastaja ja liige; tasu makstakse veebis.' };

const aiOk = (data) => () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(data) } }], usage: { completion_tokens: 50 } }), { status: 200 });
const aiStatus = (status, headers = {}) => () => new Response(`teenuse viga ${FAKE_TOKEN}`, { status, headers });

let dir, db, projectId, server, base, ai;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-conv-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  ai = fakeAi();
  server = createApp({ db, ai: ai.client }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}/conversation`;
});
afterEach(async () => {
  server.closeAllConnections(); // pooleli ühendused ei tohi testi lõppu kinni hoida
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

// Võlts-AI: vastused tulevad järjekorrast; iga kutse jäetakse meelde (sh päringu sisu).
function fakeAi({ timeoutMs } = {}) {
  const queue = [];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const next = queue.shift();
    if (!next) throw new Error('võlts-AI-l pole vastust');
    return next(init);
  };
  const client = createAiClient({ token: FAKE_TOKEN, model: 'Qwen3.8-27B', fetchImpl, ...(timeoutMs ? { timeoutMs } : {}) });
  return { client, calls, push: (...r) => queue.push(...r) };
}

const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const getConversation = async () => (await fetch(base)).json();
const lastUserPrompt = () => ai.calls.at(-1).messages.find((m) => m.role === 'user').content;

async function startWithQuestions() {
  ai.push(aiOk(QUESTIONS));
  const res = await post('/idea', { text: IDEA });
  assert.equal(res.status, 200);
  const { messages } = await res.json();
  return messages.find((m) => m.kind === 'questions');
}

const validAnswers = (q) => ({
  questionsMessageId: q.id,
  answers: [
    { questionId: 'k1', selected: ['Külastaja', 'Administraator'], other: 'Treener', skipped: false },
    { questionId: 'k2', selected: [], other: null, skipped: true },
  ],
});

// --- Idee ja küsimused ---

test('idee salvestatakse ja AI küsimused salvestatakse vestlusse', async () => {
  const q = await startWithQuestions();
  assert.equal(ai.calls.length, 1);
  const { messages, aiRunning } = await getConversation();
  assert.equal(aiRunning, false);
  assert.deepEqual(messages.map((m) => `${m.role}:${m.kind}`), ['user:idea', 'assistant:questions']);
  assert.equal(messages[0].content.text, IDEA);
  assert.deepEqual(q.content.questions.map((x) => x.id), ['k1', 'k2']);
  assert.equal(q.replyTo, messages[0].id);
});

test('AI päring kasutab JSON-skeemi, mõtlemine on väljas ja idee on andmeplokis', async () => {
  await startWithQuestions();
  const [call] = ai.calls;
  assert.equal(call.response_format.type, 'json_schema');
  assert.deepEqual(call.chat_template_kwargs, { enable_thinking: false });
  assert.match(lastUserPrompt(), new RegExp(`<andmed>[\\s\\S]*${IDEA}[\\s\\S]*</andmed>`));
});

test('tühi või liiga pikk idee annab 400 ja midagi ei salvestata ega AI-d ei kutsuta', async () => {
  assert.equal((await post('/idea', { text: '   ' })).status, 400);
  assert.equal((await post('/idea', { text: 'x'.repeat(2001) })).status, 400);
  assert.equal(ai.calls.length, 0);
  assert.deepEqual((await getConversation()).messages, []);
});

test('olematu projekt annab 404', async () => {
  const res = await fetch(base.replace(`/projects/${projectId}/`, '/projects/999/'));
  assert.equal(res.status, 404);
});

// --- Idempotentsus: värskendus, katkestus, kordus ---

test('sama idee uuesti saatmine pärast AI vastust ei lisa rida ega kutsu AI-d', async () => {
  await startWithQuestions();
  const res = await post('/idea', { text: `  ${IDEA} ` });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).messages.length, 2);
  assert.equal(ai.calls.length, 1);
});

test('teistsugune idee pärast alustamist annab 409 ja midagi ei muutu', async () => {
  await startWithQuestions();
  const res = await post('/idea', { text: 'Hoopis teine idee.' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'already_started');
  assert.equal((await getConversation()).messages.length, 2);
  assert.equal(ai.calls.length, 1);
});

test('AI vea korral jääb idee alles; sama idee uuesti saatmine ei dubleeri seda ja kutsub AI-d üks kord', async () => {
  ai.push(aiStatus(500));
  const failed = await post('/idea', { text: IDEA });
  assert.equal(failed.status, 502);
  assert.equal((await failed.json()).code, 'unavailable');
  assert.deepEqual((await getConversation()).messages.map((m) => m.kind), ['idea']);

  ai.push(aiOk(QUESTIONS));
  const retried = await post('/idea', { text: IDEA });
  assert.equal(retried.status, 200);
  assert.deepEqual((await retried.json()).messages.map((m) => m.kind), ['idea', 'questions']);
  assert.equal(ai.calls.length, 2);
});

test('continue: vastuseta kasutaja sõnumi korral kutsub AI-d; kui vastus on olemas, ei kutsu', async () => {
  ai.push(aiStatus(500));
  await post('/idea', { text: IDEA });
  ai.push(aiOk(QUESTIONS));
  assert.equal((await post('/continue')).status, 200);
  assert.equal(ai.calls.length, 2);

  const again = await post('/continue');
  assert.equal(again.status, 200);
  assert.equal(ai.calls.length, 2);
  assert.equal((await again.json()).messages.length, 2);
});

test('kaks samaaegset päringut: üks kutsub AI-d, teine saab 409 in_progress', async () => {
  ai.push(aiStatus(500));
  await post('/idea', { text: IDEA });
  let release;
  ai.push(() => new Promise((r) => { release = () => r(aiOk(QUESTIONS)()); }));

  const first = post('/continue');
  await waitFor(() => ai.calls.length === 2);
  assert.equal((await getConversation()).aiRunning, true);
  const second = await post('/continue');
  assert.equal(second.status, 409);
  assert.equal((await second.json()).code, 'in_progress');

  release();
  assert.equal((await first).status, 200);
  assert.equal(ai.calls.length, 2);
  assert.deepEqual((await getConversation()).messages.map((m) => m.kind), ['idea', 'questions']);
});

test('kui brauser katkestab ühenduse AI töö ajal, salvestatakse vastus siiski täpselt üks kord', async () => {
  let release;
  ai.push(() => new Promise((r) => { release = () => r(aiOk(QUESTIONS)()); }));
  const controller = new AbortController();
  const aborted = fetch(`${base}/idea`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: IDEA }), signal: controller.signal,
  }).catch((e) => e);

  await waitFor(() => ai.calls.length === 1);
  controller.abort();
  assert.equal((await aborted).name, 'AbortError');

  // "Värskendus": GET näitab, et AI töötab ja vastust veel pole; sama idee uuesti saatmine ei käivita teist kutset.
  const during = await getConversation();
  assert.equal(during.aiRunning, true);
  assert.deepEqual(during.messages.map((m) => m.kind), ['idea']);
  assert.equal((await post('/idea', { text: IDEA })).status, 409);

  release();
  await waitFor(async () => (await getConversation()).aiRunning === false);
  assert.deepEqual((await getConversation()).messages.map((m) => m.kind), ['idea', 'questions']);
  assert.equal(ai.calls.length, 1);
});

test('andmebaas ei luba samale sõnumile teist vastust ega projektile teist ideed', () => {
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: IDEA } });
  assert.ok(idea);
  assert.equal(addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: 'teine' } }), null);
  assert.ok(addMessage(db, { projectId, role: 'assistant', kind: 'summary', content: { message: 'a', summary: 'b' }, replyTo: idea.id }));
  assert.equal(addMessage(db, { projectId, role: 'assistant', kind: 'summary', content: { message: 'c', summary: 'd' }, replyTo: idea.id }), null);
});

// --- Vastused ---

test('vastused salvestatakse ja järgmine AI päring sisaldab vabalt kirjutatud vastust', async () => {
  const q = await startWithQuestions();
  ai.push(aiOk(SUMMARY));
  const res = await post('/answers', validAnswers(q));
  assert.equal(res.status, 200);
  const { messages } = await res.json();
  assert.deepEqual(messages.map((m) => m.kind), ['idea', 'questions', 'answers', 'summary']);
  assert.deepEqual(messages[2].content.answers[0], { questionId: 'k1', selected: ['Külastaja', 'Administraator'], other: 'Treener', skipped: false });
  assert.equal(messages[2].replyTo, q.id);
  // Järgmine prompt on koostatud andmebaasist ja sisaldab vabateksti ning vahelejätmist.
  assert.match(lastUserPrompt(), /muu: Treener/);
  assert.match(lastUserPrompt(), /k2 \(Kas liikmetasu makstakse rakenduses\?\): jäeti vahele/);
});

test('samade vastuste uuesti saatmine ei lisa rida ega kutsu AI-d; erinevad vastused annavad 409', async () => {
  const q = await startWithQuestions();
  ai.push(aiOk(SUMMARY));
  await post('/answers', validAnswers(q));
  assert.equal(ai.calls.length, 2);

  const same = await post('/answers', validAnswers(q));
  assert.equal(same.status, 200);
  assert.equal((await same.json()).messages.length, 4);
  assert.equal(ai.calls.length, 2);

  const different = validAnswers(q);
  different.answers[1] = { questionId: 'k2', selected: ['Jah, veebis'], other: null, skipped: false };
  const res = await post('/answers', different);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'already_answered');
});

test('kui AI ebaõnnestub pärast vastuste salvestamist, ei dubleeri samade vastuste uus saatmine neid', async () => {
  const q = await startWithQuestions();
  ai.push(aiStatus(500));
  assert.equal((await post('/answers', validAnswers(q))).status, 502);
  ai.push(aiOk(SUMMARY));
  const res = await post('/answers', validAnswers(q));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).messages.map((m) => m.kind), ['idea', 'questions', 'answers', 'summary']);
});

test('vigased vastused annavad 400 ja midagi ei salvestata', async () => {
  const q = await startWithQuestions();
  const cases = [
    { questionsMessageId: q.id, answers: [validAnswers(q).answers[0]] }, // üks vastus puudu
    { questionsMessageId: q.id, answers: [{ questionId: 'k1', selected: ['Olematu'] }, { questionId: 'k2', skipped: true }] },
    { questionsMessageId: q.id, answers: [{ questionId: 'k1', selected: ['Külastaja'] }, { questionId: 'k2', selected: ['Jah, veebis', 'Ei, kohapeal'] }] },
    { questionsMessageId: q.id, answers: [{ questionId: 'k1', selected: [], other: '   ' }, { questionId: 'k2', skipped: true }] },
    { questionsMessageId: q.id, answers: [{ questionId: 'k1', selected: [] }, { questionId: 'k2', skipped: true }] },
  ];
  for (const body of cases) assert.equal((await post('/answers', body)).status, 400, JSON.stringify(body));
  assert.equal((await post('/answers', { questionsMessageId: 99999, answers: [] })).status, 400);
  assert.equal((await getConversation()).messages.length, 2);
  assert.equal(ai.calls.length, 1);
});

test('mitmikvalikus võib valida mitu varianti koos oma vastusega', async () => {
  const q = await startWithQuestions();
  ai.push(aiOk(SUMMARY));
  const body = validAnswers(q);
  body.answers[0].selected = ['Külastaja', 'Klubi liige', 'Administraator'];
  assert.equal((await post('/answers', body)).status, 200);
});

// --- AI ülesande reeglid ---

test('esimeses voorus ilma küsimusteta vastus korratakse; kahe vigase järel 502 ja idee jääb alles', async () => {
  ai.push(aiOk(SUMMARY), aiOk(SUMMARY));
  const res = await post('/idea', { text: IDEA });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, 'invalid_response');
  assert.equal(ai.calls.length, 2);
  assert.deepEqual((await getConversation()).messages.map((m) => m.kind), ['idea']);
});

test('"Muu" või "Jäta vahele" variant AI vastuses põhjustab korduse', async () => {
  const bad = structuredClone(QUESTIONS);
  bad.questions[1].options.push('Muu');
  ai.push(aiOk(bad), aiOk(QUESTIONS));
  assert.equal((await post('/idea', { text: IDEA })).status, 200);
  assert.equal(ai.calls.length, 2);
});

test('küsimusi kokku üle kolme ei lubata', async () => {
  const q = await startWithQuestions(); // 2 küsimust
  const tooMany = { message: 'Veel.', questions: [QUESTIONS.questions[0], QUESTIONS.questions[1]], summary: '' };
  ai.push(aiOk(tooMany), aiOk(SUMMARY));
  assert.equal((await post('/answers', validAnswers(q))).status, 200);
  assert.equal(ai.calls.length, 3);
  assert.equal((await getConversation()).messages.at(-1).kind, 'summary');
});

// --- Ajalimiit, päringupiir, seadistamata AI, lekked ---

test('ajalimiit (võltsvastus) annab 504 timeout ja idee jääb alles', async () => {
  await new Promise((r) => server.close(r));
  ai = fakeAi({ timeoutMs: 50 });
  server = createApp({ db, ai: ai.client }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}/conversation`;
  ai.push((init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));

  const res = await post('/idea', { text: IDEA });
  assert.equal(res.status, 504);
  assert.equal((await res.json()).code, 'timeout');
  assert.deepEqual((await getConversation()).messages.map((m) => m.kind), ['idea']);
});

test('päringupiir (võltsvastus 429) annab 429 koos ooteajaga', async () => {
  ai.push(aiStatus(429, { 'retry-after': '40' }));
  const res = await post('/idea', { text: IDEA });
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.code, 'rate_limited');
  assert.equal(body.retryAfterSeconds, 40);
  assert.equal(ai.calls.length, 1);
});

test('seadistamata AI: päringut ei saadeta, 503 ja idee jääb alles', async () => {
  await new Promise((r) => server.close(r));
  server = createApp({ db }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}/conversation`;
  const res = await post('/idea', { text: IDEA });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'not_configured');
  assert.deepEqual((await getConversation()).messages.map((m) => m.kind), ['idea']);
});

test('token ei jõua ühtegi vastusesse', async () => {
  ai.push(aiStatus(500), aiStatus(401), aiOk(QUESTIONS));
  const bodies = [];
  bodies.push(await (await post('/idea', { text: IDEA })).text());
  bodies.push(await (await post('/continue')).text());
  bodies.push(await (await post('/continue')).text());
  bodies.push(await (await fetch(base)).text());
  for (const b of bodies) assert.ok(!b.includes(FAKE_TOKEN));
});

async function waitFor(cond, timeoutMs = 2000) {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > timeoutMs) throw new Error('ootus aegus');
    await new Promise((r) => setTimeout(r, 10));
  }
}
