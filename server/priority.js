// Alustamise lugu (L08): projekti focus_story_id. Muutub ainult kasutaja kinnitusel.

export function getFocusStoryId(db, projectId) {
  return db.prepare('SELECT focus_story_id AS id FROM projects WHERE id = ?').get(projectId)?.id ?? null;
}

// Kas lugu on selle projekti backlog'is.
export function storyInProject(db, projectId, storyId) {
  return Number.isInteger(storyId) && Boolean(db.prepare('SELECT 1 FROM stories WHERE id = ? AND project_id = ?').get(storyId, projectId));
}

export function setFocusStory(db, projectId, storyId) {
  db.prepare("UPDATE projects SET focus_story_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(storyId, projectId);
}
