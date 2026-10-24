const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const source = fs.readFileSync(path.join(__dirname, '../src/design/DeliveryScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'OperationsDashboardDesign');
const compiled = ts.transpileModule(component.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

test('dispatch dashboard renders no raw text in layout containers when error is empty', () => {
  const context = { exports: {}, React, styles: {},
    useAuthStore: select => select({ user: { id: 1 } }),
    useLogout: () => () => {},
    useQuery: options => ({ data: options.queryKey[1] === 'rider-options' ? undefined : { orders: [], riders: [] }, isLoading: false, error: null }),
    useCommand: () => ({ error: '', busy: false }), usePalette: () => ({}),
    useState: initial => [initial, () => {}],
    useEffect: () => {},
  };
  for (const name of ['Screen', 'View', 'Txt', 'Card', 'State', 'Section', 'Field', 'Button', 'IconButton', 'X', 'UserRound', 'SearchBox', 'TabsRow', 'Empty', 'ActionModal']) context[name] = name;
  vm.runInNewContext(compiled, context);
  const tree = context.exports.OperationsDashboardDesign();
  function walk(node, parent) {
    if (Array.isArray(node)) return node.forEach(child => walk(child, parent));
    if (typeof node === 'string' || typeof node === 'number') {
      assert.equal(parent, 'Txt', `Raw text ${JSON.stringify(node)} under ${parent}`);
      return;
    }
    if (node?.props) walk(node.props.children, node.type);
  }
  walk(tree);
});
