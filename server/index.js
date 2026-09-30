import dns from 'node:dns';
import net from 'node:net';
import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { createAiClient, DEFAULT_TIMEOUT_MS } from './ai/client.js';

// .env on valikuline; loeme selle ise, sest `node --watch` kukub --env-file lipuga, kui faili pole.
if (existsSync('.env')) process.loadEnvFile('.env');

// Eelista IPv4-t: võrkudes, kus IPv6 ei tööta, jääks fetch muidu aeguma.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const port = Number(process.env.PORT) || 3001;
const dbPath = process.env.DATABASE_PATH || './data/app.db';

const db = openDb(dbPath);
console.log(`Andmebaas: ${dbPath}`);

const ai = createAiClient({
  token: process.env.HETZNER_INFERENCE_TOKEN,
  model: process.env.HETZNER_MODEL,
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
});
console.log(`AI: ${ai.configured ? 'seadistatud' : 'seadistamata (AI funktsioonid annavad veateate)'}`);

createApp({ db, ai }).listen(port, () => {
  console.log(`Server töötab: http://localhost:${port}`);
});
