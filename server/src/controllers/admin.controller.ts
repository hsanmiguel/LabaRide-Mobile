import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { approvalStatus, reviewShopSchema } from '../validators/admin.validator';
import type { Server } from 'socket.io';
import { shopRequirementsMissing } from '../utils/shop-requirements';
import { fail } from '../services/dispatch.service';

const applicationInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

export class AdminController {
  static async shops(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status === undefined ? undefined : approvalStatus.parse(req.query.status);
      const shops = await prisma.shop.findMany({
        where: status ? { approvalStatus: status } : {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: applicationInclude,
      });
      return sendSuccess(res, shops, 'Shop applications retrieved');
    } catch (error) { next(error); }
  }

  static async review(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { params: { shopId }, body } = reviewShopSchema.parse(req);
      const result = await prisma.$transaction(async tx => {
        const updated = await tx.shop.updateMany({
          where: { id: shopId, approvalStatus: body.expectedStatus, applicationVersion: body.expectedVersion },
          data: { approvalStatus: body.status, reviewReason: body.reason || null,
            reviewedAt: new Date(), reviewedById: req.user!.userId },
        });
        if (!updated.count) return null;
        const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId }, include: applicationInclude });
        if (body.status === 'Approved' && shop.requirementsVersion >= 1) {
          const documents = await tx.shopDocument.findMany({ where: { shopId }, select: { type: true, status: true } });
          const missing = shopRequirementsMissing(documents);
          if (missing.length) fail(`Verify the required shop documents before approval: ${missing.join(', ')}`, 400);
        }
        await tx.user.update({ where: { id: shop.userId }, data: { isShopOwner: body.status === 'Approved' } });
        return shop;
      });
      if (!result) return sendError(res, 'Shop status changed or the shop no longer exists. Refresh and try again.', 'CONFLICT', 409);
      if (body.status !== 'Approved') (req.app.get('io') as Server | undefined)?.in(`shop_${shopId}`).socketsLeave(`shop_${shopId}`);
      return sendSuccess(res, result, `Shop ${body.status.toLowerCase()} successfully`);
    } catch (error) { next(error); }
  }
}
