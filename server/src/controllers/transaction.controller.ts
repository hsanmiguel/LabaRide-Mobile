import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { createTransactionSchema, updateStatusSchema } from '../validators/transaction.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import type { Server } from 'socket.io';

export class TransactionController {
  
  static async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createTransactionSchema.parse(req).body;
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return sendError(res, 'User not found', 'NOT_FOUND', 404);

      const { items, ...transactionData } = validatedData;

      const transaction = await prisma.transaction.create({
        data: {
          ...transactionData,
          userId,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          scheduledDate: new Date(validatedData.scheduledDate),
          scheduledTime: new Date(validatedData.scheduledTime),
          items: items ? {
            create: items
          } : undefined
        },
        include: { items: true }
      });

      // Emit socket event to shop room
      (req.app.get('io') as Server | undefined)?.to(`shop_${transaction.shopId}`).emit('new_transaction', transaction);

      return sendSuccess(res, transaction, 'Transaction created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getUserTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      if (req.user?.userId !== userId) {
        return sendError(res, 'Unauthorized', 'FORBIDDEN', 403);
      }

      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { items: true, shop: { select: { shopName: true, address: true, contactNumber: true } } }
      });

      return sendSuccess(res, transactions, 'User transactions retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getShopTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop || shop.userId !== req.user!.userId) {
        return sendError(res, 'Only the shop owner can view these orders', 'FORBIDDEN', 403);
      }
      
      const transactions = await prisma.transaction.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      });

      return sendSuccess(res, transactions, 'Shop transactions retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transactionId = parseInt(req.params.id);
      const { status, notes } = updateStatusSchema.parse(req).body;
      const existing = await prisma.transaction.findUnique({
        where: { id: transactionId }, include: { shop: { select: { userId: true } } },
      });
      if (!existing) return sendError(res, 'Order not found', 'NOT_FOUND', 404);
      if (existing.shop.userId !== req.user!.userId) {
        return sendError(res, 'Only the shop owner can update order status', 'FORBIDDEN', 403);
      }

      const transaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: { status, notes: notes || undefined }
      });

      // Emit socket event to both user and shop
      const payload = { transaction_id: transaction.id, status, notes, total_amount: transaction.totalAmount };
      (req.app.get('io') as Server | undefined)?.to(`user_${transaction.userId}`).emit('status_update', payload);
      (req.app.get('io') as Server | undefined)?.to(`shop_${transaction.shopId}`).emit('status_update', payload);

      return sendSuccess(res, transaction, 'Transaction status updated');
    } catch (error) {
      next(error);
    }
  }

  static async cancelTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transactionId = parseInt(req.params.id);
      const existing = await prisma.transaction.findUnique({
        where: { id: transactionId }, select: { userId: true },
      });
      if (!existing) return sendError(res, 'Order not found', 'NOT_FOUND', 404);
      if (existing.userId !== req.user!.userId) {
        return sendError(res, 'Only the customer can cancel this order', 'FORBIDDEN', 403);
      }
      
      const transaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'Cancelled' }
      });

      const payload = { transaction_id: transaction.id, status: 'Cancelled', notes: transaction.notes, total_amount: transaction.totalAmount };
      (req.app.get('io') as Server | undefined)?.to(`user_${transaction.userId}`).emit('status_update', payload);
      (req.app.get('io') as Server | undefined)?.to(`shop_${transaction.shopId}`).emit('status_update', payload);

      return sendSuccess(res, transaction, 'Transaction cancelled');
    } catch (error) {
      next(error);
    }
  }
}
