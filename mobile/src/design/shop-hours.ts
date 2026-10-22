export type ShopHours = { openingTime?: string | null; closingTime?: string | null; acceptingOrders?: boolean };
export function businessMinutes(value?: string | null) {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 60 + minute;
}
function display(minutes: number) {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
export function shopAvailability(shop?: ShopHours | null, now = Date.now()) {
  if (shop?.acceptingOrders === false) return { isOpen: false, label: "Temporarily closed", message: "This shop has temporarily stopped accepting orders." };
  const opening = businessMinutes(shop?.openingTime), closing = businessMinutes(shop?.closingTime);
  if (opening === null || closing === null || opening === closing) {
    return { isOpen: false, label: "Hours unavailable", message: "This shop needs valid opening and closing hours before it can accept orders." };
  }
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const minute = Number(parts.find(part => part.type === "hour")?.value) * 60 + Number(parts.find(part => part.type === "minute")?.value);
  const isOpen = opening < closing ? minute >= opening && minute < closing : minute >= opening || minute < closing;
  const hours = `${display(opening)}–${display(closing)} (Philippine time)`;
  if (isOpen) return { isOpen, label: "Open now", message: `Open now. Business hours: ${hours}.` };
  const beforeOpening = opening < closing && minute < opening;
  return { isOpen, label: beforeOpening ? "Not open yet" : "Closed",
    message: beforeOpening ? `This shop has not opened yet. Opens at ${display(opening)} (Philippine time).` : `This shop is closed. Orders are accepted during ${hours}.` };
}
