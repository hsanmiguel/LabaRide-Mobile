import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendError, sendSuccess } from '../utils/response';
import { prepareShopPhoto } from '../utils/shop-photo';

function profileId(req: Request) {
  const id = Number(req.params.userId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export class UserPhotoController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const id = profileId(req);
      if (!id) return sendError(res, 'Choose a valid user', 'BAD_REQUEST', 400);
      const photo = await prisma.userPhoto.findUnique({ where: { userId: id } });
      if (!photo) { res.setHeader('Cache-Control', 'no-store'); return sendError(res, 'Profile photo not found', 'NOT_FOUND', 404); }
      const etag = `"${createHash('sha256').update(photo.bytes).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (req.headers['if-none-match'] === etag) return res.status(304).end();
      return res.status(200).send(photo.bytes);
    } catch (error) { next(error); }
  }

  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = profileId(req);
      if (!id) return sendError(res, 'Choose a valid user', 'BAD_REQUEST', 400);
      if (id !== req.user?.userId) return sendError(res, 'You can only update your own profile photo', 'FORBIDDEN', 403);
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return sendError(res, 'User not found', 'NOT_FOUND', 404);
      const bytes = await prepareShopPhoto(req.body);
      const photo = await prisma.userPhoto.upsert({ where: { userId: id }, create: { userId: id, bytes }, update: { bytes }, select: { updatedAt: true } });
      return sendSuccess(res, { photoUrl: `/api/users/${id}/photo?v=${photo.updatedAt.getTime()}` }, 'Profile photo updated');
    } catch (error) { next(error); }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = profileId(req);
      if (!id) return sendError(res, 'Choose a valid user', 'BAD_REQUEST', 400);
      if (id !== req.user?.userId) return sendError(res, 'You can only update your own profile photo', 'FORBIDDEN', 403);
      await prisma.userPhoto.deleteMany({ where: { userId: id } });
      return sendSuccess(res, { photoUrl: null }, 'Profile photo removed');
    } catch (error) { next(error); }
  }
}
