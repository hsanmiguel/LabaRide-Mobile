const assert = require('node:assert/strict');
const { test } = require('node:test');
const databasePath = require.resolve('../dist/config/database');
const database = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { __esModule: true, default: database } };
const { NotificationController } = require('../dist/controllers/notification.controller');

function response() {
  return { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('notification lists are scoped to the authenticated user and selected role', async () => {
  const records = [{ id: 1, userId: 7, shopMode: false }, { id: 2, userId: 8, shopMode: false }, { id: 3, userId: 7, shopMode: true }];
  database.notification = { findMany: async ({ where, orderBy }) => {
    assert.deepEqual(orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    return records.filter(item => item.userId === where.userId && item.shopMode === where.shopMode);
  } };
  for (const [shopMode, id] of [['false', 1], ['true', 3]]) {
    const res = response();
    await NotificationController.list({ user: { userId: 7 }, query: { shopMode, userId: 8 } }, res, error => { throw error; });
    assert.deepEqual(res.body.data.map(item => item.id), [id]);
  }
});

test('marking read checks ownership and preserves the original read timestamp', async () => {
  const record = { id: 1, userId: 7, readAt: null };
  let writes = 0;
  database.notification = {
    findFirst: async ({ where }) => where.id === record.id && where.userId === record.userId ? record : null,
    updateMany: async ({ where, data }) => {
      assert.equal(where.userId, 7);
      if (record.readAt === where.readAt) { record.readAt = data.readAt; writes++; }
    },
  };
  const invoke = async (userId, id = '1') => {
    const res = response();
    await NotificationController.markRead({ user: { userId }, params: { id } }, res, error => { throw error; });
    return res;
  };
  assert.equal((await invoke(8)).code, 404);
  assert.equal((await invoke(7, 'invalid')).code, 400);
  assert.equal(writes, 0);
  assert.equal((await invoke(7)).code, 200);
  const firstRead = record.readAt;
  assert.equal((await invoke(7)).code, 200);
  assert.equal(record.readAt, firstRead);
  assert.equal(writes, 1);
});
