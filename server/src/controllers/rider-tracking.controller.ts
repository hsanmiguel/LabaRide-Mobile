import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { collectionPoint, dispatchPoint, fail } from '../services/dispatch.service';
import { clearedRiderLocation, TRACKING_STALE_MS, trackingStages } from '../services/rider-tracking.service';

const session = z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/);
const locationInput = z.discriminatedUnion('sharing', [
  z.object({ sharing: z.literal(false), sessionId: session }),
  z.object({ sharing: z.literal(true), sessionId: session, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).nullable().optional(), capturedAt: z.number().int().positive() }),
]);

export class RiderTrackingController {
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = locationInput.parse(req.body), riderId = req.user!.userId;
      if (!body.sharing) {
        await prisma.deliveryAssignment.updateMany({ where: { riderId, locationSession: body.sessionId }, data: clearedRiderLocation });
        return sendSuccess(res, { sharing: false });
      }
      const now = new Date();
      if (body.capturedAt > now.getTime() + 30000 || body.capturedAt < now.getTime() - 120000) fail('This GPS reading is out of date. Get a fresh location and try again.', 400);
      const rider = await prisma.riderProfile.findUnique({ where: { userId: riderId }, select: { active: true } });
      if (!rider?.active) fail('Rider access required', 403);
      // No order IDs are accepted from the device. Only this rider's currently
      // accepted jobs in a travelling stage can receive a location reading.
      const result = await prisma.deliveryAssignment.updateMany({ where: {
        riderId, status: 'Accepted', transaction: { workflowStatus: { in: trackingStages } },
        OR: [{ locationCapturedAt: null }, { locationCapturedAt: { lt: new Date(body.capturedAt) } }],
      }, data: { liveLatitude: body.latitude, liveLongitude: body.longitude, liveAccuracy: body.accuracy ?? null, locationCapturedAt: new Date(body.capturedAt), locationReceivedAt: now, locationSharing: true, locationSession: body.sessionId } });
      return sendSuccess(res, { sharing: result.count > 0, sharedJobs: result.count, receivedAt: now });
    } catch (error) { next(error); }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const order = await prisma.transaction.findUnique({ where: { id }, select: { userId: true, workflowStatus: true, collectionMethod: true, collectionAddress: true, latitude: true, longitude: true,
        shop: { select: { latitude: true, longitude: true } },
        assignments: { where: { status: 'Accepted' }, select: { stage: true, locationSharing: true, liveLatitude: true, liveLongitude: true, liveAccuracy: true, locationCapturedAt: true, locationReceivedAt: true, rider: { select: { name: true } } } },
      } });
      if (!order) fail('Order not found', 404);
      if (order.userId !== req.user!.userId && !req.user!.isAdmin) fail('Rider location access denied', 403);
      res.setHeader('Cache-Control', 'private, no-store');
      const active = trackingStages.includes(order.workflowStatus || '');
      const job = active ? order.assignments.find(job => job.stage === (order.workflowStatus?.startsWith('Pickup') || order.workflowStatus === 'LaundryPickedUp' ? 'Pickup' : 'Delivery')) : undefined;
      const point = job?.locationSharing ? dispatchPoint({ latitude: job.liveLatitude, longitude: job.liveLongitude }) : undefined;
      const capturedAt = job?.locationCapturedAt;
      const location = point && capturedAt && job?.locationReceivedAt ? { ...point, accuracy: job.liveAccuracy, capturedAt, receivedAt: job.locationReceivedAt } : null;
      const finished = ['Completed', 'Cancelled', 'Delivered'].includes(order.workflowStatus || '');
      return sendSuccess(res, {
        state: !job ? finished ? 'finished' : 'waiting' : !location ? 'paused' : Date.now() - capturedAt!.getTime() > TRACKING_STALE_MS ? 'stale' : 'sharing',
        rider: job ? { name: job.rider.name, stage: job.stage } : null, location,
        customer: dispatchPoint(job?.stage === 'Pickup' ? collectionPoint(order) : order) || null, shop: dispatchPoint(order.shop) || null,
        destination: ['LaundryPickedUp', 'DeliveryAccepted'].includes(order.workflowStatus || '') ? 'shop' : 'customer',
        staleAfterMs: TRACKING_STALE_MS, serverTime: new Date(),
      });
    } catch (error) { next(error); }
  }
}
