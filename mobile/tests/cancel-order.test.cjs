const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

// Compile the production functions without importing Expo's native runtime.
function functionSource(file, name) {
  const source = fs.readFileSync(path.join(__dirname, '../src/design', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
  assert.ok(declaration, name + ' must exist');
  return declaration.getText(ast);
}
const compiled = ts.transpileModule([
  functionSource('data.ts', 'confirmAction'),
  functionSource('data.ts', 'message'),
  functionSource('OrderScreens.tsx', 'CancelOrderDesign'),
].join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
  target: ts.ScriptTarget.ES2022 } }).outputText;

function harness({ platform = 'web', confirmed = true, status = 'Pending', fail, request } = {}) {
  const hooks = [];
  let index = 0;
  const order = { id: 42, status, notes: '', shop: { shopName: 'Test Laundry' } };
  const calls = [], navigation = [], invalidations = [];
  const caches = { 'user-orders': [order], 'shop-orders': [order] };
  let dialog, refetches = 0;
  const context = {
    exports: {}, React, Platform: { OS: platform },
    window: { confirm: () => confirmed },
    Alert: { alert: (...args) => { dialog = args; } },
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = { current: initial };
      return hooks[slot];
    },
    useOrders: () => ({ data: [order], isLoading: false, error: null, refetch: async () => { refetches++; } }),
    useFlowNavigation: () => ({ replaceFlow: (...args) => navigation.push(args) }),
    useQueryClient: () => ({
      setQueriesData: ({ queryKey: [key] }, update) => { caches[key] = update(caches[key]); },
      invalidateQueries: async ({ queryKey: [key] }) => { invalidations.push(key); },
    }),
    api: { put: async (url, body) => {
      calls.push({ url, body });
      if (fail) throw fail;
      if (request) await request;
      return { ...order, status: 'Cancelled', notes: body.reason };
    } },
    palette: { navy: '#000' }, styles: {},
  };
  for (const name of ['Screen', 'Button', 'View', 'QueryState', 'Empty', 'FormError', 'Card', 'PriceRow', 'Txt', 'Choice']) context[name] = name;
  vm.runInNewContext(compiled, context);
  function render() { index = 0; return context.exports.CancelOrderDesign({ id: 42 }); }
  function elements(element, type) {
    if (Array.isArray(element)) return element.flatMap(child => elements(child, type));
    if (!React.isValidElement(element)) return [];
    return [...(element.type === type ? [element] : []), ...elements(element.props.children, type)];
  }
  function selectReason() { elements(render(), 'Choice')[2].props.onPress(); }
  return { render, selectReason, calls, navigation, invalidations, caches,
    error: () => elements(render(), 'FormError')[0].props.error,
    dialog: () => dialog, refetches: () => refetches };
}

test('browser confirmation cancels with the chosen reason and refreshes both order caches', async () => {
  const app = harness();
  assert.equal(app.render().props.footer.props.disabled, true);
  app.selectReason();
  await app.render().props.footer.props.onPress();
  assert.deepEqual(app.calls.map(call => [call.url, call.body.reason]), [['/transactions/42/cancel', 'I changed my mind']]);
  assert.deepEqual(app.invalidations, ['user-orders', 'shop-orders']);
  for (const orders of Object.values(app.caches)) assert.equal(orders[0].status, 'Cancelled');
  assert.deepEqual(app.navigation.map(([flow, params]) => [flow, params.id]), [['order-cancelled', '42']]);
  assert.equal(app.render().props.footer.props.busy, false);
});

test('declining in the browser sends no request and allows trying again', async () => {
  const app = harness({ confirmed: false });
  app.selectReason();
  await app.render().props.footer.props.onPress();
  await app.render().props.footer.props.onPress();
  assert.equal(app.calls.length, 0);
  assert.equal(app.navigation.length, 0);
  assert.equal(app.render().props.footer.props.busy, false);
});

test('native confirmation waits for Yes; No and dismiss send no request', async () => {
  for (const choice of ['Yes', 'No', 'dismiss']) {
    const app = harness({ platform: 'android' });
    app.selectReason();
    const pending = app.render().props.footer.props.onPress();
    assert.equal(app.calls.length, 0);
    const [, , buttons, options] = app.dialog();
    if (choice === 'dismiss') options.onDismiss();
    else buttons.find(button => button.text === choice).onPress();
    await pending;
    assert.equal(app.calls.length, choice === 'Yes' ? 1 : 0);
    assert.equal(app.render().props.footer.props.busy, false);
  }
});

test('double clicks submit only one cancellation', async () => {
  let finish;
  const request = new Promise(resolve => { finish = resolve; });
  const app = harness({ request });
  app.selectReason();
  const button = app.render().props.footer.props;
  const first = button.onPress();
  await button.onPress();
  assert.equal(app.calls.length, 1);
  assert.equal(app.render().props.footer.props.busy, true);
  finish();
  await first;
  assert.equal(app.calls.length, 1);
});

test('missing reasons and accepted orders cannot submit', async () => {
  const missing = harness();
  await missing.render().props.footer.props.onPress();
  assert.equal(missing.calls.length, 0);
  assert.match(missing.error(), /reason/);
  const accepted = harness({ status: 'Processing' });
  accepted.selectReason();
  await accepted.render().props.footer.props.onPress();
  assert.equal(accepted.calls.length, 0);
  assert.match(accepted.error(), /pending/);
});

test('a failed cancellation displays the API error, refetches status and restores the button', async () => {
  const app = harness({ fail: { error: { message: 'Order status changed. Refresh and try again.' } } });
  app.selectReason();
  await app.render().props.footer.props.onPress();
  assert.match(app.error(), /Order status changed/);
  assert.equal(app.refetches(), 1);
  assert.equal(app.navigation.length, 0);
  assert.equal(app.caches['user-orders'][0].status, 'Pending');
  assert.equal(app.render().props.footer.props.busy, false);
});
