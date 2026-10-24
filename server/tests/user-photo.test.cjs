const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const database = { user: {}, userPhoto: {} };
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: database } };
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { __esModule: true, env: { CORS_ORIGIN: '*', JWT_SECRET: 'user-photo-test-secret' } } };
const app = require('../dist/app').default;
let server, root, image, stored, writes = 0, revision = 0;
const token = userId => jwt.sign({ userId, isShopOwner: false }, 'user-photo-test-secret');

before(async () => {
  image = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#2457AD' } }).png().toBuffer();
  database.user.findUnique = async ({ where }) => ({ id: where.id, isShopOwner: false, isAdmin: false });
  database.userPhoto.findUnique = async ({ where }) => where.userId === 7 ? stored : null;
  database.userPhoto.upsert = async ({ create, update }) => {
    writes++;
    stored = { userId: 7, bytes: stored ? update.bytes : create.bytes, updatedAt: new Date(1700000000000 + ++revision) };
    return { updatedAt: stored.updatedAt };
  };
  database.userPhoto.deleteMany = async ({ where }) => { writes++; if (where.userId === 7) stored = null; return { count: 1 }; };
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise(resolve => server.close(resolve)));

async function request(path, method = 'GET', body, userId = 7) {
  return fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(userId == null ? {} : { Authorization: `Bearer ${token(userId)}` }) }, body: body == null ? undefined : JSON.stringify(body) });
}

test('profile photo is a placeholder until a photo is saved', async () => {
  assert.equal((await request('/users/7/photo', 'GET', undefined, null)).status, 404);
});

test('only the signed-in user may upload or remove a profile photo', async () => {
  const initialWrites = writes;
  assert.equal((await request('/users/7/photo', 'PUT', { imageBase64: image.toString('base64') }, null)).status, 401);
  assert.equal((await request('/users/7/photo', 'PUT', { imageBase64: image.toString('base64') }, 8)).status, 403);
  assert.equal((await request('/users/7/photo', 'DELETE', undefined, 8)).status, 403);
  assert.equal(writes, initialWrites);
});

test('uploads are validated, resized, safe to display and removable', async () => {
  assert.equal((await request('/users/7/photo', 'PUT', { imageBase64: 'not an image' })).status, 400);
  const upload = await request('/users/7/photo', 'PUT', { imageBase64: image.toString('base64') });
  assert.equal(upload.status, 200);
  const { data } = await upload.json();
  assert.match(data.photoUrl, /^\/api\/users\/7\/photo\?v=\d+$/);
  const served = await fetch(root.replace('/api', '') + data.photoUrl);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(served.headers.get('cross-origin-resource-policy'), 'cross-origin');
  const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.ok(metadata.width <= 1440 && metadata.height <= 1080);
  assert.equal(metadata.exif, undefined);
  const removed = await request('/users/7/photo', 'DELETE');
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).data.photoUrl, null);
  assert.equal((await request('/users/7/photo', 'GET', undefined, null)).status, 404);
});
