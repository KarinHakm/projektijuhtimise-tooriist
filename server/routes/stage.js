import { Router } from 'express';
import { stageFor } from '../stage.js';

// Projekti etapp ja soovitatud järgmised sammud (L13, L14). Ainult lugemine: ei muuda andmeid ega kutsu AI-d.
export function stageRouter({ db }) {
  const router = Router({ mergeParams: true });
  router.get('/', (req, res) => {
    const id = Number(req.params.id);
    const exists = Number.isInteger(id) && id > 0 && db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Projekti ei leitud.' });
    res.json(stageFor(db, id));
  });
  return router;
}
