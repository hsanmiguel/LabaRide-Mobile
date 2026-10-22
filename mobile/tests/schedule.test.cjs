const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/design', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', 'require', output)(module, module.exports, name => load(name.slice(2) + '.ts'));
  modules.set(file, module.exports);
  return module.exports;
}
const source = fs.readFileSync(path.join(__dirname, '../src/design/DeliverySchedule.tsx'), 'utf8');
const ast = ts.createSourceFile('DeliverySchedule.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'DeliverySchedule');
const compiled = ts.transpileModule(screen.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
function elements(element, type) {
  if (Array.isArray(element)) return element.flatMap(item => elements(item, type));
  if (!React.isValidElement(element)) return [];
  return [...(element.type === type ? [element] : []), ...elements(element.props.children, type)];
}
function harness({ time = '2026-10-22T10:30:00+08:00', schedule = '', pickup = false, hours = {}, serviceName = 'Full Service', failure = null, loading = false } = {}) {
  let clock = Date.parse(time), index = 0, tick = () => {}, effectSet = false, closed = 0, done = 0;
  const hooks = [], saves = [];
  const shop = { id: 5, openingTime: '08:00', closingTime: '18:00', services: [{ id: 9, serviceName }], ...hours };
  const draft = { shop, service: { serviceName }, serviceIds: [9], deliveryType: 'Deliver', schedule, requestedPickupAt: pickup ? schedule : '', set: value => saves.push(value) };
  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock); }
    static now() { return clock; }
  }
  const context = { exports: {}, React, Date: FakeDate, ...load('delivery-slots.ts'), ...load('schedule.ts'), ...load('form-values.ts'), ...load('shop-hours.ts'),
    useState(initial) { const slot = index++; if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial; return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }]; },
    useRef(initial) { const slot = index++; if (!(slot in hooks)) hooks[slot] = { current: initial }; return hooks[slot]; },
    useEffect(effect) { if (!effectSet) { effectSet = true; effect(); } },
    setInterval(callback) { tick = callback; return 1; }, clearInterval() {},
    useLaundryDraft: () => draft,
    useShop: () => ({ data: loading ? null : shop, isLoading: loading, error: failure, refetch() {} }),
    useWindowDimensions: () => ({ width: 320, height: 640 }), useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
    usePalette: () => ({ primary: 'blue', line: 'gray', muted: 'gray', ink: 'black', soft: '#eef' }), styles: { grow: { flex: 1 }, row: {}, muted: {} },
    Platform: { OS: 'web' }, router: { back: () => { closed++; } }, message: error => error.message,
  };
  for (const name of ['View', 'KeyboardAvoidingView', 'ScrollView', 'ActivityIndicator', 'Txt', 'Button', 'Field', 'Pressable', 'Screen', 'FormError', 'X', 'Check', 'ChevronLeft', 'ChevronRight']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.DeliverySchedule({ embedded: true, pickup, onDone: () => { done++; }, onClose: () => { closed++; } }); };
  const button = title => elements(render(), 'Button').find(item => item.props.title === title);
  const group = label => elements(render(), 'View').find(item => item.props.accessibilityLabel === label);
  const radio = (groupName, label) => elements(group(groupName), 'Pressable').find(item => item.props.accessibilityLabel === label);
  const slots = () => elements(group(pickup ? 'Pickup time' : 'Delivery time'), 'Pressable');
  const confirm = () => button(pickup ? 'Save pickup request' : 'Confirm Delivery Schedule').props.onPress();
  const calendarDay = day => elements(render(), 'Pressable').find(item => item.props.accessibilityLabel === day);
  return { render, button, radio, slots, confirm, calendarDay, saves, draft, done: () => done, closed: () => closed,
    advance: ms => { clock += ms; tick(); }, now: () => clock, context };
}

test('compact date-first layout has one scrolling body and a separate sticky footer', () => {
  const app = harness();
  const screen = app.render();
  assert.ok(screen.props.style.height <= 640 - 24 - 20 - 48);
  assert.equal(screen.props.style.maxWidth, 560);
  const text = elements(screen, 'Txt').map(item => Array.isArray(item.props.children) ? item.props.children.join('') : item.props.children);
  assert.ok(text.indexOf('1. Choose Delivery Date') < text.indexOf('2. Choose Delivery Time'));
  const body = elements(screen, 'ScrollView');
  assert.equal(body.length, 1);
  assert.equal(elements(body[0], 'Button').some(item => item.props.title === 'Confirm Delivery Schedule'), false);
  assert.ok(elements(screen, 'View').some(item => item.props.testID === 'delivery-schedule-footer'));
  for (const slot of app.slots()) assert.equal(slot.props.style({ pressed: false }).width, '48%');
});

test('invalid saved times are replaced by the earliest valid available time on open', () => {
  const app = harness({ schedule: '2026-10-22T11:00:00+08:00' });
  const selected = app.slots().filter(slot => slot.props.accessibilityState.checked);
  assert.equal(selected.length, 1);
  app.confirm();
  assert.ok(Date.parse(app.saves[0].schedule) >= app.now() + 120 * 60000);
  assert.equal(app.done(), 1);
});

test('a valid exact saved time remains selected even when it is not a suggested grid time', () => {
  const app = harness({ schedule: '2026-10-23T11:17:00+08:00' });
  assert.equal(app.slots().filter(item => item.props.accessibilityState.checked).length, 1);
  assert.equal(app.slots().find(item => item.props.accessibilityState.checked).props.accessibilityLabel, '11:17 AM');
  app.confirm();
  assert.equal(Date.parse(app.saves[0].schedule), Date.parse('2026-10-23T11:17:00+08:00'));
});

test('date changes immediately choose a valid slot and tomorrow uses the shop opening time', () => {
  const app = harness();
  app.radio('Delivery date', 'Tomorrow').props.onPress();
  assert.equal(app.slots()[0].props.accessibilityLabel, '8:00 AM');
  app.confirm();
  assert.equal(app.saves[0].schedule, '2026-10-23T00:00:00.000Z');
});

test('today is disabled when preparation cannot fit before closing', () => {
  const app = harness({ time: '2026-10-22T17:00:00+08:00' });
  assert.equal(app.radio('Delivery date', 'Today').props.disabled, true);
  assert.equal(app.radio('Delivery date', 'Tomorrow').props.accessibilityState.checked, true);
});

test('calendar navigation stays inline and cannot select a past date', () => {
  const app = harness();
  app.button('Choose another date').props.onPress();
  assert.equal(app.calendarDay('2026-10-21').props.disabled, true);
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Next month').props.onPress();
  app.calendarDay('2026-11-05').props.onPress();
  assert.equal(elements(app.render(), 'View').some(item => item.props.testID === 'delivery-calendar'), false);
  assert.equal(app.saves.length, 0);
  app.confirm();
  assert.equal(app.context.deliveryDay(app.saves[0].schedule), '2026-11-05');
});

test('exact-time entry rejects outside-hours times and accepts compatible minute-level times', () => {
  const app = harness();
  app.radio('Delivery date', 'Tomorrow').props.onPress();
  app.button('Enter an exact time').props.onPress();
  let field = elements(app.render(), 'Field')[0];
  field.props.onChangeText('19:00');
  assert.equal(app.button('Confirm Delivery Schedule').props.disabled, true);
  field = elements(app.render(), 'Field')[0];
  field.props.onChangeText('11:17 AM');
  assert.equal(app.button('Confirm Delivery Schedule').props.disabled, false);
  app.confirm();
  assert.equal(app.saves[0].schedule, '2026-10-23T03:17:00.000Z');
});

test('closing discards unconfirmed choices, and expiry revalidates before saving', () => {
  const app = harness();
  app.radio('Delivery date', 'Tomorrow').props.onPress();
  elements(app.render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Close delivery schedule').props.onPress();
  assert.equal(app.closed(), 1);
  assert.equal(app.saves.length, 0);
  assert.equal(app.draft.schedule, '');
  const expiring = harness({ time: '2026-10-22T15:59:40+08:00', schedule: '2026-10-22T17:59:55+08:00' });
  const confirm = expiring.button('Confirm Delivery Schedule').props.onPress;
  expiring.advance(20000);
  confirm();
  assert.equal(expiring.saves.length, 0);
});

test('manual closure and availability errors prevent confirmation with useful retry or empty states', () => {
  const closed = harness({ hours: { acceptingOrders: false } });
  assert.equal(closed.slots().length, 0);
  assert.equal(closed.button('Confirm Delivery Schedule').props.disabled, true);
  const failed = harness({ failure: new Error('Shop unavailable') });
  assert.ok(failed.button('Retry availability'));
  assert.equal(failed.button('Confirm Delivery Schedule').props.disabled, true);
});

 test('shop pickup requests use no laundry processing lead time and save separately from return delivery', () => {
  const app = harness({ pickup: true, schedule: '2026-10-22T11:00:00+08:00' });
  app.confirm();
  assert.equal(app.saves[0].requestedPickupAt, '2026-10-22T03:00:00.000Z');
  assert.equal(app.saves[0].schedule, undefined);
  assert.ok(elements(app.render(), 'Txt').some(x => x.props.children === 'This is a request. The shop must confirm pickup availability.'));
 });
