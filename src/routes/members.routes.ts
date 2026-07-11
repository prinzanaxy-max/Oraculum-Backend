import { Router } from 'express';
import { getAllMembers, createMember } from '../controllers/members.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAllMembers);
router.post('/', createMember);

export default router;