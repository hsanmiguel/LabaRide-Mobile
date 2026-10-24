const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/design/DeliveryScreens.tsx'), 'utf8');
const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'useCommand');
const compiled = ts.transpileModule(hook.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function command(put) {
  const invalidations = [], states = [];
  const context = { api: { put }, useQueryClient: () => ({ invalidateQueries: async options => invalidations.push(options.queryKey[0]) }), useRef: current => ({ current }), useState: initial => [initial, value => states.push(value)], message: error => error.message };
  vm.runInNewContext(compiled, context);
  return { command: context.useCommand(), invalidations, states };
}
test('same-frame repeated delivery clicks send only one request and release the lock afterward', async () => {
  let complete, writes = 0;
  const pending = new Promise(resolve => { complete = resolve; });
  const f = command(async () => { writes++; await pending; });
  const first = f.command.send('/delivery/assignments/32/respond', { action: 'accept' });
  assert.equal(await f.command.send('/delivery/assignments/32/respond', { action: 'accept' }), false);
  assert.equal(writes, 1);
  complete(); assert.equal(await first, true);
  assert.equal(await f.command.send('/delivery/availability', { online: true }), true);
  assert.equal(writes, 2);
});
test('failed delivery actions preserve the error and refresh stale jobs before allowing a retry', async () => {
  let fail = true;
  const f = command(async () => { if (fail) throw new Error('This offer expired.'); });
  assert.equal(await f.command.send('/delivery/assignments/32/respond', { action: 'accept' }), false);
  assert.ok(f.states.includes('This offer expired.')); assert.ok(f.invalidations.includes('delivery'));
  fail = false;
  assert.equal(await f.command.send('/delivery/availability', { online: true }), true);
});
