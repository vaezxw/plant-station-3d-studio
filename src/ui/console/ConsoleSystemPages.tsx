import { useEffect, useState, type FC } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ALL_PERMISSIONS, type PermissionCode } from '../../domain/authSchema';
import { useAuthStore } from '../../store/useAuthStore';
import {
  useRbacStore,
  type DynamicRoleDefinition,
  type RbacUserRecord,
} from '../../store/useRbacStore';
import { useHasPerm } from '../components/AuthGuard';

const PERM_GROUPS: { title: string; items: { code: PermissionCode; label: string }[] }[] = [
  {
    title: '平台菜单访问权限',
    items: [
      { code: 'menu:home', label: '首页总览' },
      { code: 'menu:projects', label: '厂站项目管理' },
      { code: 'menu:releases', label: '已发布大屏中心' },
      { code: 'menu:templates', label: '行业模板库' },
      { code: 'menu:assets', label: '3D 模型资产库' },
      { code: 'menu:card-templates', label: '大屏卡片模板库' },
      { code: 'menu:datasources', label: '数据源管理' },
      { code: 'menu:integration', label: 'SCADA 联调中心' },
      { code: 'menu:system:users', label: '用户管理' },
      { code: 'menu:system:roles', label: '角色与权限' },
      { code: 'menu:system:settings', label: '系统设置' },
    ],
  },
  {
    title: '功能与按钮操作权限',
    items: [
      { code: 'project:create', label: '新建 / 导入厂站' },
      { code: 'project:edit', label: '3D 搭建与大屏编排编辑' },
      { code: 'project:delete', label: '删除厂站工程' },
      { code: 'project:export', label: '导出工程 / GLB 模型' },
      { code: 'scene:publish', label: '发布 3D 大屏链接' },
      { code: 'scene:unpublish', label: '下线删除已发布场景' },
      { code: 'asset:upload', label: '上传自定义 .glb 资产' },
      { code: 'card_template:manage', label: '新建与管理卡片模板' },
      { code: 'datasource:manage', label: '管理数据源连接配置' },
      { code: 'system:user:write', label: '增删改平台用户' },
      { code: 'system:role:write', label: '配置角色权限矩阵' },
      { code: 'system:setting:write', label: '修改系统全局配置' },
    ],
  },
];

export const ConsoleUsersPage: FC = () => {
  const users = useRbacStore((s) => s.users);
  const roles = useRbacStore((s) => s.roles);
  const upsertUser = useRbacStore((s) => s.upsertUser);
  const toggleUserEnabled = useRbacStore((s) => s.toggleUserEnabled);
  const deleteUser = useRbacStore((s) => s.deleteUser);
  const canWrite = useHasPerm('system:user:write');

  const [editing, setEditing] = useState<Omit<RbacUserRecord, 'updatedAt'> | null>(null);
  const [stationText, setStationText] = useState('');

  const openCreate = () => {
    setStationText('');
    setEditing({
      id: `u-${Date.now().toString(36)}`,
      username: '',
      password: '123456',
      displayName: '',
      roleId: roles[1]?.id ?? roles[0]?.id ?? 'designer',
      department: '工艺数字孪生部门',
      enabled: true,
      allowedStationCodes: [],
    });
  };

  const openEdit = (u: RbacUserRecord) => {
    setStationText(u.allowedStationCodes.join(', '));
    setEditing({ ...u });
  };

  const handleSave = () => {
    if (!editing || !editing.username.trim() || !editing.displayName.trim()) return;
    const codes = stationText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    upsertUser({
      ...editing,
      username: editing.username.trim(),
      displayName: editing.displayName.trim(),
      allowedStationCodes: codes,
    });
    setEditing(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> 用户管理 ({users.length})
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            管理平台操作人员账号、启用状态、所属角色与可访问厂站范围（增删改实时持久生效）
          </p>
        </div>

        {canWrite ? (
          <button
            type="button"
            onClick={openCreate}
            className="h-9 px-4 rounded-xl bg-accent text-slate-950 font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> 新增用户
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-panel overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-bg-elevated border-b border-border-subtle text-text-muted">
            <tr>
              <th className="px-4 py-3">账号</th>
              <th className="px-4 py-3">姓名</th>
              <th className="px-4 py-3">部门</th>
              <th className="px-4 py-3">分配角色</th>
              <th className="px-4 py-3">厂站数据域</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {users.map((u) => {
              const role = roles.find((r) => r.id === u.roleId);
              return (
                <tr key={u.id} className="hover:bg-bg-hover">
                  <td className="px-4 py-3 font-mono text-accent">{u.username}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{u.displayName}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.department}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-accent-soft text-accent text-[11px]">
                      {role?.name ?? u.roleId}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {u.allowedStationCodes.length > 0 ? u.allowedStationCodes.join(', ') : '全部厂站'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={!canWrite || u.username === 'admin'}
                      onClick={() => toggleUserEnabled(u.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] border ${
                        u.enabled
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : 'bg-red-500/15 border-red-400/50 text-red-300'
                      } disabled:opacity-60`}
                    >
                      {u.enabled ? '已启用' : '已禁用'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="text-accent hover:underline inline-flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" /> 编辑
                        </button>
                        {u.username !== 'admin' ? (
                          <button
                            type="button"
                            onClick={() => deleteUser(u.id)}
                            className="text-red-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> 删除
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md studio-glass rounded-2xl border border-border-strong p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">
                {users.some((u) => u.id === editing.id) ? '编辑平台用户' : '新增平台用户'}
              </span>
              <button type="button" onClick={() => setEditing(null)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-text-muted">登录账号</span>
                <input
                  value={editing.username}
                  disabled={editing.username === 'admin'}
                  onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-text-primary disabled:opacity-50"
                />
              </label>
              <label className="space-y-1">
                <span className="text-text-muted">显示姓名</span>
                <input
                  value={editing.displayName}
                  onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-text-muted">登录密码</span>
                <input
                  value={editing.password}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-text-primary"
                />
              </label>
              <label className="space-y-1">
                <span className="text-text-muted">所属角色</span>
                <select
                  value={editing.roleId}
                  disabled={editing.username === 'admin'}
                  onChange={(e) => setEditing({ ...editing, roleId: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-text-muted">所属部门</span>
              <input
                value={editing.department}
                onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-text-muted">授权访问厂站编码（英文逗号分隔，留空代表全部）</span>
              <input
                value={stationText}
                onChange={(e) => setStationText(e.target.value)}
                placeholder="如 STATION_201, GAS_002"
                className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-text-primary"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-8 px-3 rounded-lg border border-border-subtle text-text-secondary"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-8 px-4 rounded-lg bg-accent text-slate-950 font-semibold"
              >
                保存用户
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const ConsoleRolesPage: FC = () => {
  const roles = useRbacStore((s) => s.roles);
  const upsertRole = useRbacStore((s) => s.upsertRole);
  const setRolePermissions = useRbacStore((s) => s.setRolePermissions);
  const deleteRole = useRbacStore((s) => s.deleteRole);
  const syncRolePermissions = useAuthStore((s) => s.syncRolePermissions);
  const canWrite = useHasPerm('system:role:write');

  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? 'admin');
  const [draftPerms, setDraftPerms] = useState<PermissionCode[]>(roles[0]?.permissions ?? []);
  const [savedTip, setSavedTip] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedId) ?? roles[0];

  useEffect(() => {
    if (selectedRole) setDraftPerms([...selectedRole.permissions]);
    setSavedTip(false);
  }, [selectedRole]);

  const togglePerm = (code: PermissionCode) => {
    if (!canWrite) return;
    setDraftPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSaveMatrix = () => {
    if (!selectedRole || !canWrite) return;
    setRolePermissions(selectedRole.id, draftPerms);
    syncRolePermissions(selectedRole.id, draftPerms);
    setSavedTip(true);
    window.setTimeout(() => setSavedTip(false), 2000);
  };

  const handleCreateRole = () => {
    const name = window.prompt('输入新角色名称：', '工艺审核专员');
    if (!name || !name.trim()) return;
    const role: DynamicRoleDefinition = {
      id: `role-${Date.now().toString(36)}`,
      name: name.trim(),
      badgeColor: '#a78bfa',
      description: '自定义 RBAC 权限角色',
      permissions: ['menu:home', 'menu:releases', 'menu:templates'],
      isBuiltin: false,
    };
    upsertRole(role);
    setSelectedId(role.id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> 角色与 RBAC 权限矩阵
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            动态配置每个角色的菜单可见范围与页面按钮操作权；保存后当前在线关联角色立即实时生效
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={handleCreateRole}
            className="h-9 px-4 rounded-xl bg-accent text-slate-950 font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> 新增角色
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 space-y-2.5">
          {roles.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`cursor-pointer p-3.5 rounded-2xl border transition space-y-1.5 ${
                selectedId === r.id
                  ? 'bg-accent-soft border-border-strong'
                  : 'bg-bg-panel border-border-subtle hover:border-border-strong'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{r.name}</span>
                <span className="px-2 py-0.5 rounded bg-bg-canvas font-mono text-[10px] text-accent">
                  {r.permissions.length} 权限
                </span>
              </div>
              <p className="text-[11px] text-text-secondary">{r.description}</p>
              {!r.isBuiltin && canWrite ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRole(r.id);
                    setSelectedId('admin');
                  }}
                  className="text-[11px] text-red-400 hover:underline pt-1"
                >
                  删除角色
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-8 p-5 rounded-2xl border border-border-subtle bg-bg-panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle">
            <div>
              <div className="text-sm font-bold text-text-primary">
                编辑角色权限：{selectedRole?.name}
              </div>
              <div className="text-[11px] text-text-muted font-mono">
                已勾选 {draftPerms.length} / {ALL_PERMISSIONS.length} 项权限
              </div>
            </div>

            {canWrite ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftPerms([...ALL_PERMISSIONS])}
                  className="h-7 px-2.5 rounded border border-border-subtle text-text-secondary hover:text-text-primary"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPerms(['menu:home'])}
                  className="h-7 px-2.5 rounded border border-border-subtle text-text-secondary hover:text-text-primary"
                >
                  仅保留首页
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatrix}
                  className="h-8 px-4 rounded-lg bg-accent text-slate-950 font-semibold flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> 保存权限并实时生效
                </button>
              </div>
            ) : null}
          </div>

          {savedTip ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> 已保存权限矩阵！受影响账号权限已即时更新。
            </div>
          ) : null}

          <div className="space-y-4">
            {PERM_GROUPS.map((grp) => (
              <div key={grp.title} className="space-y-2">
                <div className="font-semibold text-accent">{grp.title}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {grp.items.map((item) => {
                    const checked = draftPerms.includes(item.code);
                    return (
                      <label
                        key={item.code}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                          checked
                            ? 'bg-accent-soft border-border-strong text-text-primary'
                            : 'bg-bg-canvas border-border-subtle text-text-secondary'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canWrite}
                          onChange={() => togglePerm(item.code)}
                          className="mt-0.5 accent-sky-400"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.label}</div>
                          <div className="text-[10px] font-mono text-text-muted truncate">{item.code}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConsoleSettingsPage: FC = () => {
  const systemConfig = useRbacStore((s) => s.systemConfig);
  const updateSystemConfig = useRbacStore((s) => s.updateSystemConfig);
  const resetRbacDefaults = useRbacStore((s) => s.resetRbacDefaults);
  const authSettings = useAuthStore((s) => s.settings);
  const updateAuthSettings = useAuthStore((s) => s.updateSettings);
  const canWrite = useHasPerm('system:setting:write');

  const [savedTip, setSavedTip] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 text-xs">
      <div>
        <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-400" /> 系统设置与认证配置
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          自定义平台品牌展示、发布安全默认策略与 JWT/SSO 后端认证对接开关
        </p>
      </div>

      <div className="p-5 rounded-2xl border border-border-subtle bg-bg-panel space-y-4">
        <div className="font-semibold text-accent">品牌与安全策略（实时同步到顶栏与登录页）</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-text-muted">平台主标题名称</span>
            <input
              disabled={!canWrite}
              value={systemConfig.brandName}
              onChange={(e) => updateSystemConfig({ brandName: e.target.value })}
              className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
            />
          </label>
          <label className="space-y-1">
            <span className="text-text-muted">平台副标题说明</span>
            <input
              disabled={!canWrite}
              value={systemConfig.brandSubtitle}
              onChange={(e) => updateSystemConfig({ brandSubtitle: e.target.value })}
              className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={systemConfig.allowDemoQuickLogin}
              onChange={(e) => updateSystemConfig({ allowDemoQuickLogin: e.target.checked })}
              className="accent-sky-400"
            />
            <span>在登录页展示「演示角色快捷体验」入口</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={systemConfig.requirePublishTokenByDefault}
              onChange={(e) => updateSystemConfig({ requirePublishTokenByDefault: e.target.checked })}
              className="accent-sky-400"
            />
            <span>发布大屏默认开启 shareToken 防盗链校验</span>
          </label>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-border-subtle bg-bg-panel space-y-4">
        <div className="font-semibold text-accent">后端统一认证源配置（预留 JWT / SCADA SSO）</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => updateAuthSettings({ authMode: 'local-mock' })}
            className={`px-3.5 py-1.5 rounded-lg border ${
              authSettings.authMode === 'local-mock'
                ? 'bg-accent text-slate-950 border-transparent font-semibold'
                : 'border-border-subtle text-text-secondary'
            }`}
          >
            本地演示 RBAC 认证 (local-mock)
          </button>
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => updateAuthSettings({ authMode: 'remote-api' })}
            className={`px-3.5 py-1.5 rounded-lg border ${
              authSettings.authMode === 'remote-api'
                ? 'bg-accent text-slate-950 border-transparent font-semibold'
                : 'border-border-subtle text-text-secondary'
            }`}
          >
            远程后端 JWT 接口 (remote-api)
          </button>
        </div>
        <label className="block space-y-1">
          <span className="text-text-muted">远程认证网关 Base URL</span>
          <input
            disabled={!canWrite}
            value={authSettings.apiBaseUrl}
            onChange={(e) => updateAuthSettings({ apiBaseUrl: e.target.value })}
            className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-text-primary"
          />
        </label>

        {canWrite ? (
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => {
                resetRbacDefaults();
                setSavedTip(true);
                window.setTimeout(() => setSavedTip(false), 2000);
              }}
              className="h-8 px-3 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 恢复出厂默认用户与角色
            </button>
            {savedTip ? <span className="text-emerald-400">已恢复默认用户与权限配置</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
