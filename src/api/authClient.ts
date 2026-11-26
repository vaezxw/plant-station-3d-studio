import {
  type AuthEndpointSettings,
  type AuthSession,
  type RoleId,
  type UserProfile,
} from '../domain/authSchema';
import { useRbacStore } from '../store/useRbacStore';

const SESSION_KEY = 'plant-studio:auth-session:v1';
const AUTH_SETTINGS_KEY = 'plant-studio:auth-settings:v1';

export type LoginParams = {
  username: string;
  password: string;
};

export interface AuthAdapter {
  login(params: LoginParams): Promise<AuthSession>;
  loginAsRole(roleId: RoleId): Promise<AuthSession>;
  exchangeSsoToken(ssoToken: string): Promise<AuthSession>;
  fetchCurrentProfile(token: string): Promise<UserProfile>;
  logout(token?: string): Promise<void>;
}

export function loadAuthSettings(): AuthEndpointSettings {
  const envBase = (import.meta.env.VITE_AUTH_API_BASE as string | undefined) ?? '';
  const fallback: AuthEndpointSettings = {
    authMode: envBase ? 'remote-api' : 'local-mock',
    apiBaseUrl: envBase || 'https://scada.maobaoinfo.com/hub/api/auth',
  };
  try {
    const raw = window.localStorage.getItem(AUTH_SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AuthEndpointSettings>;
    return {
      authMode: parsed.authMode === 'remote-api' ? 'remote-api' : 'local-mock',
      apiBaseUrl: (parsed.apiBaseUrl ?? fallback.apiBaseUrl).trim(),
    };
  } catch {
    return fallback;
  }
}

export function saveAuthSettings(settings: AuthEndpointSettings): void {
  try {
    window.localStorage.setItem(AUTH_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.username) return null;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistSession(session: AuthSession | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_KEY);
    } else {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

function buildUserFromRbac(userIdOrUsername: string): UserProfile | null {
  const rbac = useRbacStore.getState();
  const user = rbac.users.find((u) => u.username === userIdOrUsername || u.id === userIdOrUsername);
  if (!user) return null;
  const role = rbac.roles.find((r) => r.id === user.roleId) ?? rbac.roles[0];
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roleId: (role?.id ?? 'viewer') as RoleId,
    roleName: role?.name ?? String(user.roleId),
    department: user.department,
    allowedStationCodes: user.allowedStationCodes,
    permissions: [...(role?.permissions ?? [])],
  };
}

class LocalMockAuthAdapter implements AuthAdapter {
  async login(params: LoginParams): Promise<AuthSession> {
    const uname = params.username.trim();
    const pwd = params.password;
    const rbac = useRbacStore.getState();
    const matched = rbac.users.find((a) => a.username === uname && a.password === pwd);
    if (!matched) {
      throw new Error('账号或密码错误（可使用下方任意演示角色快捷登录，或输入 admin / 123456）');
    }
    if (!matched.enabled) {
      throw new Error(`账号「${matched.username}」已被管理员禁用，请联系管理员启用`);
    }
    const user = buildUserFromRbac(matched.username)!;
    return {
      token: `mock-jwt-${user.roleId}-${Date.now().toString(36)}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      user,
      authMode: 'local-mock',
    };
  }

  async loginAsRole(roleId: RoleId): Promise<AuthSession> {
    const rbac = useRbacStore.getState();
    const acc = rbac.users.find((a) => a.roleId === roleId && a.enabled) ?? rbac.users.find((a) => a.roleId === roleId) ?? rbac.users[0];
    if (!acc || !acc.enabled) {
      throw new Error('该体验账号当前已被禁用');
    }
    const user = buildUserFromRbac(acc.username)!;
    return {
      token: `mock-jwt-${user.roleId}-${Date.now().toString(36)}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      user,
      authMode: 'local-mock',
    };
  }

  async exchangeSsoToken(ssoToken: string): Promise<AuthSession> {
    if (!ssoToken.trim()) throw new Error('无效 SSO Token');
    return await this.loginAsRole('designer');
  }

  async fetchCurrentProfile(token: string): Promise<UserProfile> {
    const stored = loadStoredSession();
    if (stored && stored.token === token) return stored.user;
    throw new Error('本地会话已失效');
  }

  async logout(): Promise<void> {
    persistSession(null);
  }
}

/** 预留：后端上线后对接 JWT 登录与 SCADA 单点登录 */
class RemoteApiAuthAdapter implements AuthAdapter {
  private settings: AuthEndpointSettings;

  constructor(settings: AuthEndpointSettings) {
    this.settings = settings;
  }

  private url(path: string): string {
    return `${this.settings.apiBaseUrl.trim().replace(/\/+$/, '')}${path}`;
  }

  async login(params: LoginParams): Promise<AuthSession> {
    const res = await fetch(this.url('/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`登录失败 (HTTP ${res.status})`);
    const raw = (await res.json()) as { data?: AuthSession } & Partial<AuthSession>;
    const session = (raw.data ?? raw) as AuthSession;
    return { ...session, authMode: 'remote-api' };
  }

  async loginAsRole(): Promise<AuthSession> {
    throw new Error('远程后端认证模式不支持免密体验角色登录');
  }

  async exchangeSsoToken(ssoToken: string): Promise<AuthSession> {
    const res = await fetch(this.url('/sso'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssoToken }),
    });
    if (!res.ok) throw new Error(`SSO 换票失败 (HTTP ${res.status})`);
    const raw = (await res.json()) as { data?: AuthSession } & Partial<AuthSession>;
    return { ...(raw.data ?? raw) as AuthSession, authMode: 'remote-api' };
  }

  async fetchCurrentProfile(token: string): Promise<UserProfile> {
    const res = await fetch(this.url('/profile'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`会话失效 (HTTP ${res.status})`);
    const raw = (await res.json()) as { data?: UserProfile } & Partial<UserProfile>;
    return (raw.data ?? raw) as UserProfile;
  }

  async logout(token?: string): Promise<void> {
    if (token) {
      await fetch(this.url('/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    persistSession(null);
  }
}

export function getAuthAdapter(settings?: AuthEndpointSettings): AuthAdapter {
  const cfg = settings ?? loadAuthSettings();
  return cfg.authMode === 'remote-api'
    ? new RemoteApiAuthAdapter(cfg)
    : new LocalMockAuthAdapter();
}
