import express from 'express';

// Loob Express'i rakenduse. Eraldi index.js-ist, et testid saaksid rakenduse ise käivitada.
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Tundmatu API aadress' });
  });

  return app;
}
