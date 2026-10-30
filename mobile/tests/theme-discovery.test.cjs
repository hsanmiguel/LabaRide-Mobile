const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file) {
  const filename = path.resolve(__dirname, '../src/design', file);
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => name === './theme-tokens' ? load('theme-tokens.ts') : require(name) });
  return exports;
}
const { themes, rolePalette, interfaceRole } = load('theme-tokens.ts');
const { InterfaceTheme, usePalette } = load('theme.tsx');
const { coordinates, nearestShops } = load('discovery.ts');
const { addressValues, addressPayload } = load('address.ts');

test('role is determined by the active layout, including shared flows and mode switches', () => {
  for (const page of ['home', 'services', 'profile', 'customers']) {
    assert.equal(interfaceRole(['shop', page, '[flow]']), 'shop');
  }
  assert.equal(interfaceRole(['(user)', 'shops', '[id]']), 'customer');
  assert.equal(interfaceRole(['(flows)', '[flow]']), 'customer');
  assert.equal(interfaceRole(['admin', 'index']), 'admin');
  assert.equal(rolePalette(interfaceRole(['admin', 'index'])).primary, '#0F4766');
  assert.equal(rolePalette(interfaceRole(['shop', 'profile'])).primary, '#321078');
  assert.equal(rolePalette(interfaceRole(['(user)', 'profile'])).primary, '#2457AD');
});
test('shared components resolve the nearest provider without leaking across sibling interfaces', () => {
  function Probe() { const palette = usePalette(); return React.createElement('span', { style: { color: palette.primary } }, palette.role); }
  const result = renderToStaticMarkup(React.createElement(InterfaceTheme, { role: 'customer' },
    React.createElement(Probe), React.createElement(InterfaceTheme, { role: 'shop' }, React.createElement(Probe)), React.createElement(Probe)));
  assert.equal(result, '<span style="color:#2457AD">customer</span><span style="color:#321078">shop</span><span style="color:#2457AD">customer</span>');
});
function luminance(hex) {
  return hex.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i],0);
}
function contrast(a,b) { const values = [luminance(a), luminance(b)].sort((a,b) => b-a); return (values[0]+.05)/(values[1]+.05); }
for (const [role, theme] of Object.entries(themes)) test(`${role} text, primary buttons and status labels meet WCAG AA contrast`, () => {
  for (const surface of ['#FFFFFF',theme.surface,theme.soft]) for (const foreground of [theme.ink,theme.muted,theme.primary,theme.warning,theme.danger]) {
    assert.ok(contrast(foreground,surface) >= 4.5, `${foreground} on ${surface}`);
  }
  for (const background of [theme.primary,theme.hover,theme.success,theme.danger]) assert.ok(contrast('#FFFFFF', background) >= 4.5, background);
  for (const foreground of [theme.primary,theme.warning,theme.successInk,theme.danger]) {
    const tint = '#' + foreground.slice(1).match(/../g).map(v => Math.round(parseInt(v,16) * (24/255) + 255 * (1-24/255)).toString(16).padStart(2,'0')).join('');
    assert.ok(contrast(foreground,tint) >= 4.5, `${foreground} status text on ${tint}`);
  }
});
test('nearby discovery sorts real coordinates, accepts zero, and excludes missing or invalid locations', () => {
  const shops = [{ id: 1, latitude: 0, longitude: 2 }, { id: 2, latitude: 0, longitude: 1 }, { id: 3 },
    { id: 4, latitude: 95, longitude: 0 }, { id: 5, latitude: '', longitude: '' }];
  const ranked = nearestShops(shops, { latitude: 0, longitude: 0 });
  assert.equal(ranked.map(item => item.shop.id).join(','), '2,1');
  assert.ok(Math.abs(ranked[0].distance - 111.195) < .01);
  assert.equal(nearestShops(shops, null).length, 0);
  assert.equal(coordinates({ latitude: 'invalid', longitude: 0 }), null);
});
test('address forms retain coordinates through edit and submit without inventing a pin', () => {
  const value = { latitude: 0, longitude: 123.2, address_type: 'Home' };
  const saved = addressPayload(addressValues(value));
  assert.equal(saved.latitude, 0); assert.equal(saved.longitude,123.2);
  assert.equal('latitude' in addressPayload(addressValues(null)), false);
});
