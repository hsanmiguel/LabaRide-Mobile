const assert = require('node:assert/strict');
const { test } = require('node:test');
const { serviceProcessingTimes, withProcessingTiming } = require('../dist/utils/processing-timing');
const { changeState } = require('../dist/services/dispatch.service');
const services = [{ serviceName: 'Full Service', washingMinutes: 30, dryingMinutes: 45 }, { serviceName: 'Wash Only', washingMinutes: 20, dryingMinutes: null }];
const base = { id: 64, shopId: 5, userId: 1, serviceName: 'Full Service', status: 'Processing', shop: { userId: 2 }, processingStartedAt: new Date('2026-10-30T01:00:00Z') };

test('service durations match exact names before splitting combined services and never invent missing durations', () => {
  assert.deepEqual(serviceProcessingTimes('Full Service', services), { washingMinutes: 30, dryingMinutes: 45 });
  assert.deepEqual(serviceProcessingTimes('Full Service, Wash Only', services), { washingMinutes: 50, dryingMinutes: null });
  assert.deepEqual(serviceProcessingTimes('Removed service', services), { washingMinutes: null, dryingMinutes: null });
  assert.deepEqual(serviceProcessingTimes('Wash, Dry', [{ serviceName: 'Wash, Dry', washingMinutes: 35, dryingMinutes: 40 }]), { washingMinutes: 35, dryingMinutes: 40 });
});

test('captured durations survive later edits and unconfigured snapshots remain unconfigured', () => {
  const captured = { ...base, processingTimingCapturedAt: new Date(), washingMinutes: 15, dryingMinutes: 25 };
  const response = withProcessingTiming(captured, services);
  assert.equal(response.washingMinutes, 15);
  assert.equal(response.dryingMinutes, 25);
  assert.equal(response.processingTimingSource, 'snapshot');
  assert.equal(withProcessingTiming({ ...captured, washingMinutes: null }, services).washingMinutes, null);
});

test('earlier orders use labelled current settings, recorded events supply actual phase starts, reads never write', () => {
  const events = [{ toStatus: 'Drying', fromStatus: 'Washing', createdAt: new Date('2026-10-30T02:00:00Z') }];
  const response = withProcessingTiming({ ...base, workflowStatus: 'Drying' }, services, events);
  assert.equal(response.processingTimingSource, 'current-service');
  assert.equal(response.washingMinutes, 30);
  assert.equal(response.dryingStartedAt, events[0].createdAt);
  assert.equal(base.dryingStartedAt, undefined);
  assert.equal(withProcessingTiming(base, services).dryingStartedAt, null);
  assert.equal(withProcessingTiming(base, services).washingStartedAt, null, 'Original processing start must never become a washing start');
  assert.equal(withProcessingTiming({ ...base, workflowStatus: 'Washing' }, services).washingStartedAt, base.processingStartedAt);
});

test('real workflow transitions capture once and drying starts on the shop action, independently of washing overrun', async () => {
  const order = { ...base, status: 'Queued', workflowStatus: 'LaundryReceived', processingStartedAt: null };
  let reads = 0;
  const tx = {
    shopService: { findMany: async () => { reads++; return services; } },
    transaction: { update: async ({ data }) => { const { workflowVersion, ...fields } = data; Object.assign(order, fields); } },
    orderEvent: { create: async () => {} }, user: { findMany: async () => [] }, notification: { createMany: async () => {} },
  };
  await changeState(tx, order, 2, 'wash', 'Washing');
  assert.ok(order.processingStartedAt instanceof Date);
  assert.ok(order.washingStartedAt instanceof Date);
  assert.ok(order.processingTimingCapturedAt instanceof Date);
  assert.equal(order.washingMinutes, 30);
  assert.equal(order.dryingStartedAt, undefined);
  const started = order.processingStartedAt;
  await changeState(tx, order, 2, 'dry', 'Drying');
  assert.ok(order.dryingStartedAt instanceof Date);
  assert.equal(order.processingStartedAt, started);
  assert.equal(order.dryingMinutes, 45);
  assert.equal(reads, 1);
});

test('customer and shop list endpoints return identical timing data without exposing private handoff codes', async () => {
  const databasePath = require.resolve('../dist/config/database');
  const events = [{ fromStatus: 'Washing', toStatus: 'Drying', createdAt: new Date('2026-10-30T02:00:00Z') }];
  const row = { ...base, workflowStatus: 'Drying', pickupCode: 'pickup-private', deliveryCode: 'delivery-private', collectionCode: 'collection-private', events };
  const shop = { id: 5, userId: 2, shopName: 'Test shop', services };
  const db = {
    shop: { findUnique: async () => shop },
    transaction: { findMany: async ({ include }) => [{ ...row, ...(include.shop ? { shop } : {}) }] },
  };
  require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
  const { TransactionController } = require('../dist/controllers/transaction.controller');
  async function read(method, userId, params) {
    let error;
    const res = { status() { return this; }, json(body) { this.body = body; return this; } };
    await TransactionController[method]({ user: { userId }, params }, res, failure => { error = failure; });
    assert.equal(error, undefined);
    return res.body.data[0];
  }
  const customer = await read('getUserTransactions', 1, { userId: '1' });
  const partner = await read('getShopTransactions', 2, { shopId: '5' });
  for (const field of ['washingMinutes', 'dryingMinutes', 'processingStartedAt', 'dryingStartedAt', 'processingTimingSource']) assert.deepEqual(customer[field], partner[field], field);
  assert.equal(customer.dryingStartedAt, events[0].createdAt);
  assert.equal(customer.collectionCode, undefined);
  assert.equal(partner.pickupCode, undefined);
  assert.equal(partner.deliveryCode, undefined);
  assert.equal(customer.shop.services, undefined);
  assert.equal(customer.events, undefined);
  assert.equal(partner.events, undefined);
});
