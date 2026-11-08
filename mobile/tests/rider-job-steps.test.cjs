const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const progressFile = fs.existsSync(path.join(__dirname, '../src/design/rider-job-steps.ts'))
  ? path.join(__dirname, '../src/design/rider-job-steps.ts') : path.join(__dirname, 'rider-job-steps.ts');
const moduleValue = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(progressFile, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleValue, moduleValue.exports);
const { riderJobProgress } = moduleValue.exports;
const job = (stage, status, handoff, assignment = 'Accepted') => ({ stage, status: assignment, order: { status, handoff } });

test('pickup uses accepted/completed progress regardless of legacy intermediate states', () => {
  assert.equal(riderJobProgress(job('Pickup', 'PickupAccepted')).current, 0);
  assert.equal(riderJobProgress(job('Pickup', 'PickupEnRoute')).current, 0);
  for (const released of [false, true]) {
    const result = riderJobProgress(job('Pickup', 'PickupEnRoute', { arrived: true, released }));
    assert.equal(result.current, 0);
    assert.match(result.detail, /Confirm completed after shop handover/);
  }
  assert.equal(riderJobProgress(job('Pickup', 'LaundryPickedUp')).current, 0);
  assert.equal(riderJobProgress(job('Pickup', 'AtPartner', undefined, 'Completed')).current, 1);
});
test('return delivery uses accepted/completed progress and retains recipient confirmation', () => {
  assert.equal(riderJobProgress(job('Delivery', 'DeliveryAccepted')).current, 0);
  assert.equal(riderJobProgress(job('Delivery', 'DeliveryAccepted', { arrived: true, released: false })).current, 0);
  assert.equal(riderJobProgress(job('Delivery', 'CleanLaundryCollected')).current, 0);
  assert.equal(riderJobProgress(job('Delivery', 'OutForDelivery')).current, 0);
  assert.equal(riderJobProgress(job('Delivery', 'OutForDelivery', { arrived: true, released: true })).current, 0);
  assert.equal(riderJobProgress(job('Delivery', 'Delivered', undefined, 'Completed')).current, 1);
});
test('expired, cancelled or reassigned jobs never show completed progress', () => {
  for (const status of ['Declined', 'Expired', 'Cancelled', 'Reassigned']) {
    const result = riderJobProgress(job('Pickup', 'PickupEnRoute', undefined, status));
    assert.equal(result.complete, false); assert.equal(result.stopped, true); assert.equal(result.current, 0);
  }
});
