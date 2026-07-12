import { Router } from 'express';
import { cancelReservation, createReservation, getAllReservations } from '../controllers/reservations.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAllReservations);
router.post('/', createReservation);
router.patch('/:id/cancel', cancelReservation);

export default router;