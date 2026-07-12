import { Router } from 'express';
import { createBorrowRecord, getAllBorrowRecords, renewBorrowRecord, returnBorrowRecord } from '../controllers/borrow.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAllBorrowRecords);
router.post('/', createBorrowRecord);
router.patch('/:id/return', returnBorrowRecord);
router.patch('/:id/renew', renewBorrowRecord);

export default router;