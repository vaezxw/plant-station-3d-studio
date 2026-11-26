import { useRef, useState, type ChangeEvent, type FC } from 'react';
import {
  ArrowRight,
  Box,
  Check,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FolderKanban,
  Globe,
  Layers,
  LayoutDashboard,
  Plus,
  Radio,
  Rocket,
  Server,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STUDIO_CATALOG } from '../../domain/catalog';
import { PROJECT_PRESETS } from '../../domain/presets';
import { buildPreviewUrls } from '../../domain/runtimeUrl';
import {
  createDefaultGroundConfig,
  createWidgetsForTemplate,
  normalizeWidgetsTo24Cols,
  type ProjectSchema,
} from '../../domain/schema';
import { useAuthStore } from '../../store/useAuthStore';
import { BUILTIN_CARD_TEMPLATES, useCardTemplateStore } from '../../store/useCardTemplateStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { usePublishStore } from '../../store/usePublishStore';
import { useRbacStore } from '../../store/useRbacStore';
import { AuthGuard, useHasPerm } from '../components/AuthGuard';

const ConsoleHomePage: FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const session = useAuthStore((s) => s.session);
  const canEdit = useHasPerm('project:edit');
  const canCreate = useHasPerm('project:create');

  const activeProject = useProjectStore((s) => s.project);
  const savedProjects = useProjectStore((s) => s.savedProjects);
  const loadPreset = useProjectStore((s) => s.loadPreset);
  const loadFromLibrary = useProjectStore((s) => s.loadFromLibrary);
  const importProject = useProjectStore((s) => s.importProject);

  const setMode = useEditorStore((s) => s.setMode);
  const setThemeId = useEditorStore((s) => s.setThemeId);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const customCardTemplates = useCardTemplateStore((s) => s.customTemplates);
  const publishedList = usePublishStore((s) => s.publishedList);
  const publishSettings = usePublishStore((s) => s.settings);
  const systemConfig = useRbacStore((s) => s.systemConfig);

  const openEditor = (targetMode: 'studio' | 'dashboard' | 'present', projId?: string) => {
    setSelectedNodeId(null);
    setMode(targetMode);
    navigate(projId ? `/editor/${encodeURIComponent(projId)}` : '/editor');
    window.setTimeout(() => triggerCameraView('iso'), 80);
  };

  const handleCreateBlankStation = () => {
    const id = `proj-${Date.now()}`;
    const blank: ProjectSchema = {
      version: 2,
      id,
      name: `新建厂站工程 ${savedProjects.length + 1}`,
      industry: 'custom',
      description: '从空白厂区创建自定义 3D 工艺流程与大屏',
      themeId: useEditorStore.getState().themeId,
      dashboardTemplate: 'immersive',
      ground: createDefaultGroundConfig(),
      nodes: [],
      pipes: [],
      bookmarks: [],
      updatedAt: Date.now(),
    };
    importProject(blank);
    openEditor('studio', id);
  };

  const handleImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ProjectSchema;
      importProject(parsed);
      openEditor('studio', parsed.id);
    } catch {
      window.alert('JSON 工程文件格式无效');
    }
  };

  const handleOpenPreset = (presetId: string, themeId: string, targetMode: 'studio' | 'dashboard' | 'present') => {
    loadPreset(presetId);
    setThemeId(themeId);
    openEditor(targetMode);
  };

  const handleOpenSaved = (projId: string, targetMode: 'studio' | 'dashboard') => {
    void loadFromLibrary(projId).then(() => {
      openEditor(targetMode, projId);
    });
  };

  const copyEmbedUrl = (sceneId: string, token: string, requireToken: boolean) => {
    const urls = buildPreviewUrls({ sceneId, token, requireToken });
    void navigator.clipboard?.writeText(urls.scadaEmbedUrl);
    setCopiedId(sceneId);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const resolveThumb = (sceneId?: string, thumb?: string) =>
    thumb ?? (sceneId ? publishedList.find((p) => p.sceneId === sceneId)?.thumbnailDataUrl : undefined);

  const recentCards = [
    ...(savedProjects.some((p) => p.id === activeProject.id)
      ? []
      : [
          {
            id: activeProject.id,
            name: activeProject.name,
            industry: activeProject.industry,
            nodeCount: activeProject.nodes.length,
            widgetCount: (activeProject.dashboardWidgets ?? []).filter((w) => w.visible).length,
            stationCode: activeProject.stationCode,
            publishedSceneId: activeProject.publishedSceneId,
            thumbnailDataUrl: resolveThumb(activeProject.publishedSceneId, activeProject.thumbnailDataUrl),
            updatedAt: activeProject.updatedAt,
            isActiveDraft: true,
          },
        ]),
    ...savedProjects.map((s) => ({
      ...s,
      thumbnailDataUrl: resolveThumb(s.publishedSceneId, s.thumbnailDataUrl),
      isActiveDraft: s.id === activeProject.id,
    })),
  ].slice(0, 4);

  const totalAssets = STUDIO_CATALOG.length + BUILTIN_CARD_TEMPLATES.length + customCardTemplates.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero 平台欢迎与快捷动作横幅 */}
      <section className="relative rounded-2xl border border-border-strong bg-bg-panel p-6 overflow-hidden shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-25"
          style={{ background: 'var(--accent)' }}
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-soft border border-border-strong text-[11px] text-accent font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>欢迎回来，{session?.user.displayName}（{session?.user.roleName}）</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              {systemConfig.brandName} · 厂站工艺数字孪生工作空间
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              在一个工作台内完成工业厂站 3D 模型搭建、管道介质流向编排、24 列可视化组态卡片设计，并发布为高隔离短链接嵌入 SCADA 监控平台。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <AuthGuard perm="project:create">
              <button
                type="button"
                onClick={handleCreateBlankStation}
                className="h-10 px-4 rounded-xl bg-accent hover:brightness-110 text-accent-fg text-xs font-semibold flex items-center gap-1.5 shadow-md transition"
              >
                <Plus className="w-4 h-4" /> 新建空白厂站
              </button>
            </AuthGuard>

            <button
              type="button"
              onClick={() => navigate('/console/templates')}
              className="h-10 px-4 rounded-xl border border-border-strong bg-bg-canvas hover:bg-bg-hover text-text-primary text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Layers className="w-4 h-4 text-accent" /> 从行业模板创建
            </button>

            <AuthGuard perm="project:create">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-3.5 rounded-xl border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs flex items-center gap-1.5 transition"
              >
                <Upload className="w-4 h-4" /> 导入 JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => void handleImportJson(e)}
              />
            </AuthGuard>
          </div>
        </div>
      </section>

      {/* 4 格核心统计 KPI */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => canCreate && navigate('/console/projects')}
          className="text-left rounded-2xl border border-border-subtle bg-bg-panel hover:border-border-strong p-4 transition space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>厂站数字孪生工程</span>
            <FolderKanban className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {Math.max(1, savedProjects.length)}
            <span className="text-xs font-normal text-text-muted ml-1.5">个项目</span>
          </div>
          <div className="text-[11px] text-text-muted">
            含当前活动草稿 · 点击管理工程列表
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/console/releases')}
          className="text-left rounded-2xl border border-border-subtle bg-bg-panel hover:border-border-strong p-4 transition space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>已发布 3D 工艺大屏</span>
            <Globe className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-500">
            {publishedList.length}
            <span className="text-xs font-normal text-text-muted ml-1.5">条在线链接</span>
          </div>
          <div className="text-[11px] text-text-muted">
            支持重发布版本递增 · 链接嵌入 SCADA 稳定不变
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/console/templates')}
          className="text-left rounded-2xl border border-border-subtle bg-bg-panel hover:border-border-strong p-4 transition space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>3D 模型与卡片组件</span>
            <Box className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {totalAssets}
            <span className="text-xs font-normal text-text-muted ml-1.5">套可用资产</span>
          </div>
          <div className="text-[11px] text-text-muted">
            {STUDIO_CATALOG.length} 类 3D 设备 · {BUILTIN_CARD_TEMPLATES.length + customCardTemplates.length} 套卡片模板
          </div>
        </button>

        <button
          type="button"
          onClick={() => canEdit && navigate('/console/integration')}
          className="text-left rounded-2xl border border-border-subtle bg-bg-panel hover:border-border-strong p-4 transition space-y-2"
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>发布后端 &amp; 桥接协议</span>
            <Server className="w-4 h-4 text-accent" />
          </div>
          <div className="text-sm font-mono font-bold text-accent pt-1">
            {publishSettings.storageMode === 'remote-api' ? '远程 REST 接口模式' : '选项 B · 本地仓(预留)'}
          </div>
          <div className="text-[11px] text-text-muted pt-1">
            PLANT_3D_BRIDGE v1.0 · MQTT 双模自适应
          </div>
        </button>
      </section>

      {/* 最近编辑的厂站项目画廊 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" /> 最近编辑的厂站项目
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              点击任意厂站直接切入全屏 3D 搭建或大屏组态编排（支持实时缩略图与状态回显）
            </p>
          </div>
          <AuthGuard perm="menu:projects">
            <button
              type="button"
              onClick={() => navigate('/console/projects')}
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              查看全部项目 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </AuthGuard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {recentCards.map((proj) => (
            <div
              key={proj.id}
              className="rounded-2xl border border-border-subtle bg-bg-panel overflow-hidden flex flex-col hover:border-border-strong transition shadow-sm group"
            >
              {/* 3D 缩略图封面 */}
              <div className="aspect-video bg-slate-950 relative overflow-hidden border-b border-border-subtle">
                {proj.thumbnailDataUrl ? (
                  <img
                    src={proj.thumbnailDataUrl}
                    alt={proj.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div
                    className="w-full h-full relative flex flex-col items-center justify-center gap-1 text-slate-500"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 50% 45%, rgba(56,189,248,0.18), transparent 65%), linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
                      backgroundSize: '100% 100%, 24px 24px, 24px 24px',
                    }}
                  >
                    {/* 无真实抓图时，叠加微缩 24 列大屏卡片布局轮廓 */}
                    {proj.isActiveDraft
                      ? normalizeWidgetsTo24Cols(
                          activeProject.dashboardWidgets ??
                            createWidgetsForTemplate(activeProject.dashboardTemplate),
                        )
                          .filter((w) => w.visible)
                          .slice(0, 6)
                          .map((w) => (
                            <div
                              key={w.id}
                              style={{
                                left: `${(w.x / 24) * 92 + 4}%`,
                                top: `${Math.min(75, (w.y / 18) * 78 + 14)}%`,
                                width: `${Math.max(18, (w.w / 24) * 90)}%`,
                                height: `${Math.max(14, Math.min(34, (w.h / 18) * 76))}%`,
                              }}
                              className="absolute rounded border border-sky-400/35 bg-slate-900/75 px-1 py-0.5 overflow-hidden pointer-events-none"
                            >
                              <div className="text-[7px] text-sky-300 truncate font-medium">
                                {w.title}
                              </div>
                            </div>
                          ))
                      : null}
                    <Box className="w-6 h-6 text-sky-400/70 relative z-10" />
                    <span className="text-[10px] font-mono text-slate-300 relative z-10 bg-slate-950/60 px-2 py-0.5 rounded-full">
                      3D + 大屏缩略
                    </span>
                  </div>
                )}

                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 border border-border-subtle font-mono text-[9px] text-sky-300">
                  3D · {proj.nodeCount} | 大屏 · {proj.widgetCount ?? 0} 卡
                </div>

                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  {proj.publishedSceneId ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 backdrop-blur-sm">
                      已发布
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900/80 border border-slate-700 text-slate-300 backdrop-blur-sm">
                      草稿工程
                    </span>
                  )}
                  {proj.isActiveDraft ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 border border-sky-400/50 text-sky-300 backdrop-blur-sm">
                      当前工作区
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text-primary truncate">{proj.name}</div>
                  <div className="text-[11px] font-mono text-text-muted flex items-center justify-between">
                    <span>{proj.nodeCount} 台设备 · {proj.widgetCount ?? 0} 卡片</span>
                    {proj.stationCode ? <span className="text-accent">{proj.stationCode}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-border-subtle">
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          proj.isActiveDraft ? openEditor('studio', proj.id) : handleOpenSaved(proj.id, 'studio')
                        }
                        className="flex-1 h-7 rounded-lg bg-accent-soft border border-border-strong text-accent hover:bg-accent hover:text-accent-fg text-[11px] font-medium flex items-center justify-center gap-1 transition"
                      >
                        <Box className="w-3 h-3" /> 3D 搭建
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          proj.isActiveDraft ? openEditor('dashboard', proj.id) : handleOpenSaved(proj.id, 'dashboard')
                        }
                        className="flex-1 h-7 rounded-lg border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-text-secondary hover:text-text-primary text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <LayoutDashboard className="w-3 h-3" /> 大屏编排
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (proj.publishedSceneId) {
                          const hit = publishedList.find((p) => p.sceneId === proj.publishedSceneId);
                          const u = buildPreviewUrls({
                            sceneId: proj.publishedSceneId,
                            token: hit?.shareToken,
                            requireToken: hit?.requireToken,
                          });
                          window.open(u.standaloneUrl, '_blank', 'noopener');
                        } else {
                          openEditor('present', proj.id);
                        }
                      }}
                      className="flex-1 h-7 rounded-lg bg-accent-soft border border-border-strong text-accent hover:bg-accent hover:text-accent-fg text-[11px] font-medium flex items-center justify-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" /> 只读预览大屏
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 行业预设样板间 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" /> 行业工艺样板间（一键克隆起步）
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/console/templates')}
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            打开完整模板中心 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROJECT_PRESETS.map((preset) => {
            const sample = preset.create();
            return (
              <div
                key={preset.id}
                className="rounded-2xl border border-border-subtle bg-bg-panel p-4 flex flex-col justify-between gap-3 hover:border-border-strong transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-soft text-accent border border-border-strong">
                      {preset.industryLabel}
                    </span>
                    <span className="text-[11px] font-mono text-text-muted">{sample.nodes.length} 台设备</span>
                  </div>
                  <div className="text-sm font-semibold text-text-primary">{preset.name}</div>
                  <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                    {preset.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenPreset(preset.id, sample.themeId, 'studio')}
                        className="flex-1 h-7 rounded-lg bg-accent-soft border border-border-strong text-accent hover:bg-accent hover:text-accent-fg text-[11px] font-medium transition"
                      >
                        使用模板搭建
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPreset(preset.id, sample.themeId, 'dashboard')}
                        className="h-7 px-2.5 rounded-lg border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-[11px] text-text-secondary hover:text-text-primary transition"
                      >
                        大屏
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenPreset(preset.id, sample.themeId, 'present')}
                      className="flex-1 h-7 rounded-lg border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-[11px] text-text-primary transition"
                    >
                      只读演示查看
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 底部双栏：已发布链接动态 + 平台架构能力 */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl border border-border-subtle bg-bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Rocket className="w-4 h-4 text-emerald-400" /> 已发布 SCADA 大屏链接动态
            </h3>
            <button
              type="button"
              onClick={() => navigate('/console/releases')}
              className="text-xs text-accent hover:underline"
            >
              全部发布记录
            </button>
          </div>

          {publishedList.length === 0 ? (
            <div className="py-8 rounded-xl border border-dashed border-border-subtle text-center text-xs text-text-muted">
              当前暂无已发布场景。进入任意工程后点击顶栏「发布预览」，即可生成可嵌入 SCADA 的短链接。
            </div>
          ) : (
            <div className="space-y-2">
              {publishedList.slice(0, 4).map((item) => {
                const urls = buildPreviewUrls({
                  sceneId: item.sceneId,
                  token: item.shareToken,
                  requireToken: item.requireToken,
                });
                return (
                  <div
                    key={item.sceneId}
                    className="p-2.5 rounded-xl bg-bg-canvas border border-border-subtle flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary truncate">{item.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-mono text-[10px]">
                          v{item.revision}
                        </span>
                        {item.stationCode ? (
                          <span className="text-[10px] font-mono text-accent">{item.stationCode}</span>
                        ) : null}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted truncate mt-0.5">
                        {item.sceneId} · 更新于 {new Date(item.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyEmbedUrl(item.sceneId, item.shareToken, item.requireToken)}
                        className="h-7 px-2.5 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-[11px] text-accent flex items-center gap-1"
                      >
                        {copiedId === item.sceneId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        嵌入链接
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(urls.standaloneUrl, '_blank', 'noopener')}
                        className="h-7 px-2 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-text-secondary"
                        title="打开独立预览"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-border-subtle bg-bg-panel p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent" /> 平台引擎与集成就绪状态
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-bg-canvas border border-border-subtle flex items-center justify-between">
              <span className="text-text-secondary flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-500" /> 发布持久化适配器
              </span>
              <span className="font-mono text-emerald-500">
                {publishSettings.storageMode === 'remote-api' ? '远程 REST' : '本地 IndexedDB (已就绪)'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-bg-canvas border border-border-subtle flex items-center justify-between">
              <span className="text-text-secondary flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-accent" /> SCADA 桥接协议
              </span>
              <span className="font-mono text-accent">PLANT_3D_BRIDGE v1.0</span>
            </div>
            <div className="p-2.5 rounded-xl bg-bg-canvas border border-border-subtle flex items-center justify-between">
              <span className="text-text-secondary flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-amber-500" /> 权限认证模式
              </span>
              <span className="font-mono text-amber-500">RBAC（Phase 1 已启用）</span>
            </div>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            提示：所有独立预览地址 <code className="font-mono text-accent">#/preview/:sceneId</code> 已默认加入免登录白名单，可直接嵌入 SCADA `iframe` 无障碍运行。
          </p>
        </div>
      </section>
    </div>
  );
};

export default ConsoleHomePage;
