import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticateParent } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateParent, getAuditLogs);

export default router;
