const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
};

export interface Device {
  id: string;
  name: string;
  model: string;
  os_version: string;
  status: 'online' | 'offline' | 'broadcasting';
  battery_level: number;
  is_charging: boolean;
  is_revoked: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface Parent {
  id: string;
  email: string;
  fullName: string;
}

export interface BroadcastSessionInfo {
  sessionId: string;
  deviceId: string;
  viewerToken: string;
  iceServers: {
    urls: string[];
    username: string;
    credential: string;
  };
}

export interface ScreenTimeSummary {
  id: string;
  device_id: string;
  summary_date: string;
  total_minutes: number;
  category_breakdown: Record<string, number>;
}

export interface AuditLog {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  metadata: Record<string, any>;
}

class ApiClient {
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('parentvision_token');
  }

  public setTokens(access: string, refresh: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('parentvision_token', access);
    localStorage.setItem('parentvision_refresh', refresh);
  }

  public clearTokens() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('parentvision_token');
    localStorage.removeItem('parentvision_refresh');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('parentvision_refresh');
      if (refreshToken && endpoint !== '/api/auth/refresh') {
        try {
          const refreshRes = await fetch(`${getApiBase()}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            this.setTokens(data.accessToken, data.refreshToken);
            headers['Authorization'] = `Bearer ${data.accessToken}`;
            const retryRes = await fetch(`${getApiBase()}${endpoint}`, {
              ...options,
              headers,
            });
            if (!retryRes.ok) {
              const errData = await retryRes.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP error ${retryRes.status}`);
            }
            return retryRes.json();
          }
        } catch {
          this.clearTokens();
          window.location.href = '/login';
        }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ accessToken: string; refreshToken: string; parent: Parent }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async register(email: string, password: string, fullName: string) {
    const data = await this.request<{ accessToken: string; refreshToken: string; parent: Parent }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      }
    );
    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async getProfile(): Promise<Parent> {
    return this.request<Parent>('/api/auth/me');
  }

  async logout() {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('parentvision_refresh') : null;
      await this.request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      this.clearTokens();
    }
  }

  // Devices
  async getDevices(): Promise<{ devices: Device[] }> {
    return this.request<{ devices: Device[] }>('/api/devices');
  }

  async getDevice(id: string): Promise<{ device: Device }> {
    return this.request<{ device: Device }>(`/api/devices/${id}`);
  }

  async createPairingCode(deviceName: string): Promise<{ code: string; deviceName: string; expiresAt: string }> {
    return this.request('/api/devices/pairing-code', {
      method: 'POST',
      body: JSON.stringify({ deviceName }),
    });
  }

  async renameDevice(id: string, name: string): Promise<{ device: Device }> {
    return this.request(`/api/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async revokeDevice(id: string): Promise<void> {
    return this.request(`/api/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // Sessions & WebRTC
  async requestBroadcastSession(deviceId: string): Promise<BroadcastSessionInfo> {
    return this.request<BroadcastSessionInfo>('/api/sessions/request', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
  }

  async terminateBroadcastSession(sessionId: string): Promise<void> {
    return this.request('/api/sessions/terminate', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async getActiveSession(deviceId: string) {
    return this.request<{ session: any; iceServers: any }>(`/api/sessions/active/${deviceId}`);
  }

  // Screen Time & Audit
  async getScreenTime(deviceId: string, days = 7): Promise<{ summaries: ScreenTimeSummary[] }> {
    return this.request<{ summaries: ScreenTimeSummary[] }>(`/api/screentime/${deviceId}?days=${days}`);
  }

  async getAuditLogs(limit = 50): Promise<{ logs: AuditLog[] }> {
    return this.request<{ logs: AuditLog[] }>(`/api/audit-logs?limit=${limit}`);
  }
}

export const api = new ApiClient();
