const assert = require('node:assert/strict');
const { test } = require('node:test');
const databasePath = require.resolve('../dist/config/database');
const db = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const { DeliveryController } = require('../dist/controllers/delivery.controller');
async function invoke(status, pinned = true) {
  const active = { active: true, online: true, user: { name: 'Test Rider' } };
  db.transaction = { findUnique: async () => ({ id: 1, workflowStatus: status, workflowVersion: 3, userName: 'Customer', latitude: pinned ? 0 : null, longitude: pinned ? 0 : null, shop: { approvalStatus: 'Approved', shopName: 'Partner', latitude: 0, longitude: 1 } }) };
  db.riderProfile = { findMany: async () => [{ ...active, userId: 1, latitude: 0, longitude: 0 }, { ...active, userId: 2, latitude: 0, longitude: 1 }] };
  db.deliveryAssignment = { findMany: async () => [], groupBy: async ({ where }) => { assert.equal(where.transactionId.not, 1); return [{ riderId: 1, _count: { id: 1 } }]; } };
  db.$transaction = callback => callback(db);
  let error;
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await DeliveryController.riderOptions({ params: { id: '1' } }, res, failure => { error = failure; });
  return { res, error };
}
test('pickup distances use the customer pin and delivery distances use the shop pin', async () => {
  const pickup = await invoke('PickupQueued');
  assert.equal(pickup.res.body.data.origin.source, 'customer');
  assert.deepEqual(pickup.res.body.data.riders.map(rider => rider.userId), [1, 2]);
  assert.equal(pickup.res.body.data.riders[0].distance, 0);
  assert.equal(pickup.res.body.data.riders[0].latitude, undefined);
  const delivery = await invoke('ReadyForDelivery');
  assert.equal(delivery.res.body.data.origin.source, 'shop');
  assert.deepEqual(delivery.res.body.data.riders.map(rider => rider.userId), [2, 1]);
  assert.equal(delivery.res.body.data.workflowVersion, 3);
});
test('missing pickup pins preserve manual assignment without inventing distances', async () => {
  const result = await invoke('PickupQueued', false);
  assert.equal(result.res.body.data.origin.coordinatesAvailable, false);
  assert.ok(result.res.body.data.riders.every(rider => rider.distance === null));
  assert.deepEqual(result.res.body.data.riders.map(rider => rider.userId), [2, 1]);
  const closed = await invoke('Completed');
  assert.equal(closed.error.statusCode, 409);
});
