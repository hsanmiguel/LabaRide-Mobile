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

test('deleting requires a read notification owned by the authenticated user', async () => {
  let records = [{ id: 1, userId: 7, readAt: new Date() }, { id: 2, userId: 7, readAt: null }, { id: 3, userId: 8, readAt: new Date() }];
  database.notification = {
    findFirst: async ({ where }) => records.find(item => item.id === where.id && item.userId === where.userId),
    deleteMany: async ({ where }) => {
      assert.deepEqual(where.readAt, { not: null });
      const before = records.length; records = records.filter(item => !(item.id === where.id && item.userId === where.userId && item.readAt));
      return { count: before - records.length };
    },
  };
  async function invoke(id) {
    const res = response();
    await NotificationController.remove({ user: { userId: 7 }, params: { id }, query: { userId: 8 } }, res, error => { throw error; });
    return res;
  }
  for (const id of ['invalid', '0', '-1', '9007199254740992']) assert.equal((await invoke(id)).code, 400);
  assert.equal((await invoke('3')).code, 404);
  assert.equal((await invoke('2')).code, 409);
  assert.equal(records.length, 3);
  assert.equal((await invoke('1')).code, 200);
  assert.deepEqual(records.map(item => item.id), [2, 3]);
  assert.equal((await invoke('1')).code, 404);
});

test('delete read is scoped to the selected role and leaves unread and other users’ notifications', async () => {
  let records = [
    { id: 1, userId: 7, audience: 'customer', shopMode: false, readAt: new Date() },
    { id: 2, userId: 7, audience: 'customer', shopMode: false, readAt: null },
    { id: 3, userId: 7, audience: 'partner', shopMode: true, readAt: new Date() },
    { id: 4, userId: 7, audience: 'rider', shopMode: false, readAt: new Date() },
    { id: 5, userId: 7, audience: 'admin', shopMode: false, readAt: new Date() },
    { id: 6, userId: 8, audience: 'customer', shopMode: false, readAt: new Date() },
  ];
  database.notification = { deleteMany: async ({ where }) => {
    assert.equal(where.userId, 7); assert.deepEqual(where.readAt, { not: null });
    const before = records.length;
    records = records.filter(item => !(item.userId === where.userId && item.readAt && (typeof where.audience === 'string' ? item.audience === where.audience : !where.audience.notIn.includes(item.audience) && item.shopMode === where.shopMode)));
    return { count: before - records.length };
  } };
  for (const query of [{ shopMode: 'false' }, { shopMode: 'true' }, { audience: 'rider' }, { audience: 'admin' }]) {
    const res = response(); await NotificationController.removeRead({ user: { userId: 7 }, query: { ...query, userId: 8 } }, res, error => { throw error; });
    assert.equal(res.body.data.deleted, 1);
  }
  assert.deepEqual(records.map(item => item.id), [2, 6]);
});
