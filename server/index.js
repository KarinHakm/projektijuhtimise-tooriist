import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { openDb } from './db.js';

// .env on valikuline; loeme selle ise, sest `node --watch` kukub --env-file lipuga, kui faili pole.
if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT) || 3001;
const dbPath = process.env.DATABASE_PATH || './data/app.db';

const db = openDb(dbPath);
console.log(`Andmebaas: ${dbPath}`);

createApp({ db }).listen(port, () => {
  console.log(`Server töötab: http://localhost:${port}`);
});
