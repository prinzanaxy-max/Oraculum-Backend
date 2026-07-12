import { Router } from 'express';
import { getLibrarySettings, updateLibrarySettings } from '../controllers/settings.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/library', getLibrarySettings);
router.put('/library', updateLibrarySettings);

export default router;
