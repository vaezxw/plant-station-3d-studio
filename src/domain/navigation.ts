import type { PermissionCode } from './authSchema';

export type NavIconKey =
  | 'home'
  | 'projects'
  | 'releases'
  | 'templates'
  | 'assets'
  | 'card-templates'
  | 'datasources'
  | 'integration'
  | 'users'
  | 'roles'
  | 'settings';

export type ConsoleNavItem = {
  id: string;
  label: string;
  path: string;
  icon: NavIconKey;
  perm: PermissionCode;
  description: string;
  phase: 'phase1' | 'phase2' | 'phase3';
};

export type ConsoleNavGroup = {
  id: string;
  title: string;
  items: ConsoleNavItem[];
};

/** 平台级侧边导航菜单注册表（由 RBAC 权限码控制渲染与路由访问） */
export const CONSOLE_NAV_GROUPS: ConsoleNavGroup[] = [
  {
    id: 'workspace',
    title: '工作台',
    items: [
      {
        id: 'home',
        label: '首页总览',
        path: '/console/home',
        icon: 'home',
        perm: 'menu:home',
        description: '项目概览、快速搭建入口与最近发布动态',
        phase: 'phase1',
      },
    ],
  },
  {
    id: 'projects',
    title: '项目与发布',
    items: [
      {
        id: 'projects',
        label: '厂站项目管理',
        path: '/console/projects',
        icon: 'projects',
        perm: 'menu:projects',
        description: '按厂站/采集点管理 3D 工艺数字孪生工程',
        phase: 'phase2',
      },
      {
        id: 'releases',
        label: '已发布大屏中心',
        path: '/console/releases',
        icon: 'releases',
        perm: 'menu:releases',
        description: '管理发布版本号、访问 Token 与 SCADA 嵌入链接',
        phase: 'phase2',
      },
    ],
  },
  {
    id: 'assets',
    title: '资产与组件',
    items: [
      {
        id: 'templates',
        label: '行业模板库',
        path: '/console/templates',
        icon: 'templates',
        perm: 'menu:templates',
        description: '燃气/水务/换热与综合能源标准工艺样板间',
        phase: 'phase1',
      },
      {
        id: 'assets',
        label: '3D 模型资产库',
        path: '/console/assets-3d',
        icon: 'assets',
        perm: 'menu:assets',
        description: '37+ 内置工业装置模型与自定义 .glb 资源库',
        phase: 'phase2',
      },
      {
        id: 'card-templates',
        label: '大屏卡片模板库',
        path: '/console/card-templates',
        icon: 'card-templates',
        perm: 'menu:card-templates',
        description: '可复用 2D 组态监视卡与设备类型自动映射',
        phase: 'phase2',
      },
    ],
  },
  {
    id: 'integration',
    title: '数据集成',
    items: [
      {
        id: 'datasources',
        label: '数据源管理',
        path: '/console/datasources',
        icon: 'datasources',
        perm: 'menu:datasources',
        description: 'HTTP REST、WebSocket 与静态 JSON 遥测接入',
        phase: 'phase2',
      },
      {
        id: 'integration',
        label: 'SCADA 联调中心',
        path: '/console/integration',
        icon: 'integration',
        perm: 'menu:integration',
        description: '选项 B 后端存储配置、iframe 联调沙盒与接口契约',
        phase: 'phase2',
      },
    ],
  },
  {
    id: 'system',
    title: '系统与权限',
    items: [
      {
        id: 'users',
        label: '用户管理',
        path: '/console/system/users',
        icon: 'users',
        perm: 'menu:system:users',
        description: '平台用户账号、状态管理与角色分配',
        phase: 'phase3',
      },
      {
        id: 'roles',
        label: '角色与权限',
        path: '/console/system/roles',
        icon: 'roles',
        perm: 'menu:system:roles',
        description: 'RBAC 菜单与页面操作按钮权限矩阵配置',
        phase: 'phase3',
      },
      {
        id: 'settings',
        label: '系统设置',
        path: '/console/system/settings',
        icon: 'settings',
        perm: 'menu:system:settings',
        description: '平台品牌配置、认证模式开关与安全策略',
        phase: 'phase3',
      },
    ],
  },
];

export function findNavItemByPath(pathname: string): ConsoleNavItem | undefined {
  for (const g of CONSOLE_NAV_GROUPS) {
    const hit = g.items.find((it) => pathname === it.path || pathname.startsWith(`${it.path}/`));
    if (hit) return hit;
  }
  return undefined;
}
