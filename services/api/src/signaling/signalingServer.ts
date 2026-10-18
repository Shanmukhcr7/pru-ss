import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { authenticateSessionToken } from '../middleware/auth.js';
import { SessionTokenPayload } from '../types/index.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

interface SignalingClient {
  ws: WebSocket;
  sessionAuth: SessionTokenPayload;
  isAlive: boolean;
}

interface SessionRoom {
  sessionId: string;
  deviceId: string;
  parentId: string;
  broadcaster?: SignalingClient;
  viewer?: SignalingClient;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private rooms = new Map<string, SessionRoom>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request, socket, head) => {
      const pathname = url.parse(request.url || '').pathname;
      if (pathname === '/ws/signaling') {
        const queryParams = new URLSearchParams(url.parse(request.url || '').query || '');
        const token = queryParams.get('token');

        if (!token) {
          logger.warn('Signaling rejected: missing token query param');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const sessionAuth = await authenticateSessionToken(token);
        if (!sessionAuth) {
          logger.warn('Signaling rejected: invalid or expired session token');
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, sessionAuth);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: any, sessionAuth: SessionTokenPayload) => {
      this.handleConnection(ws, sessionAuth);
    });

    this.startHeartbeat();
  }

  private handleConnection(ws: WebSocket, sessionAuth: SessionTokenPayload) {
    const { sessionId, role, deviceId, parentId } = sessionAuth;
    logger.info(`Signaling client connected: role=${role}, session=${sessionId}`);

    let room = this.rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        deviceId,
        parentId,
      };
      this.rooms.set(sessionId, room);
    }

    const client: SignalingClient = {
      ws,
      sessionAuth,
      isAlive: true,
    };

    // Prevent duplicate participants in 1:1 supervision session
    if (role === 'broadcaster') {
      if (room.broadcaster && room.broadcaster.ws.readyState === WebSocket.OPEN) {
        room.broadcaster.ws.close(4001, 'Another broadcaster connected');
      }
      room.broadcaster = client;
      db.updateDeviceStatus(deviceId, 'broadcasting');
      db.updateSessionStatus(sessionId, 'active');
    } else if (role === 'viewer') {
      if (room.viewer && room.viewer.ws.readyState === WebSocket.OPEN) {
        room.viewer.ws.close(4002, 'Another viewer connected');
      }
      room.viewer = client;
    }

    // Notify connected parties
    this.sendToClient(client, {
      type: 'connected',
      sessionId,
      role,
      peerOnline: role === 'broadcaster' ? !!room.viewer : !!room.broadcaster,
    });

    const peer = role === 'broadcaster' ? room.viewer : room.broadcaster;
    if (peer) {
      this.sendToClient(peer, {
        type: 'peer_joined',
        role,
      });
    }

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', async (raw: string) => {
      try {
        const message = JSON.parse(raw.toString());
        await this.handleMessage(room!, client, message);
      } catch (err: any) {
        logger.error('Error handling signaling message', { error: err.message });
      }
    });

    ws.on('close', async () => {
      logger.info(`Signaling client disconnected: role=${role}, session=${sessionId}`);
      this.handleDisconnect(sessionId, role);
    });

    ws.on('error', (err) => {
      logger.error('Signaling client socket error', { error: err.message, role, sessionId });
    });
  }

  private async handleMessage(room: SessionRoom, client: SignalingClient, message: any) {
    const { type, payload } = message;
    const { role } = client.sessionAuth;
    const target = role === 'broadcaster' ? room.viewer : room.broadcaster;

    switch (type) {
      case 'offer':
        if (role !== 'broadcaster') {
          logger.warn('Only broadcaster can send WebRTC offer');
          return;
        }
        if (target) {
          this.sendToClient(target, { type: 'offer', sdp: payload?.sdp });
        }
        break;

      case 'answer':
        if (role !== 'viewer') {
          logger.warn('Only viewer can send WebRTC answer');
          return;
        }
        if (target) {
          this.sendToClient(target, { type: 'answer', sdp: payload?.sdp });
        }
        break;

      case 'candidate':
        if (target) {
          this.sendToClient(target, { type: 'candidate', candidate: payload?.candidate });
        }
        break;

      case 'stop':
        logger.info(`Broadcast stop requested by ${role} for session ${room.sessionId}`);
        await db.updateSessionStatus(room.sessionId, 'ended');
        await db.updateDeviceStatus(room.deviceId, 'online');

        if (target) {
          this.sendToClient(target, { type: 'stream_stopped', reason: `Stopped by ${role}` });
        }

        this.sendToClient(client, { type: 'stream_stopped', reason: 'Session ended' });
        break;

      case 'ping':
        this.sendToClient(client, { type: 'pong' });
        break;

      default:
        logger.warn(`Unknown signaling message type: ${type}`);
    }
  }

  private async handleDisconnect(sessionId: string, role: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    if (role === 'broadcaster') {
      delete room.broadcaster;
      await db.updateDeviceStatus(room.deviceId, 'online');
      await db.updateSessionStatus(room.sessionId, 'ended');
      if (room.viewer) {
        this.sendToClient(room.viewer, { type: 'peer_disconnected', role: 'broadcaster' });
      }
    } else if (role === 'viewer') {
      delete room.viewer;
      if (room.broadcaster) {
        this.sendToClient(room.broadcaster, { type: 'peer_disconnected', role: 'viewer' });
      }
    }

    if (!room.broadcaster && !room.viewer) {
      this.rooms.delete(sessionId);
      logger.info(`Session room ${sessionId} closed and removed`);
    }
  }

  private sendToClient(client: SignalingClient, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [sessionId, room] of this.rooms.entries()) {
        [room.broadcaster, room.viewer].forEach((client) => {
          if (!client) return;
          if (!client.isAlive) {
            client.ws.terminate();
            return;
          }
          client.isAlive = false;
          client.ws.ping();
        });
      }
    }, 30000);
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}
