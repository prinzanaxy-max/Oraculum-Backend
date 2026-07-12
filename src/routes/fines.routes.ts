import { Router } from 'express';
import { getFines, payFine, waiveFine } from '../controllers/fines.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getFines);
router.post('/:id/pay', payFine);
router.post('/:id/waive', waiveFine);

export default router;
