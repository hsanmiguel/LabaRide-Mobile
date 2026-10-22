const assert = require('node:assert/strict');
const { test } = require('node:test');

// Isolate the real controller from credentials and the live database.
const databasePath = require.resolve('../dist/config/database');
const database = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { __esModule: true, default: database } };
const { TransactionController } = require('../dist/controllers/transaction.controller');

async function invoke({ method = 'cancelTransaction', status = 'Pending', userId = 1,
  body = { reason: '  I changed my mind  ' }, race, missing = false, id = '42' } = {}) {
  let row = missing ? null : { id: 42, userId: 1, shopId: 5, status, notes: '', totalAmount: 130, shop: { userId: 2, approvalStatus: 'Approved' } };
  let writes = 0, error;
  const events = [];
  const notifications = [];
  database.$transaction = async callback => callback(database);
  database.notification = { createMany: async ({ data }) => { notifications.push(...data); return { count: data.length }; } };
  database.transaction = {
    findUnique: async () => row && { ...row },
    updateMany: async ({ where, data }) => {
      writes++;
      if (race) row.status = race;
      if (!row || Object.entries(where).some(([key, value]) => key === 'shop' ? row.shop.approvalStatus !== value.approvalStatus : row[key] !== value)) return { count: 0 };
      for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
      return { count: 1 };
    },
    findUniqueOrThrow: async () => ({ ...row }),
  };
  const req = { params: { id }, body, user: { userId }, app: { get: () => ({
    to: room => ({ emit: (event, payload) => events.push({ room, event, payload }) }),
  }) } };
  const res = { status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
  await TransactionController[method](req, res, failure => { error = failure; });
  return { res, row, writes, events, notifications, error };
}

test('pending cancellation saves a trimmed reason and notifies customer and shop', async () => {
  const result = await invoke();
  assert.equal(result.res.code, 200);
  assert.equal(result.row.status, 'Cancelled');
  assert.equal(result.res.body.data.notes, 'I changed my mind');
  assert.deepEqual(result.events.map(event => event.room), ['user_1', 'shop_5']);
  assert.ok(result.events.every(event => event.payload.notes === 'I changed my mind'));
  assert.deepEqual(result.notifications.map(item => [item.userId, item.shopMode]), [[1, false], [2, true]]);
  assert.ok(result.notifications.every(item => item.message.includes('I changed my mind')));
});

test('other customers and missing orders cannot cancel', async () => {
  for (const [options, code] of [[{ userId: 3 }, 403], [{ missing: true }, 404]]) {
    const result = await invoke(options);
    assert.equal(result.res.code, code);
    assert.equal(result.writes, 0);
    assert.equal(result.events.length, 0);
  }
});

test('only pending orders can be cancelled', async () => {
  for (const status of ['Processing', 'Completed', 'Cancelled']) {
    const result = await invoke({ status });
    assert.equal(result.res.code, 409);
    assert.equal(result.row.status, status);
    assert.equal(result.writes, 0);
  }
});

test('invalid IDs and missing, invalid, blank or oversized reasons are rejected', async () => {
  for (const options of [{ id: 'abc' }, { id: '0' }, { body: {} }, { body: { reason: null } }, { body: { reason: 123 } }, { body: { reason: '  ' } }, { body: { reason: 'x'.repeat(501) } }]) {
    const result = await invoke(options);
    assert.equal(result.error.name, 'ZodError');
    assert.equal(result.writes, 0);
    assert.equal(result.row.status, 'Pending');
    assert.equal(result.events.length, 0);
  }
});

test('accepting an order while a customer cancels returns a conflict without cancelling it', async () => {
  const result = await invoke({ race: 'Processing' });
  assert.equal(result.res.code, 409);
  assert.equal(result.row.status, 'Processing');
  assert.equal(result.events.length, 0);
});

test('shop status updates cannot revive a cancelled order or overwrite a simultaneous cancellation', async () => {
  for (const status of ['Processing', 'Completed']) {
    const result = await invoke({ method: 'updateStatus', userId: 2, status: 'Cancelled', body: { status } });
    assert.equal(result.res.code, 409);
    assert.equal(result.row.status, 'Cancelled');
    assert.equal(result.writes, 0);
  }
  const race = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Processing', acceptanceExplanation: 'We have capacity today.' }, race: 'Cancelled' });
  assert.equal(race.res.code, 409);
  assert.equal(race.row.status, 'Cancelled');
  assert.equal(race.events.length, 0);
  const accepted = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Processing', acceptanceExplanation: '  We have capacity today.  ' } });
  assert.equal(accepted.res.code, 200);
  assert.equal(accepted.row.status, 'Processing');
  assert.equal(accepted.row.notes, 'Shop acceptance: We have capacity today.');
  assert.ok(accepted.events.every(event => event.payload.notes === accepted.row.notes));
  assert.equal(accepted.notifications.length, 2);
  assert.ok(accepted.notifications[0].message.includes('We have capacity today.'));
});

test('acceptance requires a nonblank explanation of at most 500 characters', async () => {
  const missing = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Processing' } });
  assert.equal(missing.res.code, 400);
  assert.equal(missing.writes, 0);
  for (const acceptanceExplanation of ['   ', 'x'.repeat(501)]) {
    const invalid = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Processing', acceptanceExplanation } });
    assert.equal(invalid.error.name, 'ZodError');
    assert.equal(invalid.writes, 0);
  }
});
