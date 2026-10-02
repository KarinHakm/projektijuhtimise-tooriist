import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createDisabledAi } from '../server/ai/client.js';
import { appendStories } from '../server/stories.js';
import { appendCriteria, consistencyFor, saveMockup } from '../server/criteria.js';
import { createProposal, getProposal } from '../server/proposals.js';

// L15: vastuvõtukriteeriumide käsitsi haldus backlog'is. Ajutine andmebaas, AI välja lülitatud.
let dir, db, projectId, storyId, otherStoryId, server, base;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-crit-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name) VALUES ('Spordiklubi') RETURNING id").get().id;
  const s = (want) => ({ role: 'Külastaja', rolePhrase: 'Külastajana', want, soThat: 'saaksin valida', size: 'M', origin: 'ai', touchesView: false });
  appendStories(db, projectId, [s('näha hindu'), s('näha tunniplaani')], null);
  [storyId, otherStoryId] = db.prepare('SELECT id FROM stories ORDER BY position').all().map((r) => r.id);
  server = createApp({ db, ai: createDisabledAi() }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const send = (method, path, body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const story = (data, id = storyId) => data.stories.find((s) => s.id === id);
const rows = () => db.prepare('SELECT id, story_id, position, text, origin, ref_kind, ref_index FROM criteria ORDER BY id').all().map((r) => ({ ...r }));

test('kriteeriumi lisamine, muutmine ja kustutamine uuendavad kohe DoR-i ja päritolu', async () => {
  appendCriteria(db, storyId, [{ text: 'Lehel on pealkiri.', origin: 'ai' }, { text: 'Lehel on otsinguväli.', origin: 'ai' }]);
  let res = await send('POST', `/stories/${storyId}/criteria`, { text: '  Iga paketi juures   on hind eurodes. ' });
  assert.equal(res.status, 200);
  let s = story(await res.json());
  assert.deepEqual(s.criteria.map((c) => [c.text, c.origin]), [['Lehel on pealkiri.', 'ai'], ['Lehel on otsinguväli.', 'ai'], ['Iga paketi juures on hind eurodes.', 'manual']]);
  assert.equal(s.readiness.checks.find((c) => c.key === 'criteria_count').ok, true);

  db.prepare("UPDATE stories SET status = 'valmis_arenduseks' WHERE id = ?").run(storyId);
  res = await send('PUT', `/stories/${storyId}/criteria/${s.criteria[0].id}`, { text: 'Lehe ülaosas on pealkiri.' });
  s = story(await res.json());
  assert.deepEqual([s.criteria[0].text, s.criteria[0].origin], ['Lehe ülaosas on pealkiri.', 'ai_edited']);

  res = await send('DELETE', `/stories/${storyId}/criteria/${s.criteria[1].id}`);
  s = story(await res.json());
  assert.deepEqual(rows().filter((r) => r.story_id === storyId).map((r) => r.position), [1, 2]); // ümber nummerdatud
  assert.equal(s.readiness.checks.find((c) => c.key === 'criteria_count').ok, false);
  assert.equal(s.readiness.expired, true); // staatust ei muudeta, valmisolek aegub
  assert.equal(s.status, 'valmis_arenduseks');
});

test('piirangud: tühi, liiga pikk ja korduv tekst, 10 piir, teise loo kriteerium; vigane päring midagi ei muuda', async () => {
  appendCriteria(db, storyId, [{ text: 'Lehel on pealkiri.', origin: 'manual' }]);
  appendCriteria(db, otherStoryId, [{ text: 'Tunniplaanis on algusaeg.', origin: 'manual' }]);
  const before = rows();
  const own = before[0].id;
  const foreign = before[1].id;
  assert.equal((await send('POST', `/stories/${storyId}/criteria`, { text: '   ' })).status, 400);
  assert.equal((await send('POST', `/stories/${storyId}/criteria`, { text: 'x'.repeat(201) })).status, 400);
  assert.equal((await (await send('POST', `/stories/${storyId}/criteria`, { text: 'LEHEL ON PEALKIRI.' })).json()).code, 'duplicate_criterion');
  assert.equal((await send('PUT', `/stories/${storyId}/criteria/${foreign}`, { text: 'Uus.' })).status, 404);
  assert.equal((await send('DELETE', `/stories/${storyId}/criteria/${foreign}`)).status, 404);
  assert.equal((await send('PUT', `/stories/${storyId}/criteria/${own}`, { text: '' })).status, 400);
  assert.deepEqual(rows(), before);

  appendCriteria(db, storyId, Array.from({ length: 9 }, (_, i) => ({ text: `Kriteerium number ${i + 2}.`, origin: 'manual' })));
  const res = await send('POST', `/stories/${storyId}/criteria`, { text: 'Üheteistkümnes kriteerium.' });
  assert.deepEqual([res.status, (await res.json()).code], [409, 'too_many_criteria']);
});

test('muutmisel seos jääb, kustutamisel kaob ainult selle kriteeriumi seos; kooskõla ülevaatus aegub', async () => {
  saveMockup(db, storyId, { title: 'Hinnad', components: [{ type: 'heading', text: 'Hinnad', items: [] }, { type: 'list', text: 'Paketid', items: ['A'] }] });
  appendCriteria(db, storyId, [
    { text: 'Lehel on pealkiri „Hinnad“.', origin: 'ai', ref: { kind: 'element', index: 0, version: 1, source: 'ai' } },
    { text: 'Lehel on pakettide loend.', origin: 'ai', ref: { kind: 'element', index: 1, version: 1, source: 'user' } },
  ]);
  const fp = consistencyFor(db, storyId).fingerprint;
  db.prepare('UPDATE stories SET consistency_review = ? WHERE id = ?').run(JSON.stringify({ fingerprint: fp, mockupVersion: 1, at: 'x' }), storyId);
  const mockups = db.prepare('SELECT * FROM mockups').all().map((r) => ({ ...r }));
  const [first, second] = rows();

  let s = story(await (await send('PUT', `/stories/${storyId}/criteria/${first.id}`, { text: 'Lehe pealkiri on „Hinnad“.' })).json());
  assert.equal(s.criteria[0].ref.kind, 'element'); // seos jäi
  assert.equal(consistencyFor(db, storyId).review.valid, false); // ülevaatus aegus

  s = story(await (await send('DELETE', `/stories/${storyId}/criteria/${first.id}`)).json());
  assert.deepEqual(rows().map((r) => [r.id, r.ref_kind, r.ref_index]), [[second.id, 'element', 1]]);
  assert.deepEqual(db.prepare('SELECT * FROM mockups').all().map((r) => ({ ...r })), mockups);
});

test('AI kriteeriumide rakendamine keeldub kordusest ja 10 piiri ületamisest; ettepanek jääb ootele', async () => {
  appendCriteria(db, storyId, [{ text: 'Lehel on pealkiri.', origin: 'manual' }]);
  const proposal = createProposal(db, { projectId, kind: 'criteria', payload: { storyId, message: 'x', criteria: ['Lehel on pealkiri.', 'Lehel on hind.'], refs: [-1, -1] } });
  let res = await send('POST', '/criteria/apply', { proposalId: proposal.id, criteria: [{ index: 0, text: 'lehel on pealkiri.' }, { index: 1, text: 'Lehel on hind.' }] });
  assert.deepEqual([res.status, (await res.json()).code], [400, 'duplicate_criterion']);

  appendCriteria(db, storyId, Array.from({ length: 9 }, (_, i) => ({ text: `Kriteerium number ${i + 2}.`, origin: 'manual' })));
  res = await send('POST', '/criteria/apply', { proposalId: proposal.id, criteria: [{ index: 1, text: 'Lehel on hind.' }] });
  assert.deepEqual([res.status, (await res.json()).code], [400, 'too_many_criteria']);
  assert.equal(getProposal(db, proposal.id).status, 'pending');
  assert.equal(rows().length, 10);
});
