import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { sendError } from '../utils/response';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    isShopOwner: boolean;
    isAdmin?: boolean;
    isRider?: boolean;
    riderApplicationStatus?: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return sendError(res, 'Authentication token required', 'UNAUTHORIZED', 401);
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) throw new Error('Invalid identity');
    // Permissions come from the database on every request, never old JWT claims.
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: {
      id: true, isShopOwner: true, isAdmin: true, isRider: true,
      riderProfile: { select: { applicationStatus: true } },
    } });
    if (!user) return sendError(res, 'Account no longer exists', 'UNAUTHORIZED', 401);
    req.user = { userId: user.id, isShopOwner: user.isShopOwner, isAdmin: user.isAdmin, isRider: user.isRider, riderApplicationStatus: user.riderProfile?.applicationStatus };
    return next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError) && !(error instanceof jwt.TokenExpiredError)
      && (error as Error).message !== 'Invalid identity') return next(error);
    return sendError(res, 'Invalid or expired token', 'FORBIDDEN', 403);
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) return sendError(res, 'Administrator access required', 'FORBIDDEN', 403);
  return next();
};

export const requireApprovedShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = Number(req.params.shopId);
    if (!Number.isSafeInteger(shopId) || shopId <= 0) return sendError(res, 'Choose a valid shop', 'BAD_REQUEST', 400);
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true, approvalStatus: true } });
    if (!shop) return sendError(res, 'Shop not found', 'NOT_FOUND', 404);
    if (shop.userId !== req.user?.userId) return sendError(res, 'Only the shop owner can manage this shop', 'FORBIDDEN', 403);
    if (shop.approvalStatus !== 'Approved') return sendError(res, 'Admin approval is required to use shop mode', 'SHOP_NOT_APPROVED', 403);
    return next();
  } catch (error) { return next(error); }
};

export const requireShopOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isShopOwner) {
    return sendError(res, 'Shop owner privileges required', 'FORBIDDEN', 403);
  }
  next();
};
