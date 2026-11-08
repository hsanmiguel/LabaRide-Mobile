import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { calculateFee, feeFingerprint, roadKilometers, feeError } from '../services/delivery-fees';

const amount = z.number().finite().min(0).max(100000).refine(n => n === Number(n.toFixed(2)), 'Use at most two decimal places');
const policySchema = z.object({ baseFee: amount, ratePerKm: amount, minimumFee: amount, commissionPercent: amount.refine(n => n <= 100), revision: z.number().int().nonnegative() }).strict();
const point = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const quoteSchema = z.object({ shopId: z.number().int().positive(), collectionMethod: z.enum(['ShopPickup', 'Dropoff']), deliveryType: z.enum(['Deliver', 'Pickup']),
  latitude: point.shape.latitude.optional(), longitude: point.shape.longitude.optional(), collectionAddress: point.optional() }).strict();
export class DeliveryFeesController {
  static async settings(req: AuthRequest, res: Response, next: NextFunction) {
    try { return sendSuccess(res, await prisma.deliveryFeeSettings.findUnique({ where: { id: 1 } })); } catch (error) { next(error); }
  }
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { revision, ...values } = policySchema.parse(req.body);
      const result = await prisma.$transaction(async tx => {
        // One advisory lock also serializes first-time setup, when no row exists yet.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(710234)`;
        const current = await tx.deliveryFeeSettings.findUnique({ where: { id: 1 } });
        if ((current?.revision || 0) !== revision) feeError('Settings changed. Refresh before saving.');
        return tx.deliveryFeeSettings.upsert({ where: { id: 1 }, create: { id: 1, ...values, updatedBy: req.user!.userId }, update: { ...values, revision: { increment: 1 }, updatedBy: req.user!.userId } });
      });
      return sendSuccess(res, result);
    } catch (error) { next(error); }
  }
  static async quote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.isRider || req.user?.isAdmin || req.user?.riderApplicationStatus) return sendError(res, 'Use a customer account to request a delivery quote.', 'FORBIDDEN', 403);
      const booking = quoteSchema.parse(req.body);
      const shop = await prisma.shop.findUnique({ where: { id: booking.shopId } });
      if (!shop || shop.approvalStatus !== 'Approved') feeError('This shop is unavailable.');
      const policy = await prisma.deliveryFeeSettings.findUnique({ where: { id: 1 } });
      if (!policy) feeError('Delivery rates have not been configured by the administrator.');
      const fingerprint = feeFingerprint(booking, shop!);
      const existing = await prisma.deliveryFeeQuote.findFirst({ where: { userId: req.user!.userId, fingerprint, usedAt: null, expiresAt: { gt: new Date(Date.now() + 60000) } }, orderBy: { createdAt: 'desc' } });
      if (existing) return sendSuccess(res, existing);
      const [pickupKm, returnKm] = await Promise.all([
        booking.collectionMethod === 'ShopPickup' ? roadKilometers(booking.collectionAddress || {}, shop!) : 0,
        booking.deliveryType === 'Deliver' ? roadKilometers(shop!, booking) : 0,
      ]);
      const pricing = calculateFee(policy!, pickupKm, returnKm, booking.collectionMethod === 'ShopPickup', booking.deliveryType === 'Deliver');
      const quote = await prisma.deliveryFeeQuote.create({ data: { userId: req.user!.userId, fingerprint, pricing, expiresAt: new Date(Date.now() + 30 * 60000) } });
      res.setHeader('Cache-Control', 'private, no-store');
      return sendSuccess(res, quote);
    } catch (error) { next(error); }
  }
}
