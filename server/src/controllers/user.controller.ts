import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { updateUserSchema, updatePasswordSchema } from '../validators/user.validator';
import { AuthRequest } from '../middleware/auth.middleware';

export class UserController {
  
  static async getUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      
      // Basic authorization: user can only fetch their own profile unless admin/shop owner (skipping strict check for now)
      if (req.user?.userId !== userId) {
        return sendError(res, 'Unauthorized to view this profile', 'FORBIDDEN', 403);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, email: true, phone: true, birthdate: true,
          gender: true, zone: true, street: true, barangay: true, building: true,
          isShopOwner: true, createdAt: true
        }
      });

      if (!user) {
        return sendError(res, 'User not found', 'NOT_FOUND', 404);
      }

      return sendSuccess(res, user, 'User details fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      
      if (req.user?.userId !== userId) {
        return sendError(res, 'Unauthorized to update this profile', 'FORBIDDEN', 403);
      }

      const validatedData = updateUserSchema.parse(req).body;
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...validatedData,
          birthdate: validatedData.birthdate ? new Date(validatedData.birthdate) : undefined
        },
        select: {
          id: true, name: true, email: true, phone: true, birthdate: true,
          gender: true, zone: true, street: true, barangay: true, building: true,
          isShopOwner: true, updatedAt: true
        }
      });

      return sendSuccess(res, updatedUser, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updatePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      
      if (req.user?.userId !== userId) {
        return sendError(res, 'Unauthorized to update this profile password', 'FORBIDDEN', 403);
      }

      const validatedData = updatePasswordSchema.parse(req).body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return sendError(res, 'User not found', 'NOT_FOUND', 404);
      }

      const isValidPassword = await bcrypt.compare(validatedData.currentPassword, user.password);
      if (!isValidPassword) {
        return sendError(res, 'Incorrect current password', 'BAD_REQUEST', 400);
      }

      const hashedNewPassword = await bcrypt.hash(validatedData.newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      return sendSuccess(res, null, 'Password updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      
      if (req.user?.userId !== userId) {
        return sendError(res, 'Unauthorized to delete this account', 'FORBIDDEN', 403);
      }

      // Ensure user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return sendError(res, 'User not found', 'NOT_FOUND', 404);
      }

      // Prisma cascade deletion will handle related shops and transactions
      await prisma.user.delete({ where: { id: userId } });

      return sendSuccess(res, null, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async hasShop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);

      const shop = await prisma.shop.findUnique({ where: { userId } });
      
      return sendSuccess(res, { hasShop: !!shop, shopId: shop?.id || null }, 'Shop status checked');
    } catch (error) {
      next(error);
    }
  }
}
