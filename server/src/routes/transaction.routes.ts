import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { authenticateToken, requireApprovedShop } from '../middleware/auth.middleware';
import { InvoiceController } from '../controllers/invoice.controller';

import { DeliveryFeesController } from '../controllers/delivery-fees.controller';
const router = Router();

router.use(authenticateToken);
router.get('/:id/invoice', InvoiceController.get);

router.post('/delivery-quote', DeliveryFeesController.quote);
router.post('/', TransactionController.createTransaction);
router.get('/user/:userId', TransactionController.getUserTransactions);
router.get('/shop/:shopId', requireApprovedShop, TransactionController.getShopTransactions);
router.put('/:id/status', TransactionController.updateStatus);
router.put('/:id/timer', TransactionController.startTimer);
router.put('/:id/cancel', TransactionController.cancelTransaction);

export default router;
