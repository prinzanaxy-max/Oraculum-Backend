import { Router } from 'express';
import { createSupportContact } from '../controllers/support.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/contact', requireAuth, createSupportContact);

export default router;
