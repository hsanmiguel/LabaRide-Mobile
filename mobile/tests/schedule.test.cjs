const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const screenFile = fs.readFileSync(path.join(__dirname, '../src/design/OrderScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('OrderScreens.tsx', screenFile, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'ScheduleDesign');
const source = fs.readFileSync(path.join(__dirname, '../src/design/schedule.ts'), 'utf8') + '\n' + screen.getText(ast);
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
} }).outputText;

function elements(element, type) {
  if (Array.isArray(element)) return element.flatMap(child => elements(child, type));
  if (!React.isValidElement(element)) return [];
  return [...(element.type === type ? [element] : []), ...elements(element.props.children, type)];
}

function harness(now = new Date(2026, 9, 13, 10, 30), schedule = '', serviceName = 'Wash', deliveryType = 'Deliver', screenProps = {}) {
  let clock = now.getTime(), index = 0, backs = 0;
  const hooks = [], saves = [];
  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock); }
    static now() { return clock; }
  }
  const context = { exports: {}, React, Date: FakeDate,
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useEffect() {},
    useLaundryDraft: () => ({ schedule, service: { serviceName }, deliveryType, set: value => saves.push(value) }),
    router: { back: () => { backs++; } }, palette: { navy: 'navy', muted: 'muted' }, styles: {},
  };
  for (const name of ['Screen', 'EmbeddedOrderPanel', 'Button', 'View', 'FormError', 'CalendarDays', 'ChevronUp', 'ChevronDown', 'Clock', 'Pencil', 'Modal', 'ScrollView', 'Field', 'Txt', 'TabsRow', 'Card', 'Pressable', 'Section']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const render = () => { index = 0; return context.exports.ScheduleDesign(screenProps); };
  const monthButton = label => elements(render(), 'Pressable').find(item => item.props.accessibilityLabel === label);
  const day = number => elements(render(), 'Pressable').find(item =>
    elements(item, 'Txt').some(text => text.props.children === number));
  const modal = () => elements(render(), 'Modal')[0];
  const openTime = () => elements(render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Change delivery time').props.onPress();
  const adjust = label => {
    if (!modal().props.visible) openTime();
    elements(modal(), 'Pressable').find(item => item.props.accessibilityLabel === label).props.onPress();
  };
  const value = unit => {
    if (!modal().props.visible) openTime();
    return elements(modal(), 'Txt').find(item => item.props.accessibilityLabel === `Selected ${unit}`).props.children;
  };
  const modalButton = title => elements(modal(), 'Button').find(item => item.props.title === title).props.onPress();
  const saveTime = () => modalButton('Save Time');
  const preview = () => elements(render(), 'Pressable').find(item => item.props.accessibilityLabel === 'Change delivery time').props.accessibilityValue.text;
  const confirm = () => elements(render().props.footer, 'Button')[0].props.onPress();
  return { render, monthButton, day, adjust, value, confirm, saves, context, modal, openTime, modalButton, saveTime, preview,
    advance: milliseconds => { clock += milliseconds; },
    error: () => elements(render().props.footer, 'FormError')[0].props.error,
    timeError: () => elements(modal(), 'FormError')[0]?.props.error,
    backs: () => backs,
  };
}

test('past calendar days and previous months are disabled; today is available', () => {
  const app = harness();
  assert.equal(app.monthButton('Previous month').props.disabled, true);
  for (let day = 1; day < 13; day++) assert.equal(app.day(day).props.disabled, true);
  assert.equal(app.day(13).props.disabled, false);
  assert.equal(app.day(14).props.disabled, false);
});

test('returning to the current month selects today across month and year boundaries', () => {
  for (const now of [new Date(2026, 9, 13, 10), new Date(2026, 9, 31, 10), new Date(2026, 11, 31, 10)]) {
    const app = harness(now);
    if (now.getDate() === 13) app.monthButton('Next month').props.onPress();
    app.monthButton('Previous month').props.onPress();
    assert.equal(app.day(now.getDate()).props.accessibilityState.selected, true);
    assert.equal(app.monthButton('Previous month').props.disabled, true);
  }
});

test('today accepts a future time, rejects an elapsed time and shows the error inline', () => {
  const app = harness();
  app.day(13).props.onPress();
  app.adjust('Decrease hour');
  app.saveTime();
  assert.equal(app.saves.length, 0);
  assert.match(app.timeError(), /future time/);
  assert.equal(app.modal().props.visible, true);
  app.adjust('Increase hour');
  app.adjust('Increase hour');
  app.saveTime();
  app.confirm();
  assert.equal(app.saves.length, 1);
  assert.equal(new Date(app.saves[0].schedule).getDate(), 13);
  assert.equal(app.backs(), 1);
});

test('a schedule left open across midnight cannot save yesterday', () => {
  const app = harness(new Date(2026, 9, 13, 23, 50));
  app.day(13).props.onPress();
  app.advance(20 * 60000);
  app.confirm();
  assert.equal(app.saves.length, 0);
  assert.match(app.error(), /today or a later date/);
  assert.equal(app.day(13).props.disabled, true);
});

test('stale schedules reset to tomorrow; valid schedules retain their minutes', () => {
  const now = new Date(2026, 9, 13, 10, 30);
  const stale = harness(now, new Date(2026, 9, 12, 11, 45).toISOString());
  assert.equal(stale.day(14).props.accessibilityState.selected, true);
  const saved = harness(now, new Date(2026, 9, 14, 11, 45).toISOString());
  assert.equal(saved.value('minute'), '45');
  assert.equal(saved.context.exports.validFutureSchedule('invalid', now.getTime()), false);
});

test('arrow controls cycle hours and minutes within their allowed ranges', () => {
  const app = harness(new Date(2026, 9, 13, 10, 30), new Date(2026, 9, 14, 12, 59).toISOString());
  assert.equal(app.value('hour'), '12');
  assert.equal(app.value('minute'), '59');
  app.adjust('Increase hour');
  assert.equal(app.value('hour'), '01');
  app.adjust('Decrease hour');
  assert.equal(app.value('hour'), '12');
  app.adjust('Increase minute');
  assert.equal(app.value('minute'), '00');
  app.adjust('Decrease minute');
  assert.equal(app.value('minute'), '59');
  app.saveTime();
  app.confirm();
  const saved = new Date(app.saves[0].schedule);
  assert.equal(saved.getHours(), 12);
  assert.equal(saved.getMinutes(), 59);
});

test('clicking the time opens a modal; Cancel and dismissal preserve the selected time', () => {
  const app = harness();
  const original = app.preview();
  assert.equal(app.modal().props.visible, false);
  app.openTime();
  assert.equal(app.modal().props.visible, true);
  app.adjust('Increase hour');
  app.adjust('Increase minute');
  assert.equal(app.preview(), original, 'Changes are provisional until saved');
  app.modalButton('Cancel');
  assert.equal(app.modal().props.visible, false);
  assert.equal(app.preview(), original);
  app.openTime();
  assert.equal(app.value('hour'), '10');
  assert.equal(app.value('minute'), '30');
  app.adjust('Increase hour');
  app.modal().props.onRequestClose();
  assert.equal(app.modal().props.visible, false);
  assert.equal(app.preview(), original);
});

test('Save Time applies the modal values and AM/PM before confirming the schedule', () => {
  const app = harness();
  app.openTime();
  app.adjust('Increase hour');
  app.adjust('Increase minute');
  app.adjust('PM');
  app.saveTime();
  assert.equal(app.modal().props.visible, false);
  assert.equal(app.preview(), '11:31 PM');
  assert.equal(app.saves.length, 0, 'Save Time does not place or confirm a booking');
  app.confirm();
  assert.equal(app.saves.length, 1);
  const saved = new Date(app.saves[0].schedule);
  assert.equal(saved.getHours(), 23);
  assert.equal(saved.getMinutes(), 31);
});

test('Full Service delivery rejects times inside two hours and accepts the exact cutoff', () => {
  const now = new Date(2026, 9, 13, 10, 30);
  const app = harness(now, '', '8Kg Full Service Laundry');
  app.day(13).props.onPress();
  app.adjust('Increase hour');
  app.saveTime();
  assert.match(app.timeError(), /at least 2 hours/);
  assert.equal(app.modal().props.visible, true);
  assert.equal(app.saves.length, 0);
  app.adjust('Increase hour');
  app.adjust('PM');
  app.saveTime();
  assert.equal(app.modal().props.visible, false);
  assert.equal(app.preview(), '12:30 PM');
  app.confirm();
  assert.equal(new Date(app.saves[0].schedule).getTime() - now.getTime(), 120 * 60000);
});

test('Full Service cutoff is checked again after waiting to confirm a schedule', () => {
  const now = new Date(2026, 9, 13, 10, 30);
  const app = harness(now, new Date(2026, 9, 13, 12, 30).toISOString(), 'Full-Service');
  app.render();
  app.advance(60000);
  app.confirm();
  assert.equal(app.saves.length, 0);
  assert.match(app.error(), /at least 2 hours/);
});

test('a two-hour cutoff across midnight disables today and displays the next available delivery hour', () => {
  const now = new Date(2026, 9, 13, 23, 30, 15);
  const app = harness(now, '', 'FULL SERVICE');
  assert.equal(app.day(13).props.disabled, true);
  assert.equal(app.day(14).props.disabled, false);
  const earliest = app.context.exports.earliestDeliveryTime('FULL SERVICE', 'Deliver', now.getTime());
  assert.equal(earliest.getDate(), 14);
  assert.equal(earliest.getHours(), 4);
  assert.equal(earliest.getMinutes(), 0);
  const fractional = app.context.exports.earliestDeliveryTime('FULL SERVICE', 'Deliver', new Date(2026, 9, 13, 10, 30, 15).getTime());
  assert.equal(fractional.getHours(), 12);
  assert.equal(fractional.getMinutes(), 31);
});

test('the full-service lead time applies to combined services and only to deliveries', () => {
  const now = new Date(2026, 9, 13, 10, 30).getTime();
  const soon = new Date(now + 60 * 60000).toISOString();
  const { deliveryScheduleError } = harness().context.exports;
  assert.match(deliveryScheduleError(soon, 'Iron, 8 kg Full Service Laundry', 'Deliver', now), /at least 2 hours/);
  assert.equal(deliveryScheduleError(soon, 'Wash Only', 'Deliver', now), null);
  assert.equal(deliveryScheduleError(soon, 'Full Service', 'Pickup', now), null);
});

test('all service types open, modify and save the same time-picker modal', () => {
  const now = new Date(2026, 9, 13, 10, 30);
  for (const name of ['Wash Only', 'Dry Only', 'Ironing', '8Kg Full Service Laundry', 'Custom Service']) {
    const app = harness(now, '', name);
    app.openTime();
    assert.equal(app.modal().props.visible, true, name);
    app.adjust('Increase hour');
    app.adjust('Increase minute');
    app.saveTime();
    assert.equal(app.modal().props.visible, false, name);
    assert.equal(app.preview(), '11:31 AM', name);
    app.confirm();
    assert.equal(app.saves.length, 1, name);
    const saved = new Date(app.saves[0].schedule);
    assert.equal(saved.getDate(), 14, name);
    assert.equal(saved.getHours(), 11, name);
    assert.equal(saved.getMinutes(), 31, name);
  }
});

test('embedded scheduling saves back to the review page without navigating away', () => {
  let done = 0;
  const app = harness(new Date(2026, 9, 13, 10, 30), '', 'Full Service', 'Deliver', { embedded: true, onDone: () => { done++; } });
  assert.equal(app.render().type, 'EmbeddedOrderPanel');
  app.confirm();
  assert.equal(app.saves.length, 1);
  assert.equal(done, 1);
  assert.equal(app.backs(), 0);
});
