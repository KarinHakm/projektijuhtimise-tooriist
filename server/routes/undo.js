import { Router } from 'express';
import { undoLast, undoState, UndoError } from '../undo.js';

// Üldine tagasivõtmine (L21): GET – kas viimast toetatud muudatust saab tagasi võtta; POST { at } – võta tagasi.
export function undoRouter({ db }) {
  const router = Router({ mergeParams: true });
  router.use((req, res, next) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    req.projectId = id;
    next();
  });
  router.get('/', (req, res) => res.json(undoState(db, req.projectId)));
  router.post('/', (req, res) => {
    try {
      const label = undoLast(db, req.projectId, req.body?.at);
      res.json({ undone: label, ...undoState(db, req.projectId) });
    } catch (err) {
      if (!(err instanceof UndoError)) throw err;
      res.status(err.status).json({ error: err.message, code: err.code, ...undoState(db, req.projectId) });
    }
  });
  return router;
}
