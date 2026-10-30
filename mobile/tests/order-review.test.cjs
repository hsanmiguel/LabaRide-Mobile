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
function deliveryLoad(file) {
 const module = { exports: {} };
 const source = fs.readFileSync(path.join(__dirname, '../src/design', file), 'utf8');
 new Function('module','exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports,name=>load(name.slice(2)+'.ts'));
 return module.exports;
}
const slotsHelpers = deliveryLoad('delivery-slots.ts');
const { orderPricing } = load('order-pricing.ts');
const areaHelpers = load('service-area.ts');
const hoursHelpers = load('shop-hours.ts');
const screenSource = fs.readFileSync(path.join(__dirname, '../src/design/OrderScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('OrderScreens.tsx', screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['OrderSummaryDesign', 'CheckoutDesign'];
const source = names.map(name => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name).getText(ast)).join('\n');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
} }).outputText;

function elements(element, type) {
  if (Array.isArray(element)) return element.flatMap(item => elements(item, type));
  if (!React.isValidElement(element)) return [];
  return [...(element.type === type || element.type?.name === type ? [element] : []), ...elements(element.props.children, type)];
}

function harness({ guest = false, request, failure, saved = [], storageFailure, clock = Date.parse('2026-10-22T02:00:00Z') } = {}) {
  let index = 0;
  const hooks = [], calls = [], navigation = [], invalidations = [];
  const addressWrites = [];
  let storedAddresses = [...saved];
  let now = clock, timerId = 0, blur;
  const timers = new Map();
  const scheduleTimer = (callback, delay, repeat = false) => {
    const id = ++timerId;
    timers.set(id, { callback, due: now + delay, delay, repeat });
    return id;
  };
  const advance = async milliseconds => {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.due;
      if (timer.repeat) timer.due += timer.delay;
      else timers.delete(id);
      await timer.callback();
    }
    now = end;
    await new Promise(resolve => setImmediate(resolve));
  };
  const location = { address_line_1: '12 Main Street', city: 'Naga', state_province: 'Camarines Sur',
    postal_code: '4400', country: 'Philippines', address_type: 'Home', dropoff_instructions: 'Leave at the gate' };
  const profile = { id: 1, name: 'Test Customer', email: 'customer@example.invalid', phone: '09123456789', ...location };
  const service = { id: 9, serviceName: '8Kg Full Service', price: 215, packageKilos: 8 };
  const shop = { id: 5, shopName: 'Test Laundry', openingTime: '08:00', closingTime: '18:00', services: [service], kiloPrices: [], ...location };
  const draft = { shop, service, serviceIds: [9], deliveryType: 'Deliver', kilos: '8', notes: '',
    counts: {}, address: null, requestedPickupAt: '2026-10-22T04:00:00.000Z', schedule: new Date(Date.now() + 6 * 3600000).toISOString(), paymentMethod: 'Cash on Delivery',
    clearOrder: () => { draft.cleared = true; },
    set: value => Object.assign(draft, value) };
  const context = { exports: {}, React, ...addressHelpers, ...scheduleHelpers, ...slotsHelpers, ...areaHelpers,
    shopAvailability: shop => hoursHelpers.shopAvailability(shop, now),
    useShopAvailability: shop => hoursHelpers.shopAvailability(shop, now),
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => scheduleTimer(callback, delay),
    setInterval: (callback, delay) => scheduleTimer(callback, delay, true),
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    useCallback: callback => callback, useFocusEffect: effect => { blur = effect(); },
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
    useProfile: () => ({ data: guest ? undefined : profile }), useQuery: () => ({ data: storedAddresses }),
    AsyncStorage: {
      getItem: async key => { assert.equal(key, 'labaride-addresses:1'); return JSON.stringify(storedAddresses); },
      setItem: async (key, value) => {
        if (storageFailure) throw storageFailure;
        addressWrites.push({ key, value }); storedAddresses = JSON.parse(value);
      },
    },
    useFlowNavigation: () => ({ replaceFlow: (...args) => navigation.push(args), go: (...args) => navigation.push(args) }),
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
    'Plus', 'Minus', 'Pencil', 'ChevronDown', 'CheckCircle2', 'Clock', 'Section', 'Empty', 'QueryState', 'MenuRow', 'Modal', 'ScrollView', 'Choice', 'PaymentDropdown', 'AddressFields', 'DeliveryDetails', 'ScheduleDesign', 'PriceRow', 'Totals']) context[name] = name;
  context.usePalette = () => context.palette;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.CheckoutDesign(); };
  const button = title => elements(render(), 'Button').find(item => item.props.title === title);
  const menu = title => elements(render(), 'MenuRow').find(item => item.props.title === title);
  const place = () => elements(render().props.footer, 'Button')[0].props.onPress();
  return { render, button, menu, place, draft, profile, context, calls, navigation, invalidations, addressWrites, advance, leave: () => blur?.(),
    error: () => elements(render().props.footer, 'FormError')[0].props.error };
}

test('summary is the checkout form with all booking details and a direct Place Order action', () => {
  const app = harness();
  assert.equal(app.context.exports.OrderSummaryDesign().type, app.context.exports.CheckoutDesign);
  assert.equal(app.render().props.title, 'Order Summary');
  assert.equal(elements(app.render().props.footer, 'Button')[0].props.title, 'Place Order');
  assert.equal(app.button('Proceed to checkout'), undefined);
  for (const title of ['Shop & Selected Services', 'Pickup & Delivery Options', 'Laundry Weight', 'Note to Laundry Shop', 'Payment Method', 'Fees & Total']) {
    assert.ok(elements(app.render(), 'Section').some(item => item.props.title === title), title);
  }
  assert.ok(elements(app.render(), 'Section').some(item => item.props.title === 'Turnaround & Updates'));
  assert.ok(elements(app.render(), 'Field').some(item => item.props.label === 'Order Notes (optional)'));
  assert.equal(app.button('Add Types of Clothes'), undefined);
  assert.equal(elements(app.render(), 'Txt').some(item => item.props.children === 'Laundry Items'), false);
});

test('address and schedule editors open in a modal on the review page', () => {
  const app = harness();
  app.menu('Customer address').props.onPress();
  let modal = elements(app.render(), 'Modal')[0];
  assert.equal(modal.props.visible, true);
  assert.equal(elements(modal, 'AddressFields').length, 0);
  elements(modal, 'Pressable').find(item => item.props.accessibilityLabel === 'Primary address').props.onPress();
  assert.equal(app.draft.address, null);
  assert.equal(app.menu('Customer address').props.detail, addressHelpers.formatAddress(app.profile));
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  app.draft.set({ collectionMethod: 'ShopPickup' });
  app.menu('Requested laundry pickup').props.onPress();
  modal = elements(app.render(), 'Modal')[0];
  assert.equal(modal.props.visible, true);
  const calendar = elements(modal, 'ScheduleDesign')[0];
  assert.equal(calendar.props.embedded, true);
  assert.equal(calendar.props.inDialog, true);
  calendar.props.onDone();
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  assert.equal(elements(app.render(), 'ScheduleDesign').length, 0);
  assert.deepEqual(app.navigation, []);
});

test('closing the schedule popup preserves the previous schedule', () => {
  const app = harness();
  const previous = app.draft.schedule;
  app.draft.set({ collectionMethod: 'ShopPickup' });
  app.menu('Requested laundry pickup').props.onPress();
  elements(app.render(), 'ScheduleDesign')[0].props.onClose();
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  assert.equal(app.draft.schedule, previous);
  assert.deepEqual(app.navigation, []);
});

test('Place Order submits every reviewed detail, creates one order and opens the confirmation', async () => {
  const app = harness();
  const notes = elements(app.render(), 'Field').find(item => item.props.label === 'Order Notes (optional)');
  notes.props.onChangeText('Fold separately');
  app.draft.set({ counts: { Shirts: 3, Blankets: 1 }, address: { ...app.profile, address_line_1: '99 New Street' } });
  await app.place();
  assert.equal(app.calls.length, 0);
  await app.advance(4999);
  assert.equal(app.calls.length, 0);
  await app.advance(1);
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
  assert.equal(body.scheduledDate, undefined);
  assert.equal(body.scheduledTime, undefined);
  assert.equal(body.notes, 'Fold separately');
  assert.equal(body.paymentMethod, 'Cash on Delivery');
  assert.equal(body.items, undefined);
  assert.deepEqual(app.invalidations, ['user-orders']);
  assert.equal(app.draft.cleared, true);
  assert.equal(app.navigation[0][0], 'order-complete');
  assert.equal(app.navigation[0][1].id, '77');
});

test('invalid weight, missing pickup request and incomplete addresses cannot place an order', async () => {
  for (const [patch, expected] of [
    [{ kilos: '' }, /weight/],
    [{ collectionMethod: 'ShopPickup', requestedPickupAt: '' }, /requested laundry pickup/],
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
  assert.equal(app.calls.length, 0);
  await app.advance(5000);
  assert.equal(app.calls.length, 1);
  release();
  await Promise.all([first, second]);
  const changed = harness({ failure: { error: { code: 'PRICE_CHANGED', message: 'Price changed' } } });
  await changed.place();
  await changed.advance(5000);
  assert.equal(changed.calls.length, 1);
  assert.equal(changed.draft.service.price, 300);
  assert.equal(changed.draft.cleared, undefined);
  assert.match(changed.error(), /Review the updated total/);
  assert.deepEqual(changed.navigation, []);
});

test('Modify order cancels submission, preserves details and allows a new five-second countdown', async () => {
  const app = harness();
  app.draft.set({ notes: 'Keep my notes', counts: { Shirts: 2 } });
  await app.place();
  assert.equal(elements(app.render(), 'Modal')[1].props.visible, true);
  await app.advance(2000);
  assert.ok(elements(app.render(), 'Txt').some(item => item.props.children === 3));
  app.button('Modify order').props.onPress();
  assert.equal(elements(app.render(), 'Modal')[1].props.visible, false);
  await app.advance(10000);
  assert.equal(app.calls.length, 0);
  assert.equal(app.draft.notes, 'Keep my notes');
  assert.equal(app.draft.counts.Shirts, 2);
  app.draft.set({ notes: 'Updated notes' });
  await app.place();
  await app.advance(5000);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].body.notes, 'Updated notes');
});

test('closing the countdown or leaving checkout prevents an order from being sent', async () => {
  for (const leave of [false, true]) {
    const app = harness();
    await app.place();
    await app.advance(4000);
    if (leave) app.leave();
    else elements(app.render(), 'Modal')[1].props.onRequestClose();
    await app.advance(10000);
    assert.equal(app.calls.length, 0);
    assert.equal(app.navigation.length, 0);
  }
});

test('pending editor changes must be confirmed before Place Order can submit', async () => {
  const app = harness();
  app.draft.set({ collectionMethod: 'ShopPickup' });
  app.menu('Requested laundry pickup').props.onPress();
  assert.equal(elements(app.render().props.footer, 'Button')[0].props.disabled, true);
  await app.place();
  assert.equal(app.calls.length, 0);
  assert.match(app.error(), /Finish editing/);
  elements(app.render(), 'ScheduleDesign')[0].props.onDone();
  assert.equal(elements(app.render().props.footer, 'Button')[0].props.disabled, false);
});

test('pickup hides scheduling and submits without a chosen date or time', async () => {
  for (const schedule of ['', '2020-01-01T00:00:00.000Z']) {
    const app = harness();
    app.draft.set({ schedule });
    elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Laundry transport').props.onPress();
    elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === "I'll handle both trips").props.onPress();
    assert.equal(app.menu('Delivery Schedule'), undefined);
    await app.place();
    assert.equal(app.error(), null);
    await app.advance(5000);
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].body.deliveryType, 'Pickup');
    assert.equal(app.calls[0].body.deliveryFee, 0);
    assert.equal('scheduledDate' in app.calls[0].body, false);
    assert.equal('scheduledTime' in app.calls[0].body, false);
  }
});

test('switching to return delivery does not require a fixed return time', async () => {
  const app = harness();
  app.draft.set({ deliveryType: 'Pickup', schedule: '' });
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Laundry transport').props.onPress();
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Delivery only').props.onPress();
  assert.equal(app.menu('Delivery Schedule'), undefined);
  await app.place();
  await app.advance(5000);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].body.scheduledTime, undefined);
});

test('delivery bounds block distant addresses and require map pins before the countdown', async () => {
  const app = harness();
  app.draft.shop = { ...app.draft.shop, latitude: 0, longitude: 0, deliveryMaxKm: 5 };
  app.draft.address = { ...app.profile, latitude: 0, longitude: 1 };
  await app.place();
  assert.match(app.error(), /maximum delivery distance is 5/);
  app.draft.address = { ...app.profile };
  await app.place();
  assert.match(app.error(), /Pin your delivery address/);
  await app.advance(5000);
  assert.equal(app.calls.length, 0);
});

test('shop collection uses its own range and preserves the collection address with finished-laundry pickup', async () => {
  const app = harness();
  app.draft.shop = { ...app.draft.shop, latitude: 0, longitude: 0, pickupEnabled: true, pickupMinKm: 1, pickupMaxKm: 5 };
  app.draft.address = { ...app.profile, latitude: 0, longitude: 0.02 };
  app.draft.set({ deliveryType: 'Pickup', schedule: '' });
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Laundry transport').props.onPress();
  const collection = elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Pickup only');
  assert.ok(collection);
  collection.props.onPress();
  assert.ok(app.menu('Customer address'));
  assert.equal(app.menu('Delivery Schedule'), undefined);
  await app.place();
  await app.advance(5000);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].body.collectionMethod, 'ShopPickup');
  assert.equal(app.calls[0].body.collectionAddress.longitude, 0.02);
  assert.equal(app.calls[0].body.address_line_1, app.draft.shop.address_line_1);
});

test('disabled shop collection and addresses below its minimum cannot be booked', async () => {
  const app = harness();
  app.draft.set({ deliveryType: 'Pickup', collectionMethod: 'ShopPickup' });
  await app.place();
  assert.match(app.error(), /does not offer laundry collection/);
  app.draft.shop = { ...app.draft.shop, latitude: 0, longitude: 0, pickupEnabled: true, pickupMinKm: 3 };
  app.draft.address = { ...app.profile, latitude: 0, longitude: 0.01 };
  await app.place();
  await app.advance(5000);
  assert.equal(app.calls.length, 0);
  assert.match(app.error(), /minimum pickup distance is 3/);
});

test('transport choices share one address and missing pins have an action that opens the address editor', () => {
  const app = harness();
  app.draft.shop = { ...app.draft.shop, pickupEnabled: true, latitude: 0, longitude: 0, deliveryMaxKm: 5 };
  app.draft.set({ collectionMethod: 'ShopPickup' });
  const screen = app.render();
  assert.equal(elements(screen, 'MenuRow').filter(item => item.props.title === 'Customer address').length, 1);
  assert.equal(elements(screen, 'DeliveryDetails').length, 1);
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Laundry transport').props.onPress();
  const choices = elements(app.render(), 'Pressable').filter(item => item.props.accessibilityRole === 'radio');
  assert.equal(choices.length, 4);
  assert.equal(choices.filter(item => item.props.accessibilityState.checked).length, 1);
  assert.equal(choices.find(item => item.props.accessibilityState.checked).props.accessibilityLabel, 'Pickup & delivery');
  app.button('Manage addresses').props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(app.navigation)), [['addresses', { checkout: 'true' }]]);
  assert.equal(elements(app.render(), 'AddressFields').length, 0);
});

test('one transport selection sets both trips together and unavailable pickup options are hidden', () => {
  const app = harness();
  const options = () => elements(app.render(), 'Pressable').filter(item => item.props.accessibilityRole === 'radio');
  assert.equal(options().length, 0);
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Laundry transport').props.onPress();
  assert.equal(options().length, 2);
  app.draft.shop.pickupEnabled = true;
  for (const [label, collectionMethod, deliveryType] of [
    ['Pickup & delivery', 'ShopPickup', 'Deliver'],
    ['Pickup only', 'ShopPickup', 'Pickup'],
    ['Delivery only', 'Dropoff', 'Deliver'],
    ["I'll handle both trips", 'Dropoff', 'Pickup'],
  ]) {
    options().find(item => item.props.accessibilityLabel === label).props.onPress();
    assert.equal(app.draft.collectionMethod, collectionMethod);
    assert.equal(app.draft.deliveryType, deliveryType);
    assert.equal(options().length, 0);
    const dropdown = elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Laundry transport');
    assert.equal(dropdown.props.accessibilityValue.text, label);
    assert.equal(dropdown.props.accessibilityState.expanded, false);
    dropdown.props.onPress();
    assert.equal(options().filter(item => item.props.accessibilityState.checked).length, 1);
    assert.equal(!!app.menu('Requested laundry pickup'), collectionMethod === 'ShopPickup');
    assert.ok(app.menu('Customer address'));
  }
});

test('checkout selects an existing saved address immediately and preserves coordinates and instructions', async () => {
  const existing = { address_line_1: 'Older Saved Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Work', latitude: 13.63, longitude: 123.2, access_code: 'Gate 2', dropoff_instructions: 'Ring bell' };
  const app = harness({ saved: [existing] });
  app.menu('Customer address').props.onPress();
  const modal = elements(app.render(), 'Modal')[0];
  assert.equal(elements(modal, 'AddressFields').length, 0);
  assert.equal(app.button('Add new address'), undefined);
  assert.equal(app.button('Add another address'), undefined);
  elements(modal, 'Pressable').find(item => item.props.accessibilityLabel === 'Saved address 1').props.onPress();
  assert.equal(app.draft.address, existing);
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  assert.equal(app.profile.address_line_1, '12 Main Street');
  assert.equal(app.addressWrites.length, 0);
  await app.place();
  await app.advance(5000);
  assert.equal(app.calls[0].body.latitude, 13.63);
  assert.equal(app.calls[0].body.access_code, 'Gate 2');
  assert.equal(app.calls[0].body.dropoff_instructions, 'Ring bell');
  app.menu('Customer address').props.onPress();
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Primary address').props.onPress();
  assert.equal(app.draft.address, null);
  assert.equal(app.menu('Customer address').props.detail, addressHelpers.formatAddress(app.profile));
});

test('closing the address selector preserves the selection; managing addresses leaves the basket intact', () => {
  const app = harness();
  app.draft.set({ notes: 'Preserve this order', counts: { Shirts: 2 } });
  app.menu('Customer address').props.onPress();
  app.button('Close').props.onPress();
  assert.equal(app.draft.address, null);
  assert.equal(elements(app.render(), 'Modal')[0].props.visible, false);
  app.menu('Customer address').props.onPress();
  app.button('Manage addresses in Profile').props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(app.navigation)), [['addresses', { checkout: 'true' }]]);
  assert.equal(app.draft.notes, 'Preserve this order');
  assert.equal(app.draft.counts.Shirts, 2);
  assert.equal(app.addressWrites.length, 0);
});

test('incomplete saved addresses are disabled and never expose checkout address inputs', () => {
  const app = harness({ saved: [{ address_line_1: 'Incomplete' }] });
  app.menu('Customer address').props.onPress();
  const option = elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Saved address 1');
  assert.equal(option.props.disabled, true);
  assert.equal(option.props.accessibilityState.disabled, true);
  assert.equal(elements(app.render(), 'AddressFields').length, 0);
  assert.equal(app.draft.address, null);
});

test('closed, not-yet-open, and manually paused shops cannot begin an order', async () => {
  for (const hours of [
    { openingTime: '11:00', closingTime: '18:00' },
    { openingTime: '06:00', closingTime: '09:00' },
    { acceptingOrders: false },
  ]) {
    const app = harness();
    Object.assign(app.draft.shop, hours);
    assert.equal(elements(app.render().props.footer, 'Button')[0].props.disabled, true);
    await app.place();
    await app.advance(5000);
    assert.equal(app.calls.length, 0);
    assert.ok(app.error());
  }
});

test('a shop closing during the countdown prevents submission', async () => {
  const app = harness({ clock: Date.parse('2026-10-22T09:59:58Z') });
  await app.place();
  await app.advance(5000);
  assert.equal(app.calls.length, 0);
  assert.match(app.error(), /shop is closed/);
});
