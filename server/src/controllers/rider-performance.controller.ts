import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendError, sendSuccess } from '../utils/response';
import { performanceSummary } from '../services/rider-performance';

export class RiderPerformanceController {
  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.isRider) return sendError(res, 'Rider access required', 'FORBIDDEN', 403);
      const jobs = await prisma.deliveryAssignment.findMany({ where: { riderId: req.user.userId,
        OR: [{ updatedAt: { gte: new Date(Date.now() - 30 * 86400000) } }, { status: { in: ['Offered', 'Accepted'] } }] },
        select: { id: true, riderId: true, transactionId: true, stage: true, status: true, createdAt: true, updatedAt: true,
          acceptedAt: true, completedAt: true, transaction: { select: { kiloAmount: true, deliveryPricing: true, shop: { select: { shopName: true } },
            events: { where: { actorId: req.user.userId, action: { in: ['JobClaimed', 'AssignmentAccepted', 'droppedOff', 'delivered', 'HandoffReceived'] } },
              select: { action: true, toStatus: true, actorId: true, createdAt: true, detail: true } } } } } });
      res.setHeader('Cache-Control', 'private, no-store');
      return sendSuccess(res, performanceSummary(jobs));
    } catch (error) { next(error); }
  }
}
