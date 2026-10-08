import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';
import { sendSuccess, sendError } from '../utils/response';
import { signupSchema, loginSchema } from '../validators/auth.validator';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = signupSchema.parse(req).body;
      const { name, email, password } = validatedData;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return sendError(res, 'Email already registered', 'CONFLICT', 409);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        }
      });

      // Generate token
      const token = jwt.sign(
        { userId: user.id, isShopOwner: user.isShopOwner },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return sendSuccess(res, {
        token,
        user: { id: user.id, name: user.name, email: user.email, isShopOwner: user.isShopOwner }
      }, 'User registered successfully', 201);

    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = loginSchema.parse(req).body;
      const { email, password } = validatedData;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return sendError(res, 'Invalid credentials', 'UNAUTHORIZED', 401);
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return sendError(res, 'Invalid credentials', 'UNAUTHORIZED', 401);
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, isShopOwner: user.isShopOwner },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return sendSuccess(res, {
        token,
        user: { id: user.id, name: user.name, email: user.email, isShopOwner: user.isShopOwner }
      }, 'Login successful');

    } catch (error) {
      next(error);
    }
  }

  static async verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return sendError(res, 'Unauthorized', 'UNAUTHORIZED', 401);
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!user) {
        return sendError(res, 'User not found', 'NOT_FOUND', 404);
      }

      return sendSuccess(res, {
        user: { id: user.id, name: user.name, email: user.email, isShopOwner: user.isShopOwner }
      }, 'Token is valid');
    } catch (error) {
      next(error);
    }
  }
}
