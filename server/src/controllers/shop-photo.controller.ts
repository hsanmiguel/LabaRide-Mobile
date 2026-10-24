import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendError, sendSuccess } from '../utils/response';
import { prepareShopPhoto } from '../utils/shop-photo';

function shopId(req: Request) {
  const id = Number(req.params.shopId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export class ShopPhotoController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const id = shopId(req);
      if (!id) return sendError(res, 'Choose a valid shop', 'BAD_REQUEST', 400);
      const photo = await prisma.shopPhoto.findFirst({ where: { shopId: id, shop: { approvalStatus: 'Approved' } } });
      if (!photo) { res.setHeader('Cache-Control', 'no-store'); return sendError(res, 'Shop photo not found', 'NOT_FOUND', 404); }
      const etag = `"${createHash('sha256').update(photo.bytes).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Native and web clients may load the image from a different API origin.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (req.headers['if-none-match'] === etag) return res.status(304).end();
      return res.status(200).send(photo.bytes);
    } catch (error) { next(error); }
  }

  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = shopId(req);
      if (!id) return sendError(res, 'Choose a valid shop', 'BAD_REQUEST', 400);
      const shop = await prisma.shop.findUnique({ where: { id }, select: { userId: true } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user?.userId) return sendError(res, 'Only the shop owner can upload a shop photo', 'FORBIDDEN', 403);
      const bytes = await prepareShopPhoto(req.body);
      const photo = await prisma.shopPhoto.upsert({ where: { shopId: id }, create: { shopId: id, bytes }, update: { bytes }, select: { updatedAt: true } });
      return sendSuccess(res, { photoUrl: `/api/shops/${id}/photo?v=${photo.updatedAt.getTime()}` }, 'Shop photo updated');
    } catch (error) { next(error); }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = shopId(req);
      if (!id) return sendError(res, 'Choose a valid shop', 'BAD_REQUEST', 400);
      const shop = await prisma.shop.findUnique({ where: { id }, select: { userId: true } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user?.userId) return sendError(res, 'Only the shop owner can remove a shop photo', 'FORBIDDEN', 403);
      await prisma.shopPhoto.deleteMany({ where: { shopId: id } });
      return sendSuccess(res, { photoUrl: null }, 'Shop photo removed');
    } catch (error) { next(error); }
  }
}
