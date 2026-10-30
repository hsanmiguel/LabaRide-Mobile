const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const colorsModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/design/service-colors.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(colorsModule, colorsModule.exports);

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
  const service = { id: 9, serviceName: 'Full service', price: '215', packageKilos: '8', washingMinutes: 30, dryingMinutes: 45, color: '#98D8BF' };
  const shop = { id: 5, services: services || [service], kiloPrices: [] };
  const result = { data: shop, isLoading: false, error: null, refetch() {} };
  const request = method => async (url, body) => { calls.push({ method, url, body }); if (failure) throw failure; };
  const context = { exports: {}, React,
    ...colorsModule.exports,
    serviceCardColors: colorsModule.exports.serviceCardColors,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), Platform: { OS: 'web' },
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = { current: initial };
      return hooks[slot];
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
    'Plus', 'Pencil', 'Trash2', 'Check', 'X', 'WeightRangeSlider', 'KeyboardAvoidingView', 'QueryState', 'Section', 'Empty', 'MenuRow', 'Modal', 'ScrollView', 'Choice']) context[name] = name;
  context.usePalette = () => context.palette;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.ServicesDesign(); };
  const dialog = () => elements(render(), 'Modal')[0];
  const button = (title, position = 0) => [...elements(render(), 'Button').filter(item => item.props.title === title),
    ...elements(render(), 'Pressable').filter(item => item.props.accessibilityLabel === title)][position];
  const field = label => elements(dialog(), 'Field').find(item => item.props.label === label);
  return { render, dialog, button, field, calls, invalidations, confirmations };
}

test('add and edit modals show kg units and editing saves service weight and price', async () => {
  const app = harness();
  app.render().props.right.props.onPress();
  assert.equal(app.field('Weight per load').props.suffix, 'kg');
  app.button('Cancel').props.onPress();
  app.button('Edit').props.onPress();
  assert.equal(app.dialog().props.visible, true);
  assert.equal(app.field('Weight per load').props.value, '8');
  assert.equal(app.field('Weight per load').props.suffix, 'kg');
  assert.equal(app.field('Standard washing time').props.value, '30');
  assert.equal(app.field('Standard drying time').props.value, '45');
  app.field('Weight per load').props.onChangeText('10');
  app.field('Price per load').props.onChangeText('250');
  await app.button('Save Changes').props.onPress();
  assert.equal(app.calls[0].method, 'PUT');
  assert.equal(app.calls[0].url, '/shops/5/services/9');
  assert.equal(app.calls[0].body.packageKilos, 10);
  assert.equal(app.calls[0].body.price, 250);
  assert.equal(app.calls[0].body.washingMinutes, 30);
  assert.equal(app.calls[0].body.dryingMinutes, 45);
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
    { id: 11, serviceName: 'Wash Only', price: '35', packageKilos: null, washingMinutes: 25, dryingMinutes: 40 },
    { id: 12, serviceName: 'Dry Only', price: '85', packageKilos: '5', washingMinutes: 30, dryingMinutes: 45 },
    { id: 13, serviceName: 'Full Service', price: '215', packageKilos: '8', washingMinutes: 35, dryingMinutes: 50 },
  ];
  for (const [index, service] of services.entries()) {
    const edit = harness({ services });
    edit.button('Edit', index).props.onPress();
    assert.equal(edit.field('Service Name').props.value, service.serviceName);
    const price = edit.field(service.packageKilos === null ? 'Price per kilogram' : 'Price per load');
    assert.equal(price.props.suffix, '₱');
    if (service.packageKilos !== null) assert.equal(edit.field('Weight per load').props.value, service.packageKilos);
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

test('price range fields reject text, signs, scientific notation and multiple decimal points', () => {
  const app = harness();
  app.button('Add Price Range').props.onPress();
  for (const label of ['Price per Kilogram']) {
    for (const input of ['letters', '-5', '+2', '1e3', '1.2.3']) {
      app.field(label).props.onChangeText(input);
      assert.equal(app.field(label).props.value, '');
    }
    app.field(label).props.onChangeText('25.50');
    assert.equal(app.field(label).props.value, '25.50');
    app.field(label).props.onChangeText('25.50abc');
    assert.equal(app.field(label).props.value, '25.50');
    app.field(label).props.onChangeText('');
    assert.equal(app.field(label).props.value, '');
  }
});

test('standard washing and drying times accept whole minutes only', () => {
  const app = harness();
  app.button('Edit').props.onPress();
  for (const label of ['Standard washing time', 'Standard drying time']) {
    const field = app.field(label);
    const original = field.props.value;
    for (const input of ['letters', '-5', '1.5', '1e3']) {
      field.props.onChangeText(input);
      assert.equal(app.field(label).props.value, original);
    }
    field.props.onChangeText('60');
    assert.equal(app.field(label).props.value, '60');
  }
});

test('new price ranges start at 1–12 kg and submit the slider selection', async () => {
  const app = harness();
  app.button('Add Price Range').props.onPress();
  const slider = elements(app.dialog(), 'WeightRangeSlider')[0];
  assert.equal(slider.props.minimum, 1);
  assert.equal(slider.props.maximum, 12);
  slider.props.onChange(3, 8);
  app.field('Price per Kilogram').props.onChangeText('25.50');
  await app.button('Add Range').props.onPress();
  assert.equal(app.calls[0].url, '/shops/5/kilo-prices');
  assert.equal(app.calls[0].body.minKilo, 3);
  assert.equal(app.calls[0].body.maxKilo, 8);
  assert.equal(app.calls[0].body.pricePerKilo, 25.5);
});

test('dark and medium service colors use white headings while pale backgrounds use dark text', () => {
  const { serviceCardColors } = colorsModule.exports;
  for (const color of ['#321078', '#6842D9', '#886AB8']) assert.equal(serviceCardColors(color).foreground, '#FFFFFF');
  assert.equal(serviceCardColors('#D0C1E8').foreground, '#202033');
});

test('used colors are unavailable except for the service being edited', () => {
  const { serviceColorOptions, serviceColorTaken } = colorsModule.exports;
  const services = [{ id: 1, serviceName: 'Wash', price: 25, color: '#321078' }];
  assert.equal(serviceColorTaken(services, '#321078'), true);
  assert.equal(serviceColorTaken(services, '#321078', 1), false);
  assert.equal(serviceColorTaken([{ id: 1, color: '#abc' }], '#AABBCC'), true);
  const app = harness({ services });
  app.render().props.right.props.onPress();
  const used = elements(app.dialog(), 'Pressable').find(item => item.props.accessibilityLabel === 'Service color #321078');
  assert.equal(used.props.disabled, true);
  const selected = elements(app.dialog(), 'Pressable').find(item => item.props.accessibilityState?.selected);
  assert.equal(selected.props.accessibilityLabel, 'Service color #6842D9');
  assert.equal(serviceColorOptions.length, 8);
  assert.equal(serviceColorOptions.some(option => option.color === '#AA5042'), false);
  const full = harness({ services: serviceColorOptions.map((option, index) => ({ id: index + 1, serviceName: 'Service ' + index, price: 25, color: option.color })) });
  full.render().props.right.props.onPress();
  assert.equal(full.button('Add Service').props.disabled, true);
});
