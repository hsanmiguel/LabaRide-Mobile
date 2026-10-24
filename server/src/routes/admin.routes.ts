import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { AdminController } from '../controllers/admin.controller';

const router = Router();
router.use(authenticateToken, requireAdmin);
router.get('/shops', AdminController.shops);
router.put('/shops/:shopId/review', AdminController.review);
export default router;
