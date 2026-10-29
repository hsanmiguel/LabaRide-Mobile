import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { env } from '../config/env';
import { sendSuccess, sendError } from '../utils/response';
import { signupSchema, loginSchema, riderSignupSchema } from '../validators/auth.validator';
import { AuthRequest } from '../middleware/auth.middleware';
import { userProfileSelect, withUserPhoto } from '../utils/user-profile';

export class AuthController {
  static async riderSignup(req: Request, res: Response, next: NextFunction) {
    try {
      const { confirmPassword, password, ...data } = riderSignupSchema.parse(req).body;
      if (await prisma.user.findUnique({ where: { email: data.email } })) return sendError(res, 'This email is already registered. Sign in with your existing account or use a different email for your rider application.', 'CONFLICT', 409);
      const hash = await bcrypt.hash(password, 10);
      const user = await prisma.$transaction(async tx => {
        const result = await tx.user.create({ data: {
          ...data, password: hash,
          riderProfile: { create: { active: false, online: false, applicationStatus: 'Draft', requirementsVersion: 1 } },
        } });
        return result;
      });
      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: '7d' });
      return sendSuccess(res, { token, user: { id: user.id, name: user.name, email: user.email, isShopOwner: false, isAdmin: false, isRider: false, riderApplicationStatus: 'Draft' } }, 'Rider application draft created', 201);
    } catch (error) { next(error); }
  }
  
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
        user: { id: user.id, name: user.name, email: user.email, isShopOwner: user.isShopOwner, isAdmin: user.isAdmin, isRider: user.isRider }
      }, 'User registered successfully', 201);

    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = loginSchema.parse(req).body;
      const { email, password } = validatedData;

      const user = await prisma.user.findUnique({ where: { email }, include: { riderProfile: true } });
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
        user: { id: user.id, name: user.name, email: user.email, isShopOwner: user.isShopOwner, isAdmin: user.isAdmin, isRider: user.isRider, riderApplicationStatus: user.riderProfile?.applicationStatus }
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

      const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: userProfileSelect });
      if (!user) {
        return sendError(res, 'User not found', 'NOT_FOUND', 404);
      }

      return sendSuccess(res, {
        user: withUserPhoto(user),
        token: jwt.sign({ userId: user.id, isShopOwner: user.isShopOwner }, env.JWT_SECRET, { expiresIn: '7d' }),
      }, 'Token is valid');
    } catch (error) {
      next(error);
    }
  }
}
