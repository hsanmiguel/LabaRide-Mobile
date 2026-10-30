import type { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import type { AuthRequest } from '../middleware/auth.middleware';
import { sendError, sendSuccess } from '../utils/response';
import { analyticsRange, analyticsSeries, type AnalyticsAggregate } from '../utils/shop-analytics';

export class ShopAnalyticsController {
  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      if (!Number.isSafeInteger(shopId) || shopId < 1) return sendError(res, 'Invalid shop ID.', 'INVALID_INPUT', 400);
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop || shop.userId !== req.user?.userId) return sendError(res, 'Only the shop owner can view analytics.', 'FORBIDDEN', 403);
      const range = analyticsRange(req.query.start, req.query.end);
      const complete = Prisma.sql`(workflow_status = 'Completed' OR (workflow_status IS NULL AND status = 'Completed'))`;
      // Aggregate in PostgreSQL: no customer records or paginated order lists are
      // sent to the dashboard. One snapshot keeps all metrics consistent.
      const result = await prisma.$transaction(async tx => {
        const received = await tx.$queryRaw<AnalyticsAggregate[]>`
          SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD"T"HH24') AS local, COUNT(*)::int AS count
          FROM transactions WHERE shop_id = ${shopId} AND created_at >= (${range.from.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND created_at < (${range.until.toISOString()}::timestamptz AT TIME ZONE 'UTC')
          GROUP BY 1 ORDER BY 1`;
        const completed = await tx.$queryRaw<AnalyticsAggregate[]>`
          SELECT to_char(completed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD"T"HH24') AS local,
            COUNT(*)::int AS count, SUM(total_amount) AS value, SUM(kilo_amount) AS kilos
          FROM transactions WHERE shop_id = ${shopId} AND ${complete} AND completed_at >= ${range.from.toISOString()}::timestamptz AND completed_at < ${range.until.toISOString()}::timestamptz
          GROUP BY 1 ORDER BY 1`;
        const popular = await tx.$queryRaw<{ name: string; orders: number; kilos: Prisma.Decimal; value: Prisma.Decimal }[]>`
          SELECT service_name AS name, COUNT(*)::int AS orders, SUM(kilo_amount) AS kilos, SUM(total_amount) AS value
          FROM transactions WHERE shop_id = ${shopId} AND ${complete} AND completed_at >= ${range.from.toISOString()}::timestamptz AND completed_at < ${range.until.toISOString()}::timestamptz
          GROUP BY service_name ORDER BY COUNT(*) DESC, service_name ASC LIMIT 5`;
        const workload = await tx.$queryRaw<{ pending: number; queued: number; ready: number; undated: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE workflow_status = 'BookingPending' OR (workflow_status IS NULL AND status = 'Pending'))::int AS pending,
            COUNT(*) FILTER (WHERE workflow_status = 'LaundryReceived' OR (workflow_status IS NULL AND status = 'Queued'))::int AS queued,
            COUNT(*) FILTER (WHERE workflow_status IN ('ReadyForCollection','ReadyForDelivery','DeliveryAssigned','DeliveryAccepted','CleanLaundryCollected','OutForDelivery','Delivered') OR (workflow_status IS NULL AND status = 'Ready'))::int AS ready,
            COUNT(*) FILTER (WHERE ${complete} AND completed_at IS NULL)::int AS undated
          FROM transactions WHERE shop_id = ${shopId}`;
        return { received, completed, popular, workload: workload[0] };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      const series = analyticsSeries(range, result.received, result.completed);
      const summary = series.reduce((total, point) => ({ orders: total.orders + point.orders, completedOrders: total.completedOrders + point.completedOrders,
        completedValue: total.completedValue + point.completedValue, kilos: total.kilos + point.kilos }), { orders: 0, completedOrders: 0, completedValue: 0, kilos: 0 });
      summary.completedValue = Math.round(summary.completedValue * 100) / 100;
      summary.kilos = Math.round(summary.kilos * 100) / 100;
      res.setHeader('Cache-Control', 'private, no-store');
      return sendSuccess(res, { range: { start: range.start, end: range.end, granularity: range.granularity, timeZone: 'Asia/Manila' }, summary, series,
        popularServices: result.popular.map(row => ({ ...row, kilos: Number(row.kilos), value: Number(row.value) })),
        workload: { pending: result.workload.pending, queued: result.workload.queued, ready: result.workload.ready }, undatedCompletedOrders: result.workload.undated });
    } catch (error) { next(error); }
  }
}
