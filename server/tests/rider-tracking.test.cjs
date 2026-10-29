const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const jwt = require('jsonwebtoken');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: { CORS_ORIGIN: '*', JWT_SECRET: 'tracking-test-only' } } };
const app = require('../dist/app').default;
let server, root, order, jobs;
before(async () => { server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); }); root = `http://127.0.0.1:${server.address().port}/api`; });
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  order = { id: 47, userId: 1, workflowVersion: 0, workflowStatus: 'PickupEnRoute', latitude: 0, longitude: 0, shop: { userId: 2, latitude: 0, longitude: 1, approvalStatus: 'Approved' }, events: [] };
  jobs = [{ id: 10, transactionId: 47, riderId: 7, status: 'Accepted', stage: 'Pickup', rider: { name: 'Test Rider' }, locationSharing: false }]; order.assignments = jobs;
  db.user = { findUnique: async ({ where }) => ({ id: where.id, isRider: [7, 8].includes(where.id), isAdmin: where.id === 3, isShopOwner: where.id === 2 }), findMany: async () => [{ id: 3 }] };
  db.riderProfile = { findUnique: async () => ({ active: true }) };
  db.$transaction = callback => callback(db); db.$queryRaw = async () => [];
  db.transaction = { findUnique: async ({ where, include }) => {
    if (where.id !== 47) return null;
    if (include?.assignments?.select) {
      const keys = Object.keys(include.assignments.select);
      assert.ok(!keys.includes('liveLatitude') && !keys.includes('locationSession'));
      return { ...order, assignments: jobs.map(job => Object.fromEntries(Object.entries(job).filter(([key]) => keys.includes(key)))) };
    }
    return { ...order, assignments: jobs.filter(job => job.status === 'Accepted') };
  }, update: async ({ data }) => { order.workflowStatus = data.workflowStatus; order.workflowVersion++; } };
  db.deliveryAssignment = {
    findMany: async ({ where }) => where?.expiresAt ? [] : jobs.filter(job => job.riderId === where.riderId).map(job => ({ ...job, transaction: order })),
    update: async ({ where, data }) => Object.assign(jobs.find(job => job.id === where.id), data),
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const job of jobs) {
        if (where.riderId !== undefined && job.riderId !== where.riderId || where.status && job.status !== where.status || where.locationSession && job.locationSession !== where.locationSession) continue;
        if (where.transaction && !where.transaction.workflowStatus.in.includes(order.workflowStatus)) continue;
        if (where.OR && job.locationCapturedAt && !(job.locationCapturedAt < where.OR[1].locationCapturedAt.lt)) continue;
        Object.assign(job, data); count++;
      }
      return { count };
    },
  };
  db.orderEvent = { create: async ({ data }) => order.events.push(data) }; db.notification = { createMany: async () => {} };
});
async function request(path, method = 'GET', body, who = 1) {
  const response = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${jwt.sign({ userId: who }, 'tracking-test-only')}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
const reading = (overrides = {}) => ({ sharing: true, sessionId: 'session_test_1', latitude: 0, longitude: 0, accuracy: 12, capturedAt: Date.now(), ...overrides });

test('only the assigned rider publishes and only the customer/admin can read the live point', async () => {
  for (const [who, status] of [[null, 401], [1, 403], [2, 403], [3, 403]]) assert.equal((await request('/delivery/location', 'PUT', reading(), who)).status, status);
  assert.equal((await request('/delivery/location', 'PUT', reading(), 8)).body.data.sharedJobs, 0);
  assert.equal((await request('/delivery/location', 'PUT', reading(), 7)).body.data.sharedJobs, 1);
  const tracking = await request('/delivery/orders/47/tracking');
  assert.equal(tracking.status, 200); assert.equal(tracking.headers.get('cache-control'), 'private, no-store');
  assert.equal(tracking.body.data.state, 'sharing'); assert.equal(tracking.body.data.location.latitude, 0); assert.equal(tracking.body.data.location.accuracy, 12);
  for (const who of [2, 7, 8, 9]) assert.equal((await request('/delivery/orders/47/tracking', 'GET', undefined, who)).status, 403);
  assert.equal((await request('/delivery/orders/47/tracking', 'GET', undefined, 3)).status, 200);
  assert.equal((await request('/delivery/orders/47/tracking', 'GET', undefined, null)).status, 401);
});

test('invalid, old, future and out-of-order GPS readings cannot overwrite the current point', async () => {
  for (const overrides of [{ latitude: 91 }, { longitude: -181 }, { accuracy: -1 }, { capturedAt: Date.now() - 180000 }, { capturedAt: Date.now() + 60000 }]) assert.equal((await request('/delivery/location', 'PUT', reading(overrides), 7)).status, 400);
  const newest = Date.now();
  await request('/delivery/location', 'PUT', reading({ capturedAt: newest, latitude: 1 }), 7);
  assert.equal((await request('/delivery/location', 'PUT', reading({ capturedAt: newest - 5000, latitude: 2 }), 7)).body.data.sharedJobs, 0);
  assert.equal(jobs[0].liveLatitude, 1);
  jobs[0].locationCapturedAt = new Date(Date.now() - 60000);
  const stale = await request('/delivery/orders/47/tracking');
  assert.equal(stale.body.data.state, 'stale'); assert.equal(stale.body.data.location.latitude, 1);
});

test('session-scoped stopping cannot clear a newer watcher and old jobs are never exposed', async () => {
  await request('/delivery/location', 'PUT', reading({ capturedAt: Date.now() - 5000 }), 7);
  await request('/delivery/location', 'PUT', reading({ sessionId: 'session_test_2' }), 7);
  await request('/delivery/location', 'PUT', { sharing: false, sessionId: 'session_test_1' }, 7);
  assert.equal((await request('/delivery/orders/47/tracking')).body.data.state, 'sharing');
  await request('/delivery/location', 'PUT', { sharing: false, sessionId: 'session_test_2' }, 7);
  assert.equal(jobs[0].liveLatitude, null);
  assert.equal((await request('/delivery/orders/47/tracking')).body.data.location, null);
  await request('/delivery/location', 'PUT', reading(), 7);
  jobs[0].status = 'Reassigned';
  assert.equal((await request('/delivery/orders/47/tracking')).body.data.location, null);
  assert.equal((await request('/delivery/location', 'PUT', reading(), 7)).body.data.sharedJobs, 0);
});

test('completion clears the stored position and ordinary job/order APIs omit tracking fields', async () => {
  await request('/delivery/location', 'PUT', reading(), 7);
  const detail = (await request('/delivery/orders/47')).body.data;
  assert.equal(detail.assignments[0].liveLatitude, undefined);
  const rider = (await request('/delivery/rider', 'GET', undefined, 7)).body.data;
  assert.equal(rider.jobs[0].liveLatitude, undefined); assert.equal(rider.jobs[0].locationSession, undefined);
  order.workflowStatus = 'LaundryPickedUp';
  assert.equal((await request('/delivery/orders/47/action', 'PUT', { action: 'droppedOff', expectedVersion: 0 }, 7)).status, 200);
  assert.equal(jobs[0].status, 'Completed'); assert.equal(jobs[0].liveLatitude, null);
  assert.equal((await request('/delivery/orders/47/tracking')).body.data.location, null);
  order.workflowStatus = 'Completed';
  assert.equal((await request('/delivery/orders/47/tracking')).body.data.state, 'finished');
});


test('pickup tracking and assigned job directions use the collection address, return delivery uses the return address', async () => {
  Object.assign(order, { collectionMethod: 'ShopPickup', collectionAddress: {
    address_line_1: 'Collection Street', city: 'Collection City', state_province: 'Province', postal_code: '4400',
    country: 'Philippines', address_type: 'Home', latitude: 1, longitude: 2,
  }, access_code: 'RETURN_ONLY', dropoff_instructions: 'RETURN_INSTRUCTIONS' });
  let response = await request('/delivery/orders/47/tracking');
  assert.deepEqual(response.body.data.customer, { latitude: 1, longitude: 2 });
  let assigned = await request('/delivery/rider', 'GET', undefined, 7);
  assert.match(assigned.body.data.jobs[0].order.customer.address, /Collection Street/);
  assert.equal(assigned.body.data.jobs[0].order.customer.accessCode, null);
  assert.equal(assigned.body.data.jobs[0].order.customer.instructions, null);
  order.workflowStatus = 'OutForDelivery'; jobs[0].stage = 'Delivery';
  response = await request('/delivery/orders/47/tracking');
  assert.deepEqual(response.body.data.customer, { latitude: 0, longitude: 0 });
});
