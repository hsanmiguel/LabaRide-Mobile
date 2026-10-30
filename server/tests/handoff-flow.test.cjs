const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const { DeliveryController } = require('../dist/controllers/delivery.controller');
const { handoffState } = require('../dist/services/handoff.service');

function fixture(status = 'PickupEnRoute', stage = 'Pickup') {
  const events = [], notifications = [];
  const order = { id: 47, userId: 1, shopId: 5, serviceName: 'Full Service', workflowStatus: status, workflowVersion: 0, shop: { userId: 2, approvalStatus: 'Approved' }, assignments: [{ id: 10, riderId: 3, status: 'Accepted', stage }] };
  db.$transaction = callback => callback(db);
  db.shopService = { findMany: async () => [] };
  db.$queryRaw = async () => [];
  db.transaction = { findUnique: async () => order, update: async ({ data }) => { const { workflowVersion, ...fields } = data; Object.assign(order, fields); order.workflowVersion++; } };
  db.orderEvent = { findMany: async () => events, create: async ({ data }) => { events.push(data); } };
  db.user = { findMany: async () => [{ id: 4 }] };
  db.notification = { createMany: async ({ data }) => { notifications.push(...data); } };
  db.deliveryAssignment = { update: async ({ data }) => Object.assign(order.assignments[0], data) };
  async function act(userId, action, version = order.workflowVersion, extra = {}) {
    let error;
    const req = { params: { id: '47' }, body: { action, expectedVersion: version, ...extra }, user: { userId, isRider: userId === 3, isAdmin: userId === 4 }, app: { get: () => undefined } };
    const res = { status() { return this; }, json(body) { this.body = body; return this; } };
    await DeliveryController.action(req, res, failure => { error = failure; });
    return error;
  }
  return { order, events, notifications, act };
}

test('booking confirmation accepts a short nonblank explanation and keeps other reason requirements', async () => {
  const f = fixture('BookingPending'); f.order.assignments = [];
  for (const note of [undefined, '', '   ']) {
    const error = await f.act(2, 'confirmBooking', 0, { note });
    assert.match(error.errors[0].message, /acceptance explanation/);
    assert.equal(f.events.length, 0);
  }
  assert.equal(await f.act(2, 'confirmBooking', 0, { note: '  ok  ' }), undefined);
  assert.equal(f.order.workflowStatus, 'PickupQueued');
  assert.equal(f.events[0].detail, 'ok');
  const issue = await f.act(2, 'issue', f.order.workflowVersion, { note: 'ok' });
  assert.match(issue.errors[0].message, /at least 5/);
  assert.equal(f.events.length, 1);
});

test('customer pickup requires rider arrival, customer handover, then rider receipt', async () => {
  const f = fixture();
  assert.match((await f.act(3, 'receiveHandoff')).message, /Wait for/);
  assert.match((await f.act(1, 'releaseHandoff')).message, /mark arrival/);
  assert.equal((await f.act(1, 'arriveHandoff')).statusCode, 403);
  assert.equal(await f.act(3, 'arriveHandoff'), undefined);
  assert.equal(f.order.workflowStatus, 'PickupEnRoute');
  assert.match((await f.act(3, 'arriveHandoff')).message, /already/);
  assert.equal((await f.act(2, 'releaseHandoff')).statusCode, 403);
  assert.equal((await f.act(4, 'releaseHandoff')).statusCode, 403);
  assert.equal((await f.act(3, 'releaseHandoff')).statusCode, 403);
  assert.equal(await f.act(1, 'releaseHandoff'), undefined);
  assert.match((await f.act(1, 'releaseHandoff')).message, /already/);
  assert.equal((await f.act(1, 'receiveHandoff')).statusCode, 403);
  assert.equal(await f.act(3, 'receiveHandoff'), undefined);
  assert.equal(f.order.workflowStatus, 'LaundryPickedUp');
  assert.equal(f.order.assignments[0].status, 'Accepted');
  assert.ok(f.notifications.some(item => item.audience === 'customer' && item.title.includes('Rider arrived')));
  assert.ok(f.notifications.some(item => item.audience === 'rider' && item.title.includes('Handover confirmed')));
});

test('shop collection and final delivery follow the appropriate counterpart confirmation', async () => {
  for (const [status, counterpart, result] of [['DeliveryAccepted', 2, 'CleanLaundryCollected'], ['OutForDelivery', 1, 'Completed']]) {
    const f = fixture(status, 'Delivery');
    assert.equal(await f.act(3, 'arriveHandoff'), undefined);
    assert.equal((await f.act(counterpart === 1 ? 2 : 1, 'releaseHandoff')).statusCode, 403);
    assert.equal(await f.act(counterpart, 'releaseHandoff'), undefined);
    assert.equal(await f.act(3, 'receiveHandoff'), undefined);
    assert.equal(f.order.workflowStatus, result);
    assert.equal(f.order.completedAt instanceof Date, result === 'Completed');
    assert.equal(f.order.assignments[0].status, result === 'Completed' ? 'Completed' : 'Accepted');
  }
});

test('stale versions, reassignment, and closed orders cannot reuse handover confirmation', async () => {
  const f = fixture();
  await f.act(3, 'arriveHandoff');
  assert.match((await f.act(1, 'releaseHandoff', 0)).message, /Order changed/);
  await f.act(1, 'releaseHandoff');
  f.order.assignments[0].id = 11;
  assert.equal(handoffState(f.order, f.events).released, false);
  assert.match((await f.act(3, 'receiveHandoff')).message, /Wait for/);
  f.order.assignments[0].status = 'Reassigned';
  assert.equal(handoffState(f.order, f.events), undefined);
  assert.match((await f.act(3, 'arriveHandoff')).message, /not ready/);
  f.order.workflowStatus = 'Cancelled';
  assert.match((await f.act(3, 'arriveHandoff')).message, /closed/);
});


test('drop-off confirmation waits for shop receipt; shop pickup queues a rider for either return method', async () => {
  for (const collectionMethod of ['Dropoff', 'ShopPickup']) {
    for (const deliveryType of ['Deliver', 'Pickup']) {
      const f = fixture('BookingPending');
      Object.assign(f.order, { collectionMethod, deliveryType, requestedPickupAt: new Date(Date.now() + 3600000) });
      f.order.assignments = [];
      assert.equal(await f.act(2, 'confirmBooking', undefined, { note: 'ok' }), undefined);
      assert.equal(f.order.workflowStatus, collectionMethod === 'Dropoff' ? 'AtPartner' : 'PickupQueued');
      assert.equal(f.order.status, 'Accepted');
      assert.equal(f.order.receivedAt, undefined);
      if (collectionMethod === 'ShopPickup') assert.equal(f.order.confirmedPickupAt, f.order.requestedPickupAt);
      else {
        assert.equal(await f.act(2, 'receive'), undefined);
        assert.equal(f.order.status, 'Queued');
        assert.ok(f.order.receivedAt instanceof Date);
        assert.equal(await f.act(2, 'wash'), undefined);
        assert.equal(f.order.status, 'Processing');
        assert.ok(f.order.processingStartedAt instanceof Date);
      }
    }
  }
});

test('customer collection completes at the shop without a return rider job', async () => {
  const f = fixture('Folding'); Object.assign(f.order, { deliveryType: 'Pickup', collectionMethod: 'ShopPickup', assignments: [] });
  assert.equal(await f.act(2, 'ready'), undefined);
  assert.equal(f.order.workflowStatus, 'ReadyForCollection');
  assert.equal(f.order.status, 'Ready');
  assert.ok(f.order.readyAt instanceof Date);
  assert.match((await f.act(1, 'completeCollection')).message, /Only this laundry partner/);
  assert.equal(await f.act(2, 'completeCollection'), undefined);
  assert.equal(f.order.workflowStatus, 'Completed');
  assert.equal(f.order.status, 'Completed');
});

test('managed ready estimates require receipt, partner access, a future time and revision reason', async () => {
  const f = fixture('AtPartner'); f.order.assignments = [];
  const estimatedReadyAt = new Date(Date.now() + 86400000).toISOString();
  assert.match((await f.act(2, 'updateEstimate', undefined, { estimatedReadyAt })).message, /Receive the laundry/);
  f.order.workflowStatus = 'LaundryReceived';
  assert.match((await f.act(1, 'updateEstimate', undefined, { estimatedReadyAt })).message, /Only this laundry partner/);
  assert.match((await f.act(2, 'updateEstimate', undefined, { estimatedReadyAt: '2020-01-01T00:00:00Z' })).message, /future/);
  assert.equal(await f.act(2, 'updateEstimate', undefined, { estimatedReadyAt }), undefined);
  assert.equal(f.order.workflowStatus, 'LaundryReceived');
  assert.equal(f.order.estimatedReadyAt.toISOString(), estimatedReadyAt);
  assert.match((await f.act(2, 'updateEstimate', undefined, { estimatedReadyAt })).message, /Explain the revised/);
  assert.equal(await f.act(2, 'updateEstimate', undefined, { estimatedReadyAt, note: 'Queue increased' }), undefined);
  assert.equal(f.order.estimateReason, 'Queue increased');
});
