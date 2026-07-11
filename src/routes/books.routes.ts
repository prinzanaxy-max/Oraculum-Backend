import { Router } from 'express';
import { getAllBooks, createBook } from '../controllers/books.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAllBooks);
router.post('/', createBook);

export default router;