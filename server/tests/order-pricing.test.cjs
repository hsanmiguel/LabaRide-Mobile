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
const { createServiceSchema } = require('../dist/validators/shop.validator');

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

test('8 kg full service costs 215 per load and ignores general kilogram ranges', () => {
  const services = [{ id: 3, serviceName: 'Full service', price: decimal(215), packageKilos: decimal(8) }];
  for (const [kilos, expected] of [[0.01, 215], [7.99, 215], [8, 215], [8.01, 430], [16, 430], [16.01, 645]]) {
    const priced = priceOrder({ ...input, kilos, serviceIds: [3], services });
    assert.equal(Number(priced.subtotal), expected);
    assert.equal(Number(priced.totalAmount), expected + 30);
  }
  const priced = priceOrder({ ...input, kilos: 8, serviceIds: [3], services, ranges: [...input.ranges, ...input.ranges] });
  assert.equal(Number(priced.subtotal), 215);
});

test('package and per-kilogram combinations match the checkout preview', () => {
  const services = [
    { id: 1, serviceName: 'Full service', price: decimal('215.15'), packageKilos: decimal(8) },
    { id: 2, serviceName: 'Iron', price: decimal('0.01'), packageKilos: null },
    { id: 3, serviceName: 'Dry', price: decimal('30.15'), packageKilos: decimal('0.1') },
  ];
  const mobileServices = services.map(item => ({ ...item, price: String(item.price), packageKilos: item.packageKilos === null ? null : String(item.packageKilos) }));
  for (const serviceIds of [[1], [1, 2], [1, 3], [1, 2, 3], [3]]) {
    for (const kilos of [0.1, 0.3, 1.5, 7.99, 8, 8.01, 16.01]) {
      for (const ranges of [[], input.ranges]) {
        const server = priceOrder({ ...input, kilos, services, serviceIds, ranges });
        const mobile = orderPricing(String(kilos), mobileServices[0], { services: mobileServices, kiloPrices: ranges }, 'Deliver', serviceIds);
        assert.equal(mobile.subtotal, Number(server.subtotal), `${kilos} kg, services ${serviceIds}`);
        assert.equal(mobile.total, Number(server.totalAmount));
      }
    }
  }
});

test('service creation accepts packages and validates weight and price precision', () => {
  const body = { serviceName: ' Full service ', price: 215, packageKilos: 8 };
  assert.deepEqual(createServiceSchema.parse({ body }).body, { ...body, serviceName: 'Full service' });
  for (const packageKilos of [0, -1, Infinity, NaN, 0.001, 100000000]) {
    assert.equal(createServiceSchema.safeParse({ body: { ...body, packageKilos } }).success, false);
  }
  for (const price of [-1, Infinity, NaN, 215.001, 100000000]) {
    assert.equal(createServiceSchema.safeParse({ body: { ...body, price } }).success, false);
  }
  assert.equal(createServiceSchema.safeParse({ body: { ...body, serviceName: ' ' } }).success, false);
  assert.equal(createServiceSchema.safeParse({ body: { serviceName: 'Wash', price: 25 } }).success, true);
  assert.equal(createServiceSchema.safeParse({ body: { ...body, packageKilos: null } }).success, true);
});
