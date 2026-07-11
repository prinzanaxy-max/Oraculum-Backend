import { Router } from 'express';
import { getAllReservations, createReservation } from '../controllers/reservations.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAllReservations);
router.post('/', createReservation);

export default router;