export const PLATFORM_BRAND = {
  shortName: '智孪 3D',
  name: '智孪 3D Studio',
  subtitle: '工业数字孪生低代码平台',
  version: 'v2.0',
} as const;

/** 平台全量权限码（菜单权限 + 按钮操作权限） */
export type PermissionCode =
  // 菜单权限
  | 'menu:home'
  | 'menu:projects'
  | 'menu:releases'
  | 'menu:templates'
  | 'menu:assets'
  | 'menu:card-templates'
  | 'menu:datasources'
  | 'menu:integration'
  | 'menu:system:users'
  | 'menu:system:roles'
  | 'menu:system:settings'
  // 按钮与动作权限
  | 'project:create'
  | 'project:edit'
  | 'project:delete'
  | 'project:export'
  | 'scene:publish'
  | 'scene:unpublish'
  | 'asset:upload'
  | 'card_template:manage'
  | 'datasource:manage'
  | 'system:user:write'
  | 'system:role:write'
  | 'system:setting:write';

export type RoleId = 'admin' | 'designer' | 'viewer';

export type RoleDefinition = {
  id: RoleId;
  name: string;
  badgeColor: string;
  description: string;
  permissions: PermissionCode[];
};

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  roleId: RoleId;
  roleName: string;
  department: string;
  /** 多租户与数据权限预留字段 */
  tenantId?: string;
  allowedStationCodes?: string[];
  permissions: PermissionCode[];
};

export type AuthSession = {
  token: string;
  refreshToken?: string;
  expiresAt: number;
  user: UserProfile;
  authMode: 'local-mock' | 'remote-api';
};

export type AuthEndpointSettings = {
  authMode: 'local-mock' | 'remote-api';
  apiBaseUrl: string;
};

export const ALL_PERMISSIONS: PermissionCode[] = [
  'menu:home',
  'menu:projects',
  'menu:releases',
  'menu:templates',
  'menu:assets',
  'menu:card-templates',
  'menu:datasources',
  'menu:integration',
  'menu:system:users',
  'menu:system:roles',
  'menu:system:settings',
  'project:create',
  'project:edit',
  'project:delete',
  'project:export',
  'scene:publish',
  'scene:unpublish',
  'asset:upload',
  'card_template:manage',
  'datasource:manage',
  'system:user:write',
  'system:role:write',
  'system:setting:write',
];

export const BUILTIN_ROLES: RoleDefinition[] = [
  {
    id: 'admin',
    name: '超级管理员',
    badgeColor: '#38bdf8',
    description: '拥有全部菜单、3D 搭建、大屏发布、SCADA 联调与用户角色管理权限',
    permissions: ALL_PERMISSIONS,
  },
  {
    id: 'designer',
    name: '工艺大屏设计师',
    badgeColor: '#34d399',
    description: '负责厂站 3D 建模、大屏组态、数据源配置与发布嵌入链接，不含系统管理',
    permissions: [
      'menu:home',
      'menu:projects',
      'menu:releases',
      'menu:templates',
      'menu:assets',
      'menu:card-templates',
      'menu:datasources',
      'menu:integration',
      'project:create',
      'project:edit',
      'project:export',
      'scene:publish',
      'asset:upload',
      'card_template:manage',
      'datasource:manage',
    ],
  },
  {
    id: 'viewer',
    name: '运维巡检员',
    badgeColor: '#f59e0b',
    description: '仅可浏览首页与已发布 3D 工艺大屏运行态，无新增、修改、删除或发布权限',
    permissions: ['menu:home', 'menu:releases', 'menu:templates'],
  },
];

export type DemoAccount = {
  username: string;
  password: string;
  displayName: string;
  roleId: RoleId;
  department: string;
  hint: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'admin',
    password: '123456',
    displayName: '系统管理员',
    roleId: 'admin',
    department: '数字孪生平台组',
    hint: '全菜单 · 可建站/发布/管权限',
  },
  {
    username: 'designer',
    password: '123456',
    displayName: '张工（工艺设计）',
    roleId: 'designer',
    department: '燃气与水务工艺部',
    hint: '可搭建 3D 与发布 · 无系统管理',
  },
  {
    username: 'viewer',
    password: '123456',
    displayName: '李工（值班巡检）',
    roleId: 'viewer',
    department: '调度监控中心',
    hint: '仅查看大屏 · 不可编辑或发布',
  },
];
