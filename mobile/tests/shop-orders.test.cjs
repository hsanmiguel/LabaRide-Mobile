const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/design/shop-orders.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(compiled, compiled.exports);
const { shopOrderStatus, orderIsPast, matchesOrderFilter, visibleShopOrders, shopOrderTiming, shopOrderTransport } = compiled.exports;
const order = { id: 42, status: 'Pending', userName: 'Maria Santos', serviceName: 'Full Service', createdAt: '2026-10-30T01:00:00Z', deliveryType: 'Deliver' };

test('rider stages classify active and closed work without relying on a stale legacy status', () => {
  for (const [stage, status] of Object.entries({ BookingPending: 'Pending', PickupEnRoute: 'Accepted', AtPartner: 'Accepted', LaundryReceived: 'Queued', Washing: 'Processing', Drying: 'Processing', Folding: 'Processing', ReadyForCollection: 'Ready', OutForDelivery: 'Ready', Delivered: 'Ready', Completed: 'Completed', Cancelled: 'Cancelled' })) {
    const row = { ...order, workflowStatus: stage };
    assert.equal(shopOrderStatus(row), status, stage);
    assert.equal(orderIsPast(row), ['Completed', 'Cancelled'].includes(stage));
  }
});

test('sections, status, text search and sorting compose without mutating incoming orders', () => {
  const records = [order, { ...order, id: 43, userName: 'Ana', status: 'Completed' }, { ...order, id: 44, workflowStatus: 'Washing', createdAt: '2026-10-29T01:00:00Z' }];
  assert.deepEqual(visibleShopOrders(records, 'Active', 'All', '').map(o => o.id), [42, 44]);
  assert.deepEqual(visibleShopOrders(records, 'Active', 'In progress', 'Maria').map(o => o.id), [44]);
  assert.deepEqual(visibleShopOrders(records, 'Active', 'All', '#42').map(o => o.id), [42]);
  assert.deepEqual(visibleShopOrders(records, 'Past', 'Completed', 'ana').map(o => o.id), [43]);
  assert.deepEqual(visibleShopOrders(records, 'Active', 'All', '', true).map(o => o.id), [44, 42]);
  assert.deepEqual(records.map(o => o.id), [42, 43, 44]);
  assert.equal(matchesOrderFilter(records[2], 'Processing'), true);
});

test('schedule and transport labels use recorded data without inventing completion dates', () => {
  assert.deepEqual(shopOrderTiming({ ...order, requestedPickupAt: '2026-10-31T01:00:00Z' }), { label: 'Requested pickup', value: '2026-10-31T01:00:00Z' });
  assert.deepEqual(shopOrderTiming({ ...order, workflowStatus: 'Washing', estimatedReadyAt: '2026-10-31T02:00:00Z' }), { label: 'Estimated ready', value: '2026-10-31T02:00:00Z' });
  assert.equal(shopOrderTiming({ ...order, status: 'Completed' }).label, 'Placed');
  assert.equal(shopOrderTiming({ ...order, status: 'Cancelled', updatedAt: '2026-10-31T02:00:00Z' }).label, 'Last updated');
  assert.equal(shopOrderTransport(order), 'Drop-off → Delivery');
  assert.equal(shopOrderTransport({ ...order, collectionMethod: 'ShopPickup', deliveryType: 'Pickup' }), 'Rider pickup → Customer collection');
});
