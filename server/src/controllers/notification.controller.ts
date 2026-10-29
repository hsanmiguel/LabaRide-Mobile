import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

function notificationScope(req: AuthRequest) {
  return { userId: req.user!.userId, ...(req.query.audience === 'rider' || req.query.audience === 'admin'
    ? { audience: String(req.query.audience) }
    : { shopMode: req.query.shopMode === 'true', audience: { notIn: ['rider', 'admin'] } }) };
}

export function riderHandoff(order: { workflowStatus: string | null; pickupCode: string | null; collectionCode: string | null; deliveryCode: string | null; assignments: { riderId: number; status: string; stage: string }[] }, userId: number) {
  const job = order.assignments.find(job => job.riderId === userId && job.status === 'Accepted');
  if (!job) return undefined;
  if (job.stage === 'Pickup' && ['PickupAccepted', 'PickupEnRoute'].includes(order.workflowStatus || '')) return order.pickupCode ? { label: 'Customer laundry pickup', code: order.pickupCode } : undefined;
  if (job.stage === 'Delivery' && order.workflowStatus === 'DeliveryAccepted') return order.collectionCode ? { label: 'Clean laundry collection from shop', code: order.collectionCode } : undefined;
  if (job.stage === 'Delivery' && ['CleanLaundryCollected', 'OutForDelivery'].includes(order.workflowStatus || '')) return order.deliveryCode ? { label: 'Customer delivery receipt', code: order.deliveryCode } : undefined;
  return undefined;
}

export class NotificationController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const notifications = await prisma.notification.findMany({
        where: notificationScope(req),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (req.query.audience !== 'rider') return sendSuccess(res, notifications);
      // Resolve current access at read time: never store codes in historical notifications.
      const orders = await prisma.transaction.findMany({
        where: { id: { in: [...new Set(notifications.map(item => item.transactionId))] }, assignments: { some: { riderId: req.user!.userId, status: 'Accepted' } } },
        select: { id: true, workflowStatus: true, pickupCode: true, collectionCode: true, deliveryCode: true, assignments: { where: { riderId: req.user!.userId, status: 'Accepted' }, select: { riderId: true, status: true, stage: true } } },
      });
      const byId = new Map(orders.map(order => [order.id, order]));
      const shown = new Set<number>();
      return sendSuccess(res, notifications.map(item => {
        const order = byId.get(item.transactionId);
        const handoff = !shown.has(item.transactionId) && order ? riderHandoff(order, req.user!.userId) : undefined;
        shown.add(item.transactionId);
        return { ...item, handoff };
      }));
    } catch (error) { next(error); }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return sendError(res, 'Invalid notification', 'BAD_REQUEST', 400);
      const where = { id, userId: req.user!.userId };
      const notification = await prisma.notification.findFirst({ where });
      if (!notification) return sendError(res, 'Notification not found', 'NOT_FOUND', 404);
      await prisma.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
      return sendSuccess(res, { id });
    } catch (error) { next(error); }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return sendError(res, 'Invalid notification', 'BAD_REQUEST', 400);
      const where = { id, userId: req.user!.userId };
      const notification = await prisma.notification.findFirst({ where });
      if (!notification) return sendError(res, 'Notification not found', 'NOT_FOUND', 404);
      if (!notification.readAt) return sendError(res, 'Read this notification before deleting it.', 'NOTIFICATION_UNREAD', 409);
      await prisma.notification.deleteMany({ where: { ...where, readAt: { not: null } } });
      return sendSuccess(res, { id });
    } catch (error) { next(error); }
  }

  static async removeRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await prisma.notification.deleteMany({ where: { ...notificationScope(req), readAt: { not: null } } });
      return sendSuccess(res, { deleted: result.count });
    } catch (error) { next(error); }
  }
}
