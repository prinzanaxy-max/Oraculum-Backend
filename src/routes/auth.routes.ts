import { Router } from 'express';
import {
  changePassword,
  forgotPassword,
  getMe,
  googleSignIn,
  login,
  logout,
  refresh,
  register,
  signup,
  updateMe,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', signup);
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleSignIn);
router.post('/forgot-password', forgotPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);
router.put('/change-password', requireAuth, changePassword);

export default router;