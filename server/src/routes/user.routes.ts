import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all user routes
router.use(authenticateToken);

router.get('/:userId', UserController.getUser);
router.put('/:userId', UserController.updateUser);
router.put('/:userId/password', UserController.updatePassword);
router.delete('/:userId', UserController.deleteAccount);
router.get('/:userId/has-shop', UserController.hasShop);

export default router;
