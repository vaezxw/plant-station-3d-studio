import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import {
  ArrowRight,
  Box,
  Cpu,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  Radio,
  Server,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, PLATFORM_BRAND, type RoleId } from '../../domain/authSchema';
import { resolveThemeById } from '../../domain/themes';
import { useAuthStore } from '../../store/useAuthStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useRbacStore } from '../../store/useRbacStore';
import LoginHero3DCanvas from '../components/LoginHero3DCanvas';
import ThemeSwitcher from '../components/ThemeSwitcher';

const ROLE_BADGE_DARK: Record<RoleId, string> = {
  admin: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
  designer: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300',
  viewer: 'border-amber-400/50 bg-amber-500/15 text-amber-300',
};

const ROLE_BADGE_LIGHT: Record<RoleId, string> = {
  admin: 'border-sky-600/35 bg-sky-500/10 text-sky-700',
  designer: 'border-emerald-600/35 bg-emerald-500/10 text-emerald-700',
  viewer: 'border-amber-600/35 bg-amber-500/10 text-amber-700',
};

const LoginPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const session = useAuthStore((s) => s.session);
  const settings = useAuthStore((s) => s.settings);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const loginAsRole = useAuthStore((s) => s.loginAsRole);
  const loginBySsoToken = useAuthStore((s) => s.loginBySsoToken);
  const clearError = useAuthStore((s) => s.clearError);
  const systemConfig = useRbacStore((s) => s.systemConfig);

  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);

  const activeTheme = useMemo(
    () => resolveThemeById(themeId, customThemes),
    [themeId, customThemes],
  );
  const isLight = activeTheme.mode === 'light';
  const roleBadges = isLight ? ROLE_BADGE_LIGHT : ROLE_BADGE_DARK;

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [showPwd, setShowPwd] = useState(false);

  const search = new URLSearchParams(location.search);
  const redirectPath = search.get('redirect') || '/console/home';
  const ssoToken = search.get('ssoToken');

  useEffect(() => {
    if (session) {
      navigate(redirectPath.startsWith('/') ? redirectPath : '/console/home', { replace: true });
      return;
    }
    if (ssoToken) {
      void loginBySsoToken(ssoToken).then(() => {
        navigate(redirectPath.startsWith('/') ? redirectPath : '/console/home', { replace: true });
      });
    }
  }, [session, ssoToken, redirectPath, navigate, loginBySsoToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      navigate(redirectPath.startsWith('/') ? redirectPath : '/console/home', { replace: true });
    } catch {
      // handled by store error
    }
  };

  const handleQuickRole = async (roleId: RoleId) => {
    try {
      await loginAsRole(roleId);
      navigate(redirectPath.startsWith('/') ? redirectPath : '/console/home', { replace: true });
    } catch {
      // handled by store error
    }
  };

  return (
    <div className="w-full h-full relative overflow-y-auto bg-bg-canvas text-text-primary flex select-none transition-colors duration-300">
      {/* 全屏实时 3D 数字孪生工业微场景背景（实时跟随主题配色） */}
      <LoginHero3DCanvas />

      {/* 渐变蒙层（根据深/浅主题自动调整透光度与边缘压暗/提亮，保证表单高可读性） */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background:
            activeTheme.id === 'liquid-glass'
              ? 'radial-gradient(circle at 22% 52%, rgba(235,243,255,0.34) 0%, rgba(232,241,254,0.62) 52%, rgba(238,245,255,0.78) 100%)'
              : isLight
                ? 'radial-gradient(circle at 26% 52%, rgba(226,232,240,0.22) 0%, rgba(226,232,240,0.68) 55%, rgba(241,245,249,0.88) 100%)'
                : `radial-gradient(circle at 26% 52%, transparent 0%, ${activeTheme.scene3d.background}b8 56%, ${activeTheme.scene3d.background}e8 100%)`,
        }}
      />

      {/* 右上角定制化主题快捷切换器 */}
      <div className="fixed top-4 right-5 z-20">
        <ThemeSwitcher variant="floating" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto my-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* 左侧：品牌形象与平台能力概览 */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border-strong bg-bg-panel backdrop-blur-md text-xs text-accent shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono">
              {systemConfig.brandName} · {PLATFORM_BRAND.version}
            </span>
            <span className="text-text-muted">|</span>
            <span className="text-text-secondary">Three.js 实时数字孪生场景运行中</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-text-primary leading-tight drop-shadow-sm">
              {systemConfig.brandName}
              <span className="block text-xl xl:text-2xl font-medium text-accent mt-1.5">
                {systemConfig.brandSubtitle}
              </span>
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed max-w-xl">
              无需专业 3D 建模软件，浏览器内完成工业厂站工艺搭积木、正交管网流向渲染、2D+3D 低代码组态大屏编排，并一键发布稳定预览链接无缝嵌入 SCADA 监控平台。
            </p>
          </div>

          {/* 三大核心能力卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-2xl border border-border-subtle bg-bg-panel backdrop-blur-md p-4 space-y-2 hover:border-border-strong transition shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-accent-soft border border-border-strong flex items-center justify-center text-accent">
                <Box className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-text-primary">37+ 工业装置即拖即用</div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                覆盖燃气输配、离心泵组、换热储罐、自动连管与介质流向动画。
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-panel backdrop-blur-md p-4 space-y-2 hover:border-border-strong transition shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-text-primary">24 列低代码组态大屏</div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                ECharts 图表、KPI 指标与设备模型模板双向联动，所见即所得。
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-panel backdrop-blur-md p-4 space-y-2 hover:border-border-strong transition shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Radio className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-text-primary">SCADA 链接嵌入联动</div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                一键发布防盗链短链接，支持宿主 MQTT 实时推流与报警定位。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-secondary font-mono pt-1">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-accent" /> Three.js WebGL PBR 引擎
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> RBAC 动态权限矩阵
            </span>
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-amber-500" /> 认证模式：{settings.authMode === 'remote-api' ? '远程 JWT' : '本地演示（已预留 JWT / SSO）'}
            </span>
          </div>
        </div>

        {/* 右侧：登录表单卡片 */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border-subtle bg-bg-panel backdrop-blur-xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text-primary">登录平台控制台</h2>
              <p className="text-xs text-text-muted">
                登录后可进入厂站项目首页、3D 搭建、大屏发布及权限配置
              </p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
              <label className="block space-y-1.5">
                <span className="text-xs text-text-secondary font-medium">登录账号</span>
                <div className="relative">
                  <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={username}
                    onChange={(e) => {
                      clearError();
                      setUsername(e.target.value);
                    }}
                    placeholder="请输入账号，如 admin"
                    required
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-bg-canvas border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition"
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs text-text-secondary font-medium">登录密码</span>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      clearError();
                      setPassword(e.target.value);
                    }}
                    placeholder="默认演示密码 123456"
                    required
                    className="w-full h-10 pl-9 pr-10 rounded-xl bg-bg-canvas border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                    title={showPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              {error ? (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-400">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={`w-full h-10 rounded-xl bg-accent hover:brightness-110 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50 ${
                  isLight ? 'text-white' : 'text-slate-950'
                }`}
              >
                {loading ? '正在验证身份...' : '登录进入平台首页'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* 演示角色快捷体验区 */}
            {settings.authMode === 'local-mock' && systemConfig.allowDemoQuickLogin ? (
              <div className="pt-4 border-t border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>一键体验不同 RBAC 权限角色（免输密）</span>
                  <span className="font-mono">密码均 123456</span>
                </div>
                <div className="space-y-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.username}
                      type="button"
                      disabled={loading}
                      onClick={() => void handleQuickRole(acc.roleId)}
                      className="w-full px-3 py-2 rounded-xl bg-bg-canvas hover:bg-bg-hover border border-border-subtle hover:border-border-strong flex items-center justify-between gap-2 text-left transition group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">{acc.displayName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${roleBadges[acc.roleId]}`}
                          >
                            {acc.username}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted truncate mt-0.5">{acc.hint}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent shrink-0 transition" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
