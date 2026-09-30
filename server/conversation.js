// Juhitud vestluse sõnumid andmebaasis. Vestluse ajalugu loetakse alati siit, mitte brauserist.

const COLUMNS = 'id, project_id AS projectId, role, kind, content, reply_to AS replyTo, created_at AS createdAt';

const toMessage = (row) => (row ? { ...row, content: JSON.parse(row.content) } : undefined);

export function listMessages(db, projectId) {
  return db.prepare(`SELECT ${COLUMNS} FROM conversation_messages WHERE project_id = ? ORDER BY id`).all(projectId).map(toMessage);
}

export function findIdea(db, projectId) {
  return toMessage(db.prepare(`SELECT ${COLUMNS} FROM conversation_messages WHERE project_id = ? AND kind = 'idea'`).get(projectId));
}

export function getMessage(db, projectId, id) {
  return toMessage(db.prepare(`SELECT ${COLUMNS} FROM conversation_messages WHERE project_id = ? AND id = ?`).get(projectId, id));
}

export function replyTo(db, messageId) {
  return toMessage(db.prepare(`SELECT ${COLUMNS} FROM conversation_messages WHERE reply_to = ?`).get(messageId));
}

// Viimane kasutaja sõnum, millele AI pole veel vastanud (või undefined).
export function pendingUserMessage(db, projectId) {
  const last = toMessage(db.prepare(`SELECT ${COLUMNS} FROM conversation_messages WHERE project_id = ? ORDER BY id DESC LIMIT 1`).get(projectId));
  return last?.role === 'user' ? last : undefined;
}

export function latestQuestions(db, projectId) {
  return toMessage(db.prepare(`SELECT ${COLUMNS} FROM conversation_messages WHERE project_id = ? AND kind = 'questions' ORDER BY id DESC LIMIT 1`).get(projectId));
}

export function countAskedQuestions(db, projectId) {
  return db
    .prepare("SELECT content FROM conversation_messages WHERE project_id = ? AND kind = 'questions'")
    .all(projectId)
    .reduce((n, r) => n + JSON.parse(r.content).questions.length, 0);
}

// Lisab sõnumi. Kui andmebaas keelab selle (teine idee või teine vastus samale sõnumile),
// tagastab null ega viska viga, et kutsuja saaks käituda idempotentselt.
export function addMessage(db, { projectId, role, kind, content, replyTo = null }) {
  try {
    const row = db
      .prepare(`INSERT INTO conversation_messages (project_id, role, kind, content, reply_to) VALUES (?, ?, ?, ?, ?) RETURNING ${COLUMNS}`)
      .get(projectId, role, kind, JSON.stringify(content), replyTo);
    return toMessage(row);
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err.message)) return null;
    throw err;
  }
}
