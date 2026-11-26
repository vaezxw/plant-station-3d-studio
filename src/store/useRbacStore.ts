import { create } from 'zustand';
import {
  BUILTIN_ROLES,
  DEMO_ACCOUNTS,
  PLATFORM_BRAND,
  type PermissionCode,
  type RoleDefinition,
  type RoleId,
} from '../domain/authSchema';

export type RbacUserRecord = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  roleId: RoleId | string;
  department: string;
  enabled: boolean;
  allowedStationCodes: string[];
  updatedAt: number;
};

export type DynamicRoleDefinition = Omit<RoleDefinition, 'id'> & {
  id: string;
  isBuiltin?: boolean;
};

export type SystemBrandSettings = {
  brandName: string;
  brandSubtitle: string;
  requirePublishTokenByDefault: boolean;
  allowDemoQuickLogin: boolean;
};

const USERS_KEY = 'plant-studio:rbac-users:v1';
const ROLES_KEY = 'plant-studio:rbac-roles:v1';
const SYS_KEY = 'plant-studio:system-config:v1';

function defaultUsers(): RbacUserRecord[] {
  return DEMO_ACCOUNTS.map((a) => ({
    id: `u-${a.username}`,
    username: a.username,
    password: a.password,
    displayName: a.displayName,
    roleId: a.roleId,
    department: a.department,
    enabled: true,
    allowedStationCodes: [],
    updatedAt: Date.now(),
  }));
}

function defaultRoles(): DynamicRoleDefinition[] {
  return BUILTIN_ROLES.map((r) => ({ ...r, isBuiltin: true }));
}

function defaultSystemConfig(): SystemBrandSettings {
  return {
    brandName: PLATFORM_BRAND.name,
    brandSubtitle: PLATFORM_BRAND.subtitle,
    requirePublishTokenByDefault: true,
    allowDemoQuickLogin: true,
  };
}

function loadJson<T>(key: string, fallback: () => T): T {
  if (typeof window === 'undefined') return fallback();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

function saveJson(key: string, val: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage errors
  }
}

type RbacState = {
  users: RbacUserRecord[];
  roles: DynamicRoleDefinition[];
  systemConfig: SystemBrandSettings;

  upsertUser: (user: Omit<RbacUserRecord, 'updatedAt'>) => void;
  toggleUserEnabled: (id: string) => void;
  deleteUser: (id: string) => void;

  upsertRole: (role: DynamicRoleDefinition) => void;
  setRolePermissions: (roleId: string, permissions: PermissionCode[]) => void;
  deleteRole: (roleId: string) => void;

  updateSystemConfig: (patch: Partial<SystemBrandSettings>) => void;
  resetRbacDefaults: () => void;
};

export const useRbacStore = create<RbacState>((set, get) => ({
  users: loadJson(USERS_KEY, defaultUsers),
  roles: loadJson(ROLES_KEY, defaultRoles),
  systemConfig: loadJson(SYS_KEY, defaultSystemConfig),

  upsertUser: (user) => {
    const nextRec: RbacUserRecord = { ...user, updatedAt: Date.now() };
    const exists = get().users.some((u) => u.id === nextRec.id);
    const users = exists
      ? get().users.map((u) => (u.id === nextRec.id ? nextRec : u))
      : [nextRec, ...get().users];
    saveJson(USERS_KEY, users);
    set({ users });
  },

  toggleUserEnabled: (id) => {
    const users = get().users.map((u) =>
      u.id === id && u.username !== 'admin' ? { ...u, enabled: !u.enabled, updatedAt: Date.now() } : u,
    );
    saveJson(USERS_KEY, users);
    set({ users });
  },

  deleteUser: (id) => {
    const target = get().users.find((u) => u.id === id);
    if (!target || target.username === 'admin') return;
    const users = get().users.filter((u) => u.id !== id);
    saveJson(USERS_KEY, users);
    set({ users });
  },

  upsertRole: (role) => {
    const exists = get().roles.some((r) => r.id === role.id);
    const roles = exists
      ? get().roles.map((r) => (r.id === role.id ? role : r))
      : [...get().roles, role];
    saveJson(ROLES_KEY, roles);
    set({ roles });
  },

  setRolePermissions: (roleId, permissions) => {
    const roles = get().roles.map((r) => (r.id === roleId ? { ...r, permissions } : r));
    saveJson(ROLES_KEY, roles);
    set({ roles });
  },

  deleteRole: (roleId) => {
    const target = get().roles.find((r) => r.id === roleId);
    if (!target || target.isBuiltin) return;
    const roles = get().roles.filter((r) => r.id !== roleId);
    saveJson(ROLES_KEY, roles);
    set({ roles });
  },

  updateSystemConfig: (patch) => {
    const next = { ...get().systemConfig, ...patch };
    saveJson(SYS_KEY, next);
    set({ systemConfig: next });
  },

  resetRbacDefaults: () => {
    const users = defaultUsers();
    const roles = defaultRoles();
    const systemConfig = defaultSystemConfig();
    saveJson(USERS_KEY, users);
    saveJson(ROLES_KEY, roles);
    saveJson(SYS_KEY, systemConfig);
    set({ users, roles, systemConfig });
  },
}));
