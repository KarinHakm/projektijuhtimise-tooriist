import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

// Käivitab rakenduse juhuslikul pordil ja sulgeb pärast testi.
async function withServer(fn) {
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('GET /api/health vastab status ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('tundmatu /api aadress vastab 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/olematu`);
    assert.equal(res.status, 404);
  });
});
