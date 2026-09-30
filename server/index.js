import { existsSync } from 'node:fs';
import { createApp } from './app.js';

// .env on valikuline; loeme selle ise, sest `node --watch` kukub --env-file lipuga, kui faili pole.
if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT) || 3001;

createApp().listen(port, () => {
  console.log(`Server töötab: http://localhost:${port}`);
});
