import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { AdminController } from '../controllers/admin.controller';
import { AdminCustomersController } from '../controllers/admin-customers.controller';

import { DeliveryFeesController } from '../controllers/delivery-fees.controller';
const router = Router();
router.use(authenticateToken, requireAdmin);
router.get('/delivery-fees', DeliveryFeesController.settings);
router.put('/delivery-fees', DeliveryFeesController.update);
router.get('/customers', AdminCustomersController.list);
router.put('/customers/:userId/access', AdminCustomersController.access);
router.get('/shops', AdminController.shops);
router.put('/shops/:shopId/review', AdminController.review);
export default router;
