import { readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { openDb } from '../server/db.js';
import { addMessage } from '../server/conversation.js';
import { createProposal } from '../server/proposals.js';
import { replaceRoles } from '../server/roles.js';
import { appendStories } from '../server/stories.js';

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
      if (p.proposal) {
        const stories = p.proposal.stories.map((s) => ({ ...s, touchesView: true, warnings: [] }));
        createProposal(db, { projectId, kind: 'stories', payload: { ...p.proposal, demo: true, stories } });
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Vestlus samas kujus nagu päris töövoos; "assistendi" sõnumitel on märge demo, et neid ei peetaks AI vastuseks.
function addConversation(db, projectId, c) {
  const idea = addMessage(db, { projectId, role: 'user', kind: 'idea', content: { text: c.idea } });
  const questions = addMessage(db, { projectId, role: 'assistant', kind: 'questions', content: { ...c.questions, demo: true }, replyTo: idea.id });
  const answers = addMessage(db, { projectId, role: 'user', kind: 'answers', content: { answers: c.answers }, replyTo: questions.id });
  addMessage(db, { projectId, role: 'assistant', kind: 'summary', content: { ...c.summary, demo: true }, replyTo: answers.id });
}
