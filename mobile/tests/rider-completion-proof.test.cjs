const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), React = require('react');
const source = fs.readFileSync(path.join(__dirname, '../src/design/DeliveryScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('DeliveryScreens.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'RiderDashboardDesign');
const compiled = ts.transpileModule(fn.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
function elements(node, type) {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, type));
  if (!React.isValidElement(node)) return [];
  return [...(node.type === type ? [node] : []), ...elements(node.props.children, type)];
}
function render(stage, photos, flags = {}) {
  const date = new Date().toISOString();
  const job = { id: 10, transactionId: 47, stage, status: 'Accepted', createdAt: date, updatedAt: date,
    order: { status: stage === 'Pickup' ? 'PickupAccepted' : 'DeliveryAccepted', shop: { name: 'Laundry', address: 'Shop' }, customer: { address: 'Customer' } } };
  let stateIndex = 0;
  const context = { exports: {}, React, styles: {},
    useAuthStore: select => select({ user: { id: 3 } }),
    useQuery: options => options.queryKey[1] === 'handover-photos' ? { data: photos, isError: false, isFetching: false, ...flags } : { data: { rider: { online: true }, jobs: [job] } },
    useCommand: () => ({ busy: false }), useLogout: () => {}, usePalette: () => ({}),
    useWindowDimensions: () => ({ width: 390 }),
    useState: initial => [stateIndex++ === 1 ? 10 : initial, () => {}], useEffect: () => {},
    money: String, label: String, stamp: String, stepStamp: String, scheduleLabel: () => 'Today', Platform: { OS: 'web' },
  };
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) context[node.tagName.text] = node.tagName.text;
    ts.forEachChild(node, visit);
  }
  visit(fn);
  vm.runInNewContext(compiled, context);
  return context.exports.RiderDashboardDesign({});
}
test('completion stays disabled until the current trip has saved destination proof', () => {
  for (const stage of ['Pickup', 'Delivery']) {
    const proof = { assignmentId: 10, kind: stage === 'Pickup' ? 'ShopDropoff' : 'CustomerDelivery' };
    for (const photos of [undefined, [], [{ ...proof, assignmentId: 99 }], [{ ...proof, kind: stage === 'Pickup' ? 'CustomerPickup' : 'ShopCollection' }]]) {
      const button = elements(render(stage, photos), 'Button').find(item => item.props.title === 'Confirm completed');
      assert.equal(button.props.disabled, true);
    }
    const tree = render(stage, [proof]);
    assert.equal(elements(tree, 'Button').find(item => item.props.title === 'Confirm completed').props.disabled, false);
    assert.equal(elements(tree, 'HandoverPhotos').length, 1);
    for (const flags of [{ isFetching: true }, { isError: true }]) {
      assert.equal(elements(render(stage, [proof], flags), 'Button').find(item => item.props.title === 'Confirm completed').props.disabled, true);
    }
  }
});
