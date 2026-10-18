import { Router } from 'express';
import {
  requestBroadcastSession,
  terminateBroadcastSession,
  getActiveSession,
  getTurnCredentialsEndpoint,
} from '../controllers/sessionController.js';
import { authenticateParent } from '../middleware/auth.js';

const router = Router();

router.post('/request', authenticateParent, requestBroadcastSession);
router.post('/terminate', authenticateParent, terminateBroadcastSession);
router.get('/active/:deviceId', authenticateParent, getActiveSession);
router.get('/turn-credentials', authenticateParent, getTurnCredentialsEndpoint);

export default router;
