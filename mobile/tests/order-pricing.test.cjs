const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/design/order-pricing.ts'), 'utf8');
const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(compiled, compiled.exports);
const { laundryWeight, orderPricing } = compiled.exports;
const service = { id: 1, serviceName: 'Wash', price: '23' };
const shop = { kiloPrices: [{ minKilo: '1', maxKilo: '8', pricePerKilo: '25' }] };

test('weight must be positive and contain at most two decimal places', () => {
  for (const input of ['', '0', '-1', '1.234', 'NaN', 'Infinity', '1e3']) {
    assert.equal(laundryWeight(input), null, input);
  }
  assert.equal(laundryWeight(' .5 '), 0.5);
  assert.equal(laundryWeight('2.25'), 2.25);
});

test('matching provider weight rate determines order price', () => {
  const amount = orderPricing('2', service, shop, 'Deliver');
  assert.equal(amount.rate, 25);
  assert.equal(amount.subtotal, 50);
  assert.equal(amount.deliveryFee, 30);
  assert.equal(amount.total, 80);
  assert.equal(orderPricing('1', service, shop, 'Pickup').subtotal, 25);
  assert.equal(orderPricing('8', service, shop, 'Pickup').subtotal, 200);
});

test('service rate applies when no shop weight range matches', () => {
  assert.equal(orderPricing('2', service, { kiloPrices: [] }, 'Pickup').subtotal, 46);
  assert.equal(orderPricing('9', service, shop, 'Pickup').subtotal, 207);
  assert.equal(orderPricing('2', { ...service, price: 0 }, { kiloPrices: [] }, 'Pickup').subtotal, 0);
});

test('summary has no made-up 1 kg price before the customer enters weight', () => {
  const amount = orderPricing('', service, shop, 'Deliver');
  assert.equal(amount.kilos, null);
  assert.equal(amount.subtotal, null);
  assert.equal(amount.total, null);
});

test('overlapping ranges and missing service prices block an order', () => {
  const overlap = orderPricing('2', service, { kiloPrices: [
    ...shop.kiloPrices, { minKilo: 2, maxKilo: 5, pricePerKilo: 30 },
  ] }, 'Deliver');
  assert.match(overlap.pricingError, /overlapping/);
  assert.equal(overlap.total, null);
  assert.match(orderPricing('2', null, shop, 'Pickup').pricingError, /valid price/);
});
