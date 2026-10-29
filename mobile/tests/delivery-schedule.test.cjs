const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/design/DeliveryScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ['scheduledAt', 'scheduleLabel'].includes(declaration.name.getText(ast))));
const compiled = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n') + '\nexports.scheduledAt = scheduledAt; exports.scheduleLabel = scheduleLabel;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);

test('delivery dashboards reconstruct stored UTC date/time and display the Manila schedule', () => {
  const order = { scheduledDate: '2026-10-22T00:00:00.000Z', scheduledTime: '1970-01-01T23:30:00.000Z' };
  assert.equal(context.exports.scheduledAt(order).toISOString(), '2026-10-22T23:30:00.000Z');
  const displayed = context.exports.scheduleLabel(order);
  assert.match(displayed, /23/);
  assert.match(displayed, /7:30/);
});

test('historical orders without a complete schedule show an explicit empty state', () => {
  for (const order of [{ scheduledDate: null, scheduledTime: null }, { scheduledDate: '2026-10-22', scheduledTime: null }]) {
    assert.equal(context.exports.scheduleLabel(order), 'Not scheduled');
    assert.equal(Number.isFinite(context.exports.scheduledAt(order).getTime()), false);
  }
});


test('rider pickup displays the requested pickup time without requiring a return delivery schedule', () => {
  const order = { scheduledDate: null, scheduledTime: null, requestedPickupAt: '2026-10-23T02:30:00Z' };
  assert.equal(context.exports.scheduledAt(order).toISOString(), '2026-10-23T02:30:00.000Z');
  assert.match(context.exports.scheduleLabel(order), /10:30/);
});
