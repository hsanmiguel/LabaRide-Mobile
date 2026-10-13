import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { UserPhotoController } from '../controllers/user-photo.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Profile photos are public images so native and web image views can load them.
router.get('/:userId/photo', UserPhotoController.get);

// Apply auth middleware to account actions.
router.use(authenticateToken);

router.get('/:userId', UserController.getUser);
router.put('/:userId', UserController.updateUser);
router.delete('/:userId/photo', UserPhotoController.remove);
router.put('/:userId/password', UserController.updatePassword);
router.delete('/:userId', UserController.deleteAccount);
router.get('/:userId/has-shop', UserController.hasShop);

export default router;
