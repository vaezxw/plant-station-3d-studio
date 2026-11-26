import { useEffect, useState, type FC } from 'react';
import {
  Activity,
  Box,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  FolderKanban,
  Globe,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CONSOLE_NAV_GROUPS,
  findNavItemByPath,
  type NavIconKey,
} from '../../domain/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useCardTemplateStore } from '../../store/useCardTemplateStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { usePublishStore } from '../../store/usePublishStore';
import { useRbacStore } from '../../store/useRbacStore';
import ThemeSwitcher from '../components/ThemeSwitcher';

const ICON_MAP: Record<NavIconKey, typeof Home> = {
  home: Home,
  projects: FolderKanban,
  releases: Globe,
  templates: LayoutGrid,
  assets: Box,
  'card-templates': Cpu,
  datasources: Database,
  integration: Radio,
  users: Users,
  roles: ShieldCheck,
  settings: Settings,
};

const ConsoleLayout: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const session = useAuthStore((s) => s.session);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const logout = useAuthStore((s) => s.logout);
  const systemConfig = useRbacStore((s) => s.systemConfig);

  const themeId = useEditorStore((s) => s.themeId);
  const isLiquidGlass = themeId === 'liquid-glass' || themeId === 'ios-liquid-glass';

  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const hydrateTemplates = useCardTemplateStore((s) => s.hydrateTemplates);
  const refreshPublishedList = usePublishStore((s) => s.refreshList);

  useEffect(() => {
    void hydrateFromStorage();
    void hydrateTemplates();
    void refreshPublishedList();
  }, [hydrateFromStorage, hydrateTemplates, refreshPublishedList]);

  const currentNav = findNavItemByPath(location.pathname);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchKeyword.trim();
    if (!q) return;
    if (hasPerm('menu:projects')) {
      navigate(`/console/projects?q=${encodeURIComponent(q)}`);
    } else if (hasPerm('menu:releases')) {
      navigate(`/console/releases?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="console-shell-root relative w-full h-full flex bg-bg-canvas text-text-primary overflow-hidden select-none">
      {/* 液态玻璃主题专属多维极光流光底景（供悬浮侧栏、顶栏与卡片透视折射） */}
      {isLiquidGlass ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, #dceafb 0%, #eaf3ff 42%, #e1e8fa 100%)',
          }}
        >
          <div
            className="absolute -top-28 -left-24 w-[660px] h-[660px] rounded-full blur-[90px] opacity-75"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.52) 0%, transparent 68%)' }}
          />
          <div
            className="absolute top-[10%] right-[-8%] w-[620px] h-[620px] rounded-full blur-[105px] opacity-65"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.48) 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-32 left-[24%] w-[640px] h-[520px] rounded-full blur-[95px] opacity-65"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.42) 0%, transparent 68%)' }}
          />
          <div
            className="absolute bottom-[8%] right-[16%] w-[460px] h-[460px] rounded-full blur-[85px] opacity-55"
            style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.42) 0%, transparent 70%)' }}
          />
        </div>
      ) : null}

      {/* 左侧全局权限导航栏（液态玻璃下呈现悬浮圆角玻璃舱） */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-60'} ${
          isLiquidGlass
            ? 'm-3 mr-0 h-[calc(100%-1.5rem)] rounded-2xl border border-border-subtle'
            : 'h-full border-r border-border-subtle'
        } shrink-0 bg-bg-panel flex flex-col transition-all duration-200 relative z-20`}
      >
        {/* 平台 Brand */}
        <div
          className={`h-14 border-b border-border-subtle flex items-center shrink-0 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-3 gap-2'
          }`}
        >
          <button
            type="button"
            onClick={() => navigate('/console/home')}
            className={`flex items-center min-w-0 text-left ${collapsed ? 'justify-center' : 'gap-2.5'}`}
            title={collapsed ? `${systemConfig.brandName} · 返回首页总览` : undefined}
          >
            <div className="w-8 h-8 rounded-lg bg-accent-soft border border-border-strong flex items-center justify-center text-accent font-mono font-bold text-xs shrink-0 shadow-sm">
              3D
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-primary truncate">{systemConfig.brandName}</div>
                <div className="text-[10px] text-text-muted truncate">{systemConfig.brandSubtitle}</div>
              </div>
            ) : null}
          </button>
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover shrink-0"
              title="收起菜单栏"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* 菜单分组（按 RBAC 权限码过滤） */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 space-y-4">
          {CONSOLE_NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => hasPerm(item.perm));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.id} className="space-y-1">
                {!collapsed ? (
                  <div className="px-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    {group.title}
                  </div>
                ) : (
                  <div className="h-px bg-border-subtle mx-2 my-1" />
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = ICON_MAP[item.icon];
                    const active =
                      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.path)}
                        title={collapsed ? `${item.label}：${item.description}` : item.description}
                        className={`relative w-full px-2.5 py-2 rounded-xl text-xs font-medium flex items-center ${
                          collapsed ? 'justify-center' : 'justify-between gap-2'
                        } transition ${
                          active
                            ? 'bg-accent-soft text-accent font-semibold border border-border-strong shadow-sm'
                            : 'border border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                      >
                        {active && !collapsed ? (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent" />
                        ) : null}
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : ''}`} />
                          {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        </span>
                        {!collapsed && active ? <ChevronRight className="w-3.5 h-3.5 shrink-0 text-accent" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* 左下当前角色指示卡 */}
        <div className="p-2.5 border-t border-border-subtle shrink-0 space-y-2">
          {collapsed ? (
            <>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="w-10 h-8 mx-auto rounded-xl border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-text-muted hover:text-accent flex items-center justify-center transition"
                title="展开菜单栏"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <div
                className="w-10 h-10 mx-auto rounded-xl bg-accent-soft border border-border-strong flex items-center justify-center text-accent text-xs font-bold"
                title={`${session?.user.displayName ?? ''} (${session?.user.roleName ?? ''})`}
              >
                {session?.user.displayName.slice(0, 1) ?? 'U'}
              </div>
            </>
          ) : (
            <div className="p-2.5 rounded-xl bg-bg-canvas border border-border-subtle space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-text-primary truncate">{session?.user.roleName}</span>
                <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent font-mono text-[10px]">
                  {session?.user.permissions.length ?? 0} 权限
                </span>
              </div>
              <div className="text-[10px] text-text-muted truncate">{session?.user.department}</div>
            </div>
          )}
        </div>
      </aside>

      {/* 右侧主容器 */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden relative z-10">
        {/* 顶部悬浮穿透导航条（内容向下滚动时可流经其背面实时磨砂折射） */}
        <header
          className={`h-14 px-5 bg-bg-elevated backdrop-blur-md flex items-center justify-between gap-4 shrink-0 z-40 ${
            isLiquidGlass
              ? 'absolute top-3 left-3 right-4 rounded-2xl border border-border-subtle'
              : 'absolute top-0 left-0 right-0 border-b border-border-subtle'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {collapsed ? (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="p-1.5 rounded-lg border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-text-secondary hover:text-accent shrink-0 transition"
                title="展开菜单栏"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            ) : (
              <Menu className="w-4 h-4 text-accent lg:hidden shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary flex items-center gap-2 truncate">
                <span>{currentNav?.label ?? '控制台'}</span>
                {currentNav ? (
                  <span className="hidden md:inline text-[11px] font-normal text-text-muted">
                    · {currentNav.description}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* 全局搜索 */}
            <form onSubmit={handleGlobalSearch} className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索厂站工程 / 编码..."
                className="h-8 w-44 xl:w-56 pl-8 pr-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition"
              />
            </form>

            {/* 定制化主题快速切换 */}
            <div className="hidden sm:block">
              <ThemeSwitcher variant="topbar" />
            </div>

            {hasPerm('project:edit') ? (
              <button
                type="button"
                onClick={() => navigate('/editor')}
                className="h-8 px-3 rounded-lg bg-accent-soft border border-border-strong hover:bg-accent hover:text-accent-fg text-accent text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>进入 3D 工作台</span>
              </button>
            ) : null}

            {/* 用户头像菜单 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="h-8 pl-1.5 pr-2.5 rounded-lg border border-border-subtle bg-bg-canvas hover:bg-bg-hover flex items-center gap-2 transition"
              >
                <span className="w-6 h-6 rounded-md bg-accent text-accent-fg font-bold text-xs flex items-center justify-center">
                  {session?.user.displayName.slice(0, 1) ?? 'U'}
                </span>
                <span className="text-xs font-medium text-text-primary hidden sm:inline">
                  {session?.user.displayName ?? '未登录'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </button>

              {userMenuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-56 rounded-xl studio-glass border border-border-strong shadow-2xl p-2 z-40 space-y-1 text-xs">
                    <div className="px-2.5 py-2 border-b border-border-subtle space-y-0.5">
                      <div className="font-semibold text-text-primary">{session?.user.displayName}</div>
                      <div className="text-[11px] font-mono text-accent">
                        @{session?.user.username} · {session?.user.roleName}
                      </div>
                      <div className="text-[10px] text-text-muted">{session?.user.department}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void logout().then(() => navigate('/login', { replace: true }));
                      }}
                      className="w-full px-2.5 py-2 rounded-lg text-left text-red-400 hover:bg-red-500/15 flex items-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>退出登录 / 切换角色</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {/* 内容路由区（全高穿透滚动，顶部预留悬浮导航安全距） */}
        <main className={`flex-1 min-h-0 h-full overflow-y-auto ${isLiquidGlass ? 'pt-16' : 'pt-14'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ConsoleLayout;
