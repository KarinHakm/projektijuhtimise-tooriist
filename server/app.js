import express from 'express';
import { projectsRouter } from './routes/projects.js';

// Loob Express'i rakenduse. Eraldi index.js-ist, et testid saaksid rakenduse ise käivitada
// oma (ajutise) andmebaasiga.
export function createApp({ db } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (db) app.use('/api/projects', projectsRouter(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Tundmatu API aadress' });
  });

  // Vigane JSON ja ootamatud vead: vasta alati JSON-iga, mitte HTML-lehega.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Päringu sisu ei ole korrektne JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Serveri viga.' });
  });

  return app;
}
