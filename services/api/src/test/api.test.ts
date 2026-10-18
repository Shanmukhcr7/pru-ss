import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { SignalingServer } from '../signaling/signalingServer.js';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { generateTurnCredentials } from '../utils/crypto.js';

let server: http.Server;
let signaling: SignalingServer;
let baseUrl: string;
let wsUrl: string;

before(async () => {
  // Ensure mock in-memory DB is used for fast, isolated tests
  db.isMock = true;
  await db.init();

  const app = createApp();
  server = http.createServer(app);
  signaling = new SignalingServer(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      baseUrl = `http://127.0.0.1:${address.port}`;
      wsUrl = `ws://127.0.0.1:${address.port}/ws/signaling`;
      resolve();
    });
  });
});

after(async () => {
  signaling.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
});

describe('ParentVision Security & Core API Test Suite', () => {
  let parentToken: string;
  let refreshToken: string;
  let parentId: string;
  let deviceId: string;
  let deviceToken: string;
  let sessionId: string;
  let viewerToken: string;
  let broadcasterToken: string;

  // Secondary parent to verify strict tenant isolation
  let secondParentToken: string;

  describe('1. Parent Authentication & Security', () => {
    it('registers a new parent account successfully', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice.parent@example.com',
          password: 'Password123!',
          fullName: 'Alice Walker',
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      assert.equal(data.parent.email, 'alice.parent@example.com');
      parentToken = data.accessToken;
      refreshToken = data.refreshToken;
      parentId = data.parent.id;
    });

    it('rejects duplicate email registration', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice.parent@example.com',
          password: 'AnotherPassword456!',
          fullName: 'Alice Duplicate',
        }),
      });

      assert.equal(res.status, 409);
      const data = (await res.json()) as any;
      assert.ok(data.error.includes('already exists'));
    });

    it('authenticates with valid login credentials', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice.parent@example.com',
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      refreshToken = data.refreshToken;
    });

    it('rejects login with invalid password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice.parent@example.com',
          password: 'WrongPassword!',
        }),
      });

      assert.equal(res.status, 401);
    });

    it('rotates refresh tokens securely', async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      assert.notEqual(data.refreshToken, refreshToken);

      // Verify old refresh token cannot be reused
      const replayRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      assert.equal(replayRes.status, 401);

      parentToken = data.accessToken;
      refreshToken = data.refreshToken;
    });

    it('registers a second parent for cross-tenant isolation testing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bob.parent@example.com',
          password: 'PasswordBob123!',
          fullName: 'Bob Smith',
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      secondParentToken = data.accessToken;
    });
  });

  describe('2. Device Enrollment & Pairing Protocol', () => {
    let pairingCode: string;

    it('allows parent to generate a 6-digit pairing code', async () => {
      const res = await fetch(`${baseUrl}/api/devices/pairing-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parentToken}`,
        },
        body: JSON.stringify({ deviceName: "Leo's iPhone 15" }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.ok(data.code);
      assert.equal(data.code.length, 6);
      assert.equal(data.deviceName, "Leo's iPhone 15");
      pairingCode = data.code;
    });

    it('allows child device to enroll using valid pairing code', async () => {
      const res = await fetch(`${baseUrl}/api/devices/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pairingCode,
          model: 'iPhone 15 Pro',
          osVersion: 'iOS 17.4',
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.ok(data.device.id);
      assert.ok(data.deviceToken);
      deviceId = data.device.id;
      deviceToken = data.deviceToken;
    });

    it('prevents reusing an already consumed pairing code', async () => {
      const res = await fetch(`${baseUrl}/api/devices/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pairingCode,
          model: 'iPhone 15 Pro',
          osVersion: 'iOS 17.4',
        }),
      });

      assert.equal(res.status, 400);
    });

    it('enrolled device appears in parent device listing', async () => {
      const res = await fetch(`${baseUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.devices.length, 1);
      assert.equal(data.devices[0].id, deviceId);
      assert.equal(data.devices[0].status, 'online');
    });

    it('accepts authenticated device heartbeats', async () => {
      const res = await fetch(`${baseUrl}/api/devices/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
          batteryLevel: 85,
          isCharging: true,
          status: 'online',
        }),
      });

      assert.equal(res.status, 200);
    });
  });

  describe('3. Strict Cross-Account Isolation Boundaries', () => {
    it('prevents Parent B from seeing Parent A devices', async () => {
      const res = await fetch(`${baseUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${secondParentToken}` },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.devices.length, 0); // Bob has no devices
    });

    it('prevents Parent B from viewing Parent A device details', async () => {
      const res = await fetch(`${baseUrl}/api/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${secondParentToken}` },
      });

      assert.equal(res.status, 404);
    });

    it('prevents Parent B from renaming Parent A device', async () => {
      const res = await fetch(`${baseUrl}/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secondParentToken}`,
        },
        body: JSON.stringify({ name: 'Hacked Device' }),
      });

      assert.equal(res.status, 404);
    });

    it('prevents Parent B from requesting a live broadcast on Parent A device', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secondParentToken}`,
        },
        body: JSON.stringify({ deviceId }),
      });

      assert.equal(res.status, 404);
    });
  });

  describe('4. Broadcast Authorization & Ephemeral TURN Credential Generation', () => {
    it('authorizes a live broadcast session for the authorized parent', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parentToken}`,
        },
        body: JSON.stringify({ deviceId }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.ok(data.sessionId);
      assert.ok(data.viewerToken);
      assert.ok(data.broadcasterToken);
      assert.ok(data.iceServers.urls);
      assert.ok(data.iceServers.username);
      assert.ok(data.iceServers.credential);

      sessionId = data.sessionId;
      viewerToken = data.viewerToken;
      broadcasterToken = data.broadcasterToken;
    });

    it('generates valid RFC 5766 coturn ephemeral credentials', () => {
      const creds = generateTurnCredentials('test-user', 3600);
      assert.ok(creds.username.includes(':test-user'));
      assert.ok(creds.password.length > 10);
      assert.equal(creds.ttl, 3600);
      assert.ok(Array.isArray(creds.uris));
    });
  });

  describe('5. WebRTC WebSocket Signaling Relay & Session Lifecycle', () => {
    it('rejects connection without session token', async () => {
      const rejected = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`${wsUrl}`);
        ws.on('open', () => {
          ws.close();
          resolve(false);
        });
        ws.on('unexpected-response', (_req, res) => {
          resolve(res.statusCode === 401);
        });
        ws.on('error', () => {
          resolve(true);
        });
      });
      assert.equal(rejected, true);
    });

    it('rejects connection with invalid or expired token', async () => {
      const badToken = jwt.sign(
        { sessionId: 'invalid', deviceId: 'none', parentId: 'none', role: 'viewer' },
        'wrong-secret'
      );

      const rejected = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`${wsUrl}?token=${badToken}`);
        ws.on('open', () => {
          ws.close();
          resolve(false);
        });
        ws.on('unexpected-response', (_req, res) => {
          resolve(res.statusCode === 403);
        });
        ws.on('error', () => {
          resolve(true);
        });
      });
      assert.equal(rejected, true);
    });

    it('connects broadcaster and viewer, exchanging SDP offer and answer', async () => {
      let broadcasterWs: WebSocket;
      let viewerWs: WebSocket;

      await new Promise<void>((resolve, reject) => {
        broadcasterWs = new WebSocket(`${wsUrl}?token=${broadcasterToken}`);
        viewerWs = new WebSocket(`${wsUrl}?token=${viewerToken}`);

        let broadcasterConnected = false;
        let viewerConnected = false;
        let offerReceived = false;
        let answerReceived = false;

        const checkDone = () => {
          if (offerReceived && answerReceived) {
            broadcasterWs.close();
            viewerWs.close();
            resolve();
          }
        };

        broadcasterWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connected') {
            broadcasterConnected = true;
            if (viewerConnected) {
              // Send mock SDP offer from iOS broadcaster
              broadcasterWs.send(
                JSON.stringify({
                  type: 'offer',
                  payload: { sdp: 'v=0\r\no=broadcaster 12345 2 IN IP4 127.0.0.1\r\ns=LiveScreen' },
                })
              );
            }
          } else if (msg.type === 'answer') {
            assert.equal(msg.sdp, 'v=0\r\no=viewer 67890 2 IN IP4 127.0.0.1\r\ns=LiveScreenAnswer');
            answerReceived = true;
            checkDone();
          }
        });

        viewerWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connected') {
            viewerConnected = true;
            if (broadcasterConnected) {
              broadcasterWs.send(
                JSON.stringify({
                  type: 'offer',
                  payload: { sdp: 'v=0\r\no=broadcaster 12345 2 IN IP4 127.0.0.1\r\ns=LiveScreen' },
                })
              );
            }
          } else if (msg.type === 'offer') {
            assert.equal(msg.sdp, 'v=0\r\no=broadcaster 12345 2 IN IP4 127.0.0.1\r\ns=LiveScreen');
            offerReceived = true;
            // Send mock SDP answer from Web viewer
            viewerWs.send(
              JSON.stringify({
                type: 'answer',
                payload: { sdp: 'v=0\r\no=viewer 67890 2 IN IP4 127.0.0.1\r\ns=LiveScreenAnswer' },
              })
            );
          }
        });

        broadcasterWs.on('error', reject);
        viewerWs.on('error', reject);
      });
    });

    it('terminates session and revokes stream view access', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parentToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      assert.equal(res.status, 200);

      // Verify session is no longer active
      const activeRes = await fetch(`${baseUrl}/api/sessions/active/${deviceId}`, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });
      const activeData = await activeRes.json();
      assert.equal(activeData.session, null);
    });
  });

  describe('6. Screen Time Summaries & Ingestion', () => {
    it('allows enrolled device to upload permitted daily Screen Time summary', async () => {
      const res = await fetch(`${baseUrl}/api/screentime/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
          summaryDate: '2026-10-18',
          totalMinutes: 145,
          categoryBreakdown: {
            Education: 60,
            Social: 45,
            Entertainment: 30,
            Productivity: 10,
          },
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.summary.total_minutes, 145);
    });

    it('allows parent to retrieve Screen Time summary for enrolled device', async () => {
      const res = await fetch(`${baseUrl}/api/screentime/${deviceId}`, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.summaries.length, 1);
      assert.equal(data.summaries[0].total_minutes, 145);
      assert.equal(data.summaries[0].category_breakdown.Education, 60);
    });
  });

  describe('7. Device Revocation & Administrative Audit Logs', () => {
    it('revokes device authorization and terminates pending access', async () => {
      const res = await fetch(`${baseUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${parentToken}` },
      });

      assert.equal(res.status, 200);

      // Verify device heartbeat is now rejected
      const heartbeatRes = await fetch(`${baseUrl}/api/devices/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({ batteryLevel: 70 }),
      });
      assert.equal(heartbeatRes.status, 403);
    });

    it('provides comprehensive audit logs of all security events to parent', async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.logs.length >= 4);

      const eventTypes = data.logs.map((l: any) => l.event_type);
      assert.ok(eventTypes.includes('parent.register'));
      assert.ok(eventTypes.includes('device.pairing_code.created'));
      assert.ok(eventTypes.includes('device.enrolled'));
      assert.ok(eventTypes.includes('broadcast.session.requested'));
      assert.ok(eventTypes.includes('device.revoked'));
    });
  });
});
