export function deliveryLeadMinutes(serviceName: string, deliveryType: string) {
  return deliveryType === 'Deliver' && /full[\s-]*service/i.test(serviceName) ? 120 : 0;
}

export function deliveryScheduleError(input: {
  serviceName: string;
  deliveryType: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
}, now = Date.now()) {
  const lead = deliveryLeadMinutes(input.serviceName, input.deliveryType);
  if (!lead) return null;
  const earliest = now + lead * 60000;
  return [input.scheduledDate, input.scheduledTime].some(value => !value || !Number.isFinite(Date.parse(value)) || Date.parse(value) < earliest)
    ? 'Full Service delivery must be scheduled at least 2 hours after placing your order.'
    : null;
}
