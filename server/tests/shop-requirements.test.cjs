const assert = require('node:assert/strict');
const { test } = require('node:test');
const { shopRequirementsMissing } = require('../dist/utils/shop-requirements');
test('one verified DTI or SEC registration plus TIN and Mayor’s Permit is required', () => {
  assert.deepEqual(shopRequirementsMissing([]), ['DTI or SEC registration', 'TIN proof', 'Mayor’s Permit']);
  for (const registration of ['DTIRegistration', 'SECRegistration']) {
    const documents = [registration, 'TinProof', 'MayorsPermit'].map(type => ({ type, status: 'Verified' }));
    assert.deepEqual(shopRequirementsMissing(documents), []);
    documents[1].status = 'Pending'; assert.deepEqual(shopRequirementsMissing(documents), ['TIN proof']);
    assert.deepEqual(shopRequirementsMissing(documents, false), []);
    documents[0].status = 'Rejected'; assert.deepEqual(shopRequirementsMissing(documents), ['DTI or SEC registration', 'TIN proof']);
  }
});
