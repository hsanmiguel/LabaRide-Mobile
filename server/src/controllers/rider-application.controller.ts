import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import sharp from 'sharp';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { fail } from '../services/dispatch.service';
import { prepareShopPhoto } from '../utils/shop-photo';
import { documentMeta, documentTypes, requirementsMissing, riderDetailsSchema } from '../utils/rider-requirements';

const id = z.coerce.number().int().positive();
const include = { user: { select: { name: true, email: true, phone: true, birthdate: true, address_line_1: true, city: true, state_province: true, postal_code: true } }, documents: { select: documentMeta } };
async function lock(tx: Prisma.TransactionClient, userId: number) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  const profile = await tx.riderProfile.findUnique({ where: { userId }, include });
  if (!profile) fail('Rider application not found', 404);
  return profile;
}
function editable(profile: { active: boolean; applicationStatus: string }) {
  if (profile.active || !['Draft', 'Pending', 'Rejected', 'Disabled'].includes(profile.applicationStatus)) fail('This application cannot be edited');
}

export class RiderApplicationController {
  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id ? id.parse(req.params.id) : req.user!.userId;
      if (userId !== req.user!.userId && !req.user!.isAdmin) fail('Application access denied', 403);
      const profile = await prisma.riderProfile.findUnique({ where: { userId }, include });
      if (!profile) fail('Rider application not found', 404);
      return sendSuccess(res, { ...profile, missing: requirementsMissing(profile) });
    } catch (error) { next(error); }
  }
  static async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = riderDetailsSchema.partial().parse(req.body);
      await prisma.$transaction(async tx => {
        const userId = req.user!.userId;
        editable(await lock(tx, userId));
        const { birthdate, address_line_1, city, state_province, postal_code, licenseExpiry, ...vehicle } = data;
        await tx.user.update({ where: { id: userId }, data: { birthdate: birthdate ? new Date(birthdate) : undefined, address_line_1, city, state_province, postal_code, country: 'Philippines' } });
        await tx.riderProfile.update({ where: { userId }, data: { ...vehicle, licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : undefined, requirementsVersion: 1, applicationStatus: 'Draft', reviewReason: null } });
        // A changed identity/vehicle must be checked against the documents again.
        await tx.riderDocument.updateMany({ where: { userId, status: 'Verified' }, data: { status: 'Pending', reviewedAt: null, reviewedById: null } });
      });
      return sendSuccess(res, { saved: true });
    } catch (error) { next(error); }
  }
  static async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      z.object({ acknowledge: z.literal(true) }).parse(req.body);
      await prisma.$transaction(async tx => {
        const userId = req.user!.userId;
        const profile = await lock(tx, userId);
        editable(profile);
        const missing = requirementsMissing(profile);
        if (missing.length) fail(`Complete these requirements first: ${missing.join(', ')}`, 400);
        if (profile.applicationStatus === 'Pending') fail('Your application is already submitted');
        await tx.riderProfile.update({ where: { userId }, data: { applicationStatus: 'Pending', requirementsVersion: 1, reviewReason: null, reviewedAt: null, reviewedById: null } });
      });
      return sendSuccess(res, { applicationStatus: 'Pending' });
    } catch (error) { next(error); }
  }
  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const type = z.enum(documentTypes).parse(req.params.type);
      const prepared = await prepareShopPhoto(req.body);
      const bytes = type === 'ApplicantPhoto' ? await sharp(prepared).resize(600, 600, { fit: 'cover', position: 'centre' }).jpeg({ quality: 90 }).toBuffer() : prepared;
      await prisma.$transaction(async tx => {
        const userId = req.user!.userId;
        editable(await lock(tx, userId));
        await tx.riderDocument.upsert({ where: { userId_type: { userId, type } }, create: { userId, type, bytes }, update: { bytes, status: 'Pending', reviewReason: null, reviewedAt: null, reviewedById: null } });
        await tx.riderProfile.update({ where: { userId }, data: { applicationStatus: 'Draft', requirementsVersion: 1 } });
      });
      return sendSuccess(res, { uploaded: true });
    } catch (error) { next(error); }
  }
  static async image(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = id.parse(req.params.id), type = z.enum(documentTypes).parse(req.params.type);
      if (!req.user!.isAdmin && req.user!.userId !== userId) fail('Document access denied', 403);
      const document = await prisma.riderDocument.findUnique({ where: { userId_type: { userId, type } } });
      if (!document) fail('Document not found', 404);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(document.bytes);
    } catch (error) { next(error); }
  }
  static async reviewDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = id.parse(req.params.id), type = z.enum(documentTypes).parse(req.params.type);
      const body = z.object({ status: z.enum(['Verified', 'Rejected']), reason: z.string().trim().min(5).max(1000).optional(), expectedUpdatedAt: z.string().datetime() }).parse(req.body);
      if (body.status === 'Rejected' && !body.reason) fail('Explain which document needs correction', 400);
      await prisma.$transaction(async tx => {
        const profile = await lock(tx, userId);
        if (profile.applicationStatus !== 'Pending') fail('The applicant is editing or this application was already reviewed');
        const updated = await tx.riderDocument.updateMany({ where: { userId, type, updatedAt: new Date(body.expectedUpdatedAt) }, data: { status: body.status, reviewReason: body.reason || null, reviewedById: req.user!.userId, reviewedAt: new Date() } });
        if (!updated.count) fail('Document changed. Refresh before reviewing.');
        if (body.status === 'Rejected') await tx.riderProfile.update({ where: { userId }, data: { applicationStatus: 'Rejected', reviewReason: `${type}: ${body.reason}`, reviewedAt: new Date(), reviewedById: req.user!.userId } });
      });
      return sendSuccess(res, { reviewed: true });
    } catch (error) { next(error); }
  }
}
