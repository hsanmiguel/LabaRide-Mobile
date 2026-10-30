const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ageOnDate, riderDetailsSchema, requiredDocuments, requirementsMissing } = require('../dist/utils/rider-requirements');
test('age qualification uses Manila date and an exact 18th birthday', () => {
  assert.equal(ageOnDate('2008-10-24', new Date('2026-10-23T16:00:00Z')), 18);
  assert.equal(ageOnDate('2008-10-25', new Date('2026-10-23T16:00:00Z')), 17);
});
test('required documents exclude vaccination and add authorization for borrowed motorcycles', () => {
  assert.deepEqual(requiredDocuments(true), ['ApplicantPhoto', 'ProfessionalLicense', 'Clearance', 'TinProof', 'OfficialReceipt', 'RegistrationCertificate']);
  assert.ok(requiredDocuments(false).includes('OwnerAuthorization'));
});
test('completion distinguishes uploaded documents from admin-verified documents', () => {
  const profile = { licenseNumber: 'test', licenseExpiry: new Date('2099-01-01'), motorcycleMake: 'test', motorcycleModel: 'test', motorcycleYear: 2020, plateNumber: 'TEST', registeredOwner: true, user: { birthdate: new Date('1990-01-01'), address_line_1: 'test', city: 'test', state_province: 'test', postal_code: '4400' }, documents: requiredDocuments(true).map(type => ({ type, status: 'Pending' })) };
  assert.deepEqual(requirementsMissing(profile), []);
  assert.equal(requirementsMissing(profile, true).length, 6);
  assert.equal(requirementsMissing({ ...profile, registeredOwner: false }).length, 1);
  assert.ok(requirementsMissing({ ...profile, licenseExpiry: new Date('2000-01-01') }).includes('Valid professional license details'));
});
test('invalid calendar dates and expired professional licenses are rejected', () => {
  assert.equal(riderDetailsSchema.partial().safeParse({ birthdate: '2000-02-31' }).success, false);
  assert.equal(riderDetailsSchema.partial().safeParse({ licenseExpiry: '2000-01-01' }).success, false);
});
