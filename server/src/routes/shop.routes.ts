import { Router } from 'express';
import { ShopController } from '../controllers/shop.controller';
import { authenticateToken, requireApprovedShop } from '../middleware/auth.middleware';
import { ShopPhotoController } from '../controllers/shop-photo.controller';
import { ShopDocumentController as D } from '../controllers/shop-document.controller';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/', ShopController.getAllShops);
router.get('/recent', ShopController.getRecentShops);
router.get('/:shopId/photo', ShopPhotoController.get);

// Authenticated routes
router.use(authenticateToken);
router.post('/', ShopController.registerShop);
router.get('/:shopId/documents', D.list);
router.get('/:shopId/documents/:type', D.image);
router.put('/:shopId/documents/:type/review', requireAdmin, D.review);
router.delete('/:shopId/photo', requireApprovedShop, ShopPhotoController.remove);
router.put('/:shopId/application', ShopController.resubmitApplication);
router.put('/:shopId', ShopController.updateShop);
router.get('/:shopId', ShopController.getShopById);
router.get('/user/:userId', ShopController.getShopByUserId);

// Services
router.post('/:shopId/services', requireApprovedShop, ShopController.addService);
router.put('/:shopId/services/:serviceId', requireApprovedShop, ShopController.updateService);
router.delete('/:shopId/services/:serviceId', requireApprovedShop, ShopController.deleteService);

// Kilo prices
router.post('/:shopId/kilo-prices', requireApprovedShop, ShopController.addKiloPrice);

export default router;
