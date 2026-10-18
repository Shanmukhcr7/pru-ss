import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/authController.js';
import { authenticateParent } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticateParent, logout);
router.get('/me', authenticateParent, me);

export default router;
