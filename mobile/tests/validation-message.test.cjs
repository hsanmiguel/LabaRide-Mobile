const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/design/data.ts'), 'utf8');
const ast = ts.createSourceFile('data.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'message');
const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} }; vm.runInNewContext(code, context);
const { message } = context.exports;
test('validation details are readable after Axios unwraps the server error', () => {
  const failure = { message: 'Validation error', details: [{ path: ['note'], message: 'Enter an acceptance explanation.' }] };
  assert.equal(message(failure), 'note: Enter an acceptance explanation.');
  assert.equal(message({ error: failure }), 'note: Enter an acceptance explanation.');
  assert.equal(message({ error: { details: [{ path: ['body', 'note'], message: 'Required' }] } }), 'note: Required');
});
test('empty validation details retain useful messages and ordinary errors still display', () => {
  assert.equal(message({ message: 'Order changed. Refresh and try again.', details: [] }), 'Order changed. Refresh and try again.');
  assert.equal(message(new Error('Connection lost')), 'Connection lost');
  assert.equal(message('Try again'), 'Try again'); assert.equal(message(null), 'Please try again.');
});
