const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const React = require('react');

const source = fs.readFileSync(require('node:path').join(__dirname, '../src/design/NotificationsScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'NotificationsDesign');
const compiled = ts.transpileModule(component.getText(ast), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
} }).outputText;

function harness(shopMode) {
  const items = [
    { id: 1, transactionId: 42, title: 'Order processing', message: 'We can wash today.', createdAt: new Date().toISOString(), readAt: null },
    { id: 2, transactionId: 42, title: 'Order completed', message: 'Your laundry is ready.', createdAt: new Date().toISOString(), readAt: null },
  ];
  const requests = [], navigation = [];
  let query, cache;
  const context = {
    exports: {}, React, styles: {}, usePalette: () => ({}),
    useAuthStore: select => select({ user: { id: 7 } }),
    useQuery: options => { query = options; return { data: items }; },
    useQueryClient: () => ({ setQueryData: (key, update) => { cache = update(items); } }),
    api: { get: async url => requests.push(url), put: async url => requests.push(url) },
    router: { push: target => navigation.push(target) },
    go: (...args) => navigation.push(args), fail: error => { throw error; },
  };
  for (const name of ['Pressable', 'View', 'Screen', 'Section', 'Txt', 'Empty', 'QueryState']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const root = context.exports.NotificationsDesign({ shopMode });
  const buttons = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node?.props) return;
    if (node.type === 'Pressable') buttons.push(node);
    walk(node.props.children);
  }
  walk(root);
  return { buttons, requests, navigation, query, get cache() { return cache; } };
}

test('separate events for the same order remain visible and use authenticated polling', async () => {
  const app = harness(false);
  assert.equal(app.buttons.length, 2);
  assert.equal(app.query.refetchInterval, 15000);
  await app.query.queryFn();
  assert.equal(app.requests[0], '/notifications?shopMode=false');
  await app.buttons[0].props.onPress();
  assert.equal(app.requests[1], '/notifications/1/read');
  assert.ok(app.cache[0].readAt);
  assert.equal(app.cache[1].readAt, null);
  assert.equal(app.navigation[0][0], 'transaction-details');
  assert.equal(app.navigation[0][1].id, '42');
});

test('shop notifications open the shop order details', async () => {
  const app = harness(true);
  await app.buttons[1].props.onPress();
  assert.equal(app.navigation[0].pathname, '/shop/customers/orders/[id]');
  assert.equal(app.navigation[0].params.id, '42');
});
