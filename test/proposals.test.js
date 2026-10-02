import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.js';
import { createProposal, getProposal, applyProposal, rejectProposal, ProposalError } from '../server/proposals.js';
import { buildProjectContext } from '../server/ai/context.js';
import { renderProjectState } from '../server/ai/tasks/clarify.js';
import { replaceRoles } from '../server/roles.js';
import { setFocusStory } from '../server/priority.js';

// Iga test saab oma ajutise andmebaasi; arendaja data/app.db faili ei puututa.
let dir, db, projectId;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-prop-'));
  db = openDb(join(dir, 'app.db'));
  projectId = db.prepare("INSERT INTO projects (name, description) VALUES ('Spordiklubi', 'algne') RETURNING id").get().id;
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const description = () => db.prepare('SELECT description FROM projects WHERE id = ?').get(projectId).description;
// Näidis-rakendus: muudab projekti kirjeldust ettepaneku sisu järgi ja loeb kutsed kokku.
function counter() {
  const fn = (tx, proposal) => {
    fn.calls++;
    tx.prepare('UPDATE projects SET description = ? WHERE id = ?').run(proposal.payload.description, proposal.projectId);
    return 'tehtud';
  };
  fn.calls = 0;
  return fn;
}

test('testid kasutavad ajutist kausta, mitte projekti data/ kausta', () => {
  assert.ok(realpathSync(dir).startsWith(realpathSync(tmpdir())));
  assert.ok(!dir.includes(`${process.cwd()}/data`));
});

test('uus ettepanek salvestatakse olekuga pending ega muuda andmeid', () => {
  const p = createProposal(db, { projectId, kind: 'demo', payload: { description: 'uus' } });
  assert.match(p.id, /^[0-9a-f-]{36}$/);
  assert.equal(p.status, 'pending');
  assert.deepEqual(p.payload, { description: 'uus' });
  assert.equal(description(), 'algne');
});

test('igal ettepanekul on unikaalne tunnus', () => {
  const ids = new Set(Array.from({ length: 20 }, () => createProposal(db, { projectId, kind: 'demo', payload: {} }).id));
  assert.equal(ids.size, 20);
});

test('sama ettepaneku kaks rakendamist muudavad andmeid ainult üks kord', () => {
  const p = createProposal(db, { projectId, kind: 'demo', payload: { description: 'uus' } });
  const apply = counter();

  const first = applyProposal(db, p.id, apply);
  assert.equal(first.result, 'tehtud');
  assert.equal(first.proposal.status, 'applied');
  assert.ok(first.proposal.decidedAt);
  assert.equal(description(), 'uus');

  // Vahepeal muudab kasutaja kirjeldust käsitsi; teine rakendamine ei tohi seda üle kirjutada.
  db.prepare("UPDATE projects SET description = 'käsitsi' WHERE id = ?").run(projectId);
  assert.throws(() => applyProposal(db, p.id, apply), (e) => e instanceof ProposalError && e.code === 'already_decided' && e.status === 409);
  assert.equal(apply.calls, 1);
  assert.equal(description(), 'käsitsi');
});

test('kui rakendamine ebaõnnestub, jäävad andmed ja ettepaneku olek muutmata', () => {
  const p = createProposal(db, { projectId, kind: 'demo', payload: { description: 'uus' } });
  const failing = (tx, proposal) => {
    tx.prepare('UPDATE projects SET description = ? WHERE id = ?').run(proposal.payload.description, proposal.projectId);
    throw new Error('kontroll ebaõnnestus');
  };
  assert.throws(() => applyProposal(db, p.id, failing), /kontroll ebaõnnestus/);
  assert.equal(description(), 'algne');
  assert.equal(getProposal(db, p.id).status, 'pending');

  // Pärast ebaõnnestumist saab sama ettepanekut veel rakendada.
  applyProposal(db, p.id, counter());
  assert.equal(description(), 'uus');
});

test('tagasi lükatud ettepanekut ei saa rakendada ega uuesti tagasi lükata', () => {
  const p = createProposal(db, { projectId, kind: 'demo', payload: { description: 'uus' } });
  assert.equal(rejectProposal(db, p.id).proposal.status, 'rejected');
  const apply = counter();
  assert.throws(() => applyProposal(db, p.id, apply), (e) => e.code === 'already_decided');
  assert.throws(() => rejectProposal(db, p.id), (e) => e.code === 'already_decided');
  assert.equal(apply.calls, 0);
  assert.equal(description(), 'algne');
});

test('olematu ettepanek annab not_found (404)', () => {
  assert.throws(() => applyProposal(db, 'olematu', counter()), (e) => e.code === 'not_found' && e.status === 404);
});

test('projekti kustutamisel kustuvad ka selle ettepanekud', () => {
  const p = createProposal(db, { projectId, kind: 'demo', payload: {} });
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  assert.equal(getProposal(db, p.id), undefined);
});

test('AI kontekst loetakse andmebaasi hetkeseisust', () => {
  assert.deepEqual(buildProjectContext(db, projectId), {
    project: { name: 'Spordiklubi', description: 'algne', stage: { lastDone: null, next: 'Idee', nextStep: 'Kirjelda projekti idee' } },
    conversation: [],
    roles: [],
    stories: [],
  });
  // Käsitsi muudatus peab kohe järgmisesse konteksti jõudma (vahemälu pole).
  db.prepare("UPDATE projects SET name = 'Spordiklubi veeb', description = 'käsitsi muudetud' WHERE id = ?").run(projectId);
  assert.deepEqual(buildProjectContext(db, projectId).project, { name: 'Spordiklubi veeb', description: 'käsitsi muudetud', stage: { lastDone: null, next: 'Idee', nextStep: 'Kirjelda projekti idee' } });
});

function addStory(status = 'idee') {
  return db.prepare(`INSERT INTO stories (project_id, position, role, role_phrase, want, so_that, size, status, origin, touches_view)
                     VALUES (?, 1, 'Külastaja', 'Külastajana', 'näha tunniplaani', 'saaksin trenni valida', 'M', ?, 'manual', 1) RETURNING id`).get(projectId, status).id;
}

test('AI kontekstis on etapp, lugude kriteeriumid, staatus, mockup ja avatud küsimused', () => {
  replaceRoles(db, projectId, [{ name: 'Külastaja', source: 'manual' }]);
  const storyId = addStory('vajab_tapsustamist');
  setFocusStory(db, projectId, storyId);
  db.prepare("INSERT INTO criteria (story_id, position, text, origin) VALUES (?, 1, 'Tunniplaanis on iga trenni algusaeg.', 'manual')").run(storyId);
  db.prepare('INSERT INTO mockups (story_id, version, spec) VALUES (?, 1, ?)')
    .run(storyId, JSON.stringify({ title: 'Tunniplaan', components: [{ type: 'heading', text: 'Tunniplaan', items: [] }] }));
  db.prepare("INSERT INTO story_questions (story_id, text) VALUES (?, 'Kas näidata ka treenerit?')").run(storyId);

  const context = buildProjectContext(db, projectId);
  assert.equal(context.project.stage.lastDone, 'Kriteeriumid ja mockup');
  assert.deepEqual(context.stories, [{
    id: storyId, role: 'Külastaja', title: 'Külastajana soovin näha tunniplaani, et saaksin trenni valida.', size: 'M',
    status: 'vajab_tapsustamist', ready: false, focus: true, criteria: ['Tunniplaanis on iga trenni algusaeg.'], hasMockup: true,
    openQuestions: ['Kas näidata ka treenerit?'],
  }]);
  const text = renderProjectState(context);
  assert.match(text, /viimati tehtud Kriteeriumid ja mockup/);
  assert.match(text, /staatus Vajab täpsustamist; alustamise lugu; mockup olemas/);
  assert.match(text, /Kriteeriumid: Tunniplaanis on iga trenni algusaeg\./);
  assert.match(text, /Avatud küsimused: Kas näidata ka treenerit\?/);
});

test('AI kontekstis on aegunud valmisolek märgitud ja vastatud küsimusi ei ole', () => {
  const storyId = addStory('valmis_arenduseks'); // kriteeriume pole, seega DoR ei ole täidetud
  db.prepare("INSERT INTO story_questions (story_id, text, resolved_at) VALUES (?, 'Vastatud küsimus', 'now')").run(storyId);
  const context = buildProjectContext(db, projectId);
  assert.equal(context.stories[0].ready, false);
  assert.deepEqual(context.stories[0].openQuestions, []);
  const text = renderProjectState(context);
  assert.match(text, /staatus Valmis arenduseks, valmisolek aegunud/);
  assert.doesNotMatch(text, /Avatud küsimused/);
});

test('olematu projekti kontekst on null', () => {
  assert.equal(buildProjectContext(db, 999), null);
});
