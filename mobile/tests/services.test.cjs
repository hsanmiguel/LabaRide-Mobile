const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const source = fs.readFileSync(path.join(__dirname, '../src/design/ShopScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('ShopScreens.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'ServicesDesign');
const compiled = ts.transpileModule(screen.getText(ast), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
} }).outputText;

function elements(element, type) {
  if (Array.isArray(element)) return element.flatMap(item => elements(item, type));
  if (!React.isValidElement(element)) return [];
  return [...(element.type === type ? [element] : []), ...elements(element.props.children, type)];
}

function harness({ confirmed = true, failure, services } = {}) {
  let index = 0;
  const hooks = [], calls = [], invalidations = [], confirmations = [];
  const service = { id: 9, serviceName: 'Full service', price: '215', packageKilos: '8', color: '#98D8BF' };
  const shop = { id: 5, services: services || [service], kiloPrices: [] };
  const result = { data: shop, isLoading: false, error: null, refetch() {} };
  const request = method => async (url, body) => { calls.push({ method, url, body }); if (failure) throw failure; };
  const context = { exports: {}, React,
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useOwnedShop: () => result, useShop: () => result,
    useQueryClient: () => ({ invalidateQueries: async ({ queryKey }) => invalidations.push(queryKey[0]) }),
    api: { post: request('POST'), put: request('PUT'), delete: request('DELETE') },
    confirmAction: async (...args) => { confirmations.push(args); return confirmed; },
    message: error => error.message, unavailable: () => assert.fail('Service action must be implemented'),
    Alert: { alert: () => assert.fail('Service actions use browser-compatible confirmation') },
    servicePriceLabel: () => '215 / load (up to 8 kg)', money: value => String(value),
    palette: { navy: 'navy', danger: 'red' }, styles: { stack: {}, row: {}, grow: {} },
  };
  for (const name of ['Screen', 'Button', 'View', 'FormError', 'Field', 'Txt', 'Card', 'Pressable',
    'Plus', 'Pencil', 'Trash2', 'QueryState', 'Section', 'Empty', 'MenuRow', 'Modal', 'ScrollView', 'Choice']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.ServicesDesign(); };
  const dialog = () => elements(render(), 'Modal')[0];
  const button = (title, position = 0) => elements(render(), 'Button').filter(item => item.props.title === title)[position];
  const field = label => elements(dialog(), 'Field').find(item => item.props.label === label);
  return { render, dialog, button, field, calls, invalidations, confirmations };
}

test('add and edit modals show kg units and editing saves service weight and price', async () => {
  const app = harness();
  app.render().props.right.props.onPress();
  assert.equal(app.field('Weight per Load (kg)').props.suffix, 'kg');
  app.button('Cancel').props.onPress();
  app.button('Edit').props.onPress();
  assert.equal(app.dialog().props.visible, true);
  assert.equal(app.field('Weight per Load (kg)').props.value, '8');
  assert.equal(app.field('Weight per Load (kg)').props.suffix, 'kg');
  app.field('Weight per Load (kg)').props.onChangeText('10');
  app.field('Price per Load').props.onChangeText('250');
  await app.button('Save Changes').props.onPress();
  assert.equal(app.calls[0].method, 'PUT');
  assert.equal(app.calls[0].url, '/shops/5/services/9');
  assert.equal(app.calls[0].body.packageKilos, 10);
  assert.equal(app.calls[0].body.price, 250);
  assert.equal(app.dialog().props.visible, false);
  assert.deepEqual(app.invalidations.sort(), ['shop', 'shops']);
});

test('delete confirms the selected service, calls the API and refreshes both shop lists', async () => {
  const app = harness();
  await app.button('Delete').props.onPress();
  assert.match(app.confirmations[0][1], /Full service/);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].method, 'DELETE');
  assert.equal(app.calls[0].url, '/shops/5/services/9');
  assert.equal(app.dialog().props.visible, false, 'Delete must not accidentally open Edit');
  assert.deepEqual(app.invalidations.sort(), ['shop', 'shops']);
});

test('cancelling deletion sends no request; API errors remain visible', async () => {
  const cancelled = harness({ confirmed: false });
  await cancelled.button('Delete').props.onPress();
  assert.equal(cancelled.calls.length, 0);
  assert.equal(cancelled.button('Delete').props.disabled, false);
  const failed = harness({ failure: { message: 'Could not delete service' } });
  await failed.button('Delete').props.onPress();
  assert.ok(elements(failed.render(), 'FormError').some(item => item.props.error === 'Could not delete service'));
  assert.equal(failed.button('Delete').props.disabled, false);
});

test('each package and kilogram service edits and deletes its own record', async () => {
  const services = [
    { id: 11, serviceName: 'Wash Only', price: '35', packageKilos: null },
    { id: 12, serviceName: 'Dry Only', price: '85', packageKilos: '5' },
    { id: 13, serviceName: 'Full Service', price: '215', packageKilos: '8' },
  ];
  for (const [index, service] of services.entries()) {
    const edit = harness({ services });
    edit.button('Edit', index).props.onPress();
    assert.equal(edit.field('Service Name').props.value, service.serviceName);
    const price = edit.field(service.packageKilos === null ? 'Price per Kilogram' : 'Price per Load');
    assert.equal(price.props.suffix, service.packageKilos === null ? 'PHP / kg' : 'PHP / load');
    if (service.packageKilos !== null) assert.equal(edit.field('Weight per Load (kg)').props.value, service.packageKilos);
    price.props.onChangeText('100');
    await edit.button('Save Changes').props.onPress();
    assert.equal(edit.calls[0].url, `/shops/5/services/${service.id}`);
    assert.equal(edit.calls[0].body.price, 100);
    assert.equal(edit.calls[0].body.packageKilos, service.packageKilos === null ? null : Number(service.packageKilos));
    const remove = harness({ services });
    await remove.button('Delete', index).props.onPress();
    assert.equal(remove.calls[0].url, `/shops/5/services/${service.id}`);
    assert.ok(remove.confirmations[0][1].includes(service.serviceName));
  }
});
