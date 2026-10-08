import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/', TransactionController.createTransaction);
router.get('/user/:userId', TransactionController.getUserTransactions);
router.get('/shop/:shopId', TransactionController.getShopTransactions);
router.put('/:id/status', TransactionController.updateStatus);
router.put('/:id/cancel', TransactionController.cancelTransaction);

export default router;
