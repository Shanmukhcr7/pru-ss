import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/parentvision',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-32-chars-minimum-length!',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-32-chars-minimum-length!',
    deviceSecret: process.env.JWT_DEVICE_SECRET || 'dev-device-secret-32-chars-minimum-length!',
    sessionSecret: process.env.JWT_SESSION_SECRET || 'dev-session-secret-32-chars-minimum-length!',
    accessExpiresIn: '15m' as const,
    refreshExpiresIn: '7d' as const,
    sessionExpiresIn: '15m' as const,
  },
  turn: {
    secret: process.env.TURN_SECRET || 'dev-turn-auth-secret-key-very-secure',
    realm: process.env.TURN_REALM || 'turn.parentvision.local',
    urls: (process.env.TURN_URLS || 'stun:stun.l.google.com:19302,turn:127.0.0.1:3478?transport=udp').split(','),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },
};
