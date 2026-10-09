const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerShopSchema } = require('../dist/validators/shop.validator');
const { updateUserSchema } = require('../dist/validators/user.validator');
const { createTransactionSchema } = require('../dist/validators/transaction.validator');

const location = {
  address_line_1: ' 12 Main Street ', city: 'Naga', state_province: 'Camarines Sur',
  postal_code: '0044', country: 'Philippines', address_type: 'Work',
};
const shop = { shopName: 'Test Laundry', contactNumber: '09123456789', openingTime: '8:00 AM', closingTime: '6:00 PM' };

test('shop registration accepts the structured address without legacy address fields', () => {
  const body = registerShopSchema.parse({ body: { ...shop, ...location } }).body;
  assert.equal(body.address_line_1, '12 Main Street');
  assert.equal(body.postal_code, '0044');
  assert.equal(body.latitude, undefined);
  assert.equal(body.address_line_2, undefined);
});

test('missing required routing fields, invalid coordinates, and unknown address types are rejected', () => {
  for (const field of ['address_line_1', 'city', 'state_province', 'postal_code', 'country', 'address_type']) {
    const body = { ...shop, ...location };
    delete body[field];
    const result = registerShopSchema.safeParse({ body });
    assert.equal(result.success, false, field);
    assert.ok(result.error.issues.some(issue => issue.path.includes(field)), field);
  }
  for (const patch of [{ city: '  ' }, { latitude: 90.1 }, { longitude: -180.1 }, { latitude: NaN }, { longitude: Infinity }, { latitude: '' }, { latitude: '13.6' }, { address_type: 'Office' }]) {
    assert.equal(registerShopSchema.safeParse({ body: { ...shop, ...location, ...patch } }).success, false);
  }
  for (const address_type of ['Home', 'Work', 'Hotel', 'Apartment']) {
    assert.equal(registerShopSchema.safeParse({ body: { ...shop, ...location, address_type } }).success, true);
  }
});

test('profile edits do not require an address, but an address save must be complete', () => {
  assert.equal(updateUserSchema.safeParse({ body: { name: 'Updated Name' } }).success, true);
  assert.equal(updateUserSchema.safeParse({ body: { postal_code: '4000' } }).success, false);
  const body = updateUserSchema.parse({ body: { ...location, address_line_2: 'Room 2', access_code: '0123', dropoff_instructions: 'Leave with doorman' } }).body;
  assert.equal(body.access_code, '0123');
  assert.equal(body.dropoff_instructions, 'Leave with doorman');
});

test('order addresses retain delivery instructions without requiring coordinates', () => {
  const body = { ...location, access_code: '0123', dropoff_instructions: 'Porch pickup',
    shopId: 1, serviceName: 'Wash', kiloAmount: 2, subtotal: 100, deliveryFee: 30, totalAmount: 130,
    deliveryType: 'Deliver', scheduledDate: '2026-10-10T08:00:00Z', scheduledTime: '2026-10-10T08:00:00Z' };
  assert.equal(createTransactionSchema.parse({ body }).body.dropoff_instructions, 'Porch pickup');
  assert.equal(createTransactionSchema.safeParse({ body }).success, true);
});

// Run the real mobile conversion code without loading React Native or making requests.
const fs = require('node:fs');
const ts = require('typescript');
const moduleOutput = { exports: {} };
const mobileSource = fs.readFileSync(require('node:path').resolve(__dirname, '../../mobile/src/design/address.ts'), 'utf8');
new Function('module', 'exports', ts.transpileModule(mobileSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleOutput, moduleOutput.exports);
const { addressError, addressPayload, addressValues, formatAddress } = moduleOutput.exports;

test('mobile addresses submit without coordinates, including addresses saved before their removal', () => {
  const blank = addressValues();
  assert.equal('latitude' in blank, false);
  assert.equal('longitude' in blank, false);
  assert.ok(addressError(blank));
  const form = addressValues({ ...location, latitude: '13.6217', longitude: '123.1948' });
  assert.equal(addressError(form), null);
  const payload = addressPayload(form);
  assert.equal('latitude' in payload, false);
  assert.equal('longitude' in payload, false);
  assert.equal(payload.postal_code, '0044');
});

test('optional legacy coordinates remain validated when supplied', () => {
  const body = registerShopSchema.parse({ body: { ...shop, ...location, latitude: 0, longitude: -0.1234567 } }).body;
  assert.equal(body.latitude, 0);
  assert.equal(body.longitude, -0.1234567);
});

test('address displays prefer structured fields, preserve legacy text, and exclude access details', () => {
  assert.equal(formatAddress({ ...location, address_line_1: '12 Main Street', address_line_2: 'Unit 2', access_code: 'SECRET', dropoff_instructions: 'Private note' }),
    '12 Main Street, Unit 2, Naga, Camarines Sur, 0044, Philippines');
  assert.equal(formatAddress({ zone: 'Zone 1', street: 'Main Street', barangay: 'Central' }), 'Zone 1, Main Street, Central');
});
