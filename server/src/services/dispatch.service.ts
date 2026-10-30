import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { addressSchema } from '../validators/address.validator';

// Collection and return addresses can differ. Legacy orders use their saved address.
export function collectionPoint<T extends { collectionMethod?: string; collectionAddress?: unknown }>(order: T) {
  const parsed = order.collectionMethod === 'ShopPickup' && addressSchema.safeParse(order.collectionAddress);
  return parsed && parsed.success ? { ...order, ...parsed.data,
    address_line_2: parsed.data.address_line_2 ?? null,
    latitude: parsed.data.latitude ?? null, longitude: parsed.data.longitude ?? null,
    dropoff_instructions: parsed.data.dropoff_instructions ?? null, access_code: parsed.data.access_code ?? null,
  } : order;
}

export const AUTOMATIC_DISPATCH_ENABLED = false;
export const confirmationCode = () => String(randomInt(100000, 1000000));
export const openAssignments = ['Offered', 'Accepted'];
export const claimableStatuses = ['PickupQueued', 'ReadyForDelivery'];
export const jobTransitions: Record<string, { from: string; to: string; stage: string; proof?: 'pickupCode' | 'collectionCode' | 'deliveryCode'; done?: boolean }> = {
  enRoute: { from: 'PickupAccepted', to: 'PickupEnRoute', stage: 'Pickup' },
  pickedUp: { from: 'PickupEnRoute', to: 'LaundryPickedUp', stage: 'Pickup', proof: 'pickupCode' },
  droppedOff: { from: 'LaundryPickedUp', to: 'AtPartner', stage: 'Pickup', done: true },
  collected: { from: 'DeliveryAccepted', to: 'CleanLaundryCollected', stage: 'Delivery', proof: 'collectionCode' },
  outForDelivery: { from: 'CleanLaundryCollected', to: 'OutForDelivery', stage: 'Delivery' },
  delivered: { from: 'OutForDelivery', to: 'Delivered', stage: 'Delivery', proof: 'deliveryCode', done: true },
};
export const partnerTransitions: Record<string, { from: string; to: string }> = {
  receive: { from: 'AtPartner', to: 'LaundryReceived' },
  wash: { from: 'LaundryReceived', to: 'Washing' },
  dry: { from: 'Washing', to: 'Drying' },
  fold: { from: 'Drying', to: 'Folding' },
  ready: { from: 'Folding', to: 'ReadyForDelivery' },
};

export function fail(message: string, status = 409): never {
  throw Object.assign(new Error(message), { statusCode: status, code: status === 403 ? 'FORBIDDEN' : 'WORKFLOW_CONFLICT' });
}

// The order row is always locked before assignment or workflow mutations.
export async function lockOrder(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
  const order = await tx.transaction.findUnique({ where: { id }, include: { shop: true, assignments: true } });
  if (!order) fail('Order not found', 404);
  if (!order.workflowStatus) fail('This order uses the original self-service workflow');
  return order;
}

export async function recordEvent(tx: Prisma.TransactionClient, order: { id: number; userId: number; shop: { userId: number }; workflowStatus: string | null }, actorId: number, action: string, to: string, detail?: string, riderId?: number) {
  await tx.orderEvent.create({ data: { transactionId: order.id, actorId, action, fromStatus: order.workflowStatus, toStatus: to, detail } });
  const admins = await tx.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const title = action === 'JobClaimed' ? `${to.startsWith('Pickup') ? 'Pickup' : 'Delivery'} job claimed by rider` : action === 'WeightAndPriceUpdated' ? 'Measured weight and scale photo updated' : action === 'HandoffArrived' ? 'Rider arrived — confirm the handover in order details' : action === 'HandoffReleased' ? 'Handover confirmed — rider can confirm receipt' : to.replace(/([a-z])([A-Z])/g, '$1 $2');
  const message = `Order #${order.id}: ${title}.${detail ? ` ${detail}` : ''}`;
  const recipients = [
    { userId: order.userId, audience: 'customer', shopMode: false },
    { userId: order.shop.userId, audience: 'partner', shopMode: true },
    ...admins.map(user => ({ userId: user.id, audience: 'admin', shopMode: false })),
    ...(riderId ? [{ userId: riderId, audience: 'rider', shopMode: false }] : []),
  ];
  await tx.notification.createMany({ data: recipients.map(user => ({ ...user, transactionId: order.id, title, message })) });
}

export async function changeState(tx: Prisma.TransactionClient, order: Awaited<ReturnType<typeof lockOrder>>, actorId: number, action: string, to: string, detail?: string, riderId?: number) {
  await tx.transaction.update({ where: { id: order.id }, data: {
    workflowStatus: to, workflowVersion: { increment: 1 },
    status: to === 'Completed' ? 'Completed' : to === 'Cancelled' ? 'Cancelled' : to === 'BookingPending' ? 'Pending'
      : ['LaundryReceived'].includes(to) ? 'Queued'
      : ['Washing', 'Drying', 'Folding'].includes(to) ? 'Processing'
      : ['ReadyForDelivery', 'ReadyForCollection', 'DeliveryAssigned', 'DeliveryAccepted', 'CleanLaundryCollected', 'OutForDelivery', 'Delivered'].includes(to) ? 'Ready' : 'Accepted',
    ...(action === 'confirmBooking' && order.collectionMethod === 'ShopPickup' ? { confirmedPickupAt: order.requestedPickupAt } : {}),
    ...(to === 'LaundryReceived' && !order.receivedAt ? { receivedAt: new Date() } : {}),
    ...(to === 'Washing' && !order.processingStartedAt ? { processingStartedAt: new Date() } : {}),
    ...(['ReadyForDelivery', 'ReadyForCollection'].includes(to) && !order.readyAt ? { readyAt: new Date() } : {}),
    ...(to === 'Completed' && !order.completedAt ? { completedAt: new Date() } : {}),
    ...(to === 'Cancelled' && !order.cancelledAt ? { cancelledAt: new Date() } : {}),
  } });
  await recordEvent(tx, order, actorId, action, to, detail, riderId);
}

export async function expireOffers(tx: Prisma.TransactionClient) {
  const offers = await tx.deliveryAssignment.findMany({ where: { status: 'Offered', expiresAt: { lte: new Date() } } });
  // Stable order prevents deadlocks between concurrent polling requests.
  for (const offer of offers.sort((a, b) => a.transactionId - b.transactionId)) {
    const order = await lockOrder(tx, offer.transactionId);
    const result = await tx.deliveryAssignment.updateMany({ where: { id: offer.id, status: 'Offered', expiresAt: { lte: new Date() } }, data: { status: 'Expired' } });
    if (result.count && !['Completed', 'Cancelled'].includes(order.workflowStatus!)) {
      await changeState(tx, order, offer.riderId, 'AssignmentExpired', offer.resumeStatus || (offer.stage === 'Pickup' ? 'PickupQueued' : 'ReadyForDelivery'), 'Offer expired. Check Available Jobs or contact an administrator.', offer.riderId);
    }
  }
}

// Recommendation only. No background scheduler or automatic writes are enabled.
export function dispatchStage(status: string | null) {
  if (['PickupQueued', 'PickupAssigned', 'PickupAccepted', 'PickupEnRoute', 'LaundryPickedUp'].includes(status || '')) return 'Pickup' as const;
  if (['ReadyForDelivery', 'DeliveryAssigned', 'DeliveryAccepted', 'CleanLaundryCollected', 'OutForDelivery'].includes(status || '')) return 'Delivery' as const;
  return null;
}

export function dispatchPoint(value: { latitude?: unknown; longitude?: unknown }) {
  if (value.latitude == null || value.longitude == null || value.latitude === '' || value.longitude === '') return undefined;
  const latitude = Number(value.latitude), longitude = Number(value.longitude);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : undefined;
}

export function dispatchDistance(from?: { latitude: number; longitude: number }, to?: { latitude: number; longitude: number }) {
  if (!from || !to) return null;
  const rad = Math.PI / 180;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin((to.latitude - from.latitude) * rad / 2) ** 2 + Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin((to.longitude - from.longitude) * rad / 2) ** 2)));
}

export function recommendRiders<T extends { userId: number; active: boolean; online: boolean; workload: number; latitude: number | null; longitude: number | null }>(riders: T[], origin?: { latitude: number; longitude: number }) {
  const from = origin && dispatchPoint(origin);
  return riders.filter(rider => rider.active && rider.online && rider.workload < 3).map(rider => {
    const to = dispatchPoint(rider);
    const distance = dispatchDistance(from, to);
    return { ...rider, distance };
  }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.workload - b.workload || a.userId - b.userId);
}
