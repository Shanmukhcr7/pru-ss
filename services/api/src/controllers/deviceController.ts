import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { hashToken, generateSecureToken } from '../utils/crypto.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { DeviceTokenPayload } from '../types/index.js';

const pairingCodeSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required').max(100),
});

const enrollSchema = z.object({
  code: z.string().length(6, 'Pairing code must be 6 digits'),
  name: z.string().min(1).max(100).optional(),
  model: z.string().default('iPhone'),
  osVersion: z.string().default('iOS 17.0'),
});

const renameSchema = z.object({
  name: z.string().min(1).max(100),
});

const heartbeatSchema = z.object({
  batteryLevel: z.number().min(0).max(100).optional(),
  isCharging: z.boolean().optional(),
  status: z.enum(['online', 'offline', 'broadcasting']).default('online'),
});

export async function createPairingCode(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { deviceName } = pairingCodeSchema.parse(req.body);

    const record = await db.createPairingCode(parent.id, deviceName, 15);
    await db.logEvent('device.pairing_code.created', `Generated pairing code for ${deviceName}`, parent.id, null, req.ip);

    res.status(201).json({
      code: record.code,
      deviceName: record.device_name,
      expiresAt: record.expires_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function enrollDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, name, model, osVersion } = enrollSchema.parse(req.body);

    const pairingRecord = await db.findValidPairingCode(code);
    if (!pairingRecord) {
      res.status(400).json({ error: 'Invalid or expired pairing code' });
      return;
    }

    const deviceName = name || pairingRecord.device_name;
    const rawDeviceSecret = generateSecureToken(32);
    const deviceSecretHash = hashToken(rawDeviceSecret);

    const device = await db.enrollDevice(
      pairingRecord.parent_id,
      deviceName,
      model,
      osVersion,
      deviceSecretHash
    );

    await db.markPairingCodeUsed(code);

    const deviceToken = jwt.sign(
      { deviceId: device.id, parentId: pairingRecord.parent_id, type: 'device' } as DeviceTokenPayload,
      config.jwt.deviceSecret
    );

    await db.logEvent(
      'device.enrolled',
      `Device "${device.name}" (${device.model}, ${device.os_version}) enrolled successfully`,
      pairingRecord.parent_id,
      device.id,
      req.ip
    );

    res.status(201).json({
      message: 'Device enrolled successfully',
      device: {
        id: device.id,
        name: device.name,
        model: device.model,
        osVersion: device.os_version,
        status: device.status,
      },
      deviceToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function listDevices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const devices = await db.listDevicesByParent(parent.id);
    res.json({ devices });
  } catch (err) {
    next(err);
  }
}

export async function getDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { id } = req.params;

    const device = await db.findDeviceById(id);
    if (!device || device.parent_id !== parent.id || device.is_revoked) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    res.json({ device });
  } catch (err) {
    next(err);
  }
}

export async function renameDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { id } = req.params;
    const { name } = renameSchema.parse(req.body);

    const updated = await db.renameDevice(id, parent.id, name);
    if (!updated) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    await db.logEvent('device.renamed', `Device renamed to "${name}"`, parent.id, id, req.ip);
    res.json({ message: 'Device renamed successfully', device: updated });
  } catch (err) {
    next(err);
  }
}

export async function revokeDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { id } = req.params;

    const success = await db.revokeDevice(id, parent.id);
    if (!success) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    await db.logEvent('device.revoked', `Device authorization revoked by parent`, parent.id, id, req.ip);
    res.json({ message: 'Device authorization revoked successfully' });
  } catch (err) {
    next(err);
  }
}

export async function heartbeat(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = req.device!;
    const { batteryLevel, isCharging, status } = heartbeatSchema.parse(req.body);

    await db.updateDeviceStatus(device.id, status, batteryLevel, isCharging);
    res.json({ message: 'Heartbeat acknowledged' });
  } catch (err) {
    next(err);
  }
}
