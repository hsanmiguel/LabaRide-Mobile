const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/design/processing-timer.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(compiled, compiled.exports);
const { processingTimers, timerClock, timerPhaseText } = compiled.exports;
const start = Date.parse('2026-10-30T01:00:00Z');
const order = { status: 'Processing', washingMinutes: 30, dryingMinutes: 45, processingStartedAt: new Date(start).toISOString() };

test('shop and customer countdowns derive from the same timestamps, including reopening and background gaps', () => {
  const snapshot = { ...order, workflowStatus: 'Washing' };
  const atFive = processingTimers(snapshot, start + 5 * 60000);
  assert.equal(atFive.phases[0].seconds, 25 * 60);
  assert.equal(atFive.phases[0].state, 'running');
  assert.equal(atFive.phases[1].state, 'waiting');
  assert.deepEqual(processingTimers(JSON.parse(JSON.stringify(snapshot)), start + 5 * 60000), atFive);
  assert.equal(processingTimers(snapshot, start + 20 * 60000).phases[0].seconds, 10 * 60);
});

test('washing never starts drying automatically when time elapses', () => {
  const snapshot = { ...order, workflowStatus: 'Washing' };
  const phases = processingTimers(snapshot, start + 50 * 60000).phases;
  assert.equal(phases[0].state, 'elapsed');
  assert.equal(phases[0].seconds, 0);
  assert.equal(phases[1].state, 'waiting');
  assert.equal(timerPhaseText(phases[0]), '0:00 · Time elapsed');
  assert.equal(snapshot.workflowStatus, 'Washing');
});

test('drying uses its own actual start and folding stops both countdowns', () => {
  const drying = { ...order, workflowStatus: 'Drying', dryingStartedAt: new Date(start + 50 * 60000).toISOString() };
  const phases = processingTimers(drying, start + 55 * 60000).phases;
  assert.equal(phases[0].state, 'done');
  assert.equal(phases[1].seconds, 40 * 60);
  assert.equal(phases[1].state, 'running');
  assert.deepEqual(processingTimers({ ...drying, workflowStatus: 'Folding' }, start + 100 * 60000).phases.map(p => p.state), ['done', 'done']);
});

test('original Processing orders show an explicitly estimated sequence with both durations', () => {
  assert.equal(processingTimers(order, start).estimatedSequence, true);
  const atForty = processingTimers(order, start + 40 * 60000).phases;
  assert.equal(atForty[0].state, 'elapsed');
  assert.equal(atForty[1].state, 'running');
  assert.equal(atForty[1].seconds, 35 * 60);
  assert.equal(processingTimers(order, start + 80 * 60000).phases[1].state, 'elapsed');
});

test('missing durations and timestamps remain unknown, and closed or queued orders have no active timers', () => {
  assert.equal(processingTimers({ ...order, workflowStatus: 'Drying' }, start).phases[1].state, 'unavailable');
  assert.equal(processingTimers({ ...order, washingMinutes: null }, start).phases[0].seconds, null);
  assert.equal(processingTimers({ ...order, processingStartedAt: 'invalid' }, start).phases[0].state, 'unavailable');
  for (const status of ['Pending', 'Accepted', 'Queued', 'Ready', 'Completed', 'Cancelled']) assert.equal(processingTimers({ ...order, status }, start), null);
  assert.equal(processingTimers({ ...order, workflowStatus: 'Completed' }, start), null);
  assert.equal(timerClock(45 * 60), '45:00');
  assert.equal(timerClock(3601), '1:00:01');
  assert.equal(timerClock(-1), '0:00');
});
