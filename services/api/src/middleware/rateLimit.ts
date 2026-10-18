import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipMap = new Map<string, RateLimitRecord>();

// Simple in-memory rate limiter without external dependency
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = ipMap.get(ip);

  if (!record || now > record.resetTime) {
    ipMap.set(ip, {
      count: 1,
      resetTime: now + config.rateLimit.windowMs,
    });
    return next();
  }

  record.count += 1;
  if (record.count > config.rateLimit.maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfterSeconds: retryAfter,
    });
    return;
  }

  next();
}
