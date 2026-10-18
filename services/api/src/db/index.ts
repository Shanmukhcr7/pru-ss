import pg from 'pg';
import crypto from 'crypto';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  Parent,
  Device,
  PairingCode,
  BroadcastSession,
  AuditLog,
  ScreenTimeSummary,
} from '../types/index.js';

const { Pool } = pg;

export class Database {
  private pool: pg.Pool | null = null;
  public isMock = false;

  // In-memory data store for testing and fallback
  private mockParents = new Map<string, Parent>();
  private mockRefreshTokens = new Map<string, { id: string; parent_id: string; token_hash: string; expires_at: Date; created_at: Date }>();
  private mockDevices = new Map<string, Device>();
  private mockPairingCodes = new Map<string, PairingCode>();
  private mockSessions = new Map<string, BroadcastSession>();
  private mockAuditLogs: AuditLog[] = [];
  private mockScreenTimes = new Map<string, ScreenTimeSummary>();

  constructor() {
    if (process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'test') {
      this.isMock = true;
      logger.info('Database initialized in in-memory test mode');
    } else {
      this.pool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
      });
    }
  }

  public async init(): Promise<void> {
    if (this.isMock) {
      // Seed default parent for instant zero-login access
      const defaultId = '00000000-0000-0000-0000-000000000001';
      this.mockParents.set(defaultId, {
        id: defaultId,
        email: 'parent@parentvision.local',
        password_hash: 'default',
        full_name: 'Parent Admin',
        created_at: new Date(),
        updated_at: new Date(),
      });
      return;
    }

    try {
      const client = await this.pool!.connect();
      client.release();
      logger.info('Connected to PostgreSQL successfully');

      // Ensure default parent exists in PostgreSQL
      const defaultId = '00000000-0000-0000-0000-000000000001';
      await this.pool!.query(
        `INSERT INTO parents (id, email, password_hash, full_name)
         VALUES ($1, 'parent@parentvision.local', 'default', 'Parent Admin')
         ON CONFLICT (id) DO NOTHING`,
        [defaultId]
      );
    } catch (err: any) {
      logger.warn(`PostgreSQL connection failed (${err.message}). Falling back to internal in-memory database store.`);
      this.isMock = true;
      const defaultId = '00000000-0000-0000-0000-000000000001';
      this.mockParents.set(defaultId, {
        id: defaultId,
        email: 'parent@parentvision.local',
        password_hash: 'default',
        full_name: 'Parent Admin',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  public async getDefaultParent(): Promise<Parent> {
    const defaultId = '00000000-0000-0000-0000-000000000001';
    let p = await this.findParentById(defaultId);
    if (!p) {
      p = {
        id: defaultId,
        email: 'parent@parentvision.local',
        password_hash: 'default',
        full_name: 'Parent Admin',
        created_at: new Date(),
        updated_at: new Date(),
      };
      if (this.isMock) {
        this.mockParents.set(defaultId, p);
      }
    }
    return p;
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  // --- Parent Operations ---
  public async createParent(email: string, passwordHash: string, fullName: string): Promise<Parent> {
    const now = new Date();
    const id = crypto.randomUUID();

    if (this.isMock) {
      for (const p of this.mockParents.values()) {
        if (p.email.toLowerCase() === email.toLowerCase()) {
          const error: any = new Error('duplicate key value violates unique constraint "parents_email_key"');
          error.code = '23505';
          throw error;
        }
      }
      const parent: Parent = {
        id,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName,
        created_at: now,
        updated_at: now,
      };
      this.mockParents.set(id, parent);
      return parent;
    }

    const res = await this.pool!.query(
      `INSERT INTO parents (id, email, password_hash, full_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, email.toLowerCase(), passwordHash, fullName, now, now]
    );
    return res.rows[0];
  }

  public async findParentByEmail(email: string): Promise<Parent | null> {
    if (this.isMock) {
      for (const p of this.mockParents.values()) {
        if (p.email.toLowerCase() === email.toLowerCase()) {
          return p;
        }
      }
      return null;
    }

    const res = await this.pool!.query('SELECT * FROM parents WHERE email = $1', [email.toLowerCase()]);
    return res.rows[0] || null;
  }

  public async findParentById(id: string): Promise<Parent | null> {
    if (this.isMock) {
      return this.mockParents.get(id) || null;
    }

    const res = await this.pool!.query('SELECT * FROM parents WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  // --- Refresh Token Operations ---
  public async storeRefreshToken(parentId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date();

    if (this.isMock) {
      this.mockRefreshTokens.set(tokenHash, {
        id,
        parent_id: parentId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: now,
      });
      return;
    }

    await this.pool!.query(
      `INSERT INTO refresh_tokens (id, parent_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, parentId, tokenHash, expiresAt, now]
    );
  }

  public async findRefreshToken(tokenHash: string): Promise<{ id: string; parent_id: string; expires_at: Date } | null> {
    if (this.isMock) {
      const token = this.mockRefreshTokens.get(tokenHash);
      if (!token || new Date() > token.expires_at) {
        if (token) this.mockRefreshTokens.delete(tokenHash);
        return null;
      }
      return token;
    }

    const res = await this.pool!.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  public async deleteRefreshToken(tokenHash: string): Promise<void> {
    if (this.isMock) {
      this.mockRefreshTokens.delete(tokenHash);
      return;
    }

    await this.pool!.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  }

  public async revokeAllParentRefreshTokens(parentId: string): Promise<void> {
    if (this.isMock) {
      for (const [k, v] of this.mockRefreshTokens.entries()) {
        if (v.parent_id === parentId) {
          this.mockRefreshTokens.delete(k);
        }
      }
      return;
    }

    await this.pool!.query('DELETE FROM refresh_tokens WHERE parent_id = $1', [parentId]);
  }

  // --- Device & Pairing Code Operations ---
  public async createPairingCode(parentId: string, deviceName: string, ttlMinutes = 15): Promise<PairingCode> {
    const chars = '0123456789';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const now = new Date();

    if (this.isMock) {
      const record: PairingCode = {
        code,
        parent_id: parentId,
        device_name: deviceName,
        expires_at: expiresAt,
        is_used: false,
        created_at: now,
      };
      this.mockPairingCodes.set(code, record);
      return record;
    }

    const res = await this.pool!.query(
      `INSERT INTO pairing_codes (code, parent_id, device_name, expires_at, is_used, created_at)
       VALUES ($1, $2, $3, $4, false, $5)
       RETURNING *`,
      [code, parentId, deviceName, expiresAt, now]
    );
    return res.rows[0];
  }

  public async findValidPairingCode(code: string): Promise<PairingCode | null> {
    if (this.isMock) {
      const record = this.mockPairingCodes.get(code);
      if (!record || record.is_used || new Date() > record.expires_at) {
        return null;
      }
      return record;
    }

    const res = await this.pool!.query(
      'SELECT * FROM pairing_codes WHERE code = $1 AND is_used = false AND expires_at > NOW()',
      [code]
    );
    return res.rows[0] || null;
  }

  public async markPairingCodeUsed(code: string): Promise<void> {
    if (this.isMock) {
      const record = this.mockPairingCodes.get(code);
      if (record) record.is_used = true;
      return;
    }

    await this.pool!.query('UPDATE pairing_codes SET is_used = true WHERE code = $1', [code]);
  }

  public async enrollDevice(
    parentId: string,
    name: string,
    model: string,
    osVersion: string,
    deviceSecretHash: string
  ): Promise<Device> {
    const id = crypto.randomUUID();
    const now = new Date();

    if (this.isMock) {
      const device: Device = {
        id,
        parent_id: parentId,
        name,
        model,
        os_version: osVersion,
        device_secret_hash: deviceSecretHash,
        status: 'online',
        battery_level: 100,
        is_charging: false,
        is_revoked: false,
        last_seen_at: now,
        created_at: now,
        updated_at: now,
      };
      this.mockDevices.set(id, device);
      return device;
    }

    const res = await this.pool!.query(
      `INSERT INTO devices (id, parent_id, name, model, os_version, device_secret_hash, status, battery_level, is_charging, is_revoked, last_seen_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'online', 100, false, false, $7, $8, $9)
       RETURNING *`,
      [id, parentId, name, model, osVersion, deviceSecretHash, now, now, now]
    );
    return res.rows[0];
  }

  public async listDevicesByParent(parentId: string): Promise<Device[]> {
    if (this.isMock) {
      const list: Device[] = [];
      for (const d of this.mockDevices.values()) {
        if (d.parent_id === parentId && !d.is_revoked) {
          list.push(d);
        }
      }
      return list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }

    const res = await this.pool!.query(
      'SELECT * FROM devices WHERE parent_id = $1 AND is_revoked = false ORDER BY created_at DESC',
      [parentId]
    );
    return res.rows;
  }

  public async findDeviceById(id: string): Promise<Device | null> {
    if (this.isMock) {
      return this.mockDevices.get(id) || null;
    }

    const res = await this.pool!.query('SELECT * FROM devices WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  public async updateDeviceStatus(
    id: string,
    status: 'online' | 'offline' | 'broadcasting',
    batteryLevel?: number,
    isCharging?: boolean
  ): Promise<void> {
    const now = new Date();
    if (this.isMock) {
      const device = this.mockDevices.get(id);
      if (device) {
        device.status = status;
        device.last_seen_at = now;
        device.updated_at = now;
        if (batteryLevel !== undefined) device.battery_level = batteryLevel;
        if (isCharging !== undefined) device.is_charging = isCharging;
      }
      return;
    }

    await this.pool!.query(
      `UPDATE devices
       SET status = $1,
           last_seen_at = $2,
           updated_at = $2,
           battery_level = COALESCE($3, battery_level),
           is_charging = COALESCE($4, is_charging)
       WHERE id = $5`,
      [status, now, batteryLevel ?? null, isCharging ?? null, id]
    );
  }

  public async renameDevice(id: string, parentId: string, name: string): Promise<Device | null> {
    const now = new Date();
    if (this.isMock) {
      const d = this.mockDevices.get(id);
      if (d && d.parent_id === parentId && !d.is_revoked) {
        d.name = name;
        d.updated_at = now;
        return d;
      }
      return null;
    }

    const res = await this.pool!.query(
      'UPDATE devices SET name = $1, updated_at = $2 WHERE id = $3 AND parent_id = $4 AND is_revoked = false RETURNING *',
      [name, now, id, parentId]
    );
    return res.rows[0] || null;
  }

  public async revokeDevice(id: string, parentId: string): Promise<boolean> {
    const now = new Date();
    if (this.isMock) {
      const d = this.mockDevices.get(id);
      if (d && d.parent_id === parentId) {
        d.is_revoked = true;
        d.status = 'offline';
        d.updated_at = now;

        // End any active sessions for this device
        for (const s of this.mockSessions.values()) {
          if (s.device_id === id && (s.status === 'active' || s.status === 'requested')) {
            s.status = 'revoked';
            s.ended_at = now;
          }
        }
        return true;
      }
      return false;
    }

    const res = await this.pool!.query(
      'UPDATE devices SET is_revoked = true, status = \'offline\', updated_at = $1 WHERE id = $2 AND parent_id = $3',
      [now, id, parentId]
    );

    if (res.rowCount && res.rowCount > 0) {
      await this.pool!.query(
        "UPDATE broadcast_sessions SET status = 'revoked', ended_at = $1 WHERE device_id = $2 AND status IN ('active', 'requested')",
        [now, id]
      );
      return true;
    }
    return false;
  }

  // --- Broadcast Session Operations ---
  public async createBroadcastSession(
    deviceId: string,
    parentId: string,
    sessionTokenHash: string
  ): Promise<BroadcastSession> {
    const id = crypto.randomUUID();
    const now = new Date();

    if (this.isMock) {
      const session: BroadcastSession = {
        id,
        device_id: deviceId,
        parent_id: parentId,
        session_token_hash: sessionTokenHash,
        status: 'requested',
        started_at: null,
        ended_at: null,
        created_at: now,
      };
      this.mockSessions.set(id, session);
      return session;
    }

    const res = await this.pool!.query(
      `INSERT INTO broadcast_sessions (id, device_id, parent_id, session_token_hash, status, created_at)
       VALUES ($1, $2, $3, $4, 'requested', $5)
       RETURNING *`,
      [id, deviceId, parentId, sessionTokenHash, now]
    );
    return res.rows[0];
  }

  public async findSessionById(sessionId: string): Promise<BroadcastSession | null> {
    if (this.isMock) {
      return this.mockSessions.get(sessionId) || null;
    }

    const res = await this.pool!.query('SELECT * FROM broadcast_sessions WHERE id = $1', [sessionId]);
    return res.rows[0] || null;
  }

  public async getActiveSessionForDevice(deviceId: string): Promise<BroadcastSession | null> {
    if (this.isMock) {
      for (const s of this.mockSessions.values()) {
        if (s.device_id === deviceId && (s.status === 'active' || s.status === 'requested')) {
          return s;
        }
      }
      return null;
    }

    const res = await this.pool!.query(
      "SELECT * FROM broadcast_sessions WHERE device_id = $1 AND status IN ('active', 'requested') ORDER BY created_at DESC LIMIT 1",
      [deviceId]
    );
    return res.rows[0] || null;
  }

  public async updateSessionStatus(
    sessionId: string,
    status: 'active' | 'ended' | 'revoked'
  ): Promise<void> {
    const now = new Date();
    if (this.isMock) {
      const s = this.mockSessions.get(sessionId);
      if (s) {
        s.status = status;
        if (status === 'active' && !s.started_at) s.started_at = now;
        if (status === 'ended' || status === 'revoked') s.ended_at = now;
      }
      return;
    }

    if (status === 'active') {
      await this.pool!.query(
        "UPDATE broadcast_sessions SET status = 'active', started_at = COALESCE(started_at, $1) WHERE id = $2",
        [now, sessionId]
      );
    } else {
      await this.pool!.query(
        "UPDATE broadcast_sessions SET status = $1, ended_at = $2 WHERE id = $3",
        [status, now, sessionId]
      );
    }
  }

  // --- Audit Logs ---
  public async logEvent(
    eventType: string,
    description: string,
    parentId?: string | null,
    deviceId?: string | null,
    ipAddress?: string | null,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date();

    if (this.isMock) {
      this.mockAuditLogs.unshift({
        id,
        parent_id: parentId || null,
        device_id: deviceId || null,
        event_type: eventType,
        description,
        ip_address: ipAddress || null,
        metadata,
        created_at: now,
      });
      return;
    }

    try {
      await this.pool!.query(
        `INSERT INTO audit_logs (id, parent_id, device_id, event_type, description, ip_address, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, parentId || null, deviceId || null, eventType, description, ipAddress || null, JSON.stringify(metadata), now]
      );
    } catch (err: any) {
      logger.error('Failed to write audit log', { error: err.message });
    }
  }

  public async getAuditLogs(parentId: string, limit = 50): Promise<AuditLog[]> {
    if (this.isMock) {
      return this.mockAuditLogs
        .filter((l) => l.parent_id === parentId)
        .slice(0, limit);
    }

    const res = await this.pool!.query(
      'SELECT * FROM audit_logs WHERE parent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [parentId, limit]
    );
    return res.rows;
  }

  // --- Screen Time Summaries ---
  public async saveScreenTimeSummary(
    deviceId: string,
    summaryDate: string,
    totalMinutes: number,
    categoryBreakdown: Record<string, number>
  ): Promise<ScreenTimeSummary> {
    const id = crypto.randomUUID();
    const now = new Date();
    const key = `${deviceId}:${summaryDate}`;

    if (this.isMock) {
      const summary: ScreenTimeSummary = {
        id,
        device_id: deviceId,
        summary_date: summaryDate,
        total_minutes: totalMinutes,
        category_breakdown: categoryBreakdown,
        created_at: now,
      };
      this.mockScreenTimes.set(key, summary);
      return summary;
    }

    const res = await this.pool!.query(
      `INSERT INTO screen_time_summaries (id, device_id, summary_date, total_minutes, category_breakdown, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (device_id, summary_date)
       DO UPDATE SET total_minutes = EXCLUDED.total_minutes, category_breakdown = EXCLUDED.category_breakdown
       RETURNING *`,
      [id, deviceId, summaryDate, totalMinutes, JSON.stringify(categoryBreakdown), now]
    );
    return res.rows[0];
  }

  public async getScreenTimeSummaries(deviceId: string, days = 7): Promise<ScreenTimeSummary[]> {
    if (this.isMock) {
      const list: ScreenTimeSummary[] = [];
      for (const s of this.mockScreenTimes.values()) {
        if (s.device_id === deviceId) {
          list.push(s);
        }
      }
      return list.sort((a, b) => b.summary_date.localeCompare(a.summary_date)).slice(0, days);
    }

    const res = await this.pool!.query(
      `SELECT * FROM screen_time_summaries
       WHERE device_id = $1
       ORDER BY summary_date DESC
       LIMIT $2`,
      [deviceId, days]
    );
    return res.rows;
  }
}

export const db = new Database();
