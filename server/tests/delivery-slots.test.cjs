const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const api = require('../dist/utils/delivery-slots');
const cache = new Map();
function mobile(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../../mobile/src/design', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText)(module, module.exports, name => mobile(name.slice(2) + '.ts'));
  cache.set(file, module.exports);
  return module.exports;
}
for (const [name, slots] of [['API', api], ['mobile', mobile('delivery-slots.ts')]]) {
  test(`${name}: preparation and shop hours govern today's suggestions and future dates`, () => {
    const now = Date.parse('2026-10-22T10:30:00+08:00');
    const rules = { openingTime: '08:15', closingTime: '18:00', preparationMinutes: 120 };
    const today = slots.availableDeliverySlots('2026-10-22', rules, now);
    assert.ok(today.length);
    for (const value of today) {
      assert.ok(Date.parse(value) >= now + 120 * 60000 + 6000);
      assert.equal(slots.validateDeliveryTime(value, rules, now), null);
    }
    const tomorrow = slots.availableDeliverySlots('2026-10-23', rules, now);
    assert.equal(tomorrow[0], '2026-10-23T00:15:00.000Z');
    assert.ok(tomorrow.every(value => slots.formatDeliveryTime(value) !== '6:00 PM'));
    assert.equal(slots.validateDeliveryTime('2026-10-23T18:00:00+08:00', rules, now), "Choose a delivery time within the shop's operating hours.");
  });
  test(`${name}: exhausted dates, closed shops and missing hours have no available times`, () => {
    const now = Date.parse('2026-10-22T17:00:00+08:00');
    const rules = { openingTime: '08:00', closingTime: '18:00', preparationMinutes: 120 };
    assert.equal(slots.availableDeliverySlots('2026-10-22', rules, now).length, 0);
    assert.equal(slots.deliveryDay(slots.earliestDeliverySlot(rules, now)), '2026-10-23');
    assert.equal(slots.earliestDeliverySlot({ ...rules, acceptingOrders: false }, now), null);
    assert.equal(slots.availableDeliverySlots('2026-10-23', { preparationMinutes: 0 }, now).length, 0);
    assert.equal(slots.availableDeliverySlots('2026-10-23', rules, now, 0).length, 0);
  });
  test(`${name}: overnight windows and Philippine dates remain correct across midnight and year boundaries`, () => {
    const now = Date.parse('2026-12-31T23:30:00+08:00');
    const rules = { openingTime: '22:00', closingTime: '04:00', preparationMinutes: 120 };
    const first = slots.earliestDeliverySlot(rules, now);
    assert.equal(slots.deliveryDay(first), '2027-01-01');
    assert.equal(slots.formatDeliveryTime(first), '1:31 AM');
    const values = slots.availableDeliverySlots('2027-01-01', rules, now);
    assert.ok(values.some(value => slots.formatDeliveryTime(value) === '3:30 AM'));
    assert.ok(values.some(value => slots.formatDeliveryTime(value) === '10:00 PM'));
    assert.ok(!values.some(value => slots.formatDeliveryTime(value) === '4:00 AM'));
    assert.equal(slots.deliveryDay('2026-12-31T16:30:00Z'), '2027-01-01');
    assert.equal(slots.addDeliveryDays('2026-12-31', 1), '2027-01-01');
  });
  test(`${name}: exact minute-level times remain valid without imposing a new slot-only API rule`, () => {
    const now = Date.parse('2026-10-22T10:30:00+08:00');
    const rules = { openingTime: '08:00', closingTime: '18:00', preparationMinutes: 0 };
    assert.equal(slots.validateDeliveryTime('2026-10-23T11:17:00+08:00', rules, now), null);
    assert.ok(slots.validateDeliveryTime('2026-10-22T09:00:00+08:00', rules, now));
  });
}
