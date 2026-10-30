const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const compiled = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, `../src/design/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(compiled, compiled.exports, dependency => load(dependency.replace('./', '')));
  return compiled.exports;
}
const { operationStage, operationOrders, pastReadyEstimate, operationTime } = load('live-operations');
const order = { id: 42, status: 'Pending', userName: 'Maria Santos', serviceName: 'Full Service', createdAt: '2026-10-30T01:00:00Z' };

test('every detailed workflow step enters the appropriate row, overriding stale legacy status', () => {
  const stages = {
    awaiting: ['BookingPending', 'PickupQueued', 'PickupAssigned', 'PickupAccepted', 'PickupEnRoute', 'LaundryPickedUp', 'AtPartner'],
    queue: ['LaundryReceived'], processing: ['Washing', 'Drying', 'Folding'],
    ready: ['ReadyForCollection', 'ReadyForDelivery', 'DeliveryAssigned', 'DeliveryAccepted'],
    returning: ['CleanLaundryCollected', 'OutForDelivery', 'Delivered'],
  };
  for (const [row, steps] of Object.entries(stages)) for (const workflowStatus of steps)
    assert.equal(operationStage({ ...order, status: 'Completed', workflowStatus }), row, workflowStatus);
  for (const workflowStatus of ['Completed', 'Cancelled']) assert.equal(operationStage({ ...order, workflowStatus }), null);
});

test('legacy orders remain visible without implying that a rider has collected them', () => {
  for (const [status, expected] of Object.entries({ Pending: 'awaiting', Accepted: 'awaiting', Queued: 'queue', Processing: 'processing', Ready: 'ready', Completed: null, Cancelled: null }))
    assert.equal(operationStage({ ...order, status }), expected);
});

test('search and service filters compose, exclude closed orders and preserve input order', () => {
  const older = { ...order, id: 43, status: 'Processing', serviceName: 'Wash Only', createdAt: '2026-10-29T01:00:00Z' };
  const records = [order, older, { ...order, id: 44, workflowStatus: 'Completed' }, { ...order, id: 45, status: 'Cancelled' }];
  assert.deepEqual(operationOrders(records).map(o => o.id), [43, 42]);
  assert.deepEqual(operationOrders(records, ' MARIA ', 'Wash Only').map(o => o.id), [43]);
  assert.deepEqual(operationOrders(records, '#42').map(o => o.id), [42]);
  assert.deepEqual(operationOrders(records, 'full', 'Wash Only'), []);
  assert.deepEqual(records.map(o => o.id), [42, 43, 44, 45]);
});

test('ready estimate warnings apply only to unfinished in-shop work with an actual past estimate', () => {
  const now = Date.parse('2026-10-30T05:00:00Z');
  const estimated = { ...order, estimatedReadyAt: '2026-10-30T04:00:00Z' };
  for (const workflowStatus of ['LaundryReceived', 'Washing', 'Drying', 'Folding']) assert.equal(pastReadyEstimate({ ...estimated, workflowStatus }, now), true);
  for (const workflowStatus of ['BookingPending', 'ReadyForDelivery', 'OutForDelivery', 'Completed']) assert.equal(pastReadyEstimate({ ...estimated, workflowStatus }, now), false);
  assert.equal(pastReadyEstimate({ ...order, status: 'Processing' }, now), false);
  assert.equal(pastReadyEstimate({ ...estimated, status: 'Processing', estimatedReadyAt: 'invalid' }, now), false);
  assert.equal(pastReadyEstimate({ ...estimated, status: 'Processing', estimatedReadyAt: '2026-10-30T06:00:00Z' }, now), false);
  assert.equal(operationTime('invalid'), 'Not available');
  assert.match(operationTime('2026-10-30T01:00:00Z'), /9:00\s*AM/);
});
