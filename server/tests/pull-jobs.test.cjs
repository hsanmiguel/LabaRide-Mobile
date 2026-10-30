const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const { DeliveryController } = require('../dist/controllers/delivery.controller');
function fixture(status = 'PickupQueued') {
  const order = { id: 47, userId: 1, shopId: 3, workflowStatus: status, workflowVersion: 0, assignments: [], shop: { userId: 2, approvalStatus: 'Approved', shopName: 'Test Laundry', city: 'Naga', state_province: 'Camarines Sur', latitude: 0, longitude: 1 }, city: 'Naga', state_province: 'Camarines Sur', latitude: 0, longitude: 0,
    serviceName: 'Wash', kiloAmount: 5, scheduledDate: null, scheduledTime: null, createdAt: new Date(), userName: 'PRIVATE_CUSTOMER', userPhone: 'PRIVATE_PHONE', address_line_1: 'PRIVATE_STREET', notes: 'PRIVATE_NOTES', access_code: 'PRIVATE_ACCESS', pickupCode: 'PRIVATE_CODE' };
  const rider = { userId: 7, active: true, online: true, latitude: 0, longitude: 0 };
  const events = [], notices = [];
  let workload = 0, selection;
  db.$transaction = callback => callback(db); db.$queryRaw = async () => [];
  db.riderProfile = { findUnique: async () => rider };
  db.user = { findUnique: async () => ({ isRider: true }), findMany: async () => [{ id: 4 }] };
  db.transaction = { findUnique: async () => order, findMany: async options => { selection = options; return [order]; }, update: async ({ data }) => { order.workflowStatus = data.workflowStatus; order.workflowVersion++; } };
  db.deliveryAssignment = { findMany: async () => [], count: async () => workload, create: async ({ data }) => { const job = { ...data, id: 32 }; order.assignments.push(job); return job; } };
  db.orderEvent = { create: async ({ data }) => events.push(data) };
  db.notification = { createMany: async ({ data }) => notices.push(...data) };
  async function invoke(method, body = { stage: status === 'PickupQueued' ? 'Pickup' : 'Delivery', expectedVersion: 0 }, userId = 7) {
    let error;
    const res = { status() { return this; }, json(body) { this.body = body; return this; } };
    await DeliveryController[method]({ params: { id: '47' }, body, user: { userId }, app: { get: () => undefined } }, res, failure => { error = failure; });
    return { error, data: res.body?.data };
  }
  return { order, rider, events, notices, invoke, get selection() { return selection; }, set workload(value) { workload = value; } };
}
test('board only queries ready unassigned approved-shop jobs and returns private-safe previews', async () => {
  const f = fixture();
  const result = await f.invoke('availableJobs');
  assert.equal(result.error, undefined);
  assert.equal(result.data.jobs[0].stage, 'Pickup'); assert.equal(result.data.jobs[0].distanceKm, 0);
  assert.ok(!JSON.stringify(result.data).includes('PRIVATE_'));
  assert.deepEqual(f.selection.where.workflowStatus.in, ['PickupQueued', 'ReadyForDelivery']);
  assert.deepEqual(f.selection.where.assignments.none.status.in, ['Offered', 'Accepted']);
  assert.equal(f.selection.where.shop.approvalStatus, 'Approved');
  for (const key of ['userName', 'userPhone', 'address_line_1', 'notes', 'access_code', 'pickupCode', 'collectionCode', 'deliveryCode', 'weightEvidence']) assert.equal(f.selection.select[key], undefined);
  f.order.workflowStatus = 'ReadyForDelivery';
  const delivery = await f.invoke('availableJobs');
  assert.equal(delivery.data.jobs[0].stage, 'Delivery'); assert.ok(delivery.data.jobs[0].distanceKm > 100);
  f.rider.online = false;
  assert.deepEqual((await f.invoke('availableJobs')).data.jobs, []);
});
test('claim immediately accepts each stage, notifies all parties, and acknowledges retries without duplicates', async () => {
  for (const status of ['PickupQueued', 'ReadyForDelivery']) {
    const f = fixture(status);
    const result = await f.invoke('claim');
    assert.equal(result.error, undefined); assert.equal(result.data.assignmentId, 32);
    assert.equal(f.order.assignments[0].status, 'Accepted');
    assert.equal(f.order.workflowStatus, status === 'PickupQueued' ? 'PickupAccepted' : 'DeliveryAccepted');
    assert.equal(f.events[0].action, 'JobClaimed');
    assert.deepEqual(f.notices.map(item => item.audience).sort(), ['admin', 'customer', 'partner', 'rider']);
    assert.equal((await f.invoke('claim')).error, undefined);
    assert.equal(f.order.assignments.length, 1); assert.equal(f.events.length, 1);
    assert.equal((await f.invoke('claim', { stage: status === 'PickupQueued' ? 'Pickup' : 'Delivery', expectedVersion: 0 }, 8)).error.statusCode, 409);
  }
});
test('offline, inactive, full, stale, paused and inappropriate stages cannot be claimed', async () => {
  for (const alter of [f => { f.rider.online = false; }, f => { f.rider.active = false; }, f => { f.workload = 3; }, f => { f.order.workflowVersion = 1; }, f => { f.order.shop.approvalStatus = 'Suspended'; }, f => { f.order.assignments.push({ id: 1, status: 'Offered', riderId: 8 }); }]) {
    const f = fixture(); alter(f);
    assert.ok((await f.invoke('claim')).error); assert.equal(f.events.length, 0);
  }
  for (const status of ['BookingPending', 'Washing', 'LaundryPickedUp', 'PickupEnRoute', 'OutForDelivery', 'Delivered', 'Completed', 'Cancelled']) {
    const f = fixture(status);
    assert.equal((await f.invoke('claim')).error.statusCode, 409); assert.equal(f.events.length, 0);
  }
  const mismatch = fixture();
  assert.equal((await mismatch.invoke('claim', { stage: 'Delivery', expectedVersion: 0 })).error.statusCode, 409);
});


test('pickup preview uses the collection address instead of the return address without exposing private JSON', async () => {
  const f = fixture();
  Object.assign(f.order, { collectionMethod: 'ShopPickup', collectionAddress: {
    address_line_1: 'PRIVATE_COLLECTION_STREET', city: 'Collection City', state_province: 'Collection Province',
    postal_code: '4400', country: 'Philippines', address_type: 'Home', latitude: 0, longitude: 2,
    access_code: 'PRIVATE_COLLECTION_ACCESS', dropoff_instructions: 'PRIVATE_COLLECTION_NOTES',
  } });
  const result = await f.invoke('availableJobs');
  assert.equal(result.error, undefined);
  assert.equal(result.data.jobs[0].pickupArea, 'Collection City, Collection Province');
  assert.ok(result.data.jobs[0].distanceKm > 200);
  assert.ok(!JSON.stringify(result.data).includes('PRIVATE_'));
  f.order.workflowStatus = 'ReadyForDelivery';
  const delivery = await f.invoke('availableJobs');
  assert.equal(delivery.data.jobs[0].dropoffArea, 'Naga, Camarines Sur');
});
