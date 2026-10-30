const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname, '../src/design/dashboard-analytics.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(compiled, compiled.exports);
const { dashboardToday, presetDates, rangeError, chartScale } = compiled.exports;

test('dashboard presets use Philippine dates, including midnight and month boundaries', () => {
  assert.equal(dashboardToday(new Date('2026-10-29T16:01:00Z')), '2026-10-30');
  assert.deepEqual(presetDates('7 days', '2026-03-02'), { start: '2026-02-24', end: '2026-03-02' });
  assert.deepEqual(presetDates('Today', '2026-03-02'), { start: '2026-03-02', end: '2026-03-02' });
});
test('custom analytics dates reject invalid, reversed, future and excessive ranges', () => {
  assert.equal(rangeError('2026-10-30', '2026-10-30', '2026-10-30'), null);
  for (const [start, end] of [['2026-02-30', '2026-03-01'], ['2026-10-30', '2026-10-29'], ['2025-01-01', '2026-10-30'], ['2026-10-30', '2026-10-31']])
    assert.ok(rangeError(start, end, '2026-10-30'));
});
test('chart scales keep integer order ticks, handle zeros and retain fractional currency', () => {
  for (const values of [[0, 0], [1], [4, 7, 100], [999999]]) {
    const scale = chartScale(values, 'Orders');
    assert.ok(scale.maximum >= Math.max(...values));
    assert.ok(scale.ticks.every(Number.isInteger));
    assert.ok(scale.maximum > 0);
  }
  const currency = chartScale([0.1, 0.35], 'Revenue');
  assert.ok(currency.maximum >= 0.35);
  assert.ok(currency.ticks.some(value => value > 0 && value < 1));
});
