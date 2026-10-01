import { readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { openDb } from '../server/db.js';
import { addMessage } from '../server/conversation.js';
import { createProposal } from '../server/proposals.js';
import { replaceRoles } from '../server/roles.js';
import { appendStories, listStories } from '../server/stories.js';
import { setFocusStory } from '../server/priority.js';
import { appendCriteria, latestMockup, listCriteria, saveMockup } from '../server/criteria.js';

// Näidisandmebaas õpetajale proovimiseks ilma AI tokenita (npm run demo).
// Sisu on käsitsi koostatud (demo/naidisandmed.json) ja märgitud näidiseks, mitte AI vastuseks.
export const DEMO_DB = './data/demo.db';
const FIXTURE = new URL('../demo/naidisandmed.json', import.meta.url);

export const loadFixture = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));

const sqliteFiles = (path) => [path, `${path}-wal`, `${path}-shm`];

// Loob näidisandmebaasi algseisust. Kirjutab ainult targetPath faili (ja selle ajutise eelkäija).
// Keeldub, kui siht on app.db või mõni kaitstud fail (nt arendaja päris andmebaas).
export function createDemoDb(targetPath = DEMO_DB, { protectedPaths = [] } = {}) {
  const target = resolve(targetPath);
  if (basename(target) === 'app.db' || protectedPaths.some((p) => resolve(p) === target)) {
    throw new Error(`Näidisandmeid ei kirjutata faili ${target}: see on rakenduse päris andmebaas.`);
  }
  const tmp = `${target}.uus`;
  for (const f of sqliteFiles(tmp)) rmSync(f, { force: true });

  const db = openDb(tmp);
  try {
    seed(db, loadFixture());
  } finally {
    db.close(); // viimase ühenduse sulgemisel kirjutab SQLite WAL-i põhifaili
  }
  for (const f of sqliteFiles(target)) rmSync(f, { force: true });
  renameSync(tmp, target);
  for (const f of sqliteFiles(tmp)) rmSync(f, { force: true });
  return target;
}

function seed(db, data) {
  db.exec('BEGIN');
  try {
    for (const p of data.projects) {
      const projectId = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?) RETURNING id').get(p.name, p.description).id;
      replaceRoles(db, projectId, p.roles.map((name) => ({ name, source: 'manual' })));
      if (p.conversation) addConversation(db, projectId, p.conversation);
      if (p.backlog) {
        appendStories(db, projectId, p.backlog.map((s) => ({ ...s, origin: 'manual', touchesView: true })), null);
      }
      const stories = listStories(db, projectId);
      // Alustamise lugu, selle käsitsi koostatud kriteeriumid ja kinnitatud mockup (versioon 1).
      const focus = Number.isInteger(p.focus) ? stories[p.focus] : null;
      if (focus) {
        setFocusStory(db, projectId, focus.id);
        appendCriteria(db, focus.id, (p.criteria ?? []).map((text) => ({ text, origin: 'manual', ref: null })));
        if (p.mockup) saveMockup(db, focus.id, p.mockup);
      }
      // MVP joon (L17): mitu lugu on joonest ülalpool.
      if (Number.isInteger(p.mvp)) db.prepare('UPDATE projects SET mvp_count = ? WHERE id = ?').run(p.mvp, projectId);
      // Ootel näidisettepanekud: märge demo; rakenduses on need sildiga „Näidis“, mitte AI vastusena.
      if (p.proposal) {
        const proposed = p.proposal.stories.map((s) => ({ ...s, touchesView: true, warnings: [] }));
        createProposal(db, { projectId, kind: 'stories', payload: { ...p.proposal, demo: true, stories: proposed } });
      }
      if (focus && p.refinement) createRefinement(db, projectId, focus, stories, p.refinement);
      // Järjekord ajas: vestlus → lugude ettepanek → täpsustuse ettepanek (uusim näidis on täpsustus).
      db.prepare("UPDATE conversation_messages SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 minutes') WHERE project_id = ?").run(projectId);
      db.prepare("UPDATE ai_proposals SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes') WHERE project_id = ? AND kind = 'stories'").run(projectId);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Kliendi täpsustuse näidisettepanek samas kujus nagu server/routes/refinement.js loob: "before" on loo praegune seis,
// seega rakendamise aegumise kontroll töötab nagu päris ettepanekul. Soovitused teistele lugudele on ainult tekst.
function createRefinement(db, projectId, story, stories, r) {
  const before = {
    want: story.want,
    soThat: story.soThat,
    criteria: listCriteria(db, story.id).map((c) => ({ text: c.text, origin: c.origin, ref: c.ref })),
    mockup: latestMockup(db, story.id),
  };
  createProposal(db, {
    projectId,
    kind: 'refinement',
    payload: {
      demo: true,
      storyId: story.id,
      clarification: r.clarification,
      message: r.message,
      before,
      after: {
        want: story.want,
        soThat: story.soThat,
        criteria: r.criteria.map((c) => ({ from: c.from, text: c.text, ref: null })),
        mockup: r.mockup,
      },
      otherStories: (r.otherStories ?? []).map((o) => ({ storyId: stories[o.story].id, suggestion: o.suggestion })),
    },
  });
}

// Vestlus samas kujus nagu päris töövoos; "assistendi" sõnumitel on märge demo, et neid ei peetaks AI vastuseks.
function addConversation(db, projectId, c) {
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: c.idea } });
  const questions = addMessage(db, { projectId, role: 'assistant', kind: 'questions', content: { ...c.questions, demo: true }, replyTo: idea.id });
  const answers = addMessage(db, { projectId, role: 'user', kind: 'answers', content: { answers: c.answers }, replyTo: questions.id });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', content: { ...c.summary, demo: true }, replyTo: answers.id });
}
