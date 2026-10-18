export interface Parent {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: string;
  parent_id: string;
  name: string;
  model: string;
  os_version: string;
  device_secret_hash: string;
  status: 'offline' | 'online' | 'broadcasting';
  battery_level: number;
  is_charging: boolean;
  is_revoked: boolean;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PairingCode {
  code: string;
  parent_id: string;
  device_name: string;
  expires_at: Date;
  is_used: boolean;
  created_at: Date;
}

export interface BroadcastSession {
  id: string;
  device_id: string;
  parent_id: string;
  session_token_hash: string;
  status: 'requested' | 'active' | 'ended' | 'revoked';
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  parent_id: string | null;
  device_id: string | null;
  event_type: string;
  description: string;
  ip_address: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface ScreenTimeSummary {
  id: string;
  device_id: string;
  summary_date: string;
  total_minutes: number;
  category_breakdown: Record<string, number>;
  created_at: Date;
}

export interface AuthTokenPayload {
  parentId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface DeviceTokenPayload {
  deviceId: string;
  parentId: string;
  type: 'device';
}

export interface SessionTokenPayload {
  sessionId: string;
  deviceId: string;
  parentId: string;
  role: 'broadcaster' | 'viewer';
}
