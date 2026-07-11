import { Router } from 'express';
import {
  getBooksPanel,
  getCheckoutStats,
  getDashboardStats,
  getOverdueHistory,
  getRecentCheckouts,
} from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/stats', getDashboardStats);
router.get('/checkout-stats', getCheckoutStats);
router.get('/overdue-history', getOverdueHistory);
router.get('/recent-checkouts', getRecentCheckouts);
router.get('/books-panel', getBooksPanel);

export default router;