import { stageEarnings } from './delivery-fees';
type Event = { action: string; toStatus: string; actorId: number; createdAt: Date; detail?: string | null };
export type PerformanceJob = { id: number; riderId: number; transactionId: number; stage: string; status: string;
  createdAt: Date; updatedAt: Date; acceptedAt?: Date | null; completedAt?: Date | null;
  transaction: { kiloAmount: unknown; deliveryPricing?: unknown; shop: { shopName: string }; events: Event[] } };
const day = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
const validTime = (date?: Date | null) => date && Number.isFinite(date.getTime()) ? date : null;
export function performanceSummary(jobs: PerformanceJob[], now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86400000);
  const timings = jobs.map(job => {
    const events = job.transaction.events.filter(event => event.actorId === job.riderId && event.createdAt >= job.createdAt && event.createdAt <= job.updatedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const startEvent = events.find(event => ['JobClaimed', 'AssignmentAccepted'].includes(event.action)
      && event.toStatus.startsWith(job.stage === 'Pickup' ? 'Pickup' : 'Delivery'));
    const endEvent = [...events].reverse().find(event => job.stage === 'Pickup'
      ? event.action === 'droppedOff' && event.toStatus === 'AtPartner'
      : event.action === 'delivered' && event.toStatus === 'Delivered' || event.action === 'HandoffReceived' && event.toStatus === 'Completed' && event.detail?.includes(`Assignment #${job.id} `));
    const start = validTime(job.acceptedAt) || startEvent?.createdAt;
    const end = validTime(job.completedAt) || endEvent?.createdAt;
    const duration = start && end && end >= start && end <= now ? (end.getTime() - start.getTime()) / 60000 : null;
    return { job, finished: end || job.updatedAt, duration };
  });
  const outcomes = timings.filter(item => ['Completed', 'Failed'].includes(item.job.status) && item.finished >= since && item.finished <= now);
  const completed = outcomes.filter(item => item.job.status === 'Completed');
  const average = (stage: string) => {
    const samples = completed.filter(item => item.job.stage === stage && item.duration !== null);
    return { minutes: samples.length ? Math.round(samples.reduce((sum, item) => sum + item.duration!, 0) / samples.length * 10) / 10 : null, samples: samples.length };
  };
  const totalKilos = completed.reduce((sum, item) => { const kilos = Number(item.job.transaction.kiloAmount); return sum + (Number.isFinite(kilos) && kilos > 0 ? kilos : 0); }, 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86400000);
    return { date: day(date), label: date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' }),
      completed: completed.filter(item => day(item.finished) === day(date)).length };
  });
  const earnings = (stage: string) => Math.round(completed.filter(item => item.job.stage === stage).reduce((sum, item) => sum + (stageEarnings(item.job.transaction.deliveryPricing, stage) || 0), 0) * 100) / 100;
  return { pickupEarnings: earnings('Pickup'), returnEarnings: earnings('Delivery'), periodDays: 30, generatedAt: now.toISOString(), completed: completed.length, failed: outcomes.length - completed.length,
    completionRate: outcomes.length ? Math.round(completed.length / outcomes.length * 1000) / 10 : null,
    active: jobs.filter(job => ['Offered', 'Accepted'].includes(job.status)).length,
    averagePickup: average('Pickup'), averageDelivery: average('Delivery'),
    averageJobsPerDay: Math.round(completed.length / 30 * 10) / 10,
    averageKilosPerJob: completed.length ? Math.round(totalKilos / completed.length * 10) / 10 : null,
    pickups: completed.filter(item => item.job.stage === 'Pickup').length,
    deliveries: completed.filter(item => item.job.stage === 'Delivery').length, week,
    recent: [...timings].sort((a, b) => b.job.updatedAt.getTime() - a.job.updatedAt.getTime()).slice(0, 6).map(({ job, duration }) => ({
      id: job.id, orderId: job.transactionId, stage: job.stage, status: job.status, shopName: job.transaction.shop.shopName,
      updatedAt: job.updatedAt.toISOString(), minutes: job.status === 'Completed' ? duration : null,
    })),
  };
}
