import type { FC, ReactNode } from 'react';
import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { PermissionCode } from '../../domain/authSchema';
import { useAuthStore } from '../../store/useAuthStore';

export function useHasPerm(perm?: PermissionCode): boolean {
  const session = useAuthStore((s) => s.session);
  if (!perm) return true;
  if (!session) return false;
  return session.user.permissions.includes(perm);
}

export const RequireAuth: FC<{ children: ReactNode }> = ({ children }) => {
  const session = useAuthStore((s) => s.session);
  const location = useLocation();

  if (!session) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
};

export const RequirePerm: FC<{ perm?: PermissionCode; children: ReactNode }> = ({
  perm,
  children,
}) => {
  const allowed = useHasPerm(perm);
  if (!allowed) {
    return <Navigate to={`/403?perm=${encodeURIComponent(perm ?? '')}`} replace />;
  }
  return <>{children}</>;
};

export const AuthGuard: FC<{
  perm?: PermissionCode;
  fallback?: ReactNode;
  children: ReactNode;
}> = ({ perm, fallback = null, children }) => {
  const allowed = useHasPerm(perm);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
};

export const ForbiddenPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  const search = new URLSearchParams(location.search);
  const missingPerm = search.get('perm') || '未知权限码';

  return (
    <div className="w-full h-full bg-bg-canvas text-text-primary flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full studio-glass rounded-2xl border border-border-strong p-7 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-text-primary">403 · 暂无访问权限</div>
            <div className="text-xs text-text-muted font-mono">
              当前角色：{session?.user.roleName ?? '未登录'} · 缺少 {missingPerm}
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-text-secondary bg-bg-canvas/60 rounded-xl p-3.5 border border-border-subtle">
          您的当前账号（<span className="font-mono text-accent">{session?.user.username ?? '-'}</span>
          ）未获授权访问该功能模块。可返回首页继续查看已授权大屏，或切换为管理员账号重新登录。
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => navigate('/console/home', { replace: true })}
            className="h-9 px-4 rounded-xl bg-accent text-slate-950 text-xs font-semibold flex items-center gap-1.5 hover:brightness-110 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 返回首页总览
          </button>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }));
            }}
            className="h-9 px-3.5 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> 切换账号
          </button>
        </div>
      </div>
    </div>
  );
};
