const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../src/design', file), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(module, module.exports);
  return module.exports;
}
const source = fs.readFileSync(path.join(__dirname, '../src/design/ShopScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('ShopScreens.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'ShopDetailsFormDesign');
const compiled = ts.transpileModule(screen.getText(ast), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
} }).outputText;
function elements(element, type) {
  if (Array.isArray(element)) return element.flatMap(item => elements(item, type));
  if (!React.isValidElement(element)) return [];
  return [...(element.type === type ? [element] : []), ...elements(element.props.children, type)];
}
function harness(status = 'Approved') {
  let index = 0;
  const hooks = [], calls = [], navigation = [], authChanges = [], invalidations = [];
  const shop = { id: 5, shopName: 'Test Laundry', contactNumber: '09123456789', openingTime: '08:00', closingTime: '18:00',
    address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Work',
    approvalStatus: 'Approved', latitude: 13.62, longitude: 123.19 };
  const context = { exports: {}, React, ...load('address.ts'), ...load('service-area.ts'), ...load('form-values.ts'),
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useRef(initial) { const slot = index++; if (!(slot in hooks)) hooks[slot] = { current: initial }; return hooks[slot]; },
    useEffect: effect => effect(),
    useOwnedShop: () => ({ data: shop }),
    useQueryClient: () => ({ invalidateQueries: async ({ queryKey }) => invalidations.push(queryKey[0]) }),
    api: { put: async (url, body) => { calls.push({ url, body }); return { ...shop, ...body, approvalStatus: status }; } },
    useAuthStore: { getState: () => ({ user: { id: 1, isShopOwner: true }, token: 'token', setAuth: async user => authChanges.push(user) }) },
    router: { replace: target => navigation.push(target) }, message: error => error.message, styles: {},
    usePalette: () => ({ navy: 'navy', primary: 'blue' }),
  };
  for (const name of ['Screen', 'View', 'Button', 'Txt', 'FormError', 'QueryState', 'ShopPhotoEditor', 'Card', 'Field', 'Section', 'PickerField', 'AddressFields', 'Choice']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.ShopDetailsFormDesign(); };
  render();
  const field = label => elements(render(), 'Field').find(item => item.props.label === label);
  const save = () => elements(render().props.footer, 'Button')[0].props.onPress();
  return { render, field, save, calls, navigation, authChanges, invalidations };
}
test('routine shop edits keep the owner on the form and retain shop mode after saving', async () => {
  const app = harness();
  app.field('Contact Number *').props.onChangeText('09999999999');
  app.field('Delivery maximum distance (km)').props.onChangeText('10');
  await app.save();
  assert.equal(app.calls[0].body.contactNumber, '09999999999');
  assert.equal(app.calls[0].body.deliveryMaxKm, 10);
  assert.deepEqual(app.authChanges, []);
  assert.deepEqual(app.navigation, []);
  assert.deepEqual(app.invalidations, ['shop', 'shops']);
  assert.ok(elements(app.render().props.footer, 'Txt').some(item => /remains approved/.test(item.props.children)));
});
test('identity edits that return pending approval pause shop mode and open the application page', async () => {
  const app = harness('Pending');
  app.field('Shop Name *').props.onChangeText('New Shop Name');
  await app.save();
  assert.equal(app.authChanges[0].isShopOwner, false);
  assert.equal(app.navigation[0].params.flow, 'register-shop');
});
