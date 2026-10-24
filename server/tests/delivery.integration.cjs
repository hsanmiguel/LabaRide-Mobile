// Live HTTP/database lifecycle test. Every fixture and workflow write is rolled back.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const configuration = require('../dist/config/database');
const prisma = configuration.default;
const { env } = require('../dist/config/env');
const models = ['user', 'shop', 'shopService', 'transaction', 'notification', 'riderProfile', 'deliveryAssignment', 'orderEvent', 'orderWeightEvidence'];
async function counts() { return Object.fromEntries(await Promise.all(models.map(async model => [model, await prisma[model].count()]))); }

async function main() {
  const scalePhoto = (await require('sharp')({ create: { width: 100, height: 100, channels: 3, background: '#2457AD' } }).jpeg().toBuffer()).toString('base64');
  const before = await counts();
  const rollback = new Error('ROLLBACK_DELIVERY_FIXTURES');
  try {
    await prisma.$transaction(async tx => {
      configuration.default = new Proxy(tx, { get(target, key) { return key === '$transaction' ? callback => callback(tx) : target[key]; } });
      const app = require('../dist/app').default;
      const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
      try {
        const prefix = randomUUID();
        async function user(name, flags = {}) {
          const row = await tx.user.create({ data: { name, email: `${prefix}-${name}@example.invalid`, password: 'test-only-not-a-login', phone: '09123456789', ...flags } });
          return { ...row, token: jwt.sign({ userId: row.id }, env.JWT_SECRET) };
        }
        const customer = await user('customer'), partner = await user('partner', { isShopOwner: true }), admin = await user('admin', { isAdmin: true }), rider = await user('rider'), second = await user('second'), stranger = await user('stranger', { isShopOwner: true });
        const location = { address_line_1: '123 Test Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Home', latitude: 13.62, longitude: 123.19 };
        const shop = await tx.shop.create({ data: { userId: partner.id, shopName: 'Lifecycle Test Laundry', contactNumber: '09123456789', openingTime: '08:00', closingTime: '18:00', approvalStatus: 'Approved', ...location, latitude: 13.65, longitude: 123.25 } });
        const service = await tx.shopService.create({ data: { shopId: shop.id, serviceName: 'Wash', price: 25 } });
        const root = `http://127.0.0.1:${server.address().port}/api`;
        async function request(path, method = 'GET', body, who = customer, status = 200) {
          const response = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${who.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
          const result = await response.json();
          assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result.error || result.message)}`);
          return result.data;
        }
        await request('/delivery/operations', 'GET', undefined, customer, 403);
        await request('/delivery/rider', 'GET', undefined, customer, 403);
        await request('/delivery/riders', 'PUT', { email: rider.email, active: true }, customer, 403);
        for (const person of [rider, second]) {
          // Grandfathered riders use the existing activation endpoint; new
          // applications are covered by rider-application.integration.cjs.
          await tx.riderProfile.create({ data: { userId: person.id, active: false, applicationStatus: 'Disabled', requirementsVersion: 0 } });
          await request('/delivery/riders', 'PUT', { email: person.email, active: true }, admin);
          const session = await request('/auth/verify-token', 'POST', {}, person);
          assert.equal(session.user.isRider, true);
          await request('/delivery/availability', 'PUT', { online: true, latitude: person.id === rider.id ? 13.62 : 13.65, longitude: person.id === rider.id ? 123.19 : 123.25 }, person);
        }
        const schedule = new Date(Date.now() + 86400000).toISOString();
        const input = { ...location, shopId: shop.id, serviceName: 'Wash', serviceIds: [service.id], kiloAmount: 2, deliveryType: 'Deliver', scheduledDate: schedule, scheduledTime: schedule, notes: 'Gentle detergent only' };
        await request('/transactions', 'POST', input, rider, 403);
        const order = await request('/transactions', 'POST', input, customer, 201);
        assert.equal(order.workflowStatus, 'BookingPending');
        assert.match(order.pickupCode, /^\d{6}$/);
        assert.equal(order.collectionCode, undefined);
        let detail = await request(`/delivery/orders/${order.id}`);
        assert.equal(detail.collectionCode, undefined);
        await request(`/delivery/orders/${order.id}`, 'GET', undefined, stranger, 403);
        const partnerDetail = await request(`/delivery/orders/${order.id}`, 'GET', undefined, partner);
        assert.equal(partnerDetail.pickupCode, undefined);
        assert.equal(partnerDetail.deliveryCode, undefined);
        assert.match(partnerDetail.collectionCode, /^\d{6}$/);
        async function action(name, who, extra = {}, status = 200) {
          detail = await request(`/delivery/orders/${order.id}`, 'GET', undefined, customer);
          return request(`/delivery/orders/${order.id}/action`, 'PUT', { action: name, expectedVersion: detail.workflowVersion, ...extra }, who, status);
        }
        await action('confirmBooking', stranger, { note: 'We have space today' }, 403);
        await action('confirmBooking', partner, { note: 'We can wash your laundry today.' });
        await request(`/delivery/orders/${order.id}/rider-options`, 'GET', undefined, customer, 403);
        await request(`/delivery/orders/${order.id}/rider-options`, 'GET', undefined, null, 401);
        const pickupOptions = await request(`/delivery/orders/${order.id}/rider-options`, 'GET', undefined, admin);
        assert.equal(pickupOptions.origin.source, 'customer');
        assert.equal(pickupOptions.riders.find(item => item.userId === rider.id).distance, 0);
        assert.ok(pickupOptions.riders.findIndex(item => item.userId === rider.id) < pickupOptions.riders.findIndex(item => item.userId === second.id));
        await request(`/transactions/${order.id}/status`, 'PUT', { status: 'Completed' }, partner, 409);
        await action('wash', partner, {}, 409);
        async function assign(person, stage, reason) {
          detail = await request(`/delivery/orders/${order.id}`, 'GET', undefined, customer);
          await request(`/delivery/orders/${order.id}/assign`, 'PUT', { riderId: person.id, stage, expectedVersion: detail.workflowVersion, reason }, admin);
          return (await request('/delivery/rider', 'GET', undefined, person)).jobs.find(job => job.transactionId === order.id && job.status === 'Offered');
        }
        let job = await assign(rider, 'Pickup');
        assert.equal(job.order.customer.phone, undefined);
        assert.equal(job.order.customer.name, undefined);
        assert.equal(JSON.stringify(job).includes(order.pickupCode), false);
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'accept' }, second, 404);
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'decline', reason: 'Vehicle needs maintenance' }, rider);
        job = await assign(second, 'Pickup');
        await tx.deliveryAssignment.update({ where: { id: job.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        await request('/delivery/operations', 'GET', undefined, admin);
        assert.equal((await tx.deliveryAssignment.findUnique({ where: { id: job.id } })).status, 'Expired');
        job = await assign(rider, 'Pickup');
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'accept' }, rider);
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'accept' }, rider);
        assert.equal((await request('/delivery/rider', 'GET', undefined, rider)).jobs.find(item => item.id === job.id).order.customer.phone, customer.phone);
        await request('/delivery/riders', 'PUT', { email: rider.email, active: false }, admin, 409);
        await action('enRoute', second, {}, 403);
        await action('enRoute', rider);
        const gps = { sharing: true, sessionId: 'integration_location_1', latitude: 13.621, longitude: 123.191, accuracy: 10, capturedAt: Date.now() };
        await request('/delivery/location', 'PUT', gps, rider);
        const tracking = await request(`/delivery/orders/${order.id}/tracking`);
        assert.equal(tracking.state, 'sharing'); assert.equal(tracking.location.latitude, gps.latitude);
        await request(`/delivery/orders/${order.id}/tracking`, 'GET', undefined, stranger, 403);
        await request(`/delivery/orders/${order.id}/tracking`, 'GET', undefined, partner, 403);
        const riderLocationPrivacy = await request('/delivery/rider', 'GET', undefined, rider);
        assert.equal(riderLocationPrivacy.jobs.find(item => item.id === job.id).liveLatitude, undefined);
        await action('pickedUp', rider, { code: '000000' }, 400);
        await action('failedPickup', rider, { note: 'Customer asked us to return later.' });
        job = await assign(rider, 'Pickup');
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'accept' }, rider);
        await action('enRoute', rider);
        await action('receiveHandoff', rider, {}, 409);
        await action('releaseHandoff', customer, {}, 409);
        await action('arriveHandoff', customer, {}, 403);
        await action('arriveHandoff', rider);
        const customerUpdates = await request('/notifications');
        assert.ok(customerUpdates.some(item => item.transactionId === order.id && item.title.includes('Rider arrived')));
        await action('releaseHandoff', partner, {}, 403);
        await action('releaseHandoff', customer);
        const riderJob = (await request('/delivery/rider', 'GET', undefined, rider)).jobs.find(item => item.id === job.id);
        assert.equal(riderJob.order.handoff.released, true);
        await action('receiveHandoff', rider);
        await action('cancel', admin, { note: 'Should not cancel laundry in custody' }, 409);
        await action('droppedOff', rider);
        assert.equal((await request(`/delivery/orders/${order.id}/tracking`)).location, null);
        assert.equal((await tx.deliveryAssignment.findUnique({ where: { id: job.id } })).liveLatitude, null);
        await action('receive', stranger, {}, 403);
        await action('receive', partner);
        await action('updateWeight', partner, { kilos: 3, note: 'Measured weight verified at the shop.' }, 400);
        detail = await request(`/delivery/orders/${order.id}`);
        await request(`/delivery/orders/${order.id}/weight`, 'PUT', { kilos: 3, note: 'Measured weight verified at the shop.', imageBase64: scalePhoto, expectedVersion: detail.workflowVersion }, partner);
        detail = await request(`/delivery/orders/${order.id}`);
        assert.equal(Number(detail.totalAmount), 105);
        assert.equal(detail.weightEvidence.length, 1);
        assert.equal(Number(detail.weightEvidence[0].kilos), 3);
        assert.equal(detail.weightEvidence[0].bytes, undefined);
        const weightImage = `/delivery/orders/${order.id}/weight-evidence/${detail.weightEvidence[0].id}`;
        const imageResponse = await fetch(root + weightImage, { headers: { Authorization: `Bearer ${customer.token}` } });
        assert.equal(imageResponse.status, 200);
        assert.equal(imageResponse.headers.get('content-type'), 'image/jpeg');
        assert.equal(imageResponse.headers.get('cache-control'), 'private, no-store');
        assert.ok((await imageResponse.arrayBuffer()).byteLength > 0);
        await request(weightImage, 'GET', undefined, rider, 403);
        for (const step of ['wash', 'dry', 'fold', 'ready']) await action(step, partner);
        const deliveryOptions = await request(`/delivery/orders/${order.id}/rider-options`, 'GET', undefined, admin);
        assert.equal(deliveryOptions.origin.source, 'shop');
        assert.equal(deliveryOptions.riders.find(item => item.userId === second.id).distance, 0);
        assert.ok(deliveryOptions.riders.findIndex(item => item.userId === second.id) < deliveryOptions.riders.findIndex(item => item.userId === rider.id));
        job = await assign(second, 'Delivery');
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'accept' }, second);
        await request('/delivery/location', 'PUT', { ...gps, sessionId: 'integration_location_2', capturedAt: Date.now() }, second);
        assert.equal((await request(`/delivery/orders/${order.id}/tracking`)).destination, 'shop');
        await action('arriveHandoff', second);
        await action('releaseHandoff', customer, {}, 403);
        await action('releaseHandoff', partner);
        await action('receiveHandoff', second);
        await action('issue', second, { note: 'Vehicle failure, requesting safe rider handover.' });
        job = await assign(rider, 'Delivery', 'Clean laundry physically handed to replacement rider.');
        assert.equal((await request(`/delivery/orders/${order.id}/tracking`)).location, null);
        assert.equal((await request('/delivery/location', 'PUT', { ...gps, sessionId: 'integration_location_2', capturedAt: Date.now() }, second)).sharedJobs, 0);
        await action('outForDelivery', second, {}, 403);
        await request(`/delivery/assignments/${job.id}/respond`, 'PUT', { action: 'accept' }, rider);
        detail = await request(`/delivery/orders/${order.id}`);
        assert.equal(detail.workflowStatus, 'CleanLaundryCollected');
        await action('outForDelivery', rider);
        await action('delivered', rider, { code: '000000' }, 400);
        await action('delivered', rider, { code: order.deliveryCode });
        await action('confirmReceipt', partner, {}, 403);
        await action('confirmReceipt', customer);
        detail = await request(`/delivery/orders/${order.id}`);
        assert.equal(detail.workflowStatus, 'Completed');
        assert.equal(detail.status, 'Completed');
        assert.ok(detail.events.every(event => event.actorId && event.createdAt));
        assert.ok(detail.events.some(event => event.action === 'WeightAndPriceUpdated'));
        const operations = await request('/delivery/operations', 'GET', undefined, admin);
        assert.equal(operations.automaticDispatchEnabled, false);
        assert.equal(operations.orders.find(item => item.id === order.id).deliveryCode, undefined);
        const adminNotices = await request('/notifications?audience=admin', 'GET', undefined, admin);
        const riderNotices = await request('/notifications?audience=rider', 'GET', undefined, rider);
        assert.ok(adminNotices.some(item => item.transactionId === order.id));
        assert.ok(riderNotices.some(item => item.transactionId === order.id));
        const cancelled = await request('/transactions', 'POST', input, customer, 201);
        await request(`/delivery/orders/${cancelled.id}/action`, 'PUT', { action: 'cancel', expectedVersion: 0, note: 'Customer changed their schedule.' }, customer);
        assert.equal((await request(`/delivery/orders/${cancelled.id}`)).workflowStatus, 'Cancelled');
        console.log('PASS: customer → rider → partner → replacement rider → customer lifecycle, codes, pricing, expiry, decline, failed pickup, audit, privacy and role isolation.');
      } finally {
        await new Promise(resolve => server.close(resolve));
        configuration.default = prisma;
      }
      throw rollback;
    }, { maxWait: 30000, timeout: 180000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { configuration.default = prisma; }
  assert.deepEqual(await counts(), before);
  console.log('PASS: all fixture writes rolled back; table counts unchanged.');
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : `Delivery integration failed (${error.code || error.name}).`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
