const DAY = 86_400_000;
export const MANILA_OFFSET = 8 * 60 * 60 * 1000;
export type Granularity = 'hour' | 'day' | 'week' | 'month';
export type AnalyticsRange = ReturnType<typeof analyticsRange>;

export function manilaDate(now = new Date()) {
  return new Date(now.getTime() + MANILA_OFFSET).toISOString().slice(0, 10);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}

export function analyticsRange(start: unknown, end: unknown, now = new Date()) {
  const today = manilaDate(now);
  const last = end === undefined ? today : end;
  const first = start === undefined && validDate(last) ? new Date(Date.parse(last + 'T00:00:00Z') - 29 * DAY).toISOString().slice(0, 10) : start;
  if (!validDate(first) || !validDate(last)) throw Object.assign(new Error('Use valid start and end dates in YYYY-MM-DD format.'), { statusCode: 400 });
  const days = (Date.parse(last) - Date.parse(first)) / DAY + 1;
  if (days < 1 || days > 366 || last > today) throw Object.assign(new Error('Choose a range of 1–366 days ending today or earlier (Philippine time).'), { statusCode: 400 });
  const granularity: Granularity = days === 1 ? 'hour' : days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
  return { start: first, end: last, days, granularity,
    from: new Date(Date.parse(first + 'T00:00:00Z') - MANILA_OFFSET),
    until: new Date(Date.parse(last + 'T00:00:00Z') + DAY - MANILA_OFFSET) };
}

export function bucketKey(local: string, granularity: Granularity) {
  if (granularity === 'hour') return local.slice(0, 13);
  if (granularity === 'day') return local.slice(0, 10);
  if (granularity === 'month') return local.slice(0, 7) + '-01';
  const date = new Date(local.slice(0, 10) + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export interface AnalyticsAggregate { local: string; count: number | bigint; value?: unknown; kilos?: unknown }
export function analyticsSeries(range: AnalyticsRange, received: AnalyticsAggregate[], completed: AnalyticsAggregate[]) {
  const buckets = new Map<string, { date: string; orders: number; completedOrders: number; completedValue: number; kilos: number }>();
  const step = range.granularity === 'hour' ? DAY / 24 : DAY;
  for (let time = Date.parse(range.start + 'T00:00:00Z'); time < Date.parse(range.end + 'T00:00:00Z') + DAY; time += step) {
    const date = new Date(time).toISOString();
    const key = bucketKey(date, range.granularity);
    if (!buckets.has(key)) buckets.set(key, { date: range.granularity === 'hour' ? date.slice(0, 13) : date.slice(0, 10), orders: 0, completedOrders: 0, completedValue: 0, kilos: 0 });
  }
  for (const row of received) { const bucket = buckets.get(bucketKey(row.local, range.granularity)); if (bucket) bucket.orders += Number(row.count); }
  for (const row of completed) {
    const bucket = buckets.get(bucketKey(row.local, range.granularity));
    if (bucket) { bucket.completedOrders += Number(row.count); bucket.completedValue += Number(row.value || 0); bucket.kilos += Number(row.kilos || 0); }
  }
  return [...buckets.values()].map(row => ({ ...row, completedValue: Math.round(row.completedValue * 100) / 100, kilos: Math.round(row.kilos * 100) / 100 }));
}
