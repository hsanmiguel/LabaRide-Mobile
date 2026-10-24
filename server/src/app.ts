import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import prisma from './config/database';
import { authenticateToken, requireApprovedShop } from './middleware/auth.middleware';
import adminRoutes from './routes/admin.routes';
import { ShopPhotoController } from './controllers/shop-photo.controller';
import { UserPhotoController } from './controllers/user-photo.controller';

// Import Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import shopRoutes from './routes/shop.routes';
import transactionRoutes from './routes/transaction.routes';
import notificationRoutes from './routes/notification.routes';
import deliveryRoutes from './routes/delivery.routes';
import { RiderApplicationController } from './controllers/rider-application.controller';
import { DeliveryController } from './controllers/delivery.controller';
import { ShopDocumentController } from './controllers/shop-document.controller';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
// The larger JSON limit is exclusive to authenticated photo uploads. Other
// requests retain Express's standard body limit.
app.put('/api/shops/:shopId/photo', authenticateToken, requireApprovedShop, express.json({ limit: '9mb' }), ShopPhotoController.upload);
app.put('/api/users/:userId/photo', authenticateToken, express.json({ limit: '9mb' }), UserPhotoController.upload);
app.put('/api/delivery/application/documents/:type', authenticateToken, express.json({ limit: '9mb' }), RiderApplicationController.upload);
app.put('/api/delivery/orders/:id/weight', authenticateToken, express.json({ limit: '9mb' }), DeliveryController.updateWeight);
app.put('/api/shops/:shopId/documents/:type', authenticateToken, express.json({ limit: '9mb' }), ShopDocumentController.upload);
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/delivery', deliveryRoutes);

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
