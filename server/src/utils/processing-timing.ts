type ServiceTimes = { serviceName: string; washingMinutes?: number | null; dryingMinutes?: number | null };
type TimingOrder = {
  serviceName: string; status: string; workflowStatus?: string | null;
  washingMinutes?: number | null; dryingMinutes?: number | null;
  processingStartedAt?: Date | string | null; dryingStartedAt?: Date | string | null;
  washingStartedAt?: Date | string | null;
  processingTimingCapturedAt?: Date | string | null;
};
type TimingEvent = { toStatus: string; fromStatus?: string | null; createdAt: Date | string };
export const serviceTimingSelection = { serviceName: true, washingMinutes: true, dryingMinutes: true } as const;
export const processingEventSelection = {
  where: { action: { in: ['wash', 'dry'] } },
  orderBy: { createdAt: 'asc' as const },
  select: { fromStatus: true, toStatus: true, createdAt: true },
};

export function serviceProcessingTimes(serviceName: string, services: ServiceTimes[] = []) {
  const exact = services.find(service => service.serviceName === serviceName);
  const selected = exact ? [exact] : serviceName.split(', ').map(name => services.find(service => service.serviceName === name));
  const sum = (key: 'washingMinutes' | 'dryingMinutes') => selected.length && selected.every(service => service && Number.isSafeInteger(service[key]) && Number(service[key]) > 0)
    ? selected.reduce((total, service) => total + service![key]!, 0) : null;
  return { washingMinutes: sum('washingMinutes'), dryingMinutes: sum('dryingMinutes') };
}

// Old in-progress orders can display explicitly labelled current-service estimates.
// New orders capture durations once when processing starts, even if unconfigured.
export function withProcessingTiming<T extends TimingOrder>(order: T, services: ServiceTimes[], events: TimingEvent[] = []) {
  const processing = order.workflowStatus ? ['Washing', 'Drying', 'Folding'].includes(order.workflowStatus) : order.status === 'Processing';
  const captured = !!order.processingTimingCapturedAt;
  const times = captured ? { washingMinutes: order.washingMinutes ?? null, dryingMinutes: order.dryingMinutes ?? null }
    : processing ? serviceProcessingTimes(order.serviceName, services) : {};
  const entered = (stage: string) => events.find(event => event.toStatus === stage && event.fromStatus !== stage)?.createdAt;
  return { ...order, ...times,
    processingStartedAt: order.processingStartedAt || entered('Washing') || null,
    washingStartedAt: order.washingStartedAt || (order.workflowStatus ? entered('Washing') || order.processingStartedAt : null) || null,
    dryingStartedAt: order.dryingStartedAt || entered('Drying') || null,
    processingTimingSource: captured ? 'snapshot' as const : 'current-service' as const,
  };
}
