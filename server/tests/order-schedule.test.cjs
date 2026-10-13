const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTransactionSchema } = require('../dist/validators/transaction.validator');
const { deliveryScheduleError } = require('../dist/utils/order-schedule');
const location = { address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur',
  postal_code: '4400', country: 'Philippines', address_type: 'Home' };

function input(schedule = new Date(Date.now() + 86400000).toISOString()) {
  return { ...location, shopId: 1, serviceName: 'Wash', kiloAmount: 8,
    deliveryType: 'Deliver', scheduledDate: schedule, scheduledTime: schedule };
}

test('the API rejects past dates, past times and malformed schedules on either field', () => {
  for (const field of ['scheduledDate', 'scheduledTime']) {
    for (const value of [new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() - 60000).toISOString(),
      '', 'invalid', '2026-02-30T10:00:00Z', '2026-13-01T10:00:00Z', '2099-10-13T25:00:00Z']) {
      const result = createTransactionSchema.safeParse({ body: { ...input(), [field]: value } });
      assert.equal(result.success, false, `${field}: ${value}`);
      assert.ok(result.error.issues.some(issue => issue.path.includes(field)));
    }
  }
});

test('Full Service delivery requires two hours, including the exact boundary and combined services', () => {
  const now = Date.parse('2026-10-13T02:30:00Z');
  for (const serviceName of ['8Kg Full Service Laundry', 'Full-Service', 'FULL SERVICE', 'Iron, Full service']) {
    for (const [minutes, allowed] of [[60, false], [119, false], [120, true], [121, true]]) {
      const schedule = new Date(now + minutes * 60000).toISOString();
      assert.equal(deliveryScheduleError({ ...input(schedule), serviceName }, now) === null, allowed);
    }
  }
  const soon = new Date(now + 60 * 60000).toISOString();
  assert.equal(deliveryScheduleError(input(soon), now), null);
  assert.equal(deliveryScheduleError({ ...input(soon), serviceName: 'Full Service', deliveryType: 'Pickup' }, now), null);
  const future = new Date(now + 180 * 60000).toISOString();
  assert.match(deliveryScheduleError({ ...input(future), serviceName: 'Full Service', scheduledTime: soon }, now), /at least 2 hours/);
});

// Verify the real controller without credentials or writes to the live database.
const databasePath = require.resolve('../dist/config/database');
const database = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { __esModule: true, default: database } };
const { TransactionController } = require('../dist/controllers/transaction.controller');
const { Prisma } = require('@prisma/client');

async function invoke({ minutes, serviceName = '8Kg Full Service Laundry', deliveryType = 'Deliver', waitingMinutes = 0 }) {
  const now = Date.parse('2026-10-13T02:30:00Z');
  const originalClock = Date.now;
  Date.now = () => now + waitingMinutes * 60000;
  let writes = 0, error;
  database.user = { findUnique: async () => ({ id: 1, name: 'Test User', email: 'test@example.invalid' }) };
  database.shop = { findUnique: async () => ({ id: 1, services: [
    { id: 1, serviceName, price: new Prisma.Decimal(215), packageKilos: new Prisma.Decimal(8) },
  ], kiloPrices: [] }) };
  database.transaction = { create: async ({ data }) => { writes++; return { ...data, id: 1 }; } };
  const schedule = new Date(now + minutes * 60000).toISOString();
  const req = { body: { ...input(schedule), serviceName: 'Client claims Wash Only', serviceIds: [1], deliveryType },
    user: { userId: 1 }, app: { get: () => undefined } };
  const res = { status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
  try { await TransactionController.createTransaction(req, res, failure => { error = failure; }); }
  finally { Date.now = originalClock; }
  return { res, writes, error };
}

test('API uses the saved shop service name and rejects early delivery before writing an order', async () => {
  const early = await invoke({ minutes: 119 });
  assert.equal(early.error, undefined);
  assert.equal(early.res.code, 400);
  assert.equal(early.res.body.error.code, 'INVALID_SCHEDULE');
  assert.equal(early.writes, 0);
  const boundary = await invoke({ minutes: 120 });
  assert.equal(boundary.res.code, 201);
  assert.equal(boundary.writes, 1);
  assert.equal(boundary.res.body.data.serviceName, '8Kg Full Service Laundry');
  const expiredCutoff = await invoke({ minutes: 120, waitingMinutes: 1 });
  assert.equal(expiredCutoff.res.code, 400);
  assert.equal(expiredCutoff.writes, 0);
});

test('non-Full Service deliveries and pickup retain their future-time rule', async () => {
  for (const options of [{ serviceName: 'Wash Only' }, { deliveryType: 'Pickup' }]) {
    const result = await invoke({ minutes: 60, ...options });
    assert.equal(result.error, undefined);
    assert.equal(result.res.code, 201);
    assert.equal(result.writes, 1);
  }
});

test('future schedules accept UTC and Manila offsets independently of the server timezone', () => {
  const timestamp = Date.now() + 3600000;
  const utc = new Date(timestamp).toISOString();
  const manila = new Date(timestamp + 8 * 3600000).toISOString().replace('Z', '+08:00');
  for (const schedule of [utc, manila]) {
    assert.equal(createTransactionSchema.safeParse({ body: input(schedule) }).success, true);
    assert.equal(Date.parse(schedule), timestamp);
  }
});
