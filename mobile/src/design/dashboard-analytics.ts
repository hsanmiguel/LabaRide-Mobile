export type DashboardPreset = "Today" | "7 days" | "30 days" | "Custom";
export type ChartMetric = "Orders" | "Revenue";
export interface AnalyticsPoint { date: string; orders: number; completedOrders: number; completedValue: number; kilos: number }
export interface ShopAnalytics {
  range: { start: string; end: string; granularity: "hour" | "day" | "week" | "month"; timeZone: string };
  summary: { orders: number; completedOrders: number; completedValue: number; kilos: number };
  series: AnalyticsPoint[];
  popularServices: { name: string; orders: number; kilos: number; value: number }[];
  workload: { pending: number; queued: number; ready: number };
  undatedCompletedOrders: number;
}
export function dashboardToday(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function presetDates(preset: Exclude<DashboardPreset, "Custom">, today = dashboardToday()) {
  const days = preset === "Today" ? 1 : preset === "7 days" ? 7 : 30;
  return { start: new Date(Date.parse(today + "T00:00:00Z") - (days - 1) * 86_400_000).toISOString().slice(0, 10), end: today };
}
export function rangeError(start: string, end: string, today = dashboardToday()) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end)) return "Choose a valid start and end date.";
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  if (days < 1) return "End date must be on or after the start date.";
  if (end > today) return "Choose dates ending today or earlier (Philippine time).";
  if (days > 366) return "Choose a date range of up to 366 days.";
  return null;
}
export function displayAnalyticsDate(value: string, year = true) {
  return new Date(value.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric", ...(year ? { year: "numeric" as const } : {}) });
}
export function pointLabel(point: AnalyticsPoint, granularity: ShopAnalytics["range"]["granularity"]) {
  if (granularity === "hour") return `${displayAnalyticsDate(point.date)} · ${Number(point.date.slice(11, 13)) % 12 || 12} ${Number(point.date.slice(11, 13)) < 12 ? "AM" : "PM"}`;
  const date = displayAnalyticsDate(point.date);
  return granularity === "week" ? `Week starting ${date}` : granularity === "month" ? `Month starting ${date}` : date;
}
export function chartScale(values: number[], metric: ChartMetric) {
  const maximum = Math.max(0, ...values);
  const rawStep = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const step = Math.max(metric === "Orders" ? 1 : 0.25, Math.ceil(rawStep / magnitude) * magnitude);
  return { maximum: step * 4, ticks: [0, 1, 2, 3, 4].map(value => Math.round(value * step * 100) / 100) };
}
