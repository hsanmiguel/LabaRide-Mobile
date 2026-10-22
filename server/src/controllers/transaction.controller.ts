import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { createTransactionSchema, updateStatusSchema, cancelTransactionSchema } from '../validators/transaction.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import type { Server } from 'socket.io';
import { Prisma } from '@prisma/client';
import { priceOrder } from '../utils/order-pricing';
import { validateDeliveryTime } from '../utils/delivery-slots';
import type { ShopHours } from '../utils/shop-hours';
import { serviceAreaError, type ServiceArea } from '../utils/service-area';
import { shopAvailability } from '../utils/shop-hours';

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
      const availability = shopAvailability(shop);
      if (!availability.isOpen) return sendError(res, availability.message, 'SHOP_CLOSED', 409);
      const checkArea = (area: ServiceArea) =>
        (validatedData.deliveryType === 'Deliver' ? serviceAreaError(area, validatedData, 'delivery') : null)
        || (validatedData.collectionMethod === 'ShopPickup' ? serviceAreaError(area, validatedData.collectionAddress, 'pickup') : null);
      const areaError = checkArea(shop);
      if (areaError) return sendError(res, areaError, 'OUTSIDE_SERVICE_AREA', 400);
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
      const { items, serviceIds, subtotal, deliveryFee, voucherDiscount, totalAmount, collectionAddress, ...transactionData } = validatedData;
      const checkSchedule = (hours: ShopHours) => {
        if (validatedData.collectionMethod !== 'ShopPickup') return null;
        const error = validateDeliveryTime(validatedData.requestedPickupAt!, { ...hours, preparationMinutes: 0 });
        return error?.replace(/delivery/gi, 'pickup') || null;
      };
      const scheduleError = checkSchedule(shop);
      if (scheduleError) return sendError(res, scheduleError, 'INVALID_SCHEDULE', 400);

      const transaction = await prisma.$transaction(async tx => {
        // Hold the approval row until the booking commits so a simultaneous
        // suspension cannot slip between the approval check and order creation.
        await tx.$queryRaw`SELECT id FROM shops WHERE id = ${shop.id} FOR SHARE`;
        const current = await tx.shop.findUnique({ where: { id: shop.id } });
        if (current?.approvalStatus !== 'Approved') return null;
        const currentAvailability = shopAvailability(current);
        if (!currentAvailability.isOpen) return { bookingError: { message: currentAvailability.message, code: 'SHOP_CLOSED', status: 409 } };
        const currentScheduleError = checkSchedule(current);
        if (currentScheduleError) return { bookingError: { message: currentScheduleError, code: 'INVALID_SCHEDULE', status: 400 } };
        const currentAreaError = checkArea(current);
        if (currentAreaError) return { bookingError: { message: currentAreaError, code: 'OUTSIDE_SERVICE_AREA', status: 400 } };
        return tx.transaction.create({
        data: {
          ...transactionData,
          ...pricing,
          collectionAddress: collectionAddress || Prisma.DbNull,
          userId,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          requestedPickupAt: validatedData.requestedPickupAt ? new Date(validatedData.requestedPickupAt) : null,
          scheduledDate: null,
          scheduledTime: null,
          items: items ? {
            create: items
          } : undefined
        },
        include: { items: true }
        });
      });
      if (!transaction) return sendError(res, 'This shop is not approved to receive orders', 'SHOP_NOT_APPROVED', 403);
      if ('bookingError' in transaction) return sendError(res, transaction.bookingError.message, transaction.bookingError.code, transaction.bookingError.status);

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
      const { status, notes, estimatedReadyAt, estimateReason, confirmPickup } = updateStatusSchema.parse(req).body;
      const existing = await prisma.transaction.findUnique({
        where: { id: transactionId }, include: { shop: { select: { userId: true, approvalStatus: true } } },
      });
      if (!existing) return sendError(res, 'Order not found', 'NOT_FOUND', 404);
      if (existing.shop.userId !== req.user!.userId) {
        return sendError(res, 'Only the shop owner can update order status', 'FORBIDDEN', 403);
      }
      if (existing.shop.approvalStatus !== 'Approved') return sendError(res, 'Admin approval is required to manage shop orders', 'SHOP_NOT_APPROVED', 403);
      const transitions: Record<string, string[]> = {
        Pending: ['Accepted', 'Cancelled'], Accepted: ['Queued', 'Cancelled'],
        Queued: ['Processing', 'Cancelled'], Processing: ['Ready'], Ready: ['Completed'],
        Completed: [], Cancelled: [],
      };
      if (status !== existing.status && !transitions[existing.status]?.includes(status)) {
        return sendError(res, 'Confirm receipt before starting processing, and mark laundry ready before completing the order.', 'CONFLICT', 409);
      }
      if (estimatedReadyAt && (!['Queued', 'Processing'].includes(status) || Date.parse(estimatedReadyAt) <= Date.now())) {
        return sendError(res, 'Set a future ready estimate after receiving the laundry.', 'INVALID_ESTIMATE', 400);
      }
      if (estimatedReadyAt && existing.estimatedReadyAt && Date.parse(estimatedReadyAt) !== existing.estimatedReadyAt.getTime() && !estimateReason) {
        return sendError(res, 'Explain the revised ready estimate so the customer understands the update.', 'INVALID_ESTIMATE', 400);
      }
      if (confirmPickup && (existing.collectionMethod !== 'ShopPickup' || !existing.requestedPickupAt || !['Accepted', 'Queued'].includes(status))) {
        return sendError(res, 'Accept the order before confirming its requested pickup.', 'CONFLICT', 409);
      }
      const now = new Date();
      const updated = await prisma.transaction.updateMany({
        where: { id: transactionId, status: existing.status, shop: { approvalStatus: 'Approved' } },
        data: { status, notes: notes || undefined,
          ...(status === 'Queued' && existing.status !== status ? { receivedAt: now } : {}),
          ...(status === 'Processing' && existing.status !== status ? { processingStartedAt: now } : {}),
          ...(status === 'Ready' && existing.status !== status ? { readyAt: now } : {}),
          ...(estimatedReadyAt ? { estimatedReadyAt: new Date(estimatedReadyAt), estimateUpdatedAt: now, estimateReason: estimateReason || null } : {}),
          ...(confirmPickup ? { confirmedPickupAt: existing.requestedPickupAt } : {}),
        },
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
