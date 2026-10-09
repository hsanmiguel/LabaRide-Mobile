import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { createTransactionSchema, updateStatusSchema, cancelTransactionSchema } from '../validators/transaction.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import type { Server } from 'socket.io';
import { Prisma } from '@prisma/client';
import { priceOrder } from '../utils/order-pricing';

export class TransactionController {
  
  static async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const validatedData = createTransactionSchema.parse(req).body;
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return sendError(res, 'User not found', 'NOT_FOUND', 404);

      const shop = await prisma.shop.findUnique({
        where: { id: validatedData.shopId },
        include: { services: true, kiloPrices: true },
      });
      if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
      const pricing = priceOrder({
        kilos: validatedData.kiloAmount,
        serviceIds: validatedData.serviceIds,
        serviceName: validatedData.serviceName,
        services: shop.services,
        ranges: shop.kiloPrices,
        deliveryType: validatedData.deliveryType,
      });
      if ('error' in pricing && pricing.error) return sendError(res, pricing.error, 'INVALID_PRICING', 409);
      const changedQuote = (['subtotal', 'deliveryFee', 'voucherDiscount', 'totalAmount'] as const)
        .some((field) => validatedData[field] !== undefined &&
          !new Prisma.Decimal(validatedData[field]!).equals(pricing[field]));
      if (changedQuote) return sendError(res, 'Shop prices changed. Review the updated total and try again.', 'PRICE_CHANGED', 409);
      const { items, serviceIds, subtotal, deliveryFee, voucherDiscount, totalAmount, ...transactionData } = validatedData;

      const transaction = await prisma.transaction.create({
        data: {
          ...transactionData,
          ...pricing,
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
      if (existing.status === 'Cancelled' && status !== 'Cancelled') {
        return sendError(res, 'A cancelled order cannot be accepted or completed', 'CONFLICT', 409);
      }
      const updated = await prisma.transaction.updateMany({
        where: { id: transactionId, status: existing.status },
        data: { status, notes: notes || undefined },
      });
      if (!updated.count) return sendError(res, 'Order status changed. Refresh and try again.', 'CONFLICT', 409);
      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });

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
      const { params: { id: transactionId }, body: { reason } } = cancelTransactionSchema.parse(req);
      const existing = await prisma.transaction.findUnique({
        where: { id: transactionId }, select: { userId: true, status: true },
      });
      if (!existing) return sendError(res, 'Order not found', 'NOT_FOUND', 404);
      if (existing.userId !== req.user!.userId) {
        return sendError(res, 'Only the customer can cancel this order', 'FORBIDDEN', 403);
      }
      if (existing.status !== 'Pending') {
        return sendError(res, 'You can only cancel a pending order before it is accepted', 'CONFLICT', 409);
      }
      
      const updated = await prisma.transaction.updateMany({
        where: { id: transactionId, userId: req.user!.userId, status: 'Pending' },
        data: { status: 'Cancelled', notes: reason },
      });
      if (!updated.count) return sendError(res, 'Order status changed. Refresh and try again.', 'CONFLICT', 409);
      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });

      const payload = { transaction_id: transaction.id, status: 'Cancelled', notes: transaction.notes, total_amount: transaction.totalAmount };
      (req.app.get('io') as Server | undefined)?.to(`user_${transaction.userId}`).emit('status_update', payload);
      (req.app.get('io') as Server | undefined)?.to(`shop_${transaction.shopId}`).emit('status_update', payload);

      return sendSuccess(res, transaction, 'Transaction cancelled');
    } catch (error) {
      next(error);
    }
  }
}
