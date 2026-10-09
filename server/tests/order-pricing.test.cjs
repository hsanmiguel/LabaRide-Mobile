const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { priceOrder } = require('../dist/utils/order-pricing');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobilePricingSource = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/design/order-pricing.ts'), 'utf8');
const mobilePricingModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(mobilePricingSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(mobilePricingModule, mobilePricingModule.exports);
const { orderPricing } = mobilePricingModule.exports;

const decimal = value => new Prisma.Decimal(value);
const input = {
  kilos: 2,
  serviceIds: [1],
  serviceName: 'Client supplied name',
  services: [
    { id: 1, serviceName: 'Wash', price: decimal('23') },
    { id: 2, serviceName: 'Iron', price: decimal('10') },
  ],
  ranges: [{ minKilo: decimal('1'), maxKilo: decimal('8'), pricePerKilo: decimal('25') }],
  deliveryType: 'Deliver',
};

test('a matching shop weight range sets the authoritative subtotal and delivery total', () => {
  const priced = priceOrder(input);
  assert.equal(String(priced.subtotal), '50');
  assert.equal(String(priced.totalAmount), '80');
  assert.equal(priced.serviceName, 'Wash');
  assert.equal(String(priceOrder({ ...input, deliveryType: 'Pickup' }).totalAmount), '50');
});

test('without a matching weight range, selected service prices are summed per kg', () => {
  const priced = priceOrder({ ...input, serviceIds: [1, 2], ranges: [], kilos: 2.5 });
  assert.equal(priced.serviceName, 'Wash, Iron');
  assert.equal(String(priced.subtotal), '82.5');
  assert.equal(String(priced.totalAmount), '112.5');
});

test('boundaries are inclusive and decimal multiplication rounds to cents', () => {
  assert.equal(String(priceOrder({ ...input, kilos: 1 }).subtotal), '25');
  assert.equal(String(priceOrder({ ...input, kilos: 8 }).subtotal), '200');
  const priced = priceOrder({ ...input, kilos: 1.5, ranges: [
    { minKilo: decimal('1'), maxKilo: decimal('2'), pricePerKilo: decimal('0.01') },
  ] });
  assert.equal(String(priced.subtotal), '0.02');
});

test('missing services and overlapping rates cannot produce an order total', () => {
  assert.match(priceOrder({ ...input, serviceIds: [3] }).error, /no longer available/);
  assert.match(priceOrder({ ...input, ranges: [...input.ranges, ...input.ranges] }).error, /overlapping/);
});

test('the checkout preview matches the server for fractional kilograms and rates', () => {
  for (const rate of [0.01, 0.03, 0.05, 0.10, 0.99, 23.50, 25]) {
    for (const kilos of [0.01, 0.05, 0.10, 0.25, 0.5, 1, 1.01, 1.5, 1.75, 2.25, 8, 8.75, 9.99]) {
      const serverPrice = priceOrder({ ...input, kilos, ranges: [], services: [
        { id: 1, serviceName: 'Wash', price: decimal(rate) },
      ] });
      const mobilePrice = orderPricing(String(kilos), { id: 1, price: rate }, { kiloPrices: [] }, 'Deliver');
      assert.equal(mobilePrice.subtotal, Number(serverPrice.subtotal), `${kilos} kg at ${rate}/kg`);
      assert.equal(mobilePrice.total, Number(serverPrice.totalAmount), `${kilos} kg at ${rate}/kg`);
    }
  }
});
