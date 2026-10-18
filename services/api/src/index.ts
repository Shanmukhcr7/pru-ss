import http from 'http';
import { createApp } from './app.js';
import { SignalingServer } from './signaling/signalingServer.js';
import { config } from './config.js';
import { db } from './db/index.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  await db.init();

  const app = createApp();
  const server = http.createServer(app);
  const signaling = new SignalingServer(server);

  server.listen(config.port, config.host, () => {
    logger.info(`ParentVision Backend API running at http://${config.host}:${config.port}`);
    logger.info(`WebRTC WebSocket Signaling running at ws://${config.host}:${config.port}/ws/signaling`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    signaling.close();
    server.close(async () => {
      await db.close();
      logger.info('Closed out remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
