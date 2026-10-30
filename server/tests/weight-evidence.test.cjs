const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: { CORS_ORIGIN: '*', JWT_SECRET: 'weight-test-only' } } };
const app = require('../dist/app').default;
let server, root, input, order, evidence, notices;
before(async () => {
  input = (await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#2457AD' } }).withMetadata().png().toBuffer()).toString('base64');
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  evidence = []; notices = [];
  order = { id: 47, userId: 2, shopId: 6, workflowVersion: 1, workflowStatus: 'Washing', kiloAmount: 7, serviceName: 'Wash', deliveryType: 'Deliver', shop: { userId: 1, approvalStatus: 'Approved' }, assignments: [], events: [] };
  db.user = { findUnique: async ({ where }) => ({ id: where.id, isAdmin: where.id === 3, isShopOwner: where.id === 1, isRider: where.id === 4 }), findMany: async () => [{ id: 3 }] };
  db.transaction = { findUnique: async ({ where, include }) => {
    if (where.id !== order.id) return null;
    if (include?.weightEvidence) {
      assert.equal(include.weightEvidence.select.bytes, undefined, 'Order detail must never select image bytes');
      return { ...order, weightEvidence: evidence.map(({ bytes, ...row }) => row) };
    }
    return order;
  }, update: async ({ data }) => { Object.assign(order, data, { workflowVersion: order.workflowVersion + 1 }); } };
  db.shopService = { findMany: async () => [{ id: 1, serviceName: 'Wash', price: 25 }] };
  db.kiloPrice = { findMany: async () => [] };
  db.$transaction = callback => callback(db);
  db.$queryRaw = async () => [];
  db.orderEvent = { create: async ({ data }) => order.events.push(data) };
  db.notification = { createMany: async ({ data }) => notices.push(...data) };
  db.orderWeightEvidence = {
    create: async ({ data }) => { const row = { ...data, id: evidence.length + 1, createdAt: new Date(), actor: { name: 'Laundry partner' } }; evidence.push(row); return row; },
    findFirst: async ({ where }) => evidence.find(row => row.id === where.id && row.transactionId === where.transactionId),
  };
});
async function request(path, method = 'GET', body, userId = 1) {
  return fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${jwt.sign({ userId }, 'weight-test-only')}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
}
const payload = () => ({ kilos: 8, note: 'Weighed without the basket.', expectedVersion: order.workflowVersion, imageBase64: input });

test('only this approved shop can save a weight photo; missing and invalid proof are rejected', async () => {
  for (const [who, status] of [[null, 401], [2, 403], [3, 403], [4, 403], [5, 403]]) assert.equal((await request('/delivery/orders/47/weight', 'PUT', payload(), who)).status, status);
  for (const imageBase64 of [undefined, '%%%%', Buffer.from('<svg/>').toString('base64')]) assert.equal((await request('/delivery/orders/47/weight', 'PUT', { ...payload(), imageBase64 })).status, 400);
  assert.equal(evidence.length, 0);
  order.shop.approvalStatus = 'Suspended';
  assert.equal((await request('/delivery/orders/47/weight', 'PUT', payload())).status, 403);
});

test('saving weight stores an immutable sanitized photo, updates price, and notifies the customer', async () => {
  assert.equal((await request('/delivery/orders/47/weight', 'PUT', payload())).status, 200);
  assert.equal(evidence.length, 1); assert.equal(evidence[0].kilos, 8);
  assert.equal(order.kiloAmount, 8); assert.equal(Number(order.totalAmount), 230);
  assert.equal(evidence[0].totalAmount, order.totalAmount);
  const metadata = await sharp(evidence[0].bytes).metadata();
  assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.exif, undefined);
  assert.ok(metadata.width <= 1440 && metadata.height <= 1080);
  assert.ok(notices.some(item => item.userId === 2 && item.message.includes('Scale photo available')));
  const oldBytes = Buffer.from(evidence[0].bytes);
  assert.equal((await request('/delivery/orders/47/weight', 'PUT', { ...payload(), kilos: 7.5 })).status, 200);
  assert.equal(evidence.length, 2); assert.deepEqual(evidence[0].bytes, oldBytes);
  const detail = await (await request('/delivery/orders/47', 'GET', undefined, 2)).json();
  assert.equal(detail.data.weightEvidence.length, 2);
  assert.equal(detail.data.weightEvidence[0].bytes, undefined);
});

test('scale photos are private to the customer, owning shop and admin, scoped to the order', async () => {
  await request('/delivery/orders/47/weight', 'PUT', payload());
  for (const who of [1, 2, 3]) {
    const response = await request('/delivery/orders/47/weight-evidence/1', 'GET', undefined, who);
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  for (const [who, status] of [[null, 401], [4, 403], [5, 403]]) assert.equal((await request('/delivery/orders/47/weight-evidence/1', 'GET', undefined, who)).status, status);
  assert.equal((await request('/delivery/orders/48/weight-evidence/1')).status, 404);
  assert.equal((await request('/delivery/orders/47/weight-evidence/99')).status, 404);
});

test('stale versions, invalid weight, missing reason and completed orders cannot write evidence', async () => {
  for (const overrides of [{ expectedVersion: 0 }, { kilos: 0 }, { kilos: 7.555 }, { note: undefined }]) {
    const result = await request('/delivery/orders/47/weight', 'PUT', { ...payload(), ...overrides });
    assert.ok([400, 409].includes(result.status));
  }
  order.workflowStatus = 'Completed';
  assert.equal((await request('/delivery/orders/47/weight', 'PUT', payload())).status, 409);
  assert.equal(evidence.length, 0);
});
