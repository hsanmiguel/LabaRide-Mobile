import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { sendError } from '../utils/response';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    isShopOwner: boolean;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return sendError(res, 'Authentication token required', 'UNAUTHORIZED', 401);
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId,
      isShopOwner: decoded.isShopOwner,
    };
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 'FORBIDDEN', 403);
  }
};

export const requireShopOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isShopOwner) {
    return sendError(res, 'Shop owner privileges required', 'FORBIDDEN', 403);
  }
  next();
};
