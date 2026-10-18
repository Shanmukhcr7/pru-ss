import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { hashPassword, comparePassword, hashToken, generateSecureToken } from '../utils/crypto.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AuthTokenPayload } from '../types/index.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function generateTokens(parentId: string, email: string) {
  const accessToken = jwt.sign(
    { parentId, email, type: 'access' } as AuthTokenPayload,
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn as any }
  );

  const rawRefreshToken = generateSecureToken(40);
  const refreshTokenHash = hashToken(rawRefreshToken);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return { accessToken, rawRefreshToken, refreshTokenHash, refreshExpiresAt };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await db.findParentByEmail(data.email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists' });
      return;
    }

    const passwordHash = await hashPassword(data.password);
    const parent = await db.createParent(data.email, passwordHash, data.fullName);

    const { accessToken, rawRefreshToken, refreshTokenHash, refreshExpiresAt } = generateTokens(parent.id, parent.email);
    await db.storeRefreshToken(parent.id, refreshTokenHash, refreshExpiresAt);

    await db.logEvent('parent.register', 'Parent account created', parent.id, null, req.ip, { email: parent.email });

    res.status(201).json({
      message: 'Account registered successfully',
      parent: {
        id: parent.id,
        email: parent.email,
        fullName: parent.full_name,
        createdAt: parent.created_at,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);
    const parent = await db.findParentByEmail(data.email);
    if (!parent) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(data.password, parent.password_hash);
    if (!valid) {
      await db.logEvent('parent.login.failed', 'Failed login attempt', parent.id, null, req.ip);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { accessToken, rawRefreshToken, refreshTokenHash, refreshExpiresAt } = generateTokens(parent.id, parent.email);
    await db.storeRefreshToken(parent.id, refreshTokenHash, refreshExpiresAt);

    await db.logEvent('parent.login.success', 'Parent logged in', parent.id, null, req.ip);

    res.json({
      message: 'Logged in successfully',
      parent: {
        id: parent.id,
        email: parent.email,
        fullName: parent.full_name,
        createdAt: parent.created_at,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokenHash = hashToken(refreshToken);

    const storedToken = await db.findRefreshToken(tokenHash);
    if (!storedToken) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Token rotation: delete old refresh token
    await db.deleteRefreshToken(tokenHash);

    const parent = await db.findParentById(storedToken.parent_id);
    if (!parent) {
      res.status(401).json({ error: 'Parent account not found' });
      return;
    }

    const tokens = generateTokens(parent.id, parent.email);
    await db.storeRefreshToken(parent.id, tokens.refreshTokenHash, tokens.refreshExpiresAt);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.rawRefreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      await db.deleteRefreshToken(hashToken(refreshToken));
    }
    if (req.parent) {
      await db.logEvent('parent.logout', 'Parent logged out', req.parent.id, null, req.ip);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.parent) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({
    id: req.parent.id,
    email: req.parent.email,
    fullName: req.parent.full_name,
    createdAt: req.parent.created_at,
  });
}
