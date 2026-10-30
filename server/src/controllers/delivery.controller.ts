import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { AUTOMATIC_DISPATCH_ENABLED, collectionPoint, changeState, dispatchPoint, dispatchStage, expireOffers, fail, jobTransitions, lockOrder, openAssignments, partnerTransitions, recommendRiders, recordEvent } from '../services/dispatch.service';
import { priceOrder } from '../utils/order-pricing';
import { handoffState } from '../services/handoff.service';
import { clearedRiderLocation } from '../services/rider-tracking.service';
import { prepareShopPhoto } from '../utils/shop-photo';
import { claimableStatuses, dispatchDistance } from '../services/dispatch.service';
import { documentMeta, requirementsMissing } from '../utils/rider-requirements';
import type { Server } from 'socket.io';

const idSchema = z.coerce.number().int().positive();
const noteSchema = z.string().trim().min(5).max(1000);
const actor = (req: AuthRequest) => req.user!.userId;
function emit(req: AuthRequest) { (req.app.get('io') as Server | undefined)?.emit('operations_update', {}); }
const riderSelect = { id: true, name: true, email: true, phone: true } as const;
const orderInclude = { weightEvidence: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], select: { id: true, kilos: true, totalAmount: true, note: true, createdAt: true, actor: { select: { name: true } } } }, shop: { include: { services: true, kiloPrices: true } }, assignments: { select: { id: true, transactionId: true, riderId: true, stage: true, resumeStatus: true, status: true, expiresAt: true, createdAt: true, updatedAt: true, rider: { select: { id: true, name: true } } } }, events: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { name: true } } } } };

export class DeliveryController {
  static async availableJobs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.$transaction(tx => expireOffers(tx));
      const rider = await prisma.riderProfile.findUnique({ where: { userId: actor(req) } });
      if (!rider?.active) fail('Rider access required', 403);
      const workload = await prisma.deliveryAssignment.count({ where: { riderId: actor(req), status: { in: openAssignments } } });
      const from = dispatchPoint(rider);
      // Collection JSON is used for city/province and distance only. Explicitly
      // serialize the public preview so private address fields never leave the API.
      const orders = rider.online ? await prisma.transaction.findMany({
        where: { workflowStatus: { in: claimableStatuses }, shop: { approvalStatus: 'Approved' }, assignments: { none: { status: { in: openAssignments } } } },
        select: { id: true, workflowStatus: true, workflowVersion: true, serviceName: true, kiloAmount: true, scheduledDate: true, scheduledTime: true, requestedPickupAt: true, collectionMethod: true, collectionAddress: true, createdAt: true, city: true, state_province: true, latitude: true, longitude: true, shop: { select: { shopName: true, city: true, state_province: true, latitude: true, longitude: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100,
      }) : [];
      const area = (value: { city: string | null; state_province: string | null }) => [value.city, value.state_province].filter(Boolean).join(', ') || 'Area not provided';
      return sendSuccess(res, { rider: { online: rider.online, workload, capacity: 3, hasPosition: !!from }, limit: 100, jobs: orders.map(order => {
        const stage = order.workflowStatus === 'PickupQueued' ? 'Pickup' : 'Delivery';
        const customer = collectionPoint(order);
        const distance = dispatchDistance(from, dispatchPoint(stage === 'Pickup' ? customer : order.shop));
        return { id: order.id, stage, workflowVersion: order.workflowVersion, serviceName: order.serviceName, kilos: order.kiloAmount, scheduledDate: order.scheduledDate, scheduledTime: order.scheduledTime, requestedPickupAt: order.requestedPickupAt, createdAt: order.createdAt,
          shopName: order.shop.shopName, pickupArea: area(stage === 'Pickup' ? customer : order.shop), dropoffArea: area(stage === 'Pickup' ? order.shop : order), distanceKm: distance == null ? null : Math.round(distance * 10) / 10 };
      }) });
    } catch (error) { next(error); }
  }

  static async claim(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = z.object({ stage: z.enum(['Pickup', 'Delivery']), expectedVersion: z.number().int().nonnegative() }).parse(req.body);
      const result = await prisma.$transaction(async tx => {
        const order = await lockOrder(tx, id);
        if (['Cancelled', 'Completed'].includes(order.workflowStatus!)) fail('This job is no longer available. Refresh Available Jobs.');
        const existing = order.assignments.find(job => openAssignments.includes(job.status));
        // A network retry may arrive after the first claim committed.
        if (existing?.riderId === actor(req) && existing.stage === body.stage && existing.status === 'Accepted') return { id, assignmentId: existing.id };
        if (existing || !claimableStatuses.includes(order.workflowStatus!) || order.workflowVersion !== body.expectedVersion) fail('This job was claimed or changed. Refresh Available Jobs and choose another job.');
        if (order.shop.approvalStatus !== 'Approved') fail('This shop is not currently accepting jobs.');
        const stage = order.workflowStatus === 'PickupQueued' ? 'Pickup' : 'Delivery';
        if (body.stage !== stage) fail('This job has changed. Refresh Available Jobs.');
        // Use the same lock order as manual dispatch: order, then rider user.
        // This also serializes claims for different orders by the same rider.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor(req)} FOR UPDATE`;
        const account = await tx.user.findUnique({ where: { id: actor(req) }, select: { isRider: true } });
        const rider = await tx.riderProfile.findUnique({ where: { userId: actor(req) } });
        if (!account?.isRider || !rider?.active) fail('Rider access required', 403);
        if (!rider.online) fail('Go online before claiming a job.');
        const workload = await tx.deliveryAssignment.count({ where: { riderId: actor(req), status: { in: openAssignments } } });
        if (workload >= 3) fail('You already have three active jobs. Finish a job before claiming another.');
        const assignment = await tx.deliveryAssignment.create({ data: { transactionId: id, riderId: actor(req), stage, status: 'Accepted', resumeStatus: order.workflowStatus, expiresAt: new Date() } });
        await changeState(tx, order, actor(req), 'JobClaimed', `${stage}Accepted`, 'Rider claimed this job from Available Jobs.', actor(req));
        return { id, assignmentId: assignment.id };
      });
      emit(req); return sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async reviewRider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = idSchema.parse(req.params.id);
      const body = z.object({ status: z.enum(['Approved', 'Rejected']), reason: noteSchema.optional() }).parse(req.body);
      if (body.status === 'Rejected' && !body.reason) fail('Explain why the application was rejected', 400);
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        if (body.status === 'Approved') {
          const application = await tx.riderProfile.findUnique({ where: { userId }, include: { user: true, documents: { select: documentMeta } } });
          if (!application) fail('Rider application not found', 404);
          const missing = requirementsMissing(application, true);
          if (missing.length) fail(`Approval requires: ${missing.join(', ')}`, 400);
        }
        const result = await tx.riderProfile.updateMany({ where: { userId, applicationStatus: 'Pending', active: false }, data: { applicationStatus: body.status, active: body.status === 'Approved', online: false, reviewReason: body.reason || null, reviewedAt: new Date(), reviewedById: actor(req) } });
        if (!result.count) fail('This application was already reviewed. Refresh the list.');
        await tx.user.update({ where: { id: userId }, data: { isRider: body.status === 'Approved' } });
      });
      emit(req); return sendSuccess(res, { userId, status: body.status });
    } catch (error) { next(error); }
  }
  static async operations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.$transaction(tx => expireOffers(tx));
      const orders = await prisma.transaction.findMany({ where: { workflowStatus: { not: null } }, include: orderInclude, orderBy: { createdAt: 'desc' } });
      // Admins can inspect operational details, but handoff codes stay private to the parties.
      const safe = orders.map(({ pickupCode, collectionCode, deliveryCode, ...order }) => order);
      const riders = await prisma.riderProfile.findMany({ include: { user: { select: { ...riderSelect, birthdate: true, address_line_1: true, city: true, state_province: true, postal_code: true } }, documents: { select: documentMeta } } });
      const workloads = await prisma.deliveryAssignment.groupBy({ by: ['riderId'], where: { status: { in: openAssignments } }, _count: { id: true } });
      const roster = riders.map(rider => {
        const approvalMissing = requirementsMissing(rider, true);
        return { ...rider, approvalMissing,
          canEnable: ['Approved', 'Disabled'].includes(rider.applicationStatus) && (rider.requirementsVersion === 0 || !approvalMissing.length),
          workload: workloads.find(item => item.riderId === rider.userId)?._count.id || 0 };
      });
      return sendSuccess(res, { orders: safe, riders: roster, automaticDispatchEnabled: AUTOMATIC_DISPATCH_ENABLED, recommendations: recommendRiders(roster) });
    } catch (error) { next(error); }
  }

  static async riderAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ email: z.string().email(), active: z.boolean() }).parse(req.body);
      const result = await prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({ where: { email: body.email.toLowerCase().trim() }, include: { shop: true } });
        if (!user) fail('The rider must register an account first', 404);
        if (user.isAdmin || user.shop) fail('Use a separate account for riders and shop/admin roles');
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
        const activeJobs = await tx.deliveryAssignment.count({ where: { riderId: user.id, status: { in: openAssignments } } });
        if (!body.active && activeJobs) fail('Reassign active jobs before disabling this rider');
        if (body.active) {
          const application = await tx.riderProfile.findUnique({ where: { userId: user.id }, include: { user: true, documents: { select: documentMeta } } });
          if (!application) fail('This account must complete a rider application before activation', 400);
          if (['Pending', 'Draft', 'Rejected'].includes(application.applicationStatus)) fail('Review this rider application and verify its documents before approving access', 409);
          if (application && (application.requirementsVersion > 0 || ['Pending', 'Draft', 'Rejected'].includes(application.applicationStatus))) {
            const missing = requirementsMissing(application, true);
            if (missing.length) fail(`Approval requires: ${missing.join(', ')}`, 400);
          }
        }
        await tx.user.update({ where: { id: user.id }, data: { isRider: body.active } });
        return tx.riderProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, active: body.active, applicationStatus: body.active ? 'Approved' : 'Disabled' }, update: { active: body.active, applicationStatus: body.active ? 'Approved' : 'Disabled', reviewedAt: new Date(), reviewedById: actor(req), ...(!body.active ? { online: false } : {}) } });
      });
      emit(req); return sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async availability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ online: z.boolean(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }).parse(req.body);
      const result = await prisma.riderProfile.updateMany({ where: { userId: actor(req), active: true }, data: body });
      if (!result.count) fail('Rider account is inactive', 403);
      emit(req); return sendSuccess(res, { online: body.online });
    } catch (error) { next(error); }
  }

  static async jobs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.$transaction(tx => expireOffers(tx));
      const rider = await prisma.riderProfile.findUnique({ where: { userId: actor(req) } });
      if (!rider?.active) fail('Rider access required', 403);
      const jobs = await prisma.deliveryAssignment.findMany({ where: { riderId: actor(req) }, include: { transaction: { include: { shop: true, assignments: true, events: { where: { action: { in: ['HandoffArrived', 'HandoffReleased'] } } } } } }, orderBy: { createdAt: 'desc' } });
      return sendSuccess(res, { rider, jobs: jobs.map(({ transaction: order, liveLatitude, liveLongitude, liveAccuracy, locationCapturedAt, locationReceivedAt, locationSharing, locationSession, ...job }) => {
        const contactAllowed = job.status === 'Accepted';
        const customer = job.stage === 'Pickup' ? collectionPoint(order) : order;
        return { ...job, order: { id: order.id, version: order.workflowVersion, status: order.workflowStatus, serviceName: order.serviceName, kiloAmount: order.kiloAmount,
          scheduledDate: order.scheduledDate, scheduledTime: order.scheduledTime, requestedPickupAt: job.stage === 'Pickup' ? order.requestedPickupAt : null, totalAmount: contactAllowed ? order.totalAmount : undefined,
          paymentMethod: contactAllowed ? order.paymentMethod : undefined,
          handoff: contactAllowed ? handoffState(order, order.events) : undefined,
          customer: contactAllowed ? { name: order.userName, phone: order.userPhone, address: addressText(customer), latitude: customer.latitude, longitude: customer.longitude, instructions: customer.dropoff_instructions, notes: order.notes, accessCode: customer.access_code } : { address: [order.city, order.state_province].filter(Boolean).join(', ') },
          shop: { name: order.shop.shopName, address: addressText(order.shop), latitude: order.shop.latitude, longitude: order.shop.longitude, phone: contactAllowed ? order.shop.contactNumber : undefined },
        } };
      }) });
    } catch (error) { next(error); }
  }

  static async assign(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = z.object({ riderId: idSchema, stage: z.enum(['Pickup', 'Delivery']), reason: noteSchema.optional(), expectedVersion: z.number().int().nonnegative() }).parse(req.body);
      await prisma.$transaction(async tx => {
        const order = await lockOrder(tx, id);
        if (order.workflowVersion !== body.expectedVersion) fail('Order changed. Refresh before assigning.');
        if (order.shop.approvalStatus !== 'Approved') fail('Shop approval is required before dispatch');
        if (dispatchStage(order.workflowStatus) !== body.stage) fail('This stage is not ready for rider assignment');
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${body.riderId} FOR UPDATE`;
        const rider = await tx.riderProfile.findUnique({ where: { userId: body.riderId } });
        if (!rider?.active || !rider.online) fail('Choose an active, online rider');
        const existing = order.assignments.find(job => openAssignments.includes(job.status));
        if (existing && !body.reason) fail('Explain the reassignment and confirm any physical handover');
        const workload = await tx.deliveryAssignment.count({ where: { riderId: body.riderId, status: { in: openAssignments }, transactionId: { not: id } } });
        if (workload >= 3) fail('Rider already has three active assignments');
        if (existing) {
          await tx.deliveryAssignment.update({ where: { id: existing.id }, data: { status: 'Reassigned', ...clearedRiderLocation } });
          await recordEvent(tx, order, actor(req), 'AssignmentReplaced', order.workflowStatus!, body.reason, existing.riderId);
        }
        const initial = body.stage === 'Pickup' ? 'PickupQueued' : 'ReadyForDelivery';
        const assigned = `${body.stage}Assigned`;
        const resumeStatus = existing?.status === 'Offered' ? existing.resumeStatus || initial : order.workflowStatus === assigned ? initial : order.workflowStatus;
        await tx.deliveryAssignment.create({ data: { transactionId: id, riderId: body.riderId, stage: body.stage, resumeStatus, expiresAt: new Date(Date.now() + 5 * 60000) } });
        await changeState(tx, order, actor(req), 'RiderAssigned', assigned, body.reason, body.riderId);
      });
      emit(req); return sendSuccess(res, { id });
    } catch (error) { next(error); }
  }

  static async riderOptions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      await prisma.$transaction(tx => expireOffers(tx));
      const order = await prisma.transaction.findUnique({ where: { id }, include: { shop: true } });
      if (!order) fail('Order not found', 404);
      const stage = dispatchStage(order.workflowStatus);
      if (!stage) fail('This order is not ready for rider assignment');
      if (order.shop.approvalStatus !== 'Approved') fail('Shop access is paused');
      const destination = stage === 'Pickup' ? collectionPoint(order) : order.shop;
      const origin = dispatchPoint(destination);
      const riders = await prisma.riderProfile.findMany({ where: { active: true, online: true }, select: { userId: true, active: true, online: true, latitude: true, longitude: true, user: { select: { name: true } } } });
      // Exclude this order so its current rider is eligible for an override too.
      const workloads = await prisma.deliveryAssignment.groupBy({ by: ['riderId'], where: { status: { in: openAssignments }, transactionId: { not: id } }, _count: { id: true } });
      const ranked = recommendRiders(riders.map(rider => ({ ...rider, workload: workloads.find(item => item.riderId === rider.userId)?._count.id || 0 })), origin);
      return sendSuccess(res, {
        stage, workflowVersion: order.workflowVersion,
        origin: { source: stage === 'Pickup' ? 'customer' : 'shop', name: stage === 'Pickup' ? order.userName : order.shop.shopName, address: addressText(destination), coordinatesAvailable: !!origin },
        riders: ranked.map(rider => ({ userId: rider.userId, name: rider.user.name, workload: rider.workload, distance: rider.distance })),
      });
    } catch (error) { next(error); }
  }

  static async respond(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = z.object({ action: z.enum(['accept', 'decline']), reason: noteSchema.optional() }).parse(req.body);
      const assignment = await prisma.deliveryAssignment.findUnique({ where: { id } });
      if (!assignment || assignment.riderId !== actor(req)) fail('Assignment not found', 404);
      await prisma.$transaction(async tx => {
        const order = await lockOrder(tx, assignment.transactionId);
        const job = order.assignments.find(item => item.id === id);
        if (!job || job.riderId !== actor(req)) fail('Assignment not found', 404);
        if (['Cancelled', 'Completed'].includes(order.workflowStatus!)) fail('Order is closed');
        // A retried response acknowledges the committed decision without replaying
        // workflow changes, audit events, or notifications. Accepted jobs do not expire.
        if (job.status === (body.action === 'accept' ? 'Accepted' : 'Declined')) return;
        if (job.status === 'Expired' || job.status === 'Offered' && job.expiresAt <= new Date()) fail('This offer expired. Ask the administrator to send a new assignment.');
        if (job.status === 'Reassigned') fail('This job was reassigned. Refresh your jobs to see current assignments.');
        if (job.status !== 'Offered') fail(`This assignment is already ${job.status.toLowerCase()}. Refresh your jobs.`);
        if (body.action === 'accept' && order.shop.approvalStatus !== 'Approved') fail('Shop access is paused');
        if (body.action === 'decline' && !body.reason) fail('Enter a reason for declining', 400);
        await tx.deliveryAssignment.update({ where: { id }, data: { status: body.action === 'accept' ? 'Accepted' : 'Declined' } });
        const base = job.stage === 'Pickup' ? 'PickupQueued' : 'ReadyForDelivery';
        const resume = job.resumeStatus || base;
        const to = body.action === 'accept' ? resume === base ? `${job.stage}Accepted` : resume : resume;
        await changeState(tx, order, actor(req), body.action === 'accept' ? 'AssignmentAccepted' : 'AssignmentDeclined', to, body.reason, job.riderId);
      });
      emit(req); return sendSuccess(res, { id });
    } catch (error) { next(error); }
  }

  static async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const order = await prisma.transaction.findUnique({ where: { id }, include: orderInclude });
      if (!order) fail('Order not found', 404);
      const customer = order.userId === actor(req);
      const partner = order.shop.userId === actor(req);
      if (!req.user!.isAdmin && !customer && !partner) fail('Order access denied', 403);
      const { pickupCode, collectionCode, deliveryCode, ...safe } = order;
      return sendSuccess(res, { ...safe, handoff: handoffState(order, order.events), pickupCode: customer ? pickupCode : undefined, deliveryCode: customer ? deliveryCode : undefined, collectionCode: partner ? collectionCode : undefined });
    } catch (error) { next(error); }
  }

  static async updateWeight(req: AuthRequest, res: Response, next: NextFunction) {
    req.body = { ...req.body, action: 'updateWeight' };
    return DeliveryController.action(req, res, next);
  }

  static async weightImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transactionId = idSchema.parse(req.params.id), id = idSchema.parse(req.params.evidenceId);
      const order = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { userId: true, shop: { select: { userId: true } } } });
      if (!order) fail('Order not found', 404);
      if (!req.user!.isAdmin && order.userId !== actor(req) && order.shop.userId !== actor(req)) fail('Weight photo access denied', 403);
      const evidence = await prisma.orderWeightEvidence.findFirst({ where: { id, transactionId }, select: { bytes: true } });
      if (!evidence) fail('Weight photo not found', 404);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(evidence.bytes);
    } catch (error) { next(error); }
  }

  static async action(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = idSchema.parse(req.params.id);
      const body = z.object({ action: z.string(), expectedVersion: z.number().int().nonnegative(), code: z.string().regex(/^\d{6}$/, 'Enter the six-digit handoff code.').optional(), note: z.string().trim().max(1000, 'Keep the explanation within 1,000 characters.').optional(), kilos: z.number().positive().max(10000).optional(), estimatedReadyAt: z.string().datetime().optional() }).superRefine((body, context) => {
        if (body.action === 'confirmBooking') {
          if (!body.note) context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Enter an acceptance explanation before confirming this booking.' });
        } else if (body.note !== undefined && body.note.length < 5) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Enter at least 5 characters for the notes or reason.' });
        }
      }).parse(req.body);
      let weightPhoto: Buffer | undefined;
      if (body.action === 'updateWeight') {
        const order = await prisma.transaction.findUnique({ where: { id }, include: { shop: true } });
        if (!order) fail('Order not found', 404);
        if (order.shop.userId !== actor(req) || order.shop.approvalStatus !== 'Approved') fail('Only this laundry partner can update weight', 403);
        if (!req.body.imageBase64) fail('Add a clear photo showing the laundry on the scale and its weight reading', 400);
        weightPhoto = await prepareShopPhoto(req.body);
      }
      await prisma.$transaction(async tx => {
        const order = await lockOrder(tx, id);
        if (order.workflowVersion !== body.expectedVersion) fail('Order changed. Refresh and try again.');
        const partner = order.shop.userId === actor(req) && order.shop.approvalStatus === 'Approved';
        const customer = order.userId === actor(req);
        if (['Completed', 'Cancelled'].includes(order.workflowStatus!)) fail('Order is closed');
        const job = order.assignments.find(item => item.riderId === actor(req) && item.status === 'Accepted');
        let to: string;
        if (['arriveHandoff', 'releaseHandoff', 'receiveHandoff'].includes(body.action)) {
          const events = await tx.orderEvent.findMany({ where: { transactionId: id, action: { in: ['HandoffArrived', 'HandoffReleased'] } } });
          const handoff = handoffState(order, events);
          if (!handoff) fail('This order is not ready for a handover');
          const assigned = req.user!.isRider && job?.riderId === handoff.riderId;
          if (body.action === 'arriveHandoff') {
            if (!assigned) fail('Only the assigned rider can mark arrival', 403);
            if (handoff.arrived) fail('Arrival is already recorded');
            await changeState(tx, order, actor(req), 'HandoffArrived', order.workflowStatus!, handoff.marker, handoff.riderId);
          } else if (body.action === 'releaseHandoff') {
            if (!(handoff.kind === 'collection' ? partner : customer)) fail('Only the customer or shop involved in this handover can confirm', 403);
            if (!handoff.arrived) fail('Wait for the rider to mark arrival');
            if (handoff.released) fail('Handover is already confirmed');
            await changeState(tx, order, actor(req), 'HandoffReleased', order.workflowStatus!, handoff.marker, handoff.riderId);
          } else {
            if (!assigned) fail('Only the assigned rider can confirm receipt', 403);
            if (!handoff.arrived || !handoff.released) fail('Wait for the customer or shop to confirm the handover');
            const to = handoff.kind === 'pickup' ? 'LaundryPickedUp' : handoff.kind === 'collection' ? 'CleanLaundryCollected' : 'Completed';
            if (handoff.kind === 'delivery') await tx.deliveryAssignment.update({ where: { id: job!.id }, data: { status: 'Completed', ...clearedRiderLocation } });
            await changeState(tx, order, actor(req), 'HandoffReceived', to, handoff.marker, handoff.riderId);
          }
          return;
        } else if (body.action === 'confirmBooking') {
          if (!partner) fail('Only this laundry partner can confirm a booking', 403);
          if (order.workflowStatus !== 'BookingPending' || !body.note) fail('Provide an acceptance explanation for this pending booking');
          to = order.collectionMethod === 'Dropoff' ? 'AtPartner' : 'PickupQueued';
        } else if (partnerTransitions[body.action]) {
          if (!partner) fail('Only this laundry partner can update laundry progress', 403);
          const transition = partnerTransitions[body.action];
          if (order.workflowStatus !== transition.from) fail('Complete the previous laundry stage first');
          to = body.action === 'ready' && order.deliveryType === 'Pickup' ? 'ReadyForCollection' : transition.to;
        } else if (body.action === 'completeCollection') {
          if (!partner) fail('Only this laundry partner can confirm collection', 403);
          if (order.workflowStatus !== 'ReadyForCollection') fail('Laundry is not ready for customer collection');
          to = 'Completed';
        } else if (body.action === 'updateEstimate') {
          if (!partner) fail('Only this laundry partner can update the ready estimate', 403);
          if (!['LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(order.workflowStatus!)) fail('Receive the laundry before estimating its ready time');
          if (!body.estimatedReadyAt || Date.parse(body.estimatedReadyAt) <= Date.now()) fail('Choose a future ready date and time', 400);
          if (order.estimatedReadyAt && !body.note) fail('Explain the revised ready estimate', 400);
          await tx.transaction.update({ where: { id }, data: { estimatedReadyAt: new Date(body.estimatedReadyAt), estimateUpdatedAt: new Date(), estimateReason: body.note || null, workflowVersion: { increment: 1 } } });
          await recordEvent(tx, order, actor(req), 'ReadyEstimateUpdated', order.workflowStatus!, `Estimated ready: ${body.estimatedReadyAt}.${body.note ? ' ' + body.note : ''}`);
          return;
        } else if (body.action === 'confirmReceipt') {
          if (!customer) fail('Only the customer can confirm receipt', 403);
          if (order.workflowStatus !== 'Delivered') fail('Delivery must be confirmed by the rider first');
          to = 'Completed';
        } else if (body.action === 'cancel') {
          if (!req.user!.isAdmin && !partner && !customer) fail('Cancellation access denied', 403);
          if (!body.note) fail('A cancellation reason is required', 400);
          const beforePickup = [...(order.collectionMethod === 'Dropoff' ? ['AtPartner'] : []), 'BookingPending', 'PickupQueued', 'PickupAssigned', 'PickupAccepted', 'PickupEnRoute'];
          if (!beforePickup.includes(order.workflowStatus!)) fail('Laundry is in custody. Report an issue and arrange recovery before cancelling.');
          if (customer && order.workflowStatus !== 'BookingPending') fail('Contact the shop or administrator to cancel a confirmed booking');
          await tx.deliveryAssignment.updateMany({ where: { transactionId: id, status: { in: openAssignments } }, data: { status: 'Cancelled', ...clearedRiderLocation } });
          to = 'Cancelled';
        } else if (body.action === 'failedPickup') {
          if (!job || job.stage !== 'Pickup' || !['PickupAccepted', 'PickupEnRoute'].includes(order.workflowStatus!)) fail('Only the assigned rider can fail a pickup before collection', 403);
          if (!body.note) fail('Describe why pickup failed', 400);
          await tx.deliveryAssignment.update({ where: { id: job.id }, data: { status: 'Failed', ...clearedRiderLocation } });
          to = 'PickupQueued';
        } else if (body.action === 'resolveIssue') {
          if (!req.user!.isAdmin) fail('Only an administrator can resolve operational issues', 403);
          if (!body.note) fail('Record how the issue was resolved', 400);
          to = order.workflowStatus!;
        } else if (body.action === 'issue') {
          if (!job && !partner && !req.user!.isAdmin) fail('Only the assigned rider, partner or admin can report an issue', 403);
          if (!body.note) fail('Describe the issue', 400);
          await recordEvent(tx, order, actor(req), 'IssueReported', order.workflowStatus!, body.note, job?.riderId);
          return;
        } else if (body.action === 'updateWeight') {
          if (!partner) fail('Only this laundry partner can update weight', 403);
          if (!['LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(order.workflowStatus!) || !body.kilos || !body.note) fail('Enter the measured weight and explain the change during processing');
          if (Number(body.kilos.toFixed(2)) !== body.kilos) fail('Weight supports up to two decimal places', 400);
          const priced = priceOrder({ kilos: body.kilos, serviceName: order.serviceName, services: await tx.shopService.findMany({ where: { shopId: order.shopId } }), ranges: await tx.kiloPrice.findMany({ where: { shopId: order.shopId } }), deliveryType: order.deliveryType });
          if ('error' in priced && priced.error) fail(priced.error);
          await tx.orderWeightEvidence.create({ data: { transactionId: id, actorId: actor(req), kilos: body.kilos, totalAmount: priced.totalAmount!, note: body.note, bytes: weightPhoto! } });
          await tx.transaction.update({ where: { id }, data: { kiloAmount: body.kilos, ...priced, workflowVersion: { increment: 1 } } });
          await recordEvent(tx, order, actor(req), 'WeightAndPriceUpdated', order.workflowStatus!, `${body.note} Weight: ${body.kilos} kg; total: ${priced.totalAmount}. Scale photo available in order details.`);
          return;
        } else {
          const transition = jobTransitions[body.action];
          if (!req.user!.isRider || !job || !transition || job.stage !== transition.stage) fail('Only the assigned rider can perform this action', 403);
          if (order.workflowStatus !== transition.from) fail('Complete the previous delivery step first');
          if (transition.proof && body.code !== order[transition.proof]) fail('The confirmation code is incorrect', 400);
          if (transition.done) await tx.deliveryAssignment.update({ where: { id: job.id }, data: { status: 'Completed', ...clearedRiderLocation } });
          to = transition.to;
        }
        await changeState(tx, order, actor(req), body.action, to!, body.note, job?.riderId);
      });
      emit(req); return sendSuccess(res, { id });
    } catch (error) { next(error); }
  }
}

function addressText(value: { address_line_1: string | null; address_line_2: string | null; city: string | null; state_province: string | null; postal_code: string | null; country: string | null; address?: string | null }) {
  return [value.address_line_1, value.address_line_2, value.city, value.state_province, value.postal_code, value.country].filter(Boolean).join(', ') || value.address || 'Address not provided';
}
