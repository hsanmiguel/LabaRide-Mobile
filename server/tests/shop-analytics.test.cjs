const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { analyticsRange, analyticsSeries, manilaDate } = require('../dist/utils/shop-analytics');
const db = {};
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const { ShopAnalyticsController } = require('../dist/controllers/shop-analytics.controller');

test('analytics validates calendar dates, bounded ranges and Manila midnight independently of host time', () => {
  const now = new Date('2026-10-29T16:05:00Z');
  assert.equal(manilaDate(now), '2026-10-30');
  const day = analyticsRange('2026-10-30', '2026-10-30', now);
  assert.equal(day.from.toISOString(), '2026-10-29T16:00:00.000Z');
  assert.equal(day.until.toISOString(), '2026-10-30T16:00:00.000Z');
  assert.equal(day.granularity, 'hour');
  for (const [start, end] of [['2026-02-30', '2026-03-01'], ['2026-10-30', '2026-10-29'], ['2025-01-01', '2026-10-30'], ['2026-10-31', '2026-10-31'], [['2026-10-30'], '2026-10-30']])
    assert.throws(() => analyticsRange(start, end, now), error => error.statusCode === 400);
  assert.equal(analyticsRange('2024-02-29', '2024-02-29', now).days, 1);
});

test('series zero-fills hours and days and keeps placement and completion dates distinct', () => {
  const range = analyticsRange('2020-01-01', '2020-01-03');
  const result = analyticsSeries(range, [{ local: '2020-01-01T08', count: 3 }], [{ local: '2020-01-03T12', count: 2, value: '260.10', kilos: '8.5' }]);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(p => p.orders), [3, 0, 0]);
  assert.deepEqual(result.map(p => p.completedValue), [0, 0, 260.1]);
  assert.equal(result[2].kilos, 8.5);
  const hourly = analyticsSeries(analyticsRange('2020-01-01', '2020-01-01'), [{ local: '2020-01-01T23', count: 1 }], []);
  assert.equal(hourly.length, 24);
  assert.equal(hourly[23].orders, 1);
  assert.equal(hourly[0].orders, 0);
});

test('weekly and monthly buckets retain totals across partial periods and year boundaries', () => {
  for (const [start, end, expected] of [['2019-12-28', '2020-02-01', 'week'], ['2019-12-28', '2020-06-01', 'month']]) {
    const range = analyticsRange(start, end);
    assert.equal(range.granularity, expected);
    const points = analyticsSeries(range, [{ local: start + 'T05', count: 2 }, { local: end + 'T20', count: 3 }], []);
    assert.equal(points[0].date, start);
    assert.equal(points.reduce((n, p) => n + p.orders, 0), 5);
  }
});

async function invoke({ userId = 2, shopId = '5', start = '2020-01-01', end = '2020-01-03', empty = false } = {}) {
  const queries = [];
  db.shop = { findUnique: async () => ({ userId: 2 }) };
  db.$transaction = async (callback, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return callback(db); };
  db.$queryRaw = async (strings, ...values) => {
    const query = Prisma.sql(strings, ...values);
    assert.equal(query.values[0], 5, 'every aggregate is scoped to the owned shop');
    queries.push(query);
    if (query.sql.includes('AS pending')) return [{ pending: 2, queued: 1, ready: 3, undated: empty ? 0 : 4 }];
    if (empty) return [];
    if (query.sql.includes('GROUP BY service_name')) return [{ name: 'Wash Only', orders: 2, kilos: new Prisma.Decimal(8.5), value: new Prisma.Decimal(260.1) }];
    if (query.sql.includes('SUM(total_amount)')) return [{ local: '2020-01-03T12', count: 2, value: '260.10', kilos: '8.5' }];
    return [{ local: '2020-01-01T08', count: 3 }];
  };
  const req = { user: { userId }, params: { shopId }, query: { start, end } };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
  let error;
  await ShopAnalyticsController.get(req, res, failure => { error = failure; });
  return { res, error, queries };
}

test('analytics endpoint denies other owners and invalid ranges before aggregating', async () => {
  for (const userId of [1, undefined]) {
    const result = await invoke({ userId: userId === undefined ? null : userId });
    assert.equal(result.res.code, 403); assert.equal(result.queries.length, 0);
  }
  assert.equal((await invoke({ shopId: 'bad' })).res.code, 400);
  const bad = await invoke({ start: '2020-02-30' });
  assert.equal(bad.error.statusCode, 400); assert.equal(bad.queries.length, 0);
});

test('endpoint returns aggregated totals, series, services and independent current workload', async () => {
  const { res, error, queries } = await invoke();
  assert.equal(error, undefined); assert.equal(res.code, 200);
  assert.deepEqual(res.body.data.summary, { orders: 3, completedOrders: 2, completedValue: 260.1, kilos: 8.5 });
  assert.deepEqual(res.body.data.workload, { pending: 2, queued: 1, ready: 3 });
  assert.equal(res.body.data.undatedCompletedOrders, 4);
  assert.equal(res.body.data.popularServices[0].value, 260.1);
  assert.equal(res.body.data.series[1].completedValue, 0);
  assert.equal(queries[0].values[1], '2019-12-31T16:00:00.000Z');
  assert.ok(queries[0].sql.includes("created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'"));
  assert.ok(queries[1].sql.includes('completed_at >= '));
  const empty = (await invoke({ empty: true })).res.body.data;
  assert.deepEqual(empty.summary, { orders: 0, completedOrders: 0, completedValue: 0, kilos: 0 });
  assert.equal(empty.series.length, 3);
});
