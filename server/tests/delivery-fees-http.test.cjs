const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: { CORS_ORIGIN: '*', JWT_SECRET: 'fee-test-only' } } };
const app = require('../dist/app').default;
const { calculateFee, feeFingerprint } = require('../dist/services/delivery-fees');
let server, root, policy, quotes, orders, shop;
const address = { address_line_1: 'Test Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Home', latitude: 13.62, longitude: 123.18 };
before(async () => {
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  policy = { id: 1, baseFee: 30, ratePerKm: 10, minimumFee: 30, commissionPercent: 15, revision: 1 };
  quotes = []; orders = [];
  shop = { id: 6, userId: 8, approvalStatus: 'Approved', acceptingOrders: true, openingTime: '12:00 AM', closingTime: '11:59 PM', latitude: 13.63, longitude: 123.19, services: [{ id: 1, serviceName: 'Wash', price: 20 }], kiloPrices: [] };
  db.user = { findUnique: async ({ where }) => ({ id: where.id, name: 'Test', email: 'test@example.test', isAdmin: where.id === 3, isRider: where.id === 4 }), findMany: async () => [{ id: 3 }] };
  db.shop = { findUnique: async () => shop };
  db.deliveryFeeSettings = { findUnique: async () => policy, upsert: async ({ update }) => (policy = { ...policy, ...update, revision: policy.revision + 1 }) };
  db.deliveryFeeQuote = { findUnique: async ({ where }) => quotes.find(q => q.id === where.id), findFirst: async ({ where }) => quotes.find(q => q.userId === where.userId && q.fingerprint === where.fingerprint && !q.usedAt && q.expiresAt > where.expiresAt.gt),
    create: async ({ data }) => { const q = { id: randomUUID(), ...data }; quotes.push(q); return q; }, update: async ({ where, data }) => Object.assign(quotes.find(q => q.id === where.id), data) };
  db.transaction = { create: async ({ data }) => { const order = { ...data, id: 77 }; orders.push(order); return order; } };
  db.$transaction = cb => cb(db); db.$queryRaw = async () => []; db.$executeRaw = async () => 0;
  db.orderEvent = { create: async () => ({}) }; db.notification = { createMany: async () => ({ count: 2 }) };
});
async function request(path, method, body, userId = 2) {
  const token = jwt.sign({ userId }, 'fee-test-only');
  return fetch(root + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function approvedQuote() {
  const booking = { shopId: 6, deliveryType: 'Deliver', collectionMethod: 'Dropoff', ...address };
  const quote = { id: randomUUID(), userId: 2, fingerprint: feeFingerprint(booking, shop), expiresAt: new Date(Date.now() + 300000), usedAt: null, pricing: calculateFee(policy, 0, 4, false, true) };
  quotes.push(quote);
  return { quote, booking: { ...booking, serviceName: 'Wash', serviceIds: [1], kiloAmount: 5, deliveryQuoteId: quote.id, subtotal: 100, deliveryFee: 70, totalAmount: 170 } };
}
test('only admins configure rates; money, commission and stale revisions are validated', async () => {
  const body = { baseFee: 35, ratePerKm: 12, minimumFee: 40, commissionPercent: 15, revision: 1 };
  for (const userId of [2, 4]) assert.equal((await request('/admin/delivery-fees', 'PUT', body, userId)).status, 403);
  assert.equal((await request('/admin/delivery-fees', 'PUT', { ...body, commissionPercent: 101 }, 3)).status, 400);
  assert.equal((await request('/admin/delivery-fees', 'PUT', { ...body, ratePerKm: -1 }, 3)).status, 400);
  assert.equal((await request('/admin/delivery-fees', 'PUT', body, 3)).status, 200);
  assert.equal((await request('/admin/delivery-fees', 'PUT', body, 3)).status, 409);
});
test('booking stores the approved fee and rider allocations, consumes quote once and ignores later policy changes', async () => {
  const { booking, quote } = approvedQuote();
  policy.ratePerKm = 999; policy.commissionPercent = 90;
  const response = await request('/transactions', 'POST', booking);
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  assert.equal(Number(orders[0].deliveryFee), 70);
  assert.equal(orders[0].deliveryPricing.returnEarnings, 59.5);
  assert.equal(orders[0].deliveryPricing.commissionPercent, 15);
  assert.ok(quote.usedAt);
  assert.equal((await request('/transactions', 'POST', booking)).status, 409);
  assert.equal(orders.length, 1);
});
test('missing, foreign, expired, edited-location and tampered-price quotes cannot book', async () => {
  const { booking, quote } = approvedQuote();
  for (const body of [{ ...booking, deliveryQuoteId: undefined }, { ...booking, latitude: 14 }, { ...booking, deliveryFee: 1, totalAmount: 101 }]) {
    assert.equal((await request('/transactions', 'POST', body)).status, 409);
  }
  assert.equal((await request('/transactions', 'POST', booking, 9)).status, 409);
  quote.expiresAt = new Date(0);
  assert.equal((await request('/transactions', 'POST', booking)).status, 409);
  assert.equal(orders.length, 0);
});
test('customer quotes require valid pins; riders cannot create quotes; unchanged inputs reuse an approved quote', async () => {
  const { quote } = approvedQuote();
  const body = { shopId: 6, deliveryType: 'Deliver', collectionMethod: 'Dropoff', latitude: address.latitude, longitude: address.longitude };
  assert.equal((await request('/transactions/delivery-quote', 'POST', body, 4)).status, 403);
  const response = await request('/transactions/delivery-quote', 'POST', body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.id, quote.id);
  assert.equal((await request('/transactions/delivery-quote', 'POST', { ...body, latitude: undefined })).status, 409);
});
test('self-service bookings stay free of transport charges and do not require a quote', async () => {
  const { booking } = approvedQuote();
  const response = await request('/transactions', 'POST', { ...booking, deliveryQuoteId: undefined, deliveryType: 'Pickup', deliveryFee: 0, totalAmount: 100 });
  assert.equal(response.status, 201);
  assert.equal(Number(orders[0].deliveryFee), 0);
});
