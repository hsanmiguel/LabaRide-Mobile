const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { calculateFee, feeFingerprint, roadKilometers, stageEarnings } = require('../dist/services/delivery-fees');
const { priceOrder } = require('../dist/utils/order-pricing');
const policy = { baseFee: 30, ratePerKm: 10, minimumFee: 50, commissionPercent: 15, revision: 1 };
test('combined fee applies base/minimum once and conserves cents after commission and trip allocation', () => {
  const result = calculateFee(policy, 3, 5, true, true);
  assert.equal(result.deliveryFee, 110);
  assert.equal(result.commission, 16.5);
  assert.equal(result.pickupEarnings, 35.06);
  assert.equal(result.returnEarnings, 58.44);
  assert.equal(result.pickupEarnings + result.returnEarnings + result.commission, result.deliveryFee);
  assert.equal(calculateFee(policy, 0.2, 0.3, true, true).deliveryFee, 50);
});
test('pickup-only, return-only, no-rider and zero-distance bookings allocate correct earnings', () => {
  const pickup = calculateFee(policy, 2, 0, true, false);
  assert.equal(pickup.deliveryFee, 50); assert.equal(pickup.pickupEarnings, 42.5); assert.equal(pickup.returnEarnings, 0);
  const delivery = calculateFee(policy, 0, 6, false, true);
  assert.equal(delivery.deliveryFee, 90); assert.equal(delivery.pickupEarnings, 0); assert.equal(delivery.returnEarnings, 76.5);
  assert.equal(calculateFee(policy, 0, 0, false, false).deliveryFee, 0);
  const zero = calculateFee(policy, 0, 0, true, true);
  assert.equal(zero.pickupEarnings + zero.returnEarnings, 42.5);
  assert.equal(calculateFee({ ...policy, commissionPercent: 100 }, 1, 1, true, true).pickupEarnings, 0);
  assert.throws(() => calculateFee(policy, NaN, 0, true, true));
});
test('quote fingerprint binds shop and relevant trip pins, ignoring rider and weight changes', () => {
  const shop = { latitude: 14, longitude: 121 };
  const booking = { shopId: 1, collectionMethod: 'ShopPickup', deliveryType: 'Deliver', latitude: 14.1, longitude: 121.1, collectionAddress: { latitude: 14.2, longitude: 121.2 } };
  const key = feeFingerprint(booking, shop);
  assert.equal(feeFingerprint({ ...booking, kilos: 99, riderId: 8 }, shop), key);
  assert.notEqual(feeFingerprint({ ...booking, latitude: 14.3 }, shop), key);
  assert.notEqual(feeFingerprint(booking, { ...shop, longitude: 121.3 }), key);
  assert.notEqual(feeFingerprint({ ...booking, deliveryType: 'Pickup' }, shop), key);
  assert.throws(() => feeFingerprint({ ...booking, latitude: undefined }, shop));
});
test('routing uses ordered driving coordinates and actual meters; failure never falls back to straight-line distance', async () => {
  const previous = process.env.MAPBOX_ACCESS_TOKEN; process.env.MAPBOX_ACCESS_TOKEN = 'test-only';
  try {
    let url;
    const response = body => async value => { url = value; return { ok: true, json: async () => body }; };
    assert.equal(await roadKilometers({ latitude: 14, longitude: 121 }, { latitude: 15, longitude: 122 }, response({ code: 'Ok', routes: [{ distance: 12345 }] })), 12.345);
    assert.match(url, /mapbox\/driving\/121,14;122,15/);
    for (const body of [{ code: 'NoRoute', routes: [] }, { code: 'Ok', routes: [{ distance: -1 }] }, { code: 'Ok', routes: [{ distance: 100 }], waypoints: [{ distance: 2000 }] }]) {
      await assert.rejects(roadKilometers({ latitude: 14, longitude: 121 }, { latitude: 15, longitude: 122 }, response(body)), /Unable to calculate/);
    }
    await assert.rejects(roadKilometers({ latitude: 14, longitude: 121 }, { latitude: 15, longitude: 122 }, async () => { throw Error('offline'); }), /Unable to calculate/);
  } finally { if (previous === undefined) delete process.env.MAPBOX_ACCESS_TOKEN; else process.env.MAPBOX_ACCESS_TOKEN = previous; }
});
test('weight repricing preserves the confirmed transport fee and older earnings are explicitly unavailable', () => {
  const result = priceOrder({ kilos: 8, serviceName: 'Wash', services: [{ id: 1, serviceName: 'Wash', price: new Prisma.Decimal(20) }], ranges: [], deliveryType: 'Deliver', confirmedDeliveryFee: new Prisma.Decimal(110) });
  assert.equal(result.deliveryFee.toNumber(), 110); assert.equal(result.totalAmount.toNumber(), 270);
  assert.equal(stageEarnings(null, 'Pickup'), null);
  assert.equal(stageEarnings(calculateFee(policy, 3, 5, true, true), 'Delivery'), 58.44);
});
