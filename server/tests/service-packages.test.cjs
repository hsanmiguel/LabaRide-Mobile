const assert = require('node:assert/strict');
const { test } = require('node:test');

const databasePath = require.resolve('../dist/config/database');
const database = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { __esModule: true, default: database } };
// Configuration is unused by these controller methods.
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: {} } };
const { ShopController } = require('../dist/controllers/shop.controller');

async function invoke({ method = 'addService', userId = 1, shopOwner = 1, serviceShopId = 5,
  missingShop = false, serviceId = '9', body = { serviceName: 'Full service', price: 215, packageKilos: 8, washingMinutes: 30, dryingMinutes: 45 } } = {}) {
  let row = { id: 9, shopId: serviceShopId, serviceName: 'Wash', price: 25, packageKilos: null };
  let writes = 0, error;
  database.shop = { findUnique: async () => missingShop ? null : { userId: shopOwner } };
  database.$transaction = callback => callback(database);
  database.$queryRaw = async () => [];
  database.shopService = {
    findMany: async () => [row],
    create: async ({ data }) => { writes++; row = { id: 9, ...data }; return row; },
    updateMany: async ({ where, data }) => {
      if (row.id !== where.id || row.shopId !== where.shopId) return { count: 0 };
      writes++; row = { ...row, ...data }; return { count: 1 };
    },
    findUnique: async () => row,
    deleteMany: async ({ where }) => {
      if (!row || row.id !== where.id || row.shopId !== where.shopId) return { count: 0 };
      writes++; row = null; return { count: 1 };
    },
  };
  const req = { params: { shopId: '5', serviceId }, body, user: { userId } };
  const res = { status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
  await ShopController[method](req, res, failure => { error = failure; });
  return { row, writes, res, error };
}

test('shop owner can create a package and convert an existing service between pricing types', async () => {
  const created = await invoke();
  assert.equal(created.error, undefined);
  assert.equal(created.res.code, 201);
  assert.equal(created.res.body.data.packageKilos, 8);
  assert.equal(created.res.body.data.price, 215);
  assert.equal(created.res.body.data.washingMinutes, 30);
  assert.equal(created.res.body.data.dryingMinutes, 45);
  const updated = await invoke({ method: 'updateService' });
  assert.equal(updated.res.code, 200);
  assert.equal(updated.row.packageKilos, 8);
  const perKg = await invoke({ method: 'updateService', body: { serviceName: 'Wash', price: 25, packageKilos: null } });
  assert.equal(perKg.res.code, 200);
  assert.equal(perKg.row.packageKilos, null);
});

test('only the owner can delete a service belonging to the specified shop', async () => {
  const deleted = await invoke({ method: 'deleteService' });
  assert.equal(deleted.res.code, 200);
  assert.equal(deleted.row, null);
  assert.equal(deleted.writes, 1);
  for (const [options, status] of [
    [{ userId: 2 }, 403], [{ serviceShopId: 6 }, 404], [{ missingShop: true }, 404],
    [{ serviceId: 'abc' }, 400], [{ serviceId: '0' }, 400], [{ serviceId: '100' }, 404],
  ]) {
    const result = await invoke({ method: 'deleteService', ...options });
    assert.equal(result.res.code, status);
    assert.equal(result.writes, 0);
    assert.notEqual(result.row, null);
  }
});

test('another account cannot create or change shop package prices', async () => {
  for (const method of ['addService', 'updateService']) {
    const result = await invoke({ method, userId: 2 });
    assert.equal(result.res.code, 403);
    assert.equal(result.writes, 0);
  }
});

test('an owner cannot update a service from another shop', async () => {
  const result = await invoke({ method: 'updateService', serviceShopId: 6 });
  assert.equal(result.res.code, 404);
  assert.equal(result.writes, 0);
});

test('invalid package weights and missing shops fail before any writes', async () => {
  for (const method of ['addService', 'updateService']) {
    const invalid = await invoke({ method, body: { serviceName: 'Full service', price: 215, packageKilos: 0 } });
    assert.equal(invalid.error.name, 'ZodError');
    assert.equal(invalid.writes, 0);
    const missing = await invoke({ method, missingShop: true });
    assert.equal(missing.res.code, 404);
    assert.equal(missing.writes, 0);
  }
});
