const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const jwt = require('jsonwebtoken');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: { CORS_ORIGIN: '*', JWT_SECRET: 'notification-delete-test-only' } } };
const app = require('../dist/app').default;
let server, root, records;
before(async () => {
  db.user = { findUnique: async ({ where }) => ({ id: where.id, isAdmin: false, isShopOwner: false }) };
  db.notification = {
    findFirst: async ({ where }) => records.find(row => row.id === where.id && row.userId === where.userId),
    deleteMany: async ({ where }) => {
      const before = records.length;
      records = records.filter(row => !(row.userId === where.userId && row.readAt && (where.id ? row.id === where.id : row.shopMode === where.shopMode && !where.audience.notIn.includes(row.audience))));
      return { count: before - records.length };
    },
  };
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  root = `http://127.0.0.1:${server.address().port}/api/notifications`;
});
after(() => new Promise(resolve => server.close(resolve)));
async function remove(path, authenticated = true) {
  const res = await fetch(root + path, { method: 'DELETE', headers: authenticated ? { Authorization: `Bearer ${jwt.sign({ userId: 7 }, 'notification-delete-test-only')}` } : {} });
  return { status: res.status, body: await res.json() };
}
test('real DELETE routes protect authentication/ownership/unread records and route bulk read correctly', async () => {
  records = [
    { id: 1, userId: 7, audience: 'customer', shopMode: false, readAt: new Date() },
    { id: 2, userId: 7, audience: 'customer', shopMode: false, readAt: null },
    { id: 3, userId: 8, audience: 'customer', shopMode: false, readAt: new Date() },
    { id: 4, userId: 7, audience: 'partner', shopMode: true, readAt: new Date() },
  ];
  assert.equal((await remove('/1', false)).status, 401);
  assert.equal((await remove('/3')).status, 404);
  assert.equal((await remove('/2')).status, 409);
  const bulk = await remove('/read?shopMode=false');
  assert.equal(bulk.status, 200); assert.equal(bulk.body.data.deleted, 1);
  assert.deepEqual(records.map(row => row.id), [2, 3, 4]);
  assert.equal((await remove('/4')).status, 200);
  assert.deepEqual(records.map(row => row.id), [2, 3]);
});
