const assert = require('node:assert/strict');
const { test } = require('node:test');
const { recommendRiders, dispatchPoint, dispatchStage, AUTOMATIC_DISPATCH_ENABLED, confirmationCode, jobTransitions, partnerTransitions } = require('../dist/services/dispatch.service');

test('dispatch remains disabled and recommendations enforce eligibility and workload', () => {
  assert.equal(AUTOMATIC_DISPATCH_ENABLED, false);
  const base = { active: true, online: true, workload: 0, latitude: 13.62, longitude: 123.19 };
  const result = recommendRiders([
    { ...base, userId: 1, active: false }, { ...base, userId: 2, online: false },
    { ...base, userId: 3, workload: 3 }, { ...base, userId: 4, workload: 1 },
    { ...base, userId: 5, latitude: 14 }, { ...base, userId: 6 },
  ], { latitude: 13.62, longitude: 123.19 });
  assert.deepEqual(result.map(item => item.userId), [6, 4, 5]);
  assert.equal(result[0].distance, 0);
});

test('distance is primary, unknown positions are last, and missing origin uses workload', () => {
  const riders = [
    { userId: 1, active: true, online: true, workload: 2, latitude: 0, longitude: 0 },
    { userId: 2, active: true, online: true, workload: 0, latitude: 0, longitude: 1 },
    { userId: 3, active: true, online: true, workload: 0, latitude: null, longitude: null },
    { userId: 4, active: true, online: true, workload: 1, latitude: 999, longitude: 0 },
  ];
  const result = recommendRiders(riders, { latitude: 0, longitude: 0 });
  assert.deepEqual(result.map(item => item.userId), [1, 2, 3, 4]);
  assert.equal(result[0].distance, 0);
  assert.ok(Math.abs(result[1].distance - 111.195) < 0.01);
  assert.equal(result[3].distance, null);
  assert.deepEqual(recommendRiders(riders).map(item => item.userId), [2, 3, 4, 1]);
  assert.deepEqual(dispatchPoint({ latitude: '0', longitude: '0' }), { latitude: 0, longitude: 0 });
  assert.equal(dispatchPoint({ latitude: '', longitude: 0 }), undefined);
  assert.equal(dispatchPoint({ latitude: 0, longitude: Infinity }), undefined);
  assert.equal(dispatchStage('PickupQueued'), 'Pickup');
  assert.equal(dispatchStage('ReadyForDelivery'), 'Delivery');
  assert.equal(dispatchStage('Washing'), null);
});

test('pickup and delivery handoffs require distinct proof types and preserve stage order', () => {
  assert.equal(jobTransitions.pickedUp.proof, 'pickupCode');
  assert.equal(jobTransitions.collected.proof, 'collectionCode');
  assert.equal(jobTransitions.delivered.proof, 'deliveryCode');
  assert.equal(jobTransitions.droppedOff.to, partnerTransitions.receive.from);
  assert.equal(partnerTransitions.receive.to, partnerTransitions.wash.from);
  assert.equal(partnerTransitions.wash.to, partnerTransitions.dry.from);
  assert.equal(partnerTransitions.dry.to, partnerTransitions.fold.from);
  assert.equal(partnerTransitions.fold.to, partnerTransitions.ready.from);
  for (let index = 0; index < 100; index++) assert.match(confirmationCode(), /^[1-9]\d{5}$/);
});
