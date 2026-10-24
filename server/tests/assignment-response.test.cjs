const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const { DeliveryController } = require('../dist/controllers/delivery.controller');

function fixture(status = 'Offered', expired = false) {
  const job = { id: 32, riderId: 7, transactionId: 47, status, stage: 'Delivery', expiresAt: new Date(Date.now() + (expired ? -60000 : 60000)), resumeStatus: 'ReadyForDelivery' };
  const order = { id: 47, userId: 1, workflowStatus: 'DeliveryAssigned', workflowVersion: 0, shop: { userId: 2, approvalStatus: 'Approved' }, assignments: [job] };
  const events = [], notices = [];
  let writes = 0;
  db.deliveryAssignment = { findUnique: async () => job, update: async ({ data }) => { Object.assign(job, data); writes++; } };
  db.transaction = { findUnique: async () => order, update: async ({ data }) => { order.workflowStatus = data.workflowStatus; order.workflowVersion++; } };
  db.$transaction = callback => callback(db); db.$queryRaw = async () => [];
  db.user = { findMany: async () => [{ id: 3 }] };
  db.orderEvent = { create: async ({ data }) => events.push(data) };
  db.notification = { createMany: async ({ data }) => notices.push(...data) };
  async function respond(action, userId = 7) {
    let error;
    const req = { params: { id: '32' }, body: { action, reason: action === 'decline' ? 'Vehicle unavailable today.' : undefined }, user: { userId }, app: { get: () => undefined } };
    const res = { status() { return this; }, json(body) { this.body = body; return this; } };
    await DeliveryController.respond(req, res, failure => { error = failure; });
    return error;
  }
  return { respond, job, order, events, notices, get writes() { return writes; } };
}

test('repeated accept succeeds without duplicate assignment writes, events or notifications', async () => {
  const f = fixture();
  assert.equal(await f.respond('accept'), undefined);
  const count = f.notices.length;
  assert.equal(await f.respond('accept'), undefined);
  assert.equal(f.job.status, 'Accepted'); assert.equal(f.order.workflowStatus, 'DeliveryAccepted');
  assert.equal(f.writes, 1); assert.equal(f.events.length, 1); assert.equal(f.notices.length, count); assert.equal(f.order.workflowVersion, 1);
  f.job.expiresAt = new Date(0);
  assert.equal(await f.respond('accept'), undefined, 'Accepted jobs remain accepted beyond offer expiry');
});

test('repeated decline succeeds but cannot reverse an earlier decision', async () => {
  const f = fixture();
  assert.equal(await f.respond('decline'), undefined);
  assert.equal(await f.respond('decline'), undefined);
  assert.equal(f.events.length, 1); assert.equal(f.writes, 1);
  assert.equal((await f.respond('accept')).statusCode, 409);
  const accepted = fixture('Accepted');
  assert.equal((await accepted.respond('decline')).statusCode, 409);
  assert.equal(accepted.writes, 0);
});

test('expired, reassigned, closed and other riders’ offers remain protected', async () => {
  for (const [status, expired, text] of [['Offered', true, /expired/], ['Expired', false, /expired/], ['Reassigned', false, /reassigned/], ['Completed', false, /already completed/]]) {
    const f = fixture(status, expired);
    const error = await f.respond('accept');
    assert.equal(error.statusCode, 409); assert.match(error.message, text); assert.equal(f.writes, 0);
  }
  const f = fixture('Accepted');
  assert.equal((await f.respond('accept', 8)).statusCode, 404);
  f.order.workflowStatus = 'Cancelled';
  assert.equal((await f.respond('accept')).statusCode, 409);
  assert.equal(f.writes, 0);
});
