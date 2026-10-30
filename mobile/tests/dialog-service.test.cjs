const assert = require('node:assert/strict');
const { test, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../src/design/dialog-service.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { showDialog, getDialog, settleDialog, dismissAllDialogs, dismissConfirmations, subscribeToDialogs } = compiled.exports;
const options = { title: 'Delete Service', message: 'Delete this service?', kind: 'confirm', destructive: true };
afterEach(dismissAllDialogs);

test('confirmations wait for an explicit decision and publish the selected action', async () => {
  let changed = 0, resolved = false;
  const unsubscribe = subscribeToDialogs(() => changed++);
  const promise = showDialog(options).then(result => { resolved = true; return result; });
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(getDialog().title, 'Delete Service');
  settleDialog(getDialog().id, true);
  assert.equal(await promise, true);
  assert.equal(getDialog(), null); assert.equal(changed, 2);
  unsubscribe();
});

test('queued dialogs cannot be confirmed by a repeated click from the previous dialog', async () => {
  const first = showDialog(options);
  const firstId = getDialog().id;
  const second = showDialog({ ...options, title: 'Remove photo' });
  settleDialog(firstId, true);
  assert.equal(await first, true);
  assert.equal(getDialog().title, 'Remove photo');
  settleDialog(firstId, true);
  assert.equal(getDialog().title, 'Remove photo');
  settleDialog(getDialog().id, false);
  assert.equal(await second, false);
});

test('session changes and unmounts dismiss all pending requests without accepting them', async () => {
  const first = showDialog(options);
  const second = showDialog(options);
  dismissAllDialogs();
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  assert.equal(getDialog(), null);
});

test('navigation cancels stale confirmations while keeping a success notice readable', async () => {
  const confirmation = showDialog(options);
  const notice = showDialog({ title: 'Saved', message: 'Changes saved.', kind: 'notice' });
  dismissConfirmations();
  assert.equal(await confirmation, false);
  assert.equal(getDialog().title, 'Saved');
  settleDialog(getDialog().id, true);
  assert.equal(await notice, true);
});

test('async confirmation stays open and prevents duplicate or cancelled actions while busy', async () => {
  let finish, calls = 0;
  const action = new Promise(resolve => { finish = resolve; });
  const result = showDialog({ ...options, onConfirm: async () => { calls++; await action; } });
  const id = getDialog().id;
  settleDialog(id, true);
  assert.equal(getDialog().busy, true);
  settleDialog(id, true); settleDialog(id, false);
  assert.equal(calls, 1); assert.equal(getDialog().id, id);
  finish(); assert.equal(await result, true); assert.equal(getDialog(), null);
});

test('failed logout actions keep the dialog open with an error and allow retry', async () => {
  let calls = 0;
  const result = showDialog({ ...options, onConfirm: async () => { if (++calls === 1) throw new Error('Try again'); } });
  const id = getDialog().id;
  settleDialog(id, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(getDialog().busy, false); assert.equal(getDialog().error, 'Try again');
  settleDialog(id, true); assert.equal(await result, true); assert.equal(calls, 2);
});
