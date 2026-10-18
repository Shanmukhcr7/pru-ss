import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { AuthTokenPayload, DeviceTokenPayload, SessionTokenPayload, Parent, Device } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  parent?: Parent;
  device?: Device;
  sessionAuth?: SessionTokenPayload;
}

export async function authenticateParent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Zero-login direct access: fallback to default parent
    const defaultParent = await db.getDefaultParent();
    req.parent = defaultParent;
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (token === 'default' || token === 'guest') {
    const defaultParent = await db.getDefaultParent();
    req.parent = defaultParent;
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AuthTokenPayload;
    if (payload.type !== 'access') {
      res.status(401).json({ error: 'Unauthorized: Invalid token type' });
      return;
    }

    const parent = await db.findParentById(payload.parentId);
    if (!parent) {
      res.status(401).json({ error: 'Unauthorized: Parent account not found' });
      return;
    }

    req.parent = parent;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Unauthorized: Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export async function authenticateDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or malformed device token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.deviceSecret) as DeviceTokenPayload;
    if (payload.type !== 'device') {
      res.status(401).json({ error: 'Unauthorized: Invalid device token type' });
      return;
    }

    const device = await db.findDeviceById(payload.deviceId);
    if (!device) {
      res.status(401).json({ error: 'Unauthorized: Device not recognized' });
      return;
    }

    if (device.is_revoked) {
      res.status(403).json({ error: 'Forbidden: Device enrollment has been revoked' });
      return;
    }

    req.device = device;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid device token' });
  }
}

export async function authenticateSessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const payload = jwt.verify(token, config.jwt.sessionSecret) as SessionTokenPayload;
    const session = await db.findSessionById(payload.sessionId);
    if (!session || session.status === 'ended' || session.status === 'revoked') {
      return null;
    }

    // Ensure device is not revoked
    const device = await db.findDeviceById(payload.deviceId);
    if (!device || device.is_revoked) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
