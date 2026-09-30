import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';

// Iga test saab oma ajutise andmebaasi; arendaja data/app.db faili ei puututa.
let dir, dbPath;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pjt-api-'));
  dbPath = join(dir, 'app.db');
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// Avab andmebaasi, käivitab rakenduse juhuslikul pordil ning sulgeb mõlemad pärast fn-i.
async function withApi(fn) {
  const db = openDb(dbPath);
  const server = createApp({ db }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/projects`;
  const post = (body) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    await fn({ base, post });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}

test('POST tühja nimega vastab 400 ja projekti ei looda', async () => {
  await withApi(async ({ base, post }) => {
    const res = await post({ name: '', description: 'x' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).field, 'name');
    assert.deepEqual(await (await fetch(base)).json(), []);
  });
});

test('POST ainult tühikutest nimega vastab 400', async () => {
  await withApi(async ({ post }) => {
    const res = await post({ name: '   ' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).field, 'name');
  });
});

test('POST ilma nimeta ja vigase JSON-iga vastab 400', async () => {
  await withApi(async ({ base, post }) => {
    assert.equal((await post({})).status, 400);
    const bad = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{vigane' });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /JSON/);
  });
});

test('POST korrektse nimega vastab 201 ja projekt on loendis', async () => {
  await withApi(async ({ base, post }) => {
    const res = await post({ name: '  Spordiklubi veeb  ', description: 'Treeningud ja liikmeks astumine' });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, 'Spordiklubi veeb');
    assert.equal(created.description, 'Treeningud ja liikmeks astumine');
    assert.equal(created.stage, 'idee');

    const list = await (await fetch(base)).json();
    assert.deepEqual(list.map((p) => p.id), [created.id]);

    const one = await fetch(`${base}/${created.id}`);
    assert.equal(one.status, 200);
    assert.deepEqual(await one.json(), created);
  });
});

test('kirjeldus on valikuline', async () => {
  await withApi(async ({ post }) => {
    const res = await post({ name: 'Ilma kirjelduseta' });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).description, '');
  });
});

test('olematu või vigase id-ga projekt vastab 404', async () => {
  await withApi(async ({ base }) => {
    assert.equal((await fetch(`${base}/999`)).status, 404);
    assert.equal((await fetch(`${base}/abc`)).status, 404);
  });
});

test('loend on uuemad eespool', async () => {
  await withApi(async ({ base, post }) => {
    const a = await (await post({ name: 'Esimene' })).json();
    const b = await (await post({ name: 'Teine' })).json();
    const list = await (await fetch(base)).json();
    assert.deepEqual(list.map((p) => p.id), [b.id, a.id]);
  });
});

test('loodud projekt on alles pärast andmebaasi sulgemist ja uuesti avamist', async () => {
  let created;
  await withApi(async ({ post }) => {
    created = await (await post({ name: 'Püsiv projekt', description: 'Peab jääma alles' })).json();
  });
  // withApi sulges serveri ja andmebaasi; uus rakendus avab sama faili uuesti.
  await withApi(async ({ base }) => {
    const list = await (await fetch(base)).json();
    assert.deepEqual(list, [created]);
  });
});
