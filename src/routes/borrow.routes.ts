import { Router } from 'express';
import { getAllBorrowRecords, createBorrowRecord } from '../controllers/borrow.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAllBorrowRecords);
router.post('/', createBorrowRecord);

export default router;