import express from 'express';
import { projectsRouter } from './routes/projects.js';
import { conversationRouter } from './routes/conversation.js';
import { rolesRouter } from './routes/roles.js';
import { storiesRouter } from './routes/stories.js';
import { priorityRouter } from './routes/priority.js';
import { criteriaRouter } from './routes/criteria.js';
import { refinementRouter } from './routes/refinement.js';
import { stageRouter } from './routes/stage.js';
import { reviewRouter } from './routes/review.js';
import { createDisabledAi } from './ai/client.js';

// Loob Express'i rakenduse. Eraldi index.js-ist, et testid saaksid rakenduse ise käivitada
// oma (ajutise) andmebaasi ja AI-kliendiga. Ilma AI-kliendita annavad AI marsruudid veateate (AI välja lülitatud).
export function createApp({ db, ai = createDisabledAi() } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (db) {
    app.use('/api/projects/:id/conversation', conversationRouter({ db, ai }));
    app.use('/api/projects/:id/roles', rolesRouter({ db, ai }));
    app.use('/api/projects/:id/stories', storiesRouter({ db, ai }));
    app.use('/api/projects/:id/priority', priorityRouter({ db, ai }));
    app.use('/api/projects/:id/criteria', criteriaRouter({ db, ai }));
    app.use('/api/projects/:id/refinement', refinementRouter({ db, ai }));
    app.use('/api/projects/:id/review', reviewRouter({ db, ai }));
    app.use('/api/projects/:id/stage', stageRouter({ db }));
    app.use('/api/projects', projectsRouter(db));
  }

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
