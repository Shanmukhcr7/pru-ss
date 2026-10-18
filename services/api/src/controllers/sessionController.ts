import { Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { hashToken, generateTurnCredentials } from '../utils/crypto.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { SessionTokenPayload } from '../types/index.js';

const requestSessionSchema = z.object({
  deviceId: z.string().uuid(),
});

const terminateSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function requestBroadcastSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { deviceId } = requestSessionSchema.parse(req.body);

    const device = await db.findDeviceById(deviceId);
    if (!device || device.parent_id !== parent.id) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    if (device.is_revoked) {
      res.status(403).json({ error: 'Cannot broadcast to a revoked device' });
      return;
    }

    // Reuse existing active session if one exists so broadcaster and viewer share the same session
    let session = await db.getActiveSessionForDevice(deviceId);
    if (!session) {
      session = await db.createBroadcastSession(
        deviceId,
        parent.id,
        hashToken(`${deviceId}:${Date.now()}`)
      );
    }

    const viewerToken = jwt.sign(
      {
        sessionId: session.id,
        deviceId,
        parentId: parent.id,
        role: 'viewer',
      } as SessionTokenPayload,
      config.jwt.sessionSecret,
      { expiresIn: config.jwt.sessionExpiresIn as any }
    );

    const broadcasterToken = jwt.sign(
      {
        sessionId: session.id,
        deviceId,
        parentId: parent.id,
        role: 'broadcaster',
      } as SessionTokenPayload,
      config.jwt.sessionSecret,
      { expiresIn: config.jwt.sessionExpiresIn as any }
    );

    const iceServers = generateTurnCredentials(parent.id, 900); // 15 mins TTL

    await db.logEvent(
      'broadcast.session.requested',
      `Live screen broadcast session requested for "${device.name}"`,
      parent.id,
      deviceId,
      req.ip,
      { sessionId: session.id }
    );

    res.status(201).json({
      sessionId: session.id,
      deviceId,
      viewerToken,
      broadcasterToken,
      iceServers: {
        urls: iceServers.uris,
        username: iceServers.username,
        credential: iceServers.password,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function terminateBroadcastSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { sessionId } = terminateSessionSchema.parse(req.body);

    const session = await db.findSessionById(sessionId);
    if (!session || session.parent_id !== parent.id) {
      res.status(404).json({ error: 'Broadcast session not found' });
      return;
    }

    await db.updateSessionStatus(sessionId, 'ended');
    await db.updateDeviceStatus(session.device_id, 'online');

    await db.logEvent(
      'broadcast.session.terminated',
      `Live broadcast session stopped by parent`,
      parent.id,
      session.device_id,
      req.ip,
      { sessionId }
    );

    res.json({ message: 'Broadcast session terminated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getActiveSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parent = req.parent!;
    const { deviceId } = req.params;

    const device = await db.findDeviceById(deviceId);
    if (!device || device.parent_id !== parent.id) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const session = await db.getActiveSessionForDevice(deviceId);
    if (!session) {
      res.json({ session: null });
      return;
    }

    const iceServers = generateTurnCredentials(parent.id, 900);

    res.json({
      session,
      iceServers: {
        urls: iceServers.uris,
        username: iceServers.username,
        credential: iceServers.password,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTurnCredentialsEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
  const identifier = req.parent ? req.parent.id : req.device?.id || 'client';
  const iceServers = generateTurnCredentials(identifier, 1800);
  res.json({
    iceServers: [
      {
        urls: iceServers.uris,
        username: iceServers.username,
        credential: iceServers.password,
      },
    ],
  });
}
