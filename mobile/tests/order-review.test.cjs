const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../src/design', file), 'utf8');
  const output = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(output, output.exports);
  return output.exports;
}
const addressHelpers = load('address.ts');
const scheduleHelpers = load('schedule.ts');
const { orderPricing } = load('order-pricing.ts');
const screenSource = fs.readFileSync(path.join(__dirname, '../src/design/OrderScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('OrderScreens.tsx', screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['EmbeddedOrderPanel', 'LaundryCountDesign', 'OrderSummaryDesign', 'CheckoutDesign'];
const source = names.map(name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name).getText(ast)).join('\n');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
} }).outputText;

function elements(element, type) {
  if (Array.isArray(element)) return element.flatMap(item => elements(item, type));
  if (!React.isValidElement(element)) return [];
  return [...(element.type === type || element.type?.name === type ? [element] : []), ...elements(element.props.children, type)];
}

function harness({ guest = false, request, failure, saved = [] } = {}) {
  let index = 0;
  const hooks = [], calls = [], navigation = [], invalidations = [];
  const location = { address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur',
    postal_code: '4400', country: 'Philippines', address_type: 'Home', dropoff_instructions: 'Leave at the gate' };
  const profile = { id: 1, name: 'Test Customer', email: 'customer@example.invalid', phone: '09123456789', ...location };
  const service = { id: 9, serviceName: '8Kg Full Service', price: 215, packageKilos: 8 };
  const shop = { id: 5, shopName: 'Test Laundry', services: [service], kiloPrices: [], ...location };
  const draft = { shop, service, serviceIds: [9], deliveryType: 'Deliver', kilos: '8', notes: '',
    counts: {}, address: null, schedule: new Date(Date.now() + 6 * 3600000).toISOString(), paymentMethod: 'Cash on Delivery',
    set: value => Object.assign(draft, value) };
  const context = { exports: {}, React, ...addressHelpers, ...scheduleHelpers,
    address: addressHelpers.formatAddress,
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = { current: initial };
      return hooks[slot];
    },
    useLaundryDraft: () => draft, useAuthStore: selector => selector({ user: guest ? null : profile }),
    useProfile: () => ({ data: guest ? undefined : profile }), useQuery: () => ({ data: saved }),
    useFlowNavigation: () => ({ replaceFlow: (...args) => navigation.push(args) }),
    router: { push: (...args) => navigation.push(args), back: () => navigation.push(['back']) },
    useQueryClient: () => ({ invalidateQueries: async ({ queryKey }) => invalidations.push(queryKey[0]) }),
    draftTotals: () => orderPricing(draft.kilos, draft.service, draft.shop, draft.deliveryType, draft.serviceIds),
    api: {
      post: async (url, body) => { calls.push({ url, body }); if (request) await request; if (failure) throw failure; return { ...body, id: 77 }; },
      get: async () => ({ ...shop, services: [{ ...service, price: 300 }] }),
    },
    message: error => error.error?.message || error.message,
    servicePriceLabel: item => `${item.price} / load (up to ${item.packageKilos} kg)`, money: value => String(value),
    clothingNames: ['Shirts', 'Pants'], householdNames: ['Blankets'],
    palette: { navy: 'navy', surface: 'surface' }, styles: {},
  };
  for (const name of ['Screen', 'Button', 'View', 'FormError', 'Field', 'Txt', 'Card', 'Pressable', 'Asset',
    'Plus', 'Minus', 'Pencil', 'Section', 'Empty', 'QueryState', 'MenuRow', 'Modal', 'ScrollView', 'Choice', 'AddressFields', 'DeliveryDetails', 'ScheduleDesign', 'PriceRow', 'Totals']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.CheckoutDesign(); };
  const button = title => elements(render(), 'Button').find(item => item.props.title === title);
  const menu = title => elements(render(), 'MenuRow').find(item => item.props.title === title);
  const place = () => elements(render().props.footer, 'Button')[0].props.onPress();
  return { render, button, menu, place, draft, profile, context, calls, navigation, invalidations,
    error: () => elements(render().props.footer, 'FormError')[0].props.error };
}

test('summary is the checkout form with all booking details and a direct Place Order action', () => {
  const app = harness();
  assert.equal(app.context.exports.OrderSummaryDesign().type, app.context.exports.CheckoutDesign);
  assert.equal(app.render().props.title, 'Order Summary');
  assert.equal(elements(app.render().props.footer, 'Button')[0].props.title, 'Place Order');
  assert.equal(app.button('Proceed to checkout'), undefined);
  for (const title of ['Shop & Selected Services', 'Delivery or Pickup', 'Laundry Weight', 'Note to Laundry Shop', 'Payment Method', 'Fees & Total']) {
    assert.ok(elements(app.render(), 'Section').some(item => item.props.title === title), title);
  }
  assert.ok(app.menu('Delivery Schedule'));
  assert.ok(elements(app.render(), 'Field').some(item => item.props.label === 'Order Notes (optional)'));
});

test('address and laundry editors stay on the review page; the calendar expands inline', () => {
  const app = harness();
  app.menu('Delivery Address').props.onPress();
  let modal = elements(app.render(), 'Modal')[0];
  assert.equal(modal.props.visible, true);
  elements(modal, 'AddressFields')[0].props.setValues(current => ({ ...current, address_line_1: '99 New Street' }));
  app.button('Use This Address').props.onPress();
  assert.equal(app.draft.address.address_line_1, '99 New Street');
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  app.button('Add Types of Clothes').props.onPress();
  const items = elements(app.render(), 'LaundryCountDesign')[0];
  assert.equal(items.props.embedded, true);
  const editor = app.context.exports.LaundryCountDesign(items.props);
  elements(editor, 'Pressable').find(item => item.props.accessibilityLabel === 'Add Shirts').props.onPress();
  assert.equal(app.draft.counts.Shirts, 1);
  elements(editor.props.footer, 'Button')[0].props.onPress();
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  app.menu('Delivery Schedule').props.onPress();
  const calendar = elements(app.render(), 'ScheduleDesign')[0];
  assert.equal(calendar.props.embedded, true);
  calendar.props.onDone();
  assert.equal(elements(app.render(), 'ScheduleDesign').length, 0);
  assert.deepEqual(app.navigation, []);
});

test('Place Order submits every reviewed detail, creates one order and opens the confirmation', async () => {
  const app = harness();
  const notes = elements(app.render(), 'Field').find(item => item.props.label === 'Order Notes (optional)');
  notes.props.onChangeText('Fold separately');
  app.draft.set({ counts: { Shirts: 3, Blankets: 1 }, address: { ...app.profile, address_line_1: '99 New Street' } });
  await app.place();
  assert.equal(app.calls.length, 1);
  const { url, body } = app.calls[0];
  assert.equal(url, '/transactions');
  assert.equal(body.shopId, 5);
  assert.deepEqual(Array.from(body.serviceIds), [9]);
  assert.equal(body.kiloAmount, 8);
  assert.equal(body.subtotal, 215);
  assert.equal(body.deliveryFee, 30);
  assert.equal(body.totalAmount, 245);
  assert.equal(body.address_line_1, '99 New Street');
  assert.equal(body.dropoff_instructions, 'Leave at the gate');
  assert.equal(body.scheduledDate, app.draft.schedule);
  assert.equal(body.scheduledTime, app.draft.schedule);
  assert.equal(body.notes, 'Fold separately');
  assert.equal(body.paymentMethod, 'Cash on Delivery');
  assert.equal(JSON.stringify(body.items), JSON.stringify([{ itemName: 'Shirts', quantity: 3 }, { itemName: 'Blankets', quantity: 1 }]));
  assert.deepEqual(app.invalidations, ['user-orders']);
  assert.equal(app.navigation[0][0], 'order-complete');
  assert.equal(app.navigation[0][1].id, '77');
});

test('invalid weight, early Full Service schedules and incomplete addresses cannot place an order', async () => {
  for (const [patch, expected] of [
    [{ kilos: '' }, /weight/],
    [{ schedule: new Date(Date.now() + 3600000).toISOString() }, /at least 2 hours/],
    [{ address: { address_type: 'Home' } }, /required/],
  ]) {
    const app = harness();
    app.draft.set(patch);
    await app.place();
    assert.equal(app.calls.length, 0);
    assert.match(app.error(), expected);
  }
  const guest = harness({ guest: true });
  assert.equal(elements(guest.render().props.footer, 'Button')[0].props.title, 'Log In to Place Order');
  await guest.place();
  assert.equal(guest.calls.length, 0);
  assert.equal(guest.navigation[0][0], '/(auth)/login');
});

test('double-clicking Place Order sends one request; price changes require a fresh review', async () => {
  let release;
  const app = harness({ request: new Promise(resolve => { release = resolve; }) });
  const press = elements(app.render().props.footer, 'Button')[0].props.onPress;
  const first = press();
  const second = press();
  assert.equal(app.calls.length, 1);
  release();
  await Promise.all([first, second]);
  const changed = harness({ failure: { error: { code: 'PRICE_CHANGED', message: 'Price changed' } } });
  await changed.place();
  assert.equal(changed.calls.length, 1);
  assert.equal(changed.draft.service.price, 300);
  assert.match(changed.error(), /Review the updated total/);
  assert.deepEqual(changed.navigation, []);
});

test('pending editor changes must be confirmed before Place Order can submit', async () => {
  const app = harness();
  app.menu('Delivery Schedule').props.onPress();
  assert.equal(elements(app.render().props.footer, 'Button')[0].props.disabled, true);
  await app.place();
  assert.equal(app.calls.length, 0);
  assert.match(app.error(), /Finish editing/);
  elements(app.render(), 'ScheduleDesign')[0].props.onDone();
  assert.equal(elements(app.render().props.footer, 'Button')[0].props.disabled, false);
});
