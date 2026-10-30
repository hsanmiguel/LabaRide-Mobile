import type { Prisma } from '@prisma/client';
import { serviceProcessingTimes, serviceTimingSelection } from '../utils/processing-timing';

function reject(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode, code: statusCode === 403 ? 'FORBIDDEN' : 'TIMER_CONFLICT' });
}

export async function startProcessingTimer(tx: Prisma.TransactionClient, id: number, ownerId: number, phase: 'washing' | 'drying') {
  await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
  const order = await tx.transaction.findUnique({ where: { id }, include: { shop: { select: { userId: true, approvalStatus: true } } } });
  if (!order) reject('Order not found', 404);
  if (order.shop.userId !== ownerId) reject('Only the shop owner can start laundry timers', 403);
  if (order.shop.approvalStatus !== 'Approved') reject('Shop approval is required to start laundry timers', 403);
  if (order.workflowStatus) reject('Use Start washing or Start drying in this order’s workflow');
  if (order.status !== 'Processing') reject('Start processing before starting a laundry timer');
  if (phase === 'washing' ? order.washingStartedAt : order.dryingStartedAt) return { order, started: false };
  if (phase === 'washing' && order.dryingStartedAt) reject('Drying has already started');
  if (phase === 'drying' && !order.washingStartedAt) reject('Start washing before starting drying');
  const services = await tx.shopService.findMany({ where: { shopId: order.shopId }, select: serviceTimingSelection });
  const configured = serviceProcessingTimes(order.serviceName, services);
  const times = phase === 'washing' ? configured : { washingMinutes: order.washingMinutes, dryingMinutes: order.dryingMinutes ?? configured.dryingMinutes };
  const duration = phase === 'washing' ? times.washingMinutes : times.dryingMinutes;
  if (!duration || duration <= 0) reject(`Set the service’s ${phase} duration in Services before starting this timer`);
  const now = new Date();
  const saved = await tx.transaction.update({ where: { id }, data: {
    ...times, processingTimingCapturedAt: phase === 'washing' ? now : order.processingTimingCapturedAt || now,
    ...(phase === 'washing' ? { washingStartedAt: now } : { dryingStartedAt: now }),
  } });
  await tx.notification.createMany({ data: [
    { userId: order.userId, transactionId: id, shopMode: false, title: `${phase === 'washing' ? 'Washing' : 'Drying'} started`, message: `Order #${id}: the shop started ${phase}.` },
    { userId: ownerId, transactionId: id, shopMode: true, title: `${phase === 'washing' ? 'Washing' : 'Drying'} started`, message: `Order #${id}: ${phase} timer started.` },
  ] });
  return { order: saved, started: true };
}
