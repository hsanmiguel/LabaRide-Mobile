import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';

export class NotificationController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.userId, shopMode: req.query.shopMode === 'true' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return sendSuccess(res, notifications);
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
}
