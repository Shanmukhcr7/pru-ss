import { Router } from 'express';
import {
  createPairingCode,
  enrollDevice,
  listDevices,
  getDevice,
  renameDevice,
  revokeDevice,
  heartbeat,
} from '../controllers/deviceController.js';
import { authenticateParent, authenticateDevice } from '../middleware/auth.js';

const router = Router();

// Parent endpoints
router.post('/pairing-code', authenticateParent, createPairingCode);
router.get('/', authenticateParent, listDevices);
router.get('/:id', authenticateParent, getDevice);
router.patch('/:id', authenticateParent, renameDevice);
router.delete('/:id', authenticateParent, revokeDevice);

// Device endpoints
router.post('/enroll', enrollDevice);
router.post('/heartbeat', authenticateDevice, heartbeat);

export default router;
