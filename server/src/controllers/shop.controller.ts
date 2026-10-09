import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { registerShopSchema, createServiceSchema, createKiloPriceSchema, createItemSchema } from '../validators/shop.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { formatAddress } from '../validators/address.validator';
import { userProfileSelect } from '../utils/user-profile';

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
          isShopOwner: true,
          shop: { create: { ...validatedData, address: formatAddress(validatedData) } },
        },
        select: { ...userProfileSelect, shop: true },
      });
      const { shop, ...user } = result;
      const token = jwt.sign({ userId, isShopOwner: true }, env.JWT_SECRET, { expiresIn: '7d' });
      return sendSuccess(res, { ...shop, user, token }, 'Shop registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateShop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      if (shop.userId !== req.user!.userId) {
        return sendError(res, 'Only the shop owner can update this shop', 'FORBIDDEN', 403);
      }
      const data = registerShopSchema.parse(req).body;
      const updated = await prisma.shop.update({
        where: { id: shopId }, data: { ...data, address: formatAddress(data) },
      });
      return sendSuccess(res, updated, 'Shop details updated successfully');
    } catch (error) { next(error); }
  }

  static async getAllShops(req: Request, res: Response, next: NextFunction) {
    try {
      const shops = await prisma.shop.findMany({
        include: {
          services: true,
          kiloPrices: true
        }
      });
      return sendSuccess(res, shops, 'Shops retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getRecentShops(req: Request, res: Response, next: NextFunction) {
    try {
      const shops = await prisma.shop.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { services: true }
      });
      return sendSuccess(res, shops, 'Recent shops retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getShopById(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: {
          services: true,
          kiloPrices: true,
          householdItems: true,
          clothingTypes: true
        }
      });

      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      return sendSuccess(res, shop, 'Shop details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getShopByUserId(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      const shop = await prisma.shop.findUnique({
        where: { userId },
        include: { services: true }
      });

      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      return sendSuccess(res, shop, 'Shop details retrieved');
    } catch (error) {
      next(error);
    }
  }

  // SERVICES
  static async addService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const validatedData = createServiceSchema.parse(req).body;

      // Basic authorization check could be added here
      const service = await prisma.shopService.create({
        data: { ...validatedData, shopId }
      });

      return sendSuccess(res, service, 'Service added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // KILO PRICES
  static async addKiloPrice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const validatedData = createKiloPriceSchema.parse(req).body;

      const kiloPrice = await prisma.kiloPrice.create({
        data: { ...validatedData, shopId }
      });

      return sendSuccess(res, kiloPrice, 'Kilo price added successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
