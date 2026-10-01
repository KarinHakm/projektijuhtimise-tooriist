import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { createConfiguredAi } from './ai/provider.js';

// .env on valikuline; loeme selle ise, sest `node --watch` kukub --env-file lipuga, kui faili pole.
if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT) || 3001;
const dbPath = process.env.DATABASE_PATH || './data/app.db';

const db = openDb(dbPath);
console.log(`Andmebaas: ${dbPath}`);

const { ai, description } = createConfiguredAi(process.env);
console.log(`AI: ${description}`);

createApp({ db, ai }).listen(port, () => {
  console.log(`Server töötab: http://localhost:${port}`);
});
