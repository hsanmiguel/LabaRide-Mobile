import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { registerShopSchema, createServiceSchema, createKiloPriceSchema } from '../validators/shop.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { formatAddress } from '../validators/address.validator';
import { userProfileSelect } from '../utils/user-profile';
import { shopPhotoSelection, withShopPhoto } from '../utils/shop-photo';
import { distanceSettingsError } from '../utils/service-area';
import { shopChangesRequireReview } from '../utils/shop-review';

export class ShopController {
  
  static async registerShop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = registerShopSchema.parse(req).body;
      const userId = req.user!.userId;

      // Check if user already has a shop
      const existingShop = await prisma.shop.findUnique({ where: { userId } });
      if (existingShop) {
        return sendError(res, 'User already has a registered shop', 'CONFLICT', 409);
      }

      // A nested write atomically creates the shop and updates ownership.
      const result = await prisma.user.update({
        where: { id: userId },
        data: {
          isShopOwner: false,
          shop: { create: { ...validatedData, address: formatAddress(validatedData), approvalStatus: 'Pending' } },
        },
        select: { ...userProfileSelect, shop: true },
      });
      const { shop, ...user } = result;
      const token = jwt.sign({ userId, isShopOwner: false }, env.JWT_SECRET, { expiresIn: '7d' });
      return sendSuccess(res, { ...(shop ? withShopPhoto(shop) : {}), user, token }, 'Shop application submitted for admin approval', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateShop(req: AuthRequest, res: Response, next: NextFunction) {
    return ShopController.saveApplication(req, res, next, 'Approved');
  }

  static async resubmitApplication(req: AuthRequest, res: Response, next: NextFunction) {
    return ShopController.saveApplication(req, res, next, 'Rejected');
  }

  private static async saveApplication(req: AuthRequest, res: Response, next: NextFunction, expectedStatus: 'Approved' | 'Rejected') {
    try {
      const shopId = Number(req.params.shopId);
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user!.userId) {
        return sendError(res, 'Only the shop owner can update this shop', 'FORBIDDEN', 403);
      }
      if (shop.approvalStatus !== expectedStatus) {
        return sendError(res, 'Refresh your application before making changes', 'CONFLICT', 409);
      }
      const data = registerShopSchema.parse(req).body;
      const updated = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`;
        const current = await tx.shop.findUnique({ where: { id: shopId } });
        if (!current || current.approvalStatus !== expectedStatus || current.userId !== req.user!.userId) return null;
        const areaError = distanceSettingsError({ ...current, ...data });
        if (areaError) throw Object.assign(new Error(areaError), { statusCode: 400 });
        const needsReview = expectedStatus === 'Rejected' || shopChangesRequireReview(current, data);
        const changed = await tx.shop.updateMany({
          where: { id: shopId, approvalStatus: expectedStatus, applicationVersion: current.applicationVersion },
          data: { ...data, address: formatAddress(data), ...(needsReview ? {
            approvalStatus: 'Pending', applicationVersion: { increment: 1 }, reviewReason: null, reviewedAt: null, reviewedById: null,
          } : {}) },
        });
        if (!changed.count) return null;
        if (needsReview) await tx.user.update({ where: { id: current.userId }, data: { isShopOwner: false } });
        return tx.shop.findUniqueOrThrow({ where: { id: shopId }, include: { photo: shopPhotoSelection } });
      });
      if (!updated) return sendError(res, 'Shop status changed. Refresh and try again.', 'CONFLICT', 409);
      return sendSuccess(res, withShopPhoto(updated), updated.approvalStatus === 'Approved'
        ? 'Shop details updated successfully' : 'Shop details submitted for admin approval');
    } catch (error) { next(error); }
  }

  static async getAllShops(req: Request, res: Response, next: NextFunction) {
    try {
      const shops = await prisma.shop.findMany({
        where: { approvalStatus: 'Approved' },
        include: {
          photo: shopPhotoSelection,
          services: true,
          kiloPrices: true
        }
      });
      return sendSuccess(res, shops.map(withShopPhoto), 'Shops retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getRecentShops(req: Request, res: Response, next: NextFunction) {
    try {
      const shops = await prisma.shop.findMany({
        where: { approvalStatus: 'Approved' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { services: true, photo: shopPhotoSelection }
      });
      return sendSuccess(res, shops.map(withShopPhoto), 'Recent shops retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getShopById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: {
          photo: shopPhotoSelection,
          services: true,
          kiloPrices: true,
          householdItems: true,
          clothingTypes: true
        }
      });

      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.approvalStatus !== 'Approved' && shop.userId !== req.user?.userId && !req.user?.isAdmin) {
        return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      }
      return sendSuccess(res, withShopPhoto(shop), 'Shop details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getShopByUserId(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      if (userId !== req.user?.userId && !req.user?.isAdmin) return sendError(res, 'You can only view your own application', 'FORBIDDEN', 403);
      const shop = await prisma.shop.findUnique({
        where: { userId },
        include: { services: true, photo: shopPhotoSelection }
      });

      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      return sendSuccess(res, withShopPhoto(shop), 'Shop details retrieved');
    } catch (error) {
      next(error);
    }
  }

  // SERVICES
  static async addService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const validatedData = createServiceSchema.parse(req).body;

      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user!.userId) return sendError(res, 'Only the shop owner can set service prices', 'FORBIDDEN', 403);
      const service = await prisma.shopService.create({
        data: { ...validatedData, shopId }
      });

      return sendSuccess(res, service, 'Service added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      const serviceId = Number(req.params.serviceId);
      const validatedData = createServiceSchema.parse(req).body;
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user!.userId) return sendError(res, 'Only the shop owner can set service prices', 'FORBIDDEN', 403);
      const updated = await prisma.shopService.updateMany({
        where: { id: serviceId, shopId }, data: validatedData,
      });
      if (!updated.count) return sendError(res, 'Service not found', 'NOT_FOUND', 404);
      return sendSuccess(res, await prisma.shopService.findUnique({ where: { id: serviceId } }), 'Service updated successfully');
    } catch (error) { next(error); }
  }

  static async deleteService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      const serviceId = Number(req.params.serviceId);
      if (!Number.isSafeInteger(shopId) || shopId <= 0 || !Number.isSafeInteger(serviceId) || serviceId <= 0) {
        return sendError(res, 'Choose a valid shop and service', 'BAD_REQUEST', 400);
      }
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user!.userId) return sendError(res, 'Only the shop owner can delete services', 'FORBIDDEN', 403);
      const deleted = await prisma.shopService.deleteMany({ where: { id: serviceId, shopId } });
      if (!deleted.count) return sendError(res, 'Service not found', 'NOT_FOUND', 404);
      return sendSuccess(res, { id: serviceId }, 'Service deleted successfully');
    } catch (error) { next(error); }
  }

  // KILO PRICES
  static async addKiloPrice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const validatedData = createKiloPriceSchema.parse(req).body;

      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user!.userId) return sendError(res, 'Only the shop owner can set weight prices', 'FORBIDDEN', 403);
      const overlap = await prisma.kiloPrice.findFirst({ where: {
        shopId,
        minKilo: { lte: validatedData.maxKilo },
        maxKilo: { gte: validatedData.minKilo },
      } });
      if (overlap) return sendError(res, 'Weight price ranges cannot overlap', 'CONFLICT', 409);
      const kiloPrice = await prisma.kiloPrice.create({
        data: { ...validatedData, shopId }
      });

      return sendSuccess(res, kiloPrice, 'Kilo price added successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
