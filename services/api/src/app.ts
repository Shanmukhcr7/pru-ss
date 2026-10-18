import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import screenTimeRoutes from './routes/screenTimeRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { db } from './db/index.js';

export function createApp() {
  const app = express();

  // Security and utilities middleware
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimiter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: db.isMock ? 'in-memory-mock' : 'postgresql',
      uptime: process.uptime(),
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/screentime', screenTimeRoutes);
  app.use('/api/audit-logs', auditRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
