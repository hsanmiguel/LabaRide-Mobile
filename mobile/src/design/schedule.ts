export function scheduleDayAvailable(date: Date, now = new Date(), minimum = now) {
  const today = new Date(minimum.getFullYear(), minimum.getMonth(), minimum.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Number.isFinite(date.getTime()) && day.getTime() >= today.getTime();
}

export function validFutureSchedule(value: string, now = Date.now()) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now;
}

export function deliveryLeadMinutes(serviceName = "", deliveryType = "Deliver") {
  return deliveryType === "Deliver" && /full[\s-]*service/i.test(serviceName) ? 120 : 0;
}

export function deliveryScheduleError(value: string, serviceName = "", deliveryType = "Deliver", now = Date.now()) {
  if (!validFutureSchedule(value, now)) return "Please select a future delivery schedule.";
  const lead = deliveryLeadMinutes(serviceName, deliveryType);
  return lead && Date.parse(value) < now + lead * 60000
    ? "Full Service delivery must be scheduled at least 2 hours after placing your order."
    : null;
}

export function earliestDeliveryTime(serviceName = "", deliveryType = "Deliver", now = Date.now()) {
  const earliest = new Date(Math.ceil((now + deliveryLeadMinutes(serviceName, deliveryType) * 60000) / 60000) * 60000);
  if (earliest.getHours() < 4) earliest.setHours(4, 0, 0, 0);
  return earliest;
}
