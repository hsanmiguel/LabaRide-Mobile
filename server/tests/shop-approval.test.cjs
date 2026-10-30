const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const jwt = require('jsonwebtoken');
const database = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: database } };
const envPath = require.resolve('../dist/config/env');
const secret = 'isolated-approval-test-secret-12345';
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: { JWT_SECRET: secret, CORS_ORIGIN: '*' } } };
const app = require('../dist/app').default;
const originalClock = Date.now;
let server, root, users, shops, orders, nextId, suspendAtCommit;
const shopInput = { shopName: 'Test Laundry', contactNumber: '09123456789', openingTime: '08:00', closingTime: '18:00',
  address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Work' };
function matches(row, where = {}) { return Object.entries(where).every(([key, value]) => row[key] === value); }
function project(row, select) {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.entries(select).map(([key, value]) => [key, key === 'shop' ? [...shops.values()].find(s => s.userId === row.id) || null : value === true ? row[key] : null]));
}
function shopResult(row, include) {
  if (!row) return null;
  return { ...row, photo: null, services: [{ id: 1, shopId: row.id, serviceName: 'Wash', price: 25 }], kiloPrices: [],
    ...(include?.user ? { user: project(users.get(row.userId), include.user.select) } : {}),
    ...(include?.reviewedBy ? { reviewedBy: project(users.get(row.reviewedById), include.reviewedBy.select) } : {}) };
}
beforeEach(() => {
  users = new Map([1, 2, 3].map(id => [id, { id, name: `User ${id}`, email: `user${id}@example.test`, password: 'NEVER_RETURN', isAdmin: id === 3, isShopOwner: false }]));
  shops = new Map(); orders = []; nextId = 10; suspendAtCommit = false;
  database.user = {
    findMany: async ({ where, select }) => [...users.values()].filter(row => matches(row, where)).map(row => project(row, select)),
    findUnique: async ({ where, select }) => project([...users.values()].find(row => matches(row, where)), select),
    update: async ({ where, data, select }) => {
      const user = users.get(where.id);
      const { shop, ...fields } = data;
      Object.assign(user, fields);
      if (shop?.create) shops.set(nextId, { id: nextId++, userId: user.id, createdAt: new Date(), approvalStatus: 'Pending', applicationVersion: 1, ...shop.create });
      return project(user, select);
    },
  };
  database.shop = {
    findUnique: async ({ where, select, include }) => { const row = [...shops.values()].find(row => matches(row, where)); return select ? project(row, select) : shopResult(row, include); },
    findUniqueOrThrow: async args => { const row = await database.shop.findUnique(args); assert.ok(row); return row; },
    findMany: async ({ where, include } = {}) => [...shops.values()].filter(row => matches(row, where)).map(row => shopResult(row, include)),
    updateMany: async ({ where, data }) => { let count = 0; for (const row of shops.values()) if (matches(row, where)) { for (const [key, value] of Object.entries(data)) row[key] = value?.increment ? row[key] + value.increment : value; count++; } return { count }; },
  };
  database.shopPhoto = { findFirst: async () => null };
  database.shopService = { findMany: async () => [], create: async ({ data }) => ({ id: 2, ...data }) };
  // These lifecycle cases assume completed verification; document upload/review
  // and approval denial are exercised separately in shop-requirements.test.cjs.
  database.shopDocument = { findMany: async () => ['DTIRegistration', 'TinProof', 'MayorsPermit'].map(type => ({ type, status: 'Verified' })), updateMany: async () => ({ count: 3 }) };
  database.transaction = { create: async ({ data }) => { const row = { id: orders.length + 1, ...data }; orders.push(row); return row; } };
  database.orderEvent = { create: async () => ({}) };
  database.notification = { createMany: async ({ data }) => ({ count: data.length }) };
  database.$queryRaw = async () => { if (suspendAtCommit) shops.get(10).approvalStatus = 'Suspended'; return []; };
  database.notification = { createMany: async ({ data }) => ({ count: data.length }) };
  database.$transaction = async callback => callback(database);
});
before(async () => {
  Date.now = () => Date.parse('2026-10-22T02:00:00Z');
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); Date.now = originalClock; });
const token = (id, claims = {}) => jwt.sign({ userId: id, isShopOwner: true, isAdmin: true, ...claims }, secret);
async function request(path, method = 'GET', body, id = 1, expected = 200) {
  const res = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(id == null ? {} : { Authorization: `Bearer ${token(id)}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await res.json();
  assert.equal(res.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result.data;
}
async function apply() { return request('/shops', 'POST', { ...shopInput, approvalStatus: 'Approved', isShopOwner: true, isAdmin: true }, 1, 201); }
async function decide(status, expectedStatus = 'Pending', reason) { return request('/admin/shops/10/review', 'PUT', { status, expectedStatus, expectedVersion: shops.get(10).applicationVersion, reason }, 3); }
function order() { const scheduled = new Date(Date.now() + 86400000 * 2).toISOString(); return { ...shopInput, shopId: 10, serviceIds: [1], serviceName: 'Wash', kiloAmount: 2, deliveryType: 'Pickup', scheduledDate: scheduled, scheduledTime: scheduled }; }

test('applications cannot self-approve, activate shop mode, or create multiple shops', async () => {
  const result = await apply();
  assert.equal(result.approvalStatus, 'Pending'); assert.equal(result.user.isShopOwner, false); assert.equal(result.user.isAdmin, false);
  assert.equal(result.user.password, undefined); assert.equal(jwt.verify(result.token, secret).isShopOwner, false);
  await request('/shops', 'POST', shopInput, 1, 409);
  assert.equal(shops.size, 1);
  await request('/users/1', 'PUT', { name: 'Updated', isAdmin: true, isShopOwner: true }, 1);
  assert.equal(users.get(1).isAdmin, false); assert.equal(users.get(1).isShopOwner, false);
});

test('admin routes reject anonymous, ordinary and deleted accounts despite privileged JWT claims', async () => {
  await request('/admin/shops', 'GET', undefined, null, 401);
  await request('/admin/shops', 'GET', undefined, 1, 403);
  await request('/admin/shops/10/review', 'PUT', { status: 'Approved', expectedStatus: 'Pending' }, 1, 403);
  await request('/admin/shops', 'GET', undefined, 99, 401);
  await request('/admin/shops', 'GET', undefined, 3);
  users.get(3).isAdmin = false;
  await request('/admin/shops', 'GET', undefined, 3, 403);
});

test('pending applications are hidden from discovery, direct customer access, orders, services and photos', async () => {
  await apply();
  for (const path of ['/shops', '/shops/recent']) assert.deepEqual(await request(path, 'GET', undefined, null), []);
  await request('/shops/10', 'GET', undefined, 2, 404);
  await request('/shops/user/1', 'GET', undefined, 2, 403);
  assert.equal((await request('/shops/user/1')).approvalStatus, 'Pending');
  for (const [path, method, body] of [
    ['/shops/10/services', 'POST', { serviceName: 'Wash', price: 25 }],
    ['/shops/10/services/1', 'PUT', { serviceName: 'Wash', price: 25 }],
    ['/shops/10/services/1', 'DELETE'], ['/shops/10/kilo-prices', 'POST', {}],
    ['/shops/10/photo', 'PUT', {}], ['/shops/10/photo', 'DELETE'], ['/transactions/shop/10', 'GET'],
  ]) await request(path, method, body, 1, 403);
  await request('/transactions', 'POST', order(), 2, 403);
  assert.equal(orders.length, 0);
});

test('approval publishes the shop, records reviewer, unlocks owner access and accepts bookings', async () => {
  await apply();
  const reviewed = await decide('Approved');
  assert.equal(reviewed.reviewedById, 3); assert.ok(reviewed.reviewedAt);
  assert.equal(reviewed.user.password, undefined); assert.equal(users.get(1).isShopOwner, true);
  assert.equal((await request('/shops', 'GET', undefined, null)).length, 1);
  assert.equal((await request('/shops/10', 'GET', undefined, 2)).approvalStatus, 'Approved');
  assert.equal((await request('/auth/verify-token', 'POST', {})).user.isShopOwner, true);
  await request('/transactions', 'POST', order(), 2, 201);
  assert.equal(orders.length, 1);
  await request('/admin/shops?status=Approved', 'GET', undefined, 3);
  await request('/admin/shops?status=Invalid', 'GET', undefined, 3, 400);
});

test('invalid reviews and concurrent stale decisions cannot overwrite a completed review', async () => {
  await apply();
  for (const body of [{ status: 'Rejected', expectedStatus: 'Pending' }, { status: 'Suspended', expectedStatus: 'Pending', reason: 'Reason' }, { status: 'Approved' }]) {
    await request('/admin/shops/10/review', 'PUT', { expectedVersion: 1, ...body }, 3, 400);
  }
  await decide('Approved');
  await request('/admin/shops/10/review', 'PUT', { status: 'Rejected', expectedStatus: 'Pending', expectedVersion: 1, reason: 'Stale review' }, 3, 409);
  assert.equal(shops.get(10).approvalStatus, 'Approved'); assert.equal(users.get(1).isShopOwner, true);
});

test('rejections require a reason and only the applicant can resubmit, without self-approval', async () => {
  await apply(); await decide('Rejected', 'Pending', 'Please correct the contact number.');
  assert.equal((await request('/shops/user/1')).reviewReason, 'Please correct the contact number.');
  await request('/shops/10/application', 'PUT', shopInput, 2, 403);
  const result = await request('/shops/10/application', 'PUT', { ...shopInput, approvalStatus: 'Approved' });
  assert.equal(result.approvalStatus, 'Pending'); assert.equal(result.reviewReason, null); assert.equal(result.reviewedById, null);
  assert.equal(users.get(1).isShopOwner, false);
  await request('/admin/shops/10/review', 'PUT', { status: 'Approved', expectedStatus: 'Pending', expectedVersion: 1 }, 3, 409);
  await decide('Approved');
});

test('suspension immediately blocks stale owner tokens, hides the shop and requires admin restoration', async () => {
  await apply(); await decide('Approved'); await decide('Suspended', 'Approved', 'Business verification needs review.');
  assert.equal(users.get(1).isShopOwner, false);
  assert.deepEqual(await request('/shops'), []);
  await request('/transactions', 'POST', order(), 2, 403);
  await request('/shops/10/services', 'POST', { serviceName: 'Wash', price: 25 }, 1, 403);
  await request('/shops/10/application', 'PUT', shopInput, 1, 409);
  assert.equal((await request('/auth/verify-token', 'POST', {})).user.isShopOwner, false);
  await decide('Approved', 'Suspended'); assert.equal(users.get(1).isShopOwner, true);
});

test('approved shop identity edits return to review and cannot retain publication', async () => {
  await apply(); await decide('Approved');
  const result = await request('/shops/10', 'PUT', { ...shopInput, shopName: 'Changed identity' });
  assert.equal(result.approvalStatus, 'Pending'); assert.equal(users.get(1).isShopOwner, false);
  assert.deepEqual(await request('/shops'), []);
});

test('routine edits are immediately published without losing approval or shop access', async () => {
  const pinned = { ...shopInput, latitude: 13.62, longitude: 123.19 };
  await request('/shops', 'POST', pinned, 1, 201);
  await decide('Approved');
  const original = { ...shops.get(10) };
  const result = await request('/shops/10', 'PUT', {
    ...pinned, contactNumber: '09999999999', openingTime: '07:00', closingTime: '21:00',
    pickupEnabled: true, deliveryMinKm: 0, deliveryMaxKm: 10, pickupMinKm: 1, pickupMaxKm: 5,
    access_code: 'Gate 2', dropoff_instructions: 'Use the side entrance',
    approvalStatus: 'Pending', userId: 2,
  });
  assert.equal(result.approvalStatus, 'Approved');
  assert.equal(result.applicationVersion, original.applicationVersion);
  assert.equal(result.reviewedById, original.reviewedById);
  assert.equal(result.reviewedAt, original.reviewedAt.toISOString());
  assert.equal(result.contactNumber, '09999999999');
  assert.equal(result.deliveryMaxKm, 10);
  assert.equal(result.pickupEnabled, true);
  assert.equal(result.userId, 1);
  assert.equal(users.get(1).isShopOwner, true);
  assert.equal((await request('/shops', 'GET', undefined, null)).length, 1);
  assert.equal((await request('/auth/verify-token', 'POST', {})).user.isShopOwner, true);
  await request('/shops/10/services', 'POST', { serviceName: 'Wash', price: 25 }, 1, 201);
  await request('/transactions', 'POST', order(), 2, 201);
});

test('resaving the same identity and normalizing empty address fields preserves approval', async () => {
  await apply(); await decide('Approved');
  const result = await request('/shops/10', 'PUT', {
    ...shopInput, shopName: ' Test Laundry ', city: ' NAGA ', address_line_2: '',
  });
  assert.equal(result.approvalStatus, 'Approved');
  assert.equal(users.get(1).isShopOwner, true);
});

test('each physical address or coordinate change requires a fresh review', async () => {
  await request('/shops', 'POST', { ...shopInput, latitude: 13.62, longitude: 123.19 }, 1, 201);
  await decide('Approved');
  const original = { ...shops.get(10) };
  for (const [field, value] of Object.entries({
    address_line_1: '55 Other Street', address_line_2: 'Unit 2', city: 'Legazpi',
    state_province: 'Albay', postal_code: '4500', country: 'Other Country', latitude: 13.63, longitude: 123.2,
  })) {
    shops.set(10, { ...original });
    users.get(1).isShopOwner = true;
    const result = await request('/shops/10', 'PUT', { ...shopInput, latitude: 13.62, longitude: 123.19, [field]: value });
    assert.equal(result.approvalStatus, 'Pending', field);
    assert.equal(result.applicationVersion, original.applicationVersion + 1);
    assert.equal(result.reviewedAt, null);
    assert.equal(users.get(1).isShopOwner, false);
  }
});

test('a concurrent suspension cannot be overwritten by a routine edit', async () => {
  await apply(); await decide('Approved');
  suspendAtCommit = true;
  await request('/shops/10', 'PUT', { ...shopInput, openingTime: '06:00' }, 1, 409);
  assert.equal(shops.get(10).approvalStatus, 'Suspended');
  assert.equal(shops.get(10).openingTime, shopInput.openingTime);
});

test('owners can temporarily close and reopen ordering without losing shop approval', async () => {
  await apply(); await decide('Approved');
  const closed = await request('/shops/10', 'PUT', { ...shopInput, acceptingOrders: false });
  assert.equal(closed.approvalStatus, 'Approved');
  assert.equal(users.get(1).isShopOwner, true);
  await request('/transactions', 'POST', order(), 2, 409);
  assert.equal(orders.length, 0);
  const reopened = await request('/shops/10', 'PUT', { ...shopInput, acceptingOrders: true });
  assert.equal(reopened.approvalStatus, 'Approved');
  await request('/transactions', 'POST', order(), 2, 201);
});

test('an approval change between quote validation and booking commit blocks the booking', async () => {
  await apply(); await decide('Approved'); suspendAtCommit = true;
  await request('/transactions', 'POST', order(), 2, 403);
  assert.equal(orders.length, 0);
});
