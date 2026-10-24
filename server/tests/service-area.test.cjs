const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const originalClock = Date.now;
before(() => { Date.now = () => Date.parse('2026-10-22T02:00:00Z'); });
after(() => { Date.now = originalClock; });
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const serverArea = require('../dist/utils/service-area');
const mobileModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../../mobile/src/design/service-area.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(mobileModule, mobileModule.exports);

for (const [name, area] of [['API', serverArea], ['mobile', mobileModule.exports]]) {
  test(`${name}: distance bounds include the boundaries and reject missing pins, near and far addresses`, () => {
    const shop = { latitude: 0, longitude: 0, deliveryMinKm: 10, deliveryMaxKm: 20 };
    assert.equal(area.serviceAreaError(shop, { latitude: 0, longitude: 0.1 }, 'delivery'), null);
    assert.match(area.serviceAreaError(shop, { latitude: 0, longitude: 0.01 }, 'delivery'), /minimum/);
    assert.match(area.serviceAreaError(shop, { latitude: 0, longitude: 1 }, 'delivery'), /maximum/);
    assert.match(area.serviceAreaError(shop, {}, 'delivery'), /Pin your/);
    assert.match(area.serviceAreaError({ deliveryMaxKm: 5 }, { latitude: 0, longitude: 0 }, 'delivery'), /shop needs/);
    const distance = area.distanceKm(shop, { latitude: 0, longitude: 0.1 });
    assert.equal(area.serviceAreaError({ ...shop, deliveryMinKm: distance, deliveryMaxKm: distance }, { latitude: 0, longitude: 0.1 }, 'delivery'), null);
    assert.equal(area.distanceKm(shop, { latitude: null, longitude: 0 }), null);
    assert.equal(area.distanceKm(shop, { latitude: 91, longitude: 0 }), null);
    assert.equal(area.distanceKm(shop, shop), 0);
    assert.equal(area.serviceAreaError({}, {}, 'delivery'), null);
  });
  test(`${name}: collection is opt-in and uses separate limits; settings require a shop pin`, () => {
    const shop = { latitude: 0, longitude: 0, pickupEnabled: true, pickupMinKm: '1', pickupMaxKm: '5', deliveryMaxKm: 1 };
    const customer = { latitude: 0, longitude: 0.02 };
    assert.equal(area.serviceAreaError(shop, customer, 'pickup'), null);
    assert.match(area.serviceAreaError(shop, customer, 'delivery'), /maximum/);
    assert.match(area.serviceAreaError({ ...shop, pickupEnabled: false }, customer, 'pickup'), /does not offer/);
    for (const patch of [{ deliveryMinKm: 10, deliveryMaxKm: 2 }, { pickupMinKm: -1 }, { deliveryMaxKm: 0 }, { pickupMaxKm: NaN }, { deliveryMinKm: 1.001 }]) {
      assert.ok(area.distanceSettingsError({ ...shop, ...patch }));
    }
    assert.ok(area.distanceSettingsError({ pickupEnabled: true }));
    assert.equal(area.distanceSettingsError({}), null);
  });
}

const location = { address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Home', latitude: 0, longitude: 0 };
const { registerShopSchema } = require('../dist/validators/shop.validator');
const { createTransactionSchema } = require('../dist/validators/transaction.validator');
test('shop settings reject invalid ranges and collection requests require a complete collection address', () => {
  const body = { ...location, shopName: 'Test Shop', contactNumber: '09123456789', openingTime: '08:00', closingTime: '18:00' };
  assert.equal(registerShopSchema.safeParse({ body: { ...body, deliveryMinKm: 10, deliveryMaxKm: 5 } }).success, false);
  assert.equal(registerShopSchema.safeParse({ body: { ...body, pickupEnabled: true, pickupMinKm: 0, pickupMaxKm: 5 } }).success, true);
  const order = { ...location, shopId: 1, serviceName: 'Wash', kiloAmount: 1, deliveryType: 'Pickup', collectionMethod: 'ShopPickup' };
  assert.equal(createTransactionSchema.safeParse({ body: order }).success, false);
  assert.equal(createTransactionSchema.safeParse({ body: { ...order, collectionAddress: location, requestedPickupAt: '2026-10-23T02:00:00Z' } }).success, true);
});

const database = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: database } };
const { TransactionController } = require('../dist/controllers/transaction.controller');
const { Prisma } = require('@prisma/client');
async function invoke({ area = {}, body = {}, currentArea } = {}) {
  let writes = 0, error;
  const shop = { ...location, id: 1, userId: 2, approvalStatus: 'Approved', openingTime: '08:00', closingTime: '18:00', ...area,
    services: [{ id: 1, serviceName: 'Wash', price: new Prisma.Decimal(25) }], kiloPrices: [] };
  database.user = { findUnique: async () => ({ id: 7, name: 'Customer', email: 'test@example.invalid' }) };
  database.shop = { findUnique: async () => shop };
  database.$transaction = async callback => callback({
    $queryRaw: async () => [],
    orderEvent: { create: async () => ({}) },
    user: { findMany: async () => [] },
    notification: { createMany: async ({ data }) => ({ count: data.length }) },
    shop: { findUnique: async () => ({ ...shop, ...currentArea }) },
    transaction: { create: async ({ data }) => { writes++; return { ...data, id: 42 }; } },
  });
  const schedule = new Date(Date.now() + 86400000).toISOString();
  const req = { body: { ...location, longitude: 0.02, shopId: 1, serviceName: 'Wash', serviceIds: [1], kiloAmount: 1,
    deliveryType: 'Deliver', requestedPickupAt: schedule, scheduledDate: schedule, scheduledTime: schedule, ...body }, user: { userId: 7 }, app: { get: () => undefined } };
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await TransactionController.createTransaction(req, res, value => { error = value; });
  assert.equal(error, undefined);
  return { res, writes };
}
test('API enforces delivery radius from saved coordinates and ignores client distance claims', async () => {
  const result = await invoke({ area: { deliveryMaxKm: 1 }, body: { distanceKm: 0 } });
  assert.equal(result.res.code, 400);
  assert.equal(result.res.body.error.code, 'OUTSIDE_SERVICE_AREA');
  assert.equal(result.writes, 0);
  const missing = await invoke({ area: { deliveryMaxKm: 5 }, body: { longitude: undefined } });
  assert.equal(missing.writes, 0);
  const accepted = await invoke({ area: { deliveryMinKm: 1, deliveryMaxKm: 5 } });
  assert.equal(accepted.res.code, 201);
});
test('API enforces collection independently of return method and stores collection instructions', async () => {
  const body = { deliveryType: 'Pickup', collectionMethod: 'ShopPickup', collectionAddress: { ...location, longitude: 0.02, dropoff_instructions: 'Ring the bell' } };
  const disabled = await invoke({ body });
  assert.equal(disabled.writes, 0);
  const far = await invoke({ area: { pickupEnabled: true, pickupMaxKm: 1 }, body });
  assert.equal(far.writes, 0);
  const accepted = await invoke({ area: { pickupEnabled: true, pickupMinKm: 1, pickupMaxKm: 5 }, body });
  assert.equal(accepted.res.code, 201);
  assert.equal(accepted.res.body.data.collectionAddress.dropoff_instructions, 'Ring the bell');
  assert.equal(accepted.res.body.data.workflowStatus, 'BookingPending');
  assert.equal(accepted.res.body.data.scheduledTime, null);
  const both = await invoke({ area: { pickupEnabled: true, pickupMaxKm: 5, deliveryMaxKm: 1 }, body: { ...body, deliveryType: 'Deliver' } });
  assert.equal(both.writes, 0);
});
test('the latest service area is rechecked inside the booking transaction', async () => {
  const result = await invoke({ area: { deliveryMaxKm: 5 }, currentArea: { deliveryMaxKm: 1 } });
  assert.equal(result.res.code, 400);
  assert.equal(result.writes, 0);
});

test('API blocks closed, not-yet-open and manually paused shops for delivery and customer pickup', async () => {
  for (const deliveryType of ['Deliver', 'Pickup']) {
    for (const area of [
      { openingTime: '11:00', closingTime: '18:00' },
      { openingTime: '06:00', closingTime: '09:00' },
      { acceptingOrders: false },
      { openingTime: '', closingTime: '' },
    ]) {
      const result = await invoke({ area, body: { deliveryType } });
      assert.equal(result.res.code, 409);
      assert.equal(result.res.body.error.code, 'SHOP_CLOSED');
      assert.equal(result.writes, 0);
    }
  }
});

test('availability is checked again at commit if the owner closes the shop or changes its hours', async () => {
  for (const currentArea of [{ acceptingOrders: false }, { closingTime: '09:00' }]) {
    const result = await invoke({ currentArea });
    assert.equal(result.res.code, 409);
    assert.equal(result.writes, 0);
    assert.equal(result.res.body.error.code, 'SHOP_CLOSED');
  }
});

test('pickup requests outside shop hours or made unavailable by updated hours are rejected before saving', async () => {
  const outside = '2026-10-23T19:00:00+08:00';
  const result = await invoke({ area: { pickupEnabled: true }, body: { collectionMethod: 'ShopPickup', collectionAddress: location, requestedPickupAt: outside } });
  assert.equal(result.res.body.error.code, 'INVALID_SCHEDULE');
  assert.equal(result.writes, 0);
  const previouslyAvailable = '2026-10-23T17:30:00+08:00';
  const changed = await invoke({ area: { pickupEnabled: true }, body: { collectionMethod: 'ShopPickup', collectionAddress: location, requestedPickupAt: previouslyAvailable }, currentArea: { closingTime: '17:00' } });
  assert.equal(changed.res.body.error.code, 'INVALID_SCHEDULE');
  assert.equal(changed.writes, 0);
});

test('overnight pickup request preserves its full timestamp across calendar days', async () => {
  const previous = Date.now;
  Date.now = () => Date.parse('2026-10-22T23:30:00+08:00');
  try {
    const scheduled = '2026-10-23T02:00:00+08:00';
    const result = await invoke({ area: { pickupEnabled: true, openingTime: '22:00', closingTime: '04:00' }, body: { collectionMethod: 'ShopPickup', collectionAddress: location, requestedPickupAt: scheduled } });
    assert.equal(result.res.code, 201);
    assert.equal(result.res.body.data.requestedPickupAt.toISOString(), '2026-10-22T18:00:00.000Z');
  } finally { Date.now = previous; }
});
