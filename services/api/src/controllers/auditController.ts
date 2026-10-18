import { Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const logs = await db.getAuditLogs(parent.id, limit);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
}
