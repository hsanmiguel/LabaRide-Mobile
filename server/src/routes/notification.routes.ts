import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();
router.use(authenticateToken);
router.get('/', NotificationController.list);
router.put('/:id/read', NotificationController.markRead);
export default router;
