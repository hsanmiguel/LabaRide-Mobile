const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), React = require('react');
function component(file, name, context) {
  const source = fs.readFileSync(path.join(__dirname, '../src/design', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
  vm.runInNewContext(ts.transpileModule(fn.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
  return context.exports[name];
}
function elements(node, type) {
  if (Array.isArray(node)) return node.flatMap(item => elements(item, type));
  if (!React.isValidElement(node)) return [];
  return [...(node.type === type ? [node] : []), ...elements(node.props.children, type)];
}
const names = { CustomerPickup: 'Received from customer', ShopDropoff: 'Handed over to shop', ShopCollection: 'Received from shop', CustomerDelivery: 'Handed over to customer' };
function ui(context) {
  for (const name of ['View', 'Card', 'Txt', 'Button', 'Field', 'Image', 'TabsRow', 'QueryState', 'SavedPhoto', 'Package', 'Clock3', 'TrendingUp', 'CheckCircle2']) context[name] = name;
  return { exports: {}, React, styles: {}, usePalette: () => ({}), ...context };
}
test('dashboard shows rider averages with sample counts and a seven-day chart on phone and desktop', () => {
  for (const width of [390, 1440]) {
    const data = { pickupEarnings: 150, returnEarnings: 250, completed: 8, failed: 2, completionRate: 80, active: 1, averagePickup: { minutes: 15, samples: 3 }, averageDelivery: { minutes: 20, samples: 5 },
      averageJobsPerDay: 0.3, averageKilosPerJob: 6, pickups: 3, deliveries: 5,
      week: Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-0${i + 1}`, label: 'Mon', completed: i })), recent: [] };
    const context = ui({ money: value => 'PHP ' + value.toFixed(2), useAuthStore: select => select({ user: { id: 7, isRider: true } }), useWindowDimensions: () => ({ width }),
      useQuery: options => { assert.equal(options.queryKey[2], 7); return { data }; }, minutes: value => value == null ? '—' : `${value.toFixed(1)} min` });
    const render = component('RiderPerformanceOverview.tsx', 'RiderPerformanceOverview', context);
    const tree = render(), text = elements(tree, 'Txt').map(item => item.props.children);
    for (const value of ['80%', '15.0 min', '20.0 min', 'Average pickup time', 'Average delivery time', 'PHP 150.00', 'PHP 250.00']) assert.ok(text.includes(value));
    assert.equal(elements(tree, 'View').filter(item => item.props.accessibilityLabel?.includes('completed jobs')).length, 7);
  }
});
test('rider can choose a photo, upload it to the exact assignment and refresh the private gallery', async () => {
  let index = 0; const hooks = [], writes = [], refreshed = [];
  const context = ui({ names, Platform: { OS: 'web' },
    useState(initial) { const slot = index++; if (!(slot in hooks)) hooks[slot] = initial; return [hooks[slot], update => { hooks[slot] = typeof update === 'function' ? update(hooks[slot]) : update; }]; },
    useRef(initial) { const slot = index++; if (!(slot in hooks)) hooks[slot] = { current: initial }; return hooks[slot]; },
    useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries: async data => refreshed.push(data) }),
    ImagePicker: { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'photo.jpg', base64: 'valid-image' }] }) },
    api: { put: async (...args) => writes.push(args) }, message: error => error.message,
  });
  const renderFn = component('HandoverPhotos.tsx', 'HandoverPhotos', context);
  const render = () => { index = 0; return renderFn({ orderId: 10, assignmentId: 4, stage: 'Pickup', canUpload: true }); };
  await elements(render(), 'Button').find(button => button.props.title === 'Choose laundry photo').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements(render(), 'Image').length, 1);
  elements(render(), 'TabsRow')[0].props.onChange('Handed over to shop');
  await elements(render(), 'Button').find(button => button.props.title === 'Save handover photo').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[0][0], '/delivery/assignments/4/photos'); assert.equal(writes[0][1].kind, 'ShopDropoff');
  assert.equal(writes[0][1].imageBase64, 'valid-image'); assert.equal(refreshed[0].queryKey[2], 10);
  assert.equal(elements(render(), 'Image').length, 0);
});
