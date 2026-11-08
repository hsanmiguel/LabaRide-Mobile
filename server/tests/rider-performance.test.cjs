const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, require: name => require('../dist/services/' + name.slice(2)) };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/rider-performance.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { performanceSummary } = context.exports;
const now = new Date('2026-11-04T12:00:00Z');
const fixture = extra => ({ id: 1, riderId: 7, transactionId: 10, stage: 'Pickup', status: 'Completed',
  createdAt: new Date('2026-11-04T01:00:00Z'), updatedAt: new Date('2026-11-04T02:00:00Z'),
  acceptedAt: new Date('2026-11-04T01:00:00Z'), completedAt: new Date('2026-11-04T01:15:00Z'),
  transaction: { kiloAmount: '6', shop: { shopName: 'Test Laundry' }, events: [] }, ...extra });

test('only completed trips earn their saved allocation, excluding reassigned and declined jobs', () => {
  const transaction = { kiloAmount: '6', deliveryPricing: { pickupEarnings: 35.06, returnEarnings: 58.44 }, shop: { shopName: 'Test Laundry' }, events: [] };
  const result = performanceSummary([
    fixture({ transaction }), fixture({ id: 2, transaction, stage: 'Delivery' }),
    fixture({ id: 3, transaction, status: 'Reassigned' }), fixture({ id: 4, transaction, status: 'Declined' }),
    fixture({ id: 5, transaction, status: 'Accepted' }), fixture({ id: 6 }),
  ], now);
  assert.equal(result.pickupEarnings, 35.06);
  assert.equal(result.returnEarnings, 58.44);
});
test('performance averages use actual timestamps and separate pickup/delivery jobs', () => {
  const result = performanceSummary([fixture(), fixture({ id: 2, stage: 'Delivery', completedAt: new Date('2026-11-04T01:30:00Z') }),
    fixture({ id: 3, status: 'Failed', acceptedAt: null, completedAt: null }), fixture({ id: 4, status: 'Declined' }), fixture({ id: 5, status: 'Accepted' })], now);
  assert.equal(result.completed, 2); assert.equal(result.failed, 1); assert.equal(result.completionRate, 66.7);
  assert.equal(result.averagePickup.minutes, 15); assert.equal(result.averageDelivery.minutes, 30);
  assert.equal(result.averageKilosPerJob, 6); assert.equal(result.active, 1);
  assert.equal(result.week.at(-1).completed, 2); assert.equal(result.averageJobsPerDay, 0.1);
});
test('empty periods and missing timing show no-data values rather than invented zero-duration averages', () => {
  assert.equal(performanceSummary([], now).completionRate, null);
  const result = performanceSummary([fixture({ acceptedAt: null, completedAt: null })], now);
  assert.equal(result.completed, 1); assert.equal(result.averagePickup.minutes, null); assert.equal(result.averagePickup.samples, 0);
});
test('historical handover events recover timing while ignoring other riders and GPS-related updatedAt changes', () => {
  const job = fixture({ acceptedAt: null, completedAt: null });
  job.transaction.events = [
    { action: 'JobClaimed', toStatus: 'PickupAccepted', actorId: 8, createdAt: new Date('2026-11-04T01:01:00Z') },
    { action: 'JobClaimed', toStatus: 'PickupAccepted', actorId: 7, createdAt: new Date('2026-11-04T01:05:00Z') },
    { action: 'droppedOff', toStatus: 'AtPartner', actorId: 7, createdAt: new Date('2026-11-04T01:25:00Z') },
  ];
  assert.equal(performanceSummary([job], now).averagePickup.minutes, 20);
});
test('Philippine calendar dates and 30-day boundaries exclude future and old completions', () => {
  const result = performanceSummary([fixture({ completedAt: new Date('2026-11-03T17:00:00Z') }),
    fixture({ id: 2, completedAt: new Date('2026-09-01T01:00:00Z') }),
    fixture({ id: 3, completedAt: new Date('2026-12-01T01:00:00Z') })], now);
  assert.equal(result.completed, 1); assert.equal(result.week.at(-1).date, '2026-11-04'); assert.equal(result.week.at(-1).completed, 1);
  assert.equal(result.averagePickup.minutes, null, 'negative trip intervals are excluded');
});
