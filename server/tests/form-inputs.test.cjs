const assert = require('node:assert/strict');
const { test } = require('node:test');
const { signupSchema } = require('../dist/validators/auth.validator');
const { updateUserSchema } = require('../dist/validators/user.validator');
const { registerShopSchema } = require('../dist/validators/shop.validator');

test('signup requires an exact password confirmation and reports its field', () => {
  const signup = { name: 'Test User', email: 'test@example.invalid', password: 'Password123' };
  for (const confirmPassword of [undefined, '', 'password123', 'Password123 ']) {
    const result = signupSchema.safeParse({ body: { ...signup, confirmPassword } });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(issue => issue.path.includes('confirmPassword')));
  }
  assert.equal(signupSchema.safeParse({ body: { ...signup, confirmPassword: signup.password } }).success, true);
});

test('birthdate updates reject invalid calendar dates and preserve valid leap days', () => {
  for (const birthdate of ['2025-02-29', '2024-02-30', '2024-13-01', '01/02/2000']) {
    assert.equal(updateUserSchema.safeParse({ body: { birthdate } }).success, false);
  }
  assert.equal(updateUserSchema.parse({ body: { birthdate: '2000-02-29' } }).body.birthdate, '2000-02-29');
});

const shop = { shopName: 'Test Laundry', contactNumber: '09123456789',
  address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur',
  postal_code: '4400', country: 'Philippines', address_type: 'Work' };
test('business hours support picked, legacy, and overnight hours; malformed times are rejected', () => {
  for (const [openingTime, closingTime] of [['8:00 AM', '6:00 PM'], ['08:00', '18:00'], ['10:00 PM', '4:00 AM'], ['12:00 AM', '12:00 PM']]) {
    assert.equal(registerShopSchema.safeParse({ body: { ...shop, openingTime, closingTime } }).success, true);
  }
  for (const openingTime of ['', 'tomorrow', '24:00', '8:61 AM', '0:30 AM', '13:00 PM']) {
    assert.equal(registerShopSchema.safeParse({ body: { ...shop, openingTime, closingTime: '6:00 PM' } }).success, false);
  }
});

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = { exports: {} };
const source = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/design/form-values.ts'), 'utf8');
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(loaded, loaded.exports);
const { timeInputValue, displayTime, localDateString, validBirthdate, signupError } = loaded.exports;

test('time pickers round-trip midnight, noon, evening and existing business hours', () => {
  for (const [input, clock, display] of [['12:00 AM', '00:00', '12:00 AM'], ['12:00 PM', '12:00', '12:00 PM'],
    ['08:05', '08:05', '8:05 AM'], ['18:30', '18:30', '6:30 PM'], ['11:59 PM', '23:59', '11:59 PM']]) {
    assert.equal(timeInputValue(input), clock);
    assert.equal(displayTime(clock), display);
    assert.equal(timeInputValue(displayTime(clock)), clock);
  }
  assert.equal(timeInputValue('24:00'), '');
  assert.equal(displayTime('invalid'), '');
});

test('birthdate picker values retain calendar dates without UTC conversion and reject future dates', () => {
  const date = new Date(2000, 1, 29, 23, 59);
  assert.equal(localDateString(date), '2000-02-29');
  assert.equal(validBirthdate('2000-02-29', '2026-10-09'), true);
  assert.equal(validBirthdate('2025-02-29', '2026-10-09'), false);
  assert.equal(validBirthdate('2026-10-10', '2026-10-09'), false);
  assert.equal(validBirthdate('', '2026-10-09'), false);
});

test('mobile signup blocks empty and mismatched confirmation before a request', () => {
  const input = { name: 'Test User', email: ' test@example.invalid ', password: 'Password123', confirmPassword: '' };
  assert.equal(signupError(input), 'Please confirm your password.');
  assert.equal(signupError({ ...input, confirmPassword: 'Password123 ' }), 'Passwords do not match.');
  assert.equal(signupError({ ...input, confirmPassword: input.password }), null);
});
