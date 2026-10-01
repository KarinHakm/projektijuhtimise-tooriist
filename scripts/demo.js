import { spawn } from 'node:child_process';
import { createDemoDb, DEMO_DB } from './demo-data.js';

// npm run demo: loob näidisandmebaasi algseisust ja käivitab rakenduse sellega, AI välja lülitatud.
// Keskkonnamuutujad seatakse siin (mitte käsureal), et käsk töötaks ka Windowsis. Need on ülimuslikud
// .env faili väärtuste ees, seega ei kasutata päris andmebaasi ega AI tokenit.
const path = createDemoDb(DEMO_DB, { protectedPaths: ['./data/app.db', process.env.DATABASE_PATH].filter(Boolean) });

console.log(`
Näidisandmebaas loodi algseisust: ${path}
NB! Iga "npm run demo" taastab näidise algseisu – kõik näidises tehtud muudatused kaovad.
AI on näidisrežiimis välja lülitatud; AI nupud annavad veateate.
Ava brauseris http://localhost:5175 (peatamiseks Ctrl+C).
`);

const child = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true, // Windowsis on npm käsk npm.cmd
  env: { ...process.env, DATABASE_PATH: DEMO_DB, HETZNER_INFERENCE_TOKEN: '' },
});
child.on('exit', (code) => process.exit(code ?? 0));
