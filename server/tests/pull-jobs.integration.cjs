// Real concurrent HTTP claims use separate database transactions. Fixtures are
// committed for cross-connection visibility, then removed by exact fixture IDs.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const configuration = require('../dist/config/database');
const prisma = configuration.default;
const { env } = require('../dist/config/env');
const app = require('../dist/app').default;
async function main() {
  const prefix = `pull-test-${randomUUID()}`;
  let server, shop, customer, partner, admin, riders = [];
  const users = [], orderIds = [];
  // Keep test notifications inside the fixture accounts while retaining real,
  // separate transactions and PostgreSQL locks for concurrent claim requests.
  configuration.default = new Proxy(prisma, { get(target, key) {
    if (key !== '$transaction') return target[key];
    return (callback, options) => target.$transaction(tx => callback(new Proxy(tx, { get(client, model) {
      if (model !== 'user') return client[model];
      return new Proxy(client.user, { get(delegate, operation) {
        if (operation !== 'findMany') return delegate[operation];
        return args => delegate.findMany(args?.where?.isAdmin ? { ...args, where: { ...args.where, id: { in: users } } } : args);
      } });
    } })), options);
  } });
  try {
    await prisma.$transaction(async tx => {
      async function user(name, flags = {}) {
        const row = await tx.user.create({ data: { name: `Test ${name}`, email: `${prefix}-${name}@example.invalid`, password: 'fixture-only-no-login', ...flags } });
        users.push(row.id); return { ...row, token: jwt.sign({ userId: row.id }, env.JWT_SECRET) };
      }
      customer = await user('customer'); partner = await user('partner', { isShopOwner: true }); admin = await user('admin', { isAdmin: true });
      for (const name of ['rider-a', 'rider-b']) {
        const rider = await user(name, { isRider: true }); riders.push(rider);
        await tx.riderProfile.create({ data: { userId: rider.id, active: true, online: true, latitude: 13.62, longitude: 123.19 } });
      }
      shop = await tx.shop.create({ data: { userId: partner.id, shopName: 'Pull test laundry', contactNumber: '09123456789', openingTime: '08:00', closingTime: '18:00', approvalStatus: 'Approved', city: 'Naga', state_province: 'Camarines Sur', latitude: 13.63, longitude: 123.20 } });
    }, { timeout: 60000 });
    async function order(status = 'PickupQueued') {
      const row = await prisma.transaction.create({ data: { userId: customer.id, shopId: shop.id, userName: 'PRIVATE_PULL_CUSTOMER', userEmail: customer.email, userPhone: 'PRIVATE_PULL_PHONE', serviceName: 'Wash', kiloAmount: 2, subtotal: 50, deliveryFee: 30, totalAmount: 80, deliveryType: 'Deliver', status: 'Processing', workflowStatus: status,
        address_line_1: 'PRIVATE_PULL_STREET', notes: 'PRIVATE_PULL_NOTES', access_code: 'PRIVATE_PULL_ACCESS', city: 'Naga', state_province: 'Camarines Sur', latitude: 13.62, longitude: 123.19, pickupCode: '123456', collectionCode: '234567', deliveryCode: '345678' } });
      orderIds.push(row.id); return row;
    }
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const root = `http://127.0.0.1:${server.address().port}/api`;
    async function request(path, method = 'GET', body, who = riders[0]) {
      const response = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${who.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    }
    const pickup = await order(), delivery = await order('ReadyForDelivery'), pending = await order('BookingPending'), custody = await order('LaundryPickedUp');
    for (const [who, status] of [[null, 401], [customer, 403], [partner, 403], [admin, 403]]) assert.equal((await request('/delivery/available-jobs', 'GET', undefined, who)).status, status);
    const board = await request('/delivery/available-jobs'); assert.equal(board.status, 200);
    assert.ok(board.body.data.jobs.some(job => job.id === pickup.id)); assert.ok(board.body.data.jobs.some(job => job.id === delivery.id));
    assert.ok(!board.body.data.jobs.some(job => [pending.id, custody.id].includes(job.id)));
    assert.ok(!JSON.stringify(board.body.data).includes('PRIVATE_PULL_'));
    const responses = await Promise.all(riders.map(who => request(`/delivery/orders/${pickup.id}/claim`, 'PUT', { stage: 'Pickup', expectedVersion: 0 }, who)));
    assert.deepEqual(responses.map(item => item.status).sort(), [200, 409]);
    const winner = riders[responses.findIndex(item => item.status === 200)], loser = riders.find(item => item.id !== winner.id);
    assert.equal(await prisma.deliveryAssignment.count({ where: { transactionId: pickup.id, status: 'Accepted' } }), 1);
    assert.equal(await prisma.orderEvent.count({ where: { transactionId: pickup.id, action: 'JobClaimed' } }), 1);
    assert.equal((await request(`/delivery/orders/${pickup.id}/claim`, 'PUT', { stage: 'Pickup', expectedVersion: 0 }, winner)).status, 200);
    assert.equal(await prisma.orderEvent.count({ where: { transactionId: pickup.id, action: 'JobClaimed' } }), 1);
    console.log('PASS: simultaneous claims have one winner; retries do not duplicate events.');
    const owned = await request('/delivery/rider', 'GET', undefined, winner);
    assert.equal(owned.body.data.jobs.find(job => job.transactionId === pickup.id).order.customer.name, 'PRIVATE_PULL_CUSTOMER');
    assert.equal((await request(`/delivery/orders/${delivery.id}/claim`, 'PUT', { stage: 'Delivery', expectedVersion: 0 }, loser)).status, 200);
    assert.equal((await prisma.transaction.findUnique({ where: { id: delivery.id } })).workflowStatus, 'DeliveryAccepted');
    await prisma.deliveryAssignment.create({ data: { transactionId: custody.id, riderId: winner.id, stage: 'Pickup', status: 'Accepted', expiresAt: new Date() } });
    const candidates = [await order(), await order()];
    const capacityRace = await Promise.all(candidates.map(row => request(`/delivery/orders/${row.id}/claim`, 'PUT', { stage: 'Pickup', expectedVersion: 0 }, winner)));
    assert.deepEqual(capacityRace.map(item => item.status).sort(), [200, 409]);
    assert.equal(await prisma.deliveryAssignment.count({ where: { riderId: winner.id, status: { in: ['Offered', 'Accepted'] } } }), 3);
    const contested = await order();
    const adminRace = await Promise.all([
      request(`/delivery/orders/${contested.id}/claim`, 'PUT', { stage: 'Pickup', expectedVersion: 0 }, loser),
      request(`/delivery/orders/${contested.id}/assign`, 'PUT', { stage: 'Pickup', expectedVersion: 0, riderId: loser.id }, admin),
    ]);
    assert.deepEqual(adminRace.map(item => item.status).sort(), [200, 409]);
    assert.equal(await prisma.deliveryAssignment.count({ where: { transactionId: contested.id, status: { in: ['Offered', 'Accepted'] } } }), 1);
    await prisma.riderProfile.update({ where: { userId: loser.id }, data: { online: false } });
    const offline = await request('/delivery/available-jobs', 'GET', undefined, loser);
    assert.equal(offline.body.data.rider.online, false); assert.deepEqual(offline.body.data.jobs, []);
    const open = await order();
    assert.equal((await request(`/delivery/orders/${open.id}/claim`, 'PUT', { stage: 'Pickup', expectedVersion: 0 }, loser)).status, 409);
    console.log('PASS: customer details unlock after claim; delivery claims, capacity races, admin races and offline protection verified.');
  } finally {
    configuration.default = prisma;
    if (server) await new Promise(resolve => server.close(resolve));
    if (users.length) await prisma.$transaction(async tx => {
      await tx.notification.deleteMany({ where: { transactionId: { in: orderIds } } });
      await tx.orderEvent.deleteMany({ where: { transactionId: { in: orderIds } } });
      await tx.deliveryAssignment.deleteMany({ where: { transactionId: { in: orderIds } } });
      await tx.transaction.deleteMany({ where: { id: { in: orderIds } } });
      if (shop) await tx.shop.deleteMany({ where: { id: shop.id, userId: partner.id } });
      await tx.riderProfile.deleteMany({ where: { userId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users }, email: { startsWith: prefix } } });
    }, { timeout: 60000 });
    assert.equal(await prisma.user.count({ where: { email: { startsWith: prefix } } }), 0);
    assert.equal(await prisma.transaction.count({ where: { id: { in: orderIds } } }), 0);
    console.log('PASS: all scoped pull-job fixtures removed.');
  }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : `Pull integration failed (${error.code || error.name}).`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
