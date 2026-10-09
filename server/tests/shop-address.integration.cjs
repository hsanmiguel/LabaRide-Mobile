// Explicit live Supabase test. All fixture writes run inside one rolled-back transaction.
// No existing records are modified or deleted; no credentials or tokens are printed.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const configuration = require('../dist/config/database');
const { env } = require('../dist/config/env');
const prisma = configuration.default;
const models = ['user', 'shop', 'shopService', 'kiloPrice', 'transaction', 'transactionItem', 'householdItem', 'clothingType'];
const snapshot = async () => {
  const counts = {};
  for (const name of models) counts[name] = await prisma[name].count();
  return counts;
};

async function main() {
  const before = await snapshot();
  const rollback = new Error('ROLLBACK_TEST_FIXTURES');
  try {
    await prisma.$transaction(async tx => {
      // The same production controllers and middleware use the transaction client for this test only.
      configuration.default = tx;
      const app = require('../dist/app').default;
      const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const root = `http://127.0.0.1:${server.address().port}/api`;
      async function request(path, method, body, token, status = 200) {
        const response = await fetch(root + path, { method, headers: {
          'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
        }, body: body === undefined ? undefined : JSON.stringify(body) });
        const result = await response.json();
        assert.equal(response.status, status, `${method} ${path}: ${result.error?.code || result.message}`);
        return result;
      }
      try {
        await request('/shops', 'POST', {}, null, 401);
        const mismatched = await request('/auth/signup', 'POST', { name: 'Mismatch Test',
          email: 'mismatch-' + randomUUID() + '@example.invalid', password: 'Password123', confirmPassword: 'Different123' }, null, 400);
        assert.ok(mismatched.error.details.some(issue => issue.path.includes('confirmPassword')));
        async function signupUser(name) {
          const password = randomUUID();
          return (await request('/auth/signup', 'POST', { name, email: 'address-test-' + randomUUID() + '@example.invalid', password, confirmPassword: password }, null, 201)).data;
        }
        const signup = await signupUser('Address Integration Test');
        await request(`/users/${signup.user.id}`, 'PUT', { birthdate: '2025-02-29' }, signup.token, 400);
        const birthday = (await request(`/users/${signup.user.id}`, 'PUT', { birthdate: '2000-02-29' }, signup.token)).data;
        assert.equal(birthday.birthdate.slice(0, 10), '2000-02-29');
        const location = { address_line_1: '12 Test Street', address_line_2: 'Unit 2', city: 'Naga',
          state_province: 'Camarines Sur', postal_code: '0044', country: 'Philippines',
          address_type: 'Work', access_code: '0123', dropoff_instructions: 'Leave with doorman' };
        const shopInput = { shopName: 'Rollback Test Laundry', contactNumber: '09123456789', openingTime: '8:00 AM', closingTime: '6:00 PM', ...location };
        const invalid = await request('/shops', 'POST', { ...shopInput, postal_code: undefined }, signup.token, 400);
        assert.ok(invalid.error.details.some(issue => issue.path.includes('postal_code')));
        assert.equal(await tx.shop.count({ where: { userId: signup.user.id } }), 0);
        assert.equal((await tx.user.findUnique({ where: { id: signup.user.id } })).isShopOwner, false);

        await request(`/users/${signup.user.id}`, 'PUT', { name: 'Address Integration Test Updated' }, signup.token);
        await request(`/users/${signup.user.id}`, 'PUT', { city: 'Naga' }, signup.token, 400);
        const profile = (await request(`/users/${signup.user.id}`, 'PUT', location, signup.token)).data;
        assert.equal(profile.postal_code, '0044');
        assert.equal(profile.latitude, null);
        assert.equal(profile.password, undefined);

        const registration = (await request('/shops', 'POST', shopInput, signup.token, 201)).data;
        assert.equal(registration.user.isShopOwner, true);
        assert.equal(registration.user.password, undefined);
        assert.equal(jwt.verify(registration.token, env.JWT_SECRET).isShopOwner, true);
        assert.equal(registration.address_line_1, location.address_line_1);
        assert.equal(registration.openingTime, '8:00 AM');
        assert.equal(registration.closingTime, '6:00 PM');
        assert.equal(registration.longitude, null);
        assert.equal(registration.address, '12 Test Street, Unit 2, Naga, Camarines Sur, 0044, Philippines');
        await request('/shops', 'POST', shopInput, signup.token, 409);
        assert.equal(await tx.shop.count({ where: { userId: signup.user.id } }), 1);
        const recovered = (await request('/auth/verify-token', 'POST', {}, signup.token)).data;
        assert.equal(recovered.user.isShopOwner, true);
        assert.equal(jwt.verify(recovered.token, env.JWT_SECRET).isShopOwner, true);

        const updatedInput = { ...shopInput, postal_code: '0080', latitude: 0, longitude: -0.1234567 };
        const updated = (await request(`/shops/${registration.id}`, 'PUT', updatedInput, registration.token)).data;
        assert.equal(updated.postal_code, '0080');
        assert.equal(Number(updated.latitude), 0);
        const stranger = await signupUser('Other Test User');
        await request(`/shops/${registration.id}`, 'PUT', updatedInput, stranger.token, 403);
        const fetched = (await request(`/shops/user/${signup.user.id}`, 'GET', undefined, recovered.token)).data;
        assert.equal(fetched.postal_code, '0080');

        const schedule = new Date(Date.now() + 86400000).toISOString();
        const customer = await signupUser('Test Customer');
        const orderInput = { ...location, shopId: registration.id, serviceName: 'Wash', kiloAmount: 2,
          subtotal: 100, deliveryFee: 30, totalAmount: 130, deliveryType: 'Deliver', scheduledDate: schedule,
          scheduledTime: schedule, items: [{ itemName: 'T-shirt', quantity: 2 }] };
        await request('/transactions', 'POST', { ...orderInput, postal_code: undefined }, customer.token, 400);
        for (const deliveryType of ['Deliver', 'Pickup']) {
          const order = (await request('/transactions', 'POST', { ...orderInput, deliveryType }, customer.token, 201)).data;
          assert.equal(order.access_code, '0123');
          assert.equal(order.dropoff_instructions, 'Leave with doorman');
          assert.equal(order.latitude, null);
          assert.equal(order.items[0].quantity, 2);
        }
        const orders = (await request(`/transactions/user/${customer.user.id}`, 'GET', undefined, customer.token)).data;
        assert.equal(orders.length, 2);
        assert.equal(orders[0].city, 'Naga');
        await request(`/transactions/shop/${registration.id}`, 'GET', undefined, stranger.token, 403);
        const shopOrders = (await request(`/transactions/shop/${registration.id}`, 'GET', undefined, recovered.token)).data;
        assert.equal(shopOrders.length, 2);
        assert.equal(shopOrders[0].access_code, '0123');
        await request(`/transactions/${orders[0].id}/status`, 'PUT', { status: 'Completed' }, stranger.token, 403);
        await request(`/transactions/${orders[0].id}/cancel`, 'PUT', {}, stranger.token, 403);
        await request(`/transactions/${orders[0].id}/status`, 'PUT', { status: 'Processing' }, customer.token, 403);
        await request(`/transactions/${orders[0].id}/status`, 'PUT', { status: 'Processing' }, recovered.token);
        await request(`/transactions/${orders[1].id}/cancel`, 'PUT', {}, recovered.token, 403);
        await request(`/transactions/${orders[1].id}/cancel`, 'PUT', {}, customer.token);
        console.log('PASS: real HTTP signup, validation, profile address, shop registration, owner token, duplicate recovery, shop edits, authorization, and order address snapshots.');
      } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        configuration.default = prisma;
      }
      throw rollback;
    }, { maxWait: 30000, timeout: 120000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally { configuration.default = prisma; }
  const after = await snapshot();
  assert.deepEqual(after, before, 'All table counts must be unchanged after rolling back fixtures');
  console.log('PASS: transaction rolled back; all 8 table counts are unchanged.');
}
main().catch(error => {
  console.error(`FAIL: shop/address integration test (${error.code || error.name}). ${error instanceof assert.AssertionError ? error.message : 'Check database access and server configuration.'}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
