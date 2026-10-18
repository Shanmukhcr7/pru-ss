import { Router } from 'express';
import { uploadScreenTime, getScreenTime } from '../controllers/screenTimeController.js';
import { authenticateParent, authenticateDevice } from '../middleware/auth.js';

const router = Router();

// Device uploads usage summary
router.post('/summary', authenticateDevice, uploadScreenTime);

// Parent retrieves usage summary for an enrolled device
router.get('/:deviceId', authenticateParent, getScreenTime);

export default router;
