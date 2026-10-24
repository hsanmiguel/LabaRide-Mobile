import { businessMinutes, type ShopHours } from "./shop-hours";

export type DeliveryRules = ShopHours & { preparationMinutes: number };
export const DELIVERY_TIME_ZONE = "Asia/Manila";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: DELIVERY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: DELIVERY_TIME_ZONE, hour: "numeric", minute: "2-digit" });

export function deliveryDay(value: string | number | Date) {
  const parts = dayFormatter.formatToParts(new Date(value));
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
export function addDeliveryDays(day: string, count: number) {
  const date = new Date(day + "T12:00:00+08:00");
  date.setUTCDate(date.getUTCDate() + count);
  return deliveryDay(date);
}
export function deliveryTimestamp(day: string, minutes: number) {
  return Date.parse(day + "T00:00:00+08:00") + minutes * 60000;
}
export function formatDeliveryTime(value: string | number) {
  return timeFormatter.format(new Date(value));
}
export function formatDeliveryDay(day: string, now = Date.now()) {
  const today = deliveryDay(now);
  if (day === today) return "Today";
  if (day === addDeliveryDays(today, 1)) return "Tomorrow";
  return new Date(day + "T12:00:00+08:00").toLocaleDateString("en-US", { timeZone: DELIVERY_TIME_ZONE, month: "short", day: "numeric" });
}
function windows(rules: DeliveryRules): [number, number][] {
  if (rules.acceptingOrders === false) return [];
  const open = businessMinutes(rules.openingTime), close = businessMinutes(rules.closingTime);
  if (open === null || close === null || open === close) return [];
  return open < close ? [[open, close]] : [[0, close], [open, 1440]];
}
export function validateDeliveryTime(value: string | number, rules: DeliveryRules, now = Date.now(), bufferSeconds = 0) {
  const time = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(time)) return "Choose a valid delivery date and time.";
  if (time <= now) return "That delivery time has passed. Choose a later time.";
  if (time < now + rules.preparationMinutes * 60000 + bufferSeconds * 1000) {
    return "Choose a later delivery time to allow enough preparation time.";
  }
  const day = deliveryDay(time);
  if (!windows(rules).some(([start, end]) => time >= deliveryTimestamp(day, start) && time < deliveryTimestamp(day, end))) {
    return "Choose a delivery time within the shop's operating hours.";
  }
  return null;
}
export function earliestOnDeliveryDay(day: string, rules: DeliveryRules, now = Date.now(), bufferSeconds = 6) {
  const minimum = Math.ceil((now + rules.preparationMinutes * 60000 + Math.max(1, bufferSeconds * 1000)) / 60000) * 60000;
  for (const [start, end] of windows(rules)) {
    const candidate = Math.max(deliveryTimestamp(day, start), minimum);
    if (candidate < deliveryTimestamp(day, end)) return candidate;
  }
  return null;
}
export function earliestDeliverySlot(rules: DeliveryRules, now = Date.now()) {
  const firstDay = deliveryDay(now + rules.preparationMinutes * 60000);
  for (let index = 0; index < 7; index++) {
    const earliest = earliestOnDeliveryDay(addDeliveryDays(firstDay, index), rules, now);
    if (earliest !== null) return earliest;
  }
  return null;
}
export function availableDeliverySlots(day: string, rules: DeliveryRules, now = Date.now(), intervalMinutes = 30) {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) return [];
  const values = new Set<number>();
  const minimum = now + rules.preparationMinutes * 60000 + 6000;
  const first = earliestOnDeliveryDay(day, rules, now);
  if (first !== null) values.add(first);
  for (const [start, end] of windows(rules)) {
    for (let minute = start; minute < end; minute += intervalMinutes) {
      const time = deliveryTimestamp(day, minute);
      if (time >= minimum && time > now) values.add(time);
    }
  }
  return [...values].sort((a, b) => a - b).map(time => new Date(time).toISOString());
}
