import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createProposal } from '../server/proposals.js';
import { captureProject } from '../server/undo.js';
import { createDemoDb } from '../scripts/demo-data.js';
import { aiFail, aiOk, fakeAi } from './helpers/fake-ai.js';

// Vabatekst rollide, lugude, prioriteedi, kriteeriumide ja „Mida teeme edasi?“ juures. Näidisandmebaasi koopia, võlts-AI.
let dir, db, projectId, focusId, server, base, ai;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-note-'));
  db = openDb(createDemoDb(join(dir, 'demo.db')));
  ({ id: projectId, focus_story_id: focusId } = db.prepare('SELECT id, focus_story_id FROM projects').get());
  ai = fakeAi();
  server = createApp({ db, ai: ai.client }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/projects/${projectId}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const pendingOf = (kind) => db.prepare("SELECT id FROM ai_proposals WHERE project_id = ? AND kind = ? AND status = 'pending'").all(projectId, kind).map((r) => r.id);
const backlog = () => { const s = captureProject(db, projectId); delete s.tables.ai_proposals; return s; };
const roles = () => db.prepare('SELECT name FROM project_roles WHERE project_id = ? ORDER BY id').all(projectId).map((r) => r.name);
const lastPrompt = () => ai.calls.at(-1).messages.map((m) => m.content).join('\n');

const story = (role, rolePhrase, want, soThat) => ({ role, rolePhrase, want, soThat, size: 'M', touchesView: true });
const STORIES = {
  message: 'Lisasin treeneri soovi järgi lood.',
  primaryRole: 'Külastaja',
  stories: [
    story('Külastaja', 'Külastajana', 'näha treenerite tutvustusi', 'saaksin valida endale sobiva treeneri'),
    story('Külastaja', 'Külastajana', 'näha treeneri järgi treeninguid', 'saaksin käia sama treeneri tundides'),
    story('Külastaja', 'Külastajana', 'saata treenerile küsimuse', 'saaksin enne liitumist nõu'),
    story('Külastaja', 'Külastajana', 'näha proovitreeningu aegu', 'saaksin klubi enne liitumist proovida'),
    story('Administraator', 'Administraatorina', 'lisada uue treeneri profiili', 'külastajad näeksid ajakohast treenerite loendit'),
  ],
};

test('vabatekst jõuab AI päringusse, uus ettepanek asendab ootel ettepaneku ja backlog ei muutu', async () => {
  const before = backlog();
  const oldStories = pendingOf('stories');
  ai.push(aiOk(STORIES));
  assert.equal((await post('/stories/propose', { note: 'Lisa lugusid treeneri kohta' })).status, 200);
  assert.match(lastPrompt(), /<kasutaja_soov>\nLisa lugusid treeneri kohta\n<\/kasutaja_soov>/);
  assert.equal(pendingOf('stories').length, 1);
  assert.notDeepEqual(pendingOf('stories'), oldStories); // vana lükati tagasi, uus on ootel

  const oldRoles = createProposal(db, { projectId, kind: 'roles', payload: { message: 'x', roles: [{ name: 'Külastaja', description: 'Vaatab.' }] } }).id;
  ai.push(aiOk({ message: 'Lisasin treeneri.', roles: [{ name: 'Külastaja', description: 'Tutvub klubiga.' }, { name: 'Treener', description: 'Juhendab treeninguid.' }] }));
  assert.equal((await post('/roles/propose', { note: 'lisa ka treener' })).status, 200);
  assert.match(lastPrompt(), /lisa ka treener/);
  assert.equal(pendingOf('roles').length, 1);
  assert.notEqual(pendingOf('roles')[0], oldRoles);

  ai.push(aiOk({ message: 'Alustame hindadest.', storyId: focusId, reason: 'Klient soovis alustada liitumisest, sest see toob tulu.' }));
  assert.equal((await post('/priority/propose', { note: 'alustame liitumisest' })).status, 200);
  assert.match(lastPrompt(), /alustame liitumisest/);

  db.prepare('DELETE FROM criteria WHERE story_id = ?').run(focusId);
  const beforeCriteria = backlog();
  ai.push(aiOk({
    message: 'Lisasin telefoninumbri.',
    criteria: [
      { text: "Taotlusvormil on sisestusväli 'Telefoninumber'.", ref: 'Telefoninumber' },
      { text: "Taotlusvormil on nupp 'Saada liitumistaotlus'.", ref: 'Saada liitumistaotlus' },
      { text: 'Pärast taotluse saatmist kuvatakse kinnitusteade.', ref: '' },
    ],
    mockup: { title: 'Taotlus', components: [{ type: 'input', text: 'Telefoninumber', items: [] }, { type: 'button', text: 'Saada liitumistaotlus', items: [] }] },
  }));
  assert.equal((await post('/criteria/propose', { note: 'kriteeriumides peab olema telefoninumber' })).status, 200);
  assert.match(lastPrompt(), /kriteeriumides peab olema telefoninumber/);
  assert.equal(pendingOf('criteria').length, 1);

  assert.deepEqual(roles(), ['Külastaja', 'Administraator']);
  assert.deepEqual(backlog(), beforeCriteria); // ükski ettepanek ei jõudnud backlog'i
  assert.notDeepEqual(before, beforeCriteria); // (ainult testi enda kriteeriumide kustutus)
});

test('AI tõrke korral jääb vana ettepanek ootele; liiga pikk vabatekst lükatakse tagasi ilma AI-kutseta', async () => {
  const old = pendingOf('stories');
  ai.push(aiFail('unavailable'), aiFail('unavailable'));
  assert.notEqual((await post('/stories/propose', { note: 'Paku lühemaid lugusid' })).status, 200);
  assert.deepEqual(pendingOf('stories'), old);

  const calls = ai.calls.length;
  const res = await post('/roles/propose', { note: 'x'.repeat(501) });
  assert.deepEqual([res.status, (await res.json()).field], [400, 'note']);
  assert.equal(ai.calls.length, calls);
});

test('„Mida teeme edasi?“ vabatekst: AI valib lubatud sammu ja märkuse, andmed ei muutu; vale samm lükatakse tagasi', async () => {
  const before = captureProject(db, projectId);
  ai.push(aiOk({ message: 'Lähme lugude juurde.', stepId: 'stage:lood', note: 'Lisa lugusid treeneri kohta.' }));
  const res = await post('/stage/next', { text: 'tahaks treeneri lugusid juurde' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual([body.step.id, body.step.card, body.note], ['stage:lood', 'stories', 'Lisa lugusid treeneri kohta.']);
  assert.match(lastPrompt(), /tahaks treeneri lugusid juurde/);
  assert.match(lastPrompt(), /- stage:lood: Ava etapp „Lood“ \(vabateksti väljaga\)/);

  ai.push(aiOk({ message: 'x', stepId: 'kustuta-koik', note: '' }), aiOk({ message: 'x', stepId: 'kustuta-koik', note: '' }));
  assert.notEqual((await post('/stage/next', { text: 'kustuta kõik' })).status, 200);
  assert.equal((await post('/stage/next', { text: '  ' })).status, 400);
  assert.deepEqual(captureProject(db, projectId), before);
});
