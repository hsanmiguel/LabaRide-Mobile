import { Router } from 'express';
import { ShopController } from '../controllers/shop.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/', ShopController.getAllShops);
router.get('/recent', ShopController.getRecentShops);

// Authenticated routes
router.use(authenticateToken);
router.post('/', ShopController.registerShop);
router.put('/:shopId', ShopController.updateShop);
router.get('/:shopId', ShopController.getShopById);
router.get('/user/:userId', ShopController.getShopByUserId);

// Services
router.post('/:shopId/services', ShopController.addService);
router.put('/:shopId/services/:serviceId', ShopController.updateService);
router.delete('/:shopId/services/:serviceId', ShopController.deleteService);

// Kilo prices
router.post('/:shopId/kilo-prices', ShopController.addKiloPrice);

export default router;
