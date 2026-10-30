const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const api = require('../dist/utils/shop-hours');
const mobileModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../../mobile/src/design/shop-hours.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(mobileModule, mobileModule.exports);
const at = time => Date.parse(`2026-10-22T${time}:00+08:00`);
for (const [name, { shopAvailability, businessMinutes }] of [['API', api], ['mobile', mobileModule.exports]]) {
  test(`${name}: orders open exactly at opening and close exactly at closing in Philippine time`, () => {
    const shop = { openingTime: '8:00 AM', closingTime: '6:00 PM' };
    for (const [time, open] of [['07:59', false], ['08:00', true], ['12:00', true], ['17:59', true], ['18:00', false], ['23:59', false]]) {
      assert.equal(shopAvailability(shop, at(time)).isOpen, open, time);
    }
    assert.match(shopAvailability(shop, at('07:59')).message, /not opened yet/);
    assert.equal(shopAvailability(shop, Date.parse('2026-10-22T00:00:00Z')).isOpen, true);
  });
  test(`${name}: overnight hours work on both sides of midnight`, () => {
    const shop = { openingTime: '22:00', closingTime: '04:00' };
    for (const [time, open] of [['21:59', false], ['22:00', true], ['23:59', true], ['00:00', true], ['03:59', true], ['04:00', false], ['12:00', false]]) {
      assert.equal(shopAvailability(shop, at(time)).isOpen, open, time);
    }
  });
  test(`${name}: manual closure overrides valid hours, and missing or invalid hours cannot accept orders`, () => {
    assert.equal(shopAvailability({ openingTime: '08:00', closingTime: '18:00', acceptingOrders: false }, at('10:00')).isOpen, false);
    for (const shop of [{}, { openingTime: 'bad', closingTime: '18:00' }, { openingTime: '08:00', closingTime: '08:00' }]) {
      assert.equal(shopAvailability(shop, at('10:00')).isOpen, false);
    }
    assert.equal(businessMinutes('12:00 AM'), 0);
    assert.equal(businessMinutes('12:00 PM'), 720);
    assert.equal(businessMinutes('24:00'), null);
    assert.equal(businessMinutes('8:61 AM'), null);
  });
}
