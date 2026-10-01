import { Router } from 'express';
import { progressFor } from '../stage.js';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

const COLUMNS = 'id, name, description, stage, created_at AS createdAt, updated_at AS updatedAt';

// Kontrollib projekti loomise sisendit. Tagastab { value } või { error, field }.
function validateProject(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'Projekti nimi on kohustuslik.', field: 'name' };
  if (name.length > NAME_MAX) return { error: `Nimi võib olla kuni ${NAME_MAX} märki.`, field: 'name' };

  const raw = body.description ?? '';
  if (typeof raw !== 'string') return { error: 'Kirjeldus peab olema tekst.', field: 'description' };
  const description = raw.trim();
  if (description.length > DESCRIPTION_MAX) {
    return { error: `Kirjeldus võib olla kuni ${DESCRIPTION_MAX} märki.`, field: 'description' };
  }
  return { value: { name, description } };
}

export function projectsRouter(db) {
  const router = Router();
  const listStmt = db.prepare(`SELECT ${COLUMNS} FROM projects ORDER BY created_at DESC, id DESC`);
  const getStmt = db.prepare(`SELECT ${COLUMNS} FROM projects WHERE id = ?`);
  const insertStmt = db.prepare(`INSERT INTO projects (name, description) VALUES (?, ?) RETURNING ${COLUMNS}`);

  router.get('/', (req, res) => {
    // Avalehe kaartidele lisatakse etapi kokkuvõte (ainult lugemine, AI-d ei kasutata).
    res.json(listStmt.all().map((p) => ({ ...p, progress: progressFor(db, p.id) })));
  });

  router.post('/', (req, res) => {
    const result = validateProject(req.body);
    if (result.error) return res.status(400).json({ error: result.error, field: result.field });
    const project = insertStmt.get(result.value.name, result.value.description);
    res.status(201).json(project);
  });

  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    const project = Number.isInteger(id) && id > 0 ? getStmt.get(id) : undefined;
    if (!project) return res.status(404).json({ error: 'Projekti ei leitud.' });
    res.json(project);
  });

  return router;
}
