import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config.js';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRandomCode(length = 6): string {
  const chars = '0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Generates RFC 5766 / Coturn REST API ephemeral TURN credentials.
 * Coturn expects username formatted as: `<timestamp>:<username>`
 * and password as HMAC-SHA1 of the username using the shared TURN secret, base64 encoded.
 */
export function generateTurnCredentials(username = 'user', ttlSeconds = 86400) {
  const unixTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const turnUsername = `${unixTimestamp}:${username}`;
  const hmac = crypto.createHmac('sha1', config.turn.secret);
  hmac.update(turnUsername);
  const password = hmac.digest('base64');

  return {
    username: turnUsername,
    password,
    ttl: ttlSeconds,
    uris: config.turn.urls,
  };
}
