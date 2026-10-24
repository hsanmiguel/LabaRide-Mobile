const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/design/riderTrackingMapHtml.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleContext = { exports: {} }; vm.runInNewContext(code, moduleContext);
const { riderTrackingMapHtml } = moduleContext.exports;
test('tracking map updates genuine reported coordinates in srcdoc without resetting the map on every reading', () => {
  let listener, fitted = 0;
  const parent = { location: { origin: 'https://labaride.test' } };
  const elements = Object.fromEntries(['status', 'recenter', 'map'].map(id => [id, { style: {} }]));
  const context = { parent, location: { origin: 'null' }, document: { getElementById: id => elements[id], createElement: () => ({}), head: { appendChild: node => node.onload() } }, setTimeout: callback => callback(),
    L: { map: () => ({ setView() { return this; }, fitBounds() { fitted++; }, invalidateSize() {}, removeLayer() {} }), tileLayer: () => ({ addTo() { return this; }, on() {} }), divIcon: options => options,
      marker: position => ({ position, addTo() { return this; }, setLatLng(position) { this.position = position; return this; }, setIcon() { return this; }, bindTooltip() { return this; }, getLatLng() { return this.position; } }) },
  };
  context.window = context; context.addEventListener = (name, callback) => { listener = callback; };
  vm.runInNewContext(riderTrackingMapHtml('public-test-token').match(/<script>([\s\S]*)<\/script>/)[1], context);
  const send = payload => listener({ source: parent, origin: parent.location.origin, data: { type: 'labaride-tracking', payload } });
  send({ rider: { latitude: 0, longitude: 0 }, customer: { latitude: 1, longitude: 1 }, shop: null, stale: false });
  assert.equal(context.markers.rider.getLatLng()[0], 0);
  const before = fitted;
  send({ rider: { latitude: 0.5, longitude: 0.5 }, customer: { latitude: 1, longitude: 1 }, shop: null, stale: false });
  assert.equal(context.markers.rider.getLatLng()[0], 0.5); assert.equal(fitted, before);
  listener({ source: {}, origin: parent.location.origin, data: { type: 'labaride-tracking', payload: { rider: { latitude: 5, longitude: 5 } } } });
  assert.equal(context.markers.rider.getLatLng()[0], 0.5);
  listener({ source: parent, origin: 'https://untrusted.test', data: { type: 'labaride-tracking', payload: {} } });
  assert.ok(context.markers.rider);
  send({ rider: null, customer: { latitude: 1, longitude: 1 }, shop: null, stale: false });
  assert.equal(context.markers.rider, undefined);
});
test('map configuration cannot inject closing HTML/script tags into the embedded script', () => {
  const html = riderTrackingMapHtml('</script><script>unexpected()</script>');
  assert.equal(html.includes('</script><script>unexpected()'), false);
});
