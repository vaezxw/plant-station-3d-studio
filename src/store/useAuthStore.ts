import { create } from 'zustand';
import {
  getAuthAdapter,
  loadAuthSettings,
  loadStoredSession,
  persistSession,
  saveAuthSettings,
  type LoginParams,
} from '../api/authClient';
import type {
  AuthEndpointSettings,
  AuthSession,
  PermissionCode,
  RoleId,
} from '../domain/authSchema';

type AuthState = {
  session: AuthSession | null;
  settings: AuthEndpointSettings;
  loading: boolean;
  error: string | null;

  hasPerm: (perm?: PermissionCode) => boolean;
  hasAnyPerm: (perms: PermissionCode[]) => boolean;
  login: (params: LoginParams) => Promise<AuthSession>;
  loginAsRole: (roleId: RoleId) => Promise<AuthSession>;
  loginBySsoToken: (ssoToken: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  updateSettings: (patch: Partial<AuthEndpointSettings>) => void;
  syncRolePermissions: (roleId: string, permissions: PermissionCode[]) => void;
  clearError: () => void;
};

const initialSession = typeof window !== 'undefined' ? loadStoredSession() : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: initialSession,
  settings: typeof window !== 'undefined' ? loadAuthSettings() : { authMode: 'local-mock', apiBaseUrl: '' },
  loading: false,
  error: null,

  hasPerm: (perm) => {
    if (!perm) return true;
    const s = get().session;
    if (!s) return false;
    return s.user.permissions.includes(perm);
  },

  hasAnyPerm: (perms) => {
    if (perms.length === 0) return true;
    const s = get().session;
    if (!s) return false;
    return perms.some((p) => s.user.permissions.includes(p));
  },

  login: async (params) => {
    set({ loading: true, error: null });
    try {
      const adapter = getAuthAdapter(get().settings);
      const session = await adapter.login(params);
      persistSession(session);
      set({ session, loading: false, error: null });
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      set({ loading: false, error: msg });
      throw err;
    }
  },

  loginAsRole: async (roleId) => {
    set({ loading: true, error: null });
    try {
      const adapter = getAuthAdapter(get().settings);
      const session = await adapter.loginAsRole(roleId);
      persistSession(session);
      set({ session, loading: false, error: null });
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '快捷登录失败';
      set({ loading: false, error: msg });
      throw err;
    }
  },

  loginBySsoToken: async (ssoToken) => {
    set({ loading: true, error: null });
    try {
      const adapter = getAuthAdapter(get().settings);
      const session = await adapter.exchangeSsoToken(ssoToken);
      persistSession(session);
      set({ session, loading: false, error: null });
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SSO 免登失败';
      set({ loading: false, error: msg });
      throw err;
    }
  },

  logout: async () => {
    const token = get().session?.token;
    const adapter = getAuthAdapter(get().settings);
    await adapter.logout(token);
    set({ session: null, error: null });
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    saveAuthSettings(next);
    set({ settings: next, error: null });
  },

  syncRolePermissions: (roleId, permissions) => {
    const cur = get().session;
    if (!cur || cur.user.roleId !== roleId) return;
    const nextSession: AuthSession = {
      ...cur,
      user: {
        ...cur.user,
        permissions: [...permissions],
      },
    };
    persistSession(nextSession);
    set({ session: nextSession });
  },

  clearError: () => set({ error: null }),
}));
