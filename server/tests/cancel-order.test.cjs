const assert = require('node:assert/strict');
const { test } = require('node:test');

// Isolate the real controller from credentials and the live database.
const databasePath = require.resolve('../dist/config/database');
const database = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { __esModule: true, default: database } };
const { TransactionController } = require('../dist/controllers/transaction.controller');

async function invoke({ method = 'cancelTransaction', status = 'Pending', userId = 1,
  body = { reason: '  I changed my mind  ' }, rowFields = {}, race, missing = false, id = '42' } = {}) {
  let row = missing ? null : { id: 42, userId: 1, shopId: 5, status, notes: '', totalAmount: 130, shop: { userId: 2, approvalStatus: 'Approved' }, ...rowFields };
  let writes = 0, error;
  const events = [];
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
  return { res, row, writes, events, error };
}

test('pending cancellation saves a trimmed reason and notifies customer and shop', async () => {
  const result = await invoke();
  assert.equal(result.res.code, 200);
  assert.equal(result.row.status, 'Cancelled');
  assert.equal(result.res.body.data.notes, 'I changed my mind');
  assert.deepEqual(result.events.map(event => event.room), ['user_1', 'shop_5']);
  assert.ok(result.events.every(event => event.payload.notes === 'I changed my mind'));
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

test('invalid IDs and supplied blank or oversized reasons fail before querying', async () => {
  for (const options of [{ id: 'abc' }, { id: '0' }, { body: { reason: '  ' } }, { body: { reason: 'x'.repeat(501) } }]) {
    const result = await invoke(options);
    assert.equal(result.error.name, 'ZodError');
    assert.equal(result.writes, 0);
  }
  assert.equal((await invoke({ body: {} })).res.code, 200, 'Older clients can omit a reason');
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
  const race = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Accepted' }, race: 'Cancelled' });
  assert.equal(race.res.code, 409);
  assert.equal(race.row.status, 'Cancelled');
  assert.equal(race.events.length, 0);
  const accepted = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Accepted' } });
  assert.equal(accepted.res.code, 200);
  assert.equal(accepted.row.status, 'Accepted');
  assert.equal(accepted.row.processingStartedAt, undefined);
});

test('receipt and processing are separate, timestamps start on explicit action and cannot reset', async () => {
  const skip = await invoke({ method: 'updateStatus', userId: 2, body: { status: 'Processing' } });
  assert.equal(skip.res.code, 409);
  const receipt = await invoke({ method: 'updateStatus', userId: 2, status: 'Accepted', body: { status: 'Queued' } });
  assert.ok(receipt.row.receivedAt instanceof Date);
  assert.equal(receipt.row.processingStartedAt, undefined);
  const start = await invoke({ method: 'updateStatus', userId: 2, status: 'Queued', body: { status: 'Processing' } });
  assert.ok(start.row.processingStartedAt instanceof Date);
  const original = new Date('2026-01-01T00:00:00Z');
  const repeat = await invoke({ method: 'updateStatus', userId: 2, status: 'Processing', rowFields: { processingStartedAt: original }, body: { status: 'Processing' } });
  assert.equal(repeat.row.processingStartedAt, original);
  const ready = await invoke({ method: 'updateStatus', userId: 2, status: 'Processing', body: { status: 'Ready' } });
  assert.ok(ready.row.readyAt instanceof Date);
  assert.equal((await invoke({ method: 'updateStatus', userId: 2, status: 'Ready', body: { status: 'Completed' } })).res.code, 200);
});
test('ready estimates require receipt and a future time; revisions require a reason and notify customer', async () => {
  const estimatedReadyAt = new Date(Date.now()+86400000).toISOString();
  for (const status of ['Pending', 'Accepted', 'Ready', 'Completed', 'Cancelled']) {
    const result = await invoke({ method: 'updateStatus', userId: 2, status, body: { status, estimatedReadyAt } });
    assert.equal(result.res.code, 400);
    assert.equal(result.writes, 0);
  }
  const result = await invoke({ method: 'updateStatus', userId: 2, status: 'Queued', body: { status: 'Queued', estimatedReadyAt } });
  assert.equal(result.res.code, 200);
  assert.equal(result.row.estimatedReadyAt.toISOString(), estimatedReadyAt);
  assert.ok(result.row.estimateUpdatedAt instanceof Date);
  assert.deepEqual(result.events.map(e=>e.room), ['user_1','shop_5']);
  const rowFields = { estimatedReadyAt: new Date(Date.now()+3600000) };
  const revise = { method: 'updateStatus', userId: 2, status: 'Processing', rowFields, body: { status: 'Processing', estimatedReadyAt } };
  assert.equal((await invoke(revise)).res.code, 400);
  revise.body.estimateReason = 'Queue is longer than expected';
  assert.equal((await invoke(revise)).row.estimateReason, revise.body.estimateReason);
  revise.body.estimatedReadyAt = '2020-01-01T00:00:00Z';
  assert.equal((await invoke(revise)).res.code, 400);
});
test('shop can confirm requested pickup only after accepting the order', async () => {
  const rowFields = { collectionMethod: 'ShopPickup', requestedPickupAt: new Date(Date.now()+3600000) };
  const options = { method: 'updateStatus', userId: 2, status: 'Accepted', rowFields, body: { status: 'Accepted', confirmPickup: true } };
  assert.equal((await invoke(options)).row.confirmedPickupAt, rowFields.requestedPickupAt);
  options.status = 'Pending'; options.body.status = 'Pending';
  assert.equal((await invoke(options)).res.code, 409);
});
