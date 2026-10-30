const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/design/phone-call.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} }; vm.runInNewContext(code, context);
const { dialablePhone, openPhoneApp } = context.exports;
test('formatted phone numbers produce safe tel links without USSD or URL injection', async () => {
  assert.equal(dialablePhone(' 0912 345-6789 '), '09123456789');
  assert.equal(dialablePhone('+63 (912) 345-6789'), '+639123456789');
  assert.equal(dialablePhone('23423423'), '23423423');
  for (const value of ['abc', '', '123', '*123#', '09123456789;123', 'tel:09123456789', 'https://example.test']) assert.equal(dialablePhone(value), null);
  const urls = [];
  await openPhoneApp('0912 345-6789', async url => urls.push(url));
  assert.deepEqual(urls, ['tel:09123456789']);
});
test('failed dialer launch and invalid numbers are available for the contact fallback to handle', async () => {
  await assert.rejects(openPhoneApp('09123456789', async () => { throw new Error('No phone app'); }), /No phone app/);
  let opened = false;
  await assert.rejects(openPhoneApp('*123#', async () => { opened = true; }), /valid phone number/);
  assert.equal(opened, false);
});
