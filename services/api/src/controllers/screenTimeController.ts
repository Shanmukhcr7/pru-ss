import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const uploadSchema = z.object({
  summaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  totalMinutes: z.number().int().min(0).max(1440),
  categoryBreakdown: z.record(z.number().int().min(0)),
});

export async function uploadScreenTime(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = req.device!;
    const { summaryDate, totalMinutes, categoryBreakdown } = uploadSchema.parse(req.body);

    const summary = await db.saveScreenTimeSummary(
      device.id,
      summaryDate,
      totalMinutes,
      categoryBreakdown
    );

    res.status(201).json({
      message: 'Screen Time summary recorded successfully',
      summary,
    });
  } catch (err) {
    next(err);
  }
}

export async function getScreenTime(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { deviceId } = req.params;
    const days = parseInt(req.query.days as string, 10) || 7;

    const device = await db.findDeviceById(deviceId);
    if (!device || device.parent_id !== parent.id || device.is_revoked) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const summaries = await db.getScreenTimeSummaries(deviceId, days);
    res.json({ summaries });
  } catch (err) {
    next(err);
  }
}
