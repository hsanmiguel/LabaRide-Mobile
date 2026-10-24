import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { fail } from '../services/dispatch.service';
import { prepareShopPhoto } from '../utils/shop-photo';
import { shopDocumentTypes, shopDocumentLabels, shopDocumentMeta, shopRequirementsMissing } from '../utils/shop-requirements';
import { Prisma } from '@prisma/client';
const id = z.coerce.number().int().positive();
async function lockedShop(tx: Prisma.TransactionClient, shopId: number) {
  await tx.$queryRaw`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`;
  const shop = await tx.shop.findUnique({ where: { id: shopId } });
  if (!shop) fail('Shop not found', 404);
  return shop;
}
async function access(req: AuthRequest, shopId: number) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) fail('Shop not found', 404);
  if (!req.user!.isAdmin && req.user!.userId !== shop.userId) fail('Shop document access denied', 403);
  return shop;
}
export class ShopDocumentController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = id.parse(req.params.shopId), shop = await access(req, shopId);
      const documents = await prisma.shopDocument.findMany({ where: { shopId }, select: shopDocumentMeta });
      res.setHeader('Cache-Control', 'private, no-store');
      return sendSuccess(res, { shopId, approvalStatus: shop.approvalStatus, applicationVersion: shop.applicationVersion, requirementsVersion: shop.requirementsVersion,
        documents, missing: shopRequirementsMissing(documents, false), unverified: shopRequirementsMissing(documents), canApprove: !shopRequirementsMissing(documents).length });
    } catch (error) { next(error); }
  }
  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = id.parse(req.params.shopId), type = z.enum(shopDocumentTypes).parse(req.params.type);
      const shop = await access(req, shopId);
      if (shop.userId !== req.user!.userId) fail('Only the shop owner can upload requirements', 403);
      if (!['Pending', 'Rejected'].includes(shop.approvalStatus)) fail('Requirements can be edited while the application is pending or needs correction');
      const bytes = await prepareShopPhoto(req.body);
      await prisma.$transaction(async tx => {
        const current = await lockedShop(tx, shopId);
        if (current.userId !== req.user!.userId || !['Pending', 'Rejected'].includes(current.approvalStatus)) fail('Shop access changed. Refresh before uploading.');
        await tx.shopDocument.upsert({ where: { shopId_type: { shopId, type } }, create: { shopId, type, bytes }, update: { bytes, status: 'Pending', reviewReason: null, reviewedAt: null, reviewedById: null } });
        await tx.shop.update({ where: { id: shopId }, data: { requirementsVersion: 1, approvalStatus: 'Pending', applicationVersion: { increment: 1 }, reviewReason: null } });
      });
      return sendSuccess(res, { uploaded: true });
    } catch (error) { next(error); }
  }
  static async image(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = id.parse(req.params.shopId), type = z.enum(shopDocumentTypes).parse(req.params.type);
      await access(req, shopId);
      const doc = await prisma.shopDocument.findUnique({ where: { shopId_type: { shopId, type } }, select: { bytes: true } });
      if (!doc) fail('Document not found', 404);
      res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(doc.bytes);
    } catch (error) { next(error); }
  }
  static async review(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = id.parse(req.params.shopId), type = z.enum(shopDocumentTypes).parse(req.params.type);
      const body = z.object({ status: z.enum(['Verified', 'Rejected']), reason: z.string().trim().min(5).max(1000).optional(), expectedUpdatedAt: z.string().datetime() }).parse(req.body);
      if (body.status === 'Rejected' && !body.reason) fail('Explain what the owner needs to correct', 400);
      await prisma.$transaction(async tx => {
        const shop = await lockedShop(tx, shopId);
        if (shop.approvalStatus !== 'Pending') fail('The shop must be pending review. Refresh this application.');
        const updated = await tx.shopDocument.updateMany({ where: { shopId, type, updatedAt: new Date(body.expectedUpdatedAt) }, data: { status: body.status, reviewReason: body.reason || null, reviewedAt: new Date(), reviewedById: req.user!.userId } });
        if (!updated.count) fail('Document changed. Refresh before reviewing.');
        await tx.shop.update({ where: { id: shopId }, data: { applicationVersion: { increment: 1 }, ...(body.status === 'Rejected' ? { approvalStatus: 'Rejected', reviewReason: `${shopDocumentLabels[type]}: ${body.reason}` } : {}) } });
      });
      return sendSuccess(res, { reviewed: true });
    } catch (error) { next(error); }
  }
}
