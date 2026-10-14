import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import prisma from './config/database';
import { authenticateToken } from './middleware/auth.middleware';
import { ShopPhotoController } from './controllers/shop-photo.controller';
import { UserPhotoController } from './controllers/user-photo.controller';

// Import Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import shopRoutes from './routes/shop.routes';
import transactionRoutes from './routes/transaction.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
// The larger JSON limit is exclusive to authenticated photo uploads. Other
// requests retain Express's standard body limit.
app.put('/api/shops/:shopId/photo', authenticateToken, express.json({ limit: '9mb' }), ShopPhotoController.upload);
app.put('/api/users/:userId/photo', authenticateToken, express.json({ limit: '9mb' }), UserPhotoController.upload);
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

// Global Error Handler
app.use(errorHandler);

export default app;
