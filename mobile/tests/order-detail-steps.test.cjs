const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/design/order-detail-steps.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(compiled, compiled.exports);
const { orderDetailProgress, originalOrderDetailProgress } = compiled.exports;

test('each real workflow state selects its relevant detail step', () => {
  const stages = [
    ['BookingPending'],
    ['PickupQueued', 'PickupAssigned', 'PickupAccepted', 'PickupEnRoute', 'LaundryPickedUp', 'AtPartner', 'LaundryReceived'],
    ['Washing', 'Drying', 'Folding'],
    ['ReadyForDelivery', 'ReadyForCollection', 'DeliveryAssigned', 'DeliveryAccepted', 'CleanLaundryCollected', 'OutForDelivery', 'Delivered'],
    ['Completed'],
  ];
  stages.forEach((statuses, index) => statuses.forEach(status => {
    assert.equal(orderDetailProgress(status).current, index, status);
    assert.equal(orderDetailProgress(status).complete, status === 'Completed');
  }));
});

test('cancellation retains the last recorded step without implying completion or altering history', () => {
  const history = [{ toStatus: 'BookingPending' }, { toStatus: 'LaundryReceived' }, { toStatus: 'Washing' }, { toStatus: 'Cancelled' }];
  assert.deepEqual(orderDetailProgress('Cancelled', history), { current: 2, cancelled: true, complete: false });
  assert.deepEqual(history.map(event => event.toStatus), ['BookingPending', 'LaundryReceived', 'Washing', 'Cancelled']);
  assert.deepEqual(orderDetailProgress('Cancelled'), { current: 0, cancelled: true, complete: false });
});

test('original order statuses select the same five detail steps without inventing washing or drying stages', () => {
  for (const [status, current] of Object.entries({ Pending: 0, Accepted: 1, Queued: 1, Processing: 2, Ready: 3, Completed: 4 })) {
    const order = { status };
    assert.deepEqual(originalOrderDetailProgress(order), { current, cancelled: false, complete: status === 'Completed' });
    assert.equal(order.workflowStatus, undefined);
  }
});

test('cancelled original orders use their actual last milestone, and missing dates imply no completed steps', () => {
  const status = 'Cancelled', time = '2026-10-30T01:00:00Z';
  assert.deepEqual(originalOrderDetailProgress({ status }), { current: 0, cancelled: true, complete: false });
  assert.equal(originalOrderDetailProgress({ status, receivedAt: time }).current, 1);
  assert.equal(originalOrderDetailProgress({ status, processingStartedAt: time }).current, 2);
  assert.equal(originalOrderDetailProgress({ status, readyAt: time }).current, 3);
});
