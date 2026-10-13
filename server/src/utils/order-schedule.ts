export function deliveryScheduleError(input: {
  serviceName: string;
  deliveryType: string;
  scheduledDate: string;
  scheduledTime: string;
}, now = Date.now()) {
  if (input.deliveryType !== 'Deliver' || !/full[\s-]*service/i.test(input.serviceName)) return null;
  const earliest = now + 120 * 60000;
  return [input.scheduledDate, input.scheduledTime].some(value => Date.parse(value) < earliest)
    ? 'Full Service delivery must be scheduled at least 2 hours after placing your order.'
    : null;
}
