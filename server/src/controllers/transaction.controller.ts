import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { createTransactionSchema, updateStatusSchema, cancelTransactionSchema } from '../validators/transaction.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import type { Server } from 'socket.io';
import { Prisma } from '@prisma/client';
import { priceOrder } from '../utils/order-pricing';
import { deliveryScheduleError } from '../utils/order-schedule';

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
      if (shop.approvalStatus !== 'Approved') return sendError(res, 'This shop is not approved to receive orders', 'SHOP_NOT_APPROVED', 403);
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
      const scheduleError = deliveryScheduleError({
        ...validatedData, serviceName: pricing.serviceName,
      });
      if (scheduleError) return sendError(res, scheduleError, 'INVALID_SCHEDULE', 400);

      const transaction = await prisma.$transaction(async tx => {
        // Hold the approval row until the booking commits so a simultaneous
        // suspension cannot slip between the approval check and order creation.
        await tx.$queryRaw`SELECT id FROM shops WHERE id = ${shop.id} FOR SHARE`;
        const current = await tx.shop.findUnique({ where: { id: shop.id }, select: { approvalStatus: true } });
        if (current?.approvalStatus !== 'Approved') return null;
        const order = await tx.transaction.create({
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
        await tx.notification.createMany({ data: [
          { userId, transactionId: order.id, shopMode: false, title: 'Booking submitted', message: `Order #${order.id} is waiting for shop confirmation.` },
          { userId: shop.userId, transactionId: order.id, shopMode: true, title: 'New order', message: `${user.name} submitted order #${order.id} for ${order.serviceName}.` },
        ] });
        return order;
      });
      if (!transaction) return sendError(res, 'This shop is not approved to receive orders', 'SHOP_NOT_APPROVED', 403);

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
      const { status, notes, acceptanceExplanation } = updateStatusSchema.parse(req).body;
      const existing = await prisma.transaction.findUnique({
        where: { id: transactionId }, include: { shop: { select: { userId: true, approvalStatus: true } } },
      });
      if (!existing) return sendError(res, 'Order not found', 'NOT_FOUND', 404);
      if (existing.shop.userId !== req.user!.userId) {
        return sendError(res, 'Only the shop owner can update order status', 'FORBIDDEN', 403);
      }
      if (existing.shop.approvalStatus !== 'Approved') return sendError(res, 'Admin approval is required to manage shop orders', 'SHOP_NOT_APPROVED', 403);
      if (existing.status === 'Cancelled' && status !== 'Cancelled') {
        return sendError(res, 'A cancelled order cannot be accepted or completed', 'CONFLICT', 409);
      }
      const accepting = existing.status === 'Pending' && status === 'Processing';
      if (accepting && !acceptanceExplanation) {
        return sendError(res, 'Enter an explanation before accepting this order', 'ACCEPTANCE_EXPLANATION_REQUIRED', 400);
      }
      const savedNotes = accepting
        ? [existing.notes, `Shop acceptance: ${acceptanceExplanation}`].filter(Boolean).join('\n\n')
        : notes || undefined;
      const updated = await prisma.$transaction(async tx => {
        const result = await tx.transaction.updateMany({
          where: { id: transactionId, status: existing.status, shop: { approvalStatus: 'Approved' } },
          data: { status, notes: savedNotes },
        });
        if (result.count && existing.status !== status) await tx.notification.createMany({ data: [
          { userId: existing.userId, transactionId, shopMode: false, title: `Order ${status.toLowerCase()}`, message: `Order #${transactionId} is now ${status.toLowerCase()}.${accepting ? ` Shop acceptance: ${acceptanceExplanation}` : notes ? ` ${notes}` : ''}` },
          { userId: existing.shop.userId, transactionId, shopMode: true, title: `Order ${status.toLowerCase()}`, message: `Order #${transactionId} is now ${status.toLowerCase()}.` },
        ] });
        return result;
      });
      if (!updated.count) return sendError(res, 'Order status changed. Refresh and try again.', 'CONFLICT', 409);
      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });

      // Emit socket event to both user and shop
      const payload = { transaction_id: transaction.id, status, notes: transaction.notes, total_amount: transaction.totalAmount };
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
        where: { id: transactionId }, include: { shop: { select: { userId: true } } },
      });
      if (!existing) return sendError(res, 'Order not found', 'NOT_FOUND', 404);
      if (existing.userId !== req.user!.userId) {
        return sendError(res, 'Only the customer can cancel this order', 'FORBIDDEN', 403);
      }
      if (existing.status !== 'Pending') {
        return sendError(res, 'You can only cancel a pending order before it is accepted', 'CONFLICT', 409);
      }
      
      const updated = await prisma.$transaction(async tx => {
        const result = await tx.transaction.updateMany({
          where: { id: transactionId, userId: req.user!.userId, status: 'Pending' },
          data: { status: 'Cancelled', notes: reason },
        });
        if (result.count) await tx.notification.createMany({ data: [
          { userId: existing.userId, transactionId, shopMode: false, title: 'Order cancelled', message: `You cancelled order #${transactionId}: ${reason}` },
          { userId: existing.shop.userId, transactionId, shopMode: true, title: 'Customer cancelled an order', message: `Order #${transactionId} was cancelled: ${reason}` },
        ] });
        return result;
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
