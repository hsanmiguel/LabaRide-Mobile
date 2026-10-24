const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTransactionSchema } = require('../dist/validators/transaction.validator');
const location = { address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Home' };
function input(schedule) { return { ...location, shopId: 1, serviceName: 'Full Service', kiloAmount: 8, deliveryType: 'Deliver', scheduledDate: schedule, scheduledTime: schedule }; }
// Verify the real controller without credentials or writes to the live database.
const databasePath = require.resolve('../dist/config/database');
const database = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { __esModule: true, default: database } };
const { TransactionController } = require('../dist/controllers/transaction.controller');
const { Prisma } = require('@prisma/client');

async function invoke({ minutes, serviceName = '8Kg Full Service Laundry', deliveryType = 'Deliver', waitingMinutes = 0, omitSchedule = false }) {
  const now = Date.parse('2026-10-13T02:30:00Z');
  const originalClock = Date.now;
  Date.now = () => now + waitingMinutes * 60000;
  let writes = 0, error;
  const notifications = [];
  database.notification = { createMany: async ({ data }) => { notifications.push(...data); return { count: data.length }; } };
  database.user = { findUnique: async () => ({ id: 1, name: 'Test User', email: 'test@example.invalid' }), findMany: async () => [] };
  database.orderEvent = { create: async () => ({}) };
  database.shop = { findUnique: async () => ({ id: 1, userId: 2, approvalStatus: 'Approved', openingTime: '08:00', closingTime: '18:00', services: [
    { id: 1, serviceName, price: new Prisma.Decimal(215), packageKilos: new Prisma.Decimal(8) },
  ], kiloPrices: [] }) };
  database.transaction = { create: async ({ data }) => { writes++; return { ...data, id: 1 }; } };
  database.$transaction = async callback => callback(database);
  database.$queryRaw = async () => [];
  const schedule = new Date(now + minutes * 60000).toISOString();
  const req = { body: { ...input(schedule), serviceName: 'Client claims Wash Only', serviceIds: [1], deliveryType },
    user: { userId: 1 }, app: { get: () => undefined } };
  if (omitSchedule) {
    delete req.body.scheduledDate;
    delete req.body.scheduledTime;
  }
  const res = { status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
  try { await TransactionController.createTransaction(req, res, failure => { error = failure; }); }
  finally { Date.now = originalClock; }
  return { res, writes, error, notifications };
}


test('return delivery never requires a checkout time or two-hour booking lead time', async () => {
 for (const options of [{minutes:1}, {minutes:119}, {minutes:0,omitSchedule:true}, {minutes:0,deliveryType:'Pickup',omitSchedule:true}]) {
  const result = await invoke(options);
  assert.equal(result.error,undefined);
  assert.equal(result.res.code,201);
  assert.equal(result.res.body.data.scheduledDate,null);
  assert.equal(result.res.body.data.scheduledTime,null);
  assert.equal(result.res.body.data.processingStartedAt,undefined);
  assert.deepEqual(result.notifications.map(item => [item.userId, item.shopMode]), [[1, false], [2, true]]);
 }
});
test('shop pickup requires a complete address and a valid future pickup request', () => {
 for (const requestedPickupAt of [undefined, null, '', 'invalid', '2020-01-01T00:00:00Z']) {
  assert.equal(createTransactionSchema.safeParse({body:{...input(),collectionMethod:'ShopPickup',collectionAddress:location,requestedPickupAt}}).success,false);
 }
 const requestedPickupAt = new Date(Date.now()+60000).toISOString();
 for (const deliveryType of ['Deliver','Pickup']) {
  const parsed = createTransactionSchema.parse({body:{...input(),deliveryType,collectionMethod:'ShopPickup',collectionAddress:location,requestedPickupAt}}).body;
  assert.equal(parsed.requestedPickupAt,requestedPickupAt);
  assert.equal(parsed.scheduledTime,null);
 }
 assert.equal(createTransactionSchema.safeParse({body:{...input(),collectionMethod:'ShopPickup',requestedPickupAt}}).success,false);
});
test('drop-off ignores old return schedules and stale pickup requests', () => {
 const parsed=createTransactionSchema.parse({body:{...input('2020-01-01T00:00:00Z'),requestedPickupAt:'2020-01-01T00:00:00Z'}}).body;
 assert.equal(parsed.scheduledDate,null);
 assert.equal(parsed.scheduledTime,null);
 assert.equal(parsed.requestedPickupAt,null);
});
