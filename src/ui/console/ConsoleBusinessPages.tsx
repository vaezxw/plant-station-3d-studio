import { useRef, useState, type ChangeEvent, type FC } from 'react';
import {
  Box,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  FolderOpen,
  Globe,
  Grid,
  LayoutDashboard,
  List,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildPreviewUrls } from '../../domain/runtimeUrl';
import {
  createDefaultCardElement,
  createDefaultGroundConfig,
  type CardTemplateSchema,
  type ProjectSchema,
} from '../../domain/schema';
import { BUILTIN_CARD_TEMPLATES, useCardTemplateStore } from '../../store/useCardTemplateStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { usePublishStore } from '../../store/usePublishStore';
import { AuthGuard, useHasPerm } from '../components/AuthGuard';
import ApplyTemplateProjectModal from './ApplyTemplateProjectModal';
import CardTemplateDetailViewer from './CardTemplateDetailViewer';
import { CardTemplateThumb } from './CardTemplateThumb';

const INDUSTRY_LABELS: Record<ProjectSchema['industry'], string> = {
  'gas-meter': '燃气表工艺',
  'gas-station': '燃气输配站',
  water: '水务泵站',
  energy: '综合能源',
  custom: '自定义厂站',
};

export const ConsoleProjectsPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initQ = new URLSearchParams(location.search).get('q') ?? '';
  const [query, setQuery] = useState(initQ);
  const [industry, setIndustry] = useState<ProjectSchema['industry'] | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editingMeta, setEditingMeta] = useState<{
    id: string;
    name: string;
    stationCode: string;
    isActiveOnly: boolean;
  } | null>(null);

  const savedProjects = useProjectStore((s) => s.savedProjects);
  const activeProject = useProjectStore((s) => s.project);
  const loadFromLibrary = useProjectStore((s) => s.loadFromLibrary);
  const deleteFromLibrary = useProjectStore((s) => s.deleteFromLibrary);
  const importProject = useProjectStore((s) => s.importProject);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const saveCurrentToLibrary = useProjectStore((s) => s.saveCurrentToLibrary);

  const publishedList = usePublishStore((s) => s.publishedList);
  const setMode = useEditorStore((s) => s.setMode);
  const canEdit = useHasPerm('project:edit');
  const canDelete = useHasPerm('project:delete');

  const resolveThumb = (sceneId?: string, thumb?: string) =>
    thumb ?? (sceneId ? publishedList.find((p) => p.sceneId === sceneId)?.thumbnailDataUrl : undefined);

  const merged = [
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
            isActiveOnly: true,
          },
        ]),
    ...savedProjects.map((s) => ({
      ...s,
      thumbnailDataUrl: resolveThumb(s.publishedSceneId, s.thumbnailDataUrl),
      isActiveOnly: false,
    })),
  ].filter((p) => {
    if (industry !== 'all' && p.industry !== industry) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.stationCode ?? '').toLowerCase().includes(q);
  });

  const openInEditor = (id: string, targetMode: 'studio' | 'dashboard', isActiveOnly: boolean) => {
    const go = () => {
      setMode(targetMode);
      navigate(`/editor/${encodeURIComponent(id)}`);
    };
    if (!isActiveOnly && savedProjects.some((s) => s.id === id)) {
      void loadFromLibrary(id).then(go);
    } else {
      go();
    }
  };

  const createBlank = () => {
    const id = `proj-${Date.now()}`;
    const blank: ProjectSchema = {
      version: 2,
      id,
      name: `新建厂站工程 ${savedProjects.length + 1}`,
      industry: 'custom',
      description: '新建 3D 厂站工艺数字孪生工程',
      themeId: useEditorStore.getState().themeId,
      dashboardTemplate: 'immersive',
      ground: createDefaultGroundConfig(),
      nodes: [],
      pipes: [],
      bookmarks: [],
      updatedAt: Date.now(),
    };
    importProject(blank);
    setMode('studio');
    navigate(`/editor/${encodeURIComponent(id)}`);
  };

  const handleImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ProjectSchema;
      importProject(parsed);
      void saveCurrentToLibrary();
    } catch {
      window.alert('JSON 工程格式无效');
    }
  };

  const handleSaveMeta = async () => {
    if (!editingMeta) return;
    if (!editingMeta.isActiveOnly && activeProject.id !== editingMeta.id) {
      await loadFromLibrary(editingMeta.id);
    }
    updateProjectMeta({
      name: editingMeta.name.trim() || '未命名工程',
      stationCode: editingMeta.stationCode.trim() || undefined,
    });
    await saveCurrentToLibrary();
    setEditingMeta(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">厂站项目管理</h1>
          <p className="text-xs text-text-muted mt-0.5">
            共 {merged.length} 个 3D 工艺数字孪生厂站工程（支持关联 SCADA 采集点编码与 2D+3D 合成预览）
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AuthGuard perm="project:create">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3 rounded-xl border border-border-subtle bg-bg-panel hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> 导入 JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => void handleImportJson(e)}
            />
            <button
              type="button"
              onClick={createBlank}
              className="h-9 px-4 rounded-xl bg-accent text-slate-950 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> 新建空白厂站
            </button>
          </AuthGuard>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIndustry('all')}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              industry === 'all'
                ? 'bg-accent text-slate-950 border-transparent font-semibold'
                : 'border-border-subtle bg-bg-panel text-text-secondary'
            }`}
          >
            全部行业
          </button>
          {(Object.keys(INDUSTRY_LABELS) as ProjectSchema['industry'][]).map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => setIndustry(ind)}
              className={`px-3 py-1.5 rounded-lg text-xs border ${
                industry === ind
                  ? 'bg-accent text-slate-950 border-transparent font-semibold'
                  : 'border-border-subtle bg-bg-panel text-text-secondary'
              }`}
            >
              {INDUSTRY_LABELS[ind]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索工程名或采集点编码..."
              className="h-8 w-56 pl-8 pr-2.5 rounded-lg bg-bg-panel border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
            />
          </div>
          <div className="flex rounded-lg border border-border-subtle bg-bg-panel p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-accent text-slate-950' : 'text-text-muted'}`}
              title="卡片视图"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-accent text-slate-950' : 'text-text-muted'}`}
              title="列表视图"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {merged.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border-subtle bg-bg-panel overflow-hidden flex flex-col justify-between hover:border-border-strong transition"
            >
              <div className="aspect-video bg-slate-950 relative border-b border-border-subtle overflow-hidden">
                {item.thumbnailDataUrl ? (
                  <img src={item.thumbnailDataUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
                    <Box className="w-7 h-7 text-sky-400/70" />
                    <span className="text-[10px] font-mono">3D + 大屏工程</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/80 border border-border-subtle text-text-secondary">
                    {INDUSTRY_LABELS[item.industry]}
                  </span>
                  {item.publishedSceneId ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                      已发布
                    </span>
                  ) : null}
                </div>
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 border border-border-subtle font-mono text-[10px] text-sky-300">
                  {item.nodeCount} 设备 · {item.widgetCount} 大屏卡
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">{item.name}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingMeta({
                            id: item.id,
                            name: item.name,
                            stationCode: item.stationCode ?? '',
                            isActiveOnly: item.isActiveOnly,
                          })
                        }
                        className="p-1 rounded text-text-muted hover:text-accent"
                        title="修改名称与绑定采集点编码"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <div className="text-[11px] font-mono text-text-muted mt-0.5">
                    {item.stationCode ? `采集点：${item.stationCode} · ` : ''}
                    {new Date(item.updatedAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-border-subtle">
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openInEditor(item.id, 'studio', item.isActiveOnly)}
                        className="flex-1 h-8 rounded-lg bg-accent-soft border border-border-strong text-accent hover:bg-accent hover:text-slate-950 text-xs font-medium flex items-center justify-center gap-1 transition"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> 3D 搭建
                      </button>
                      <button
                        type="button"
                        onClick={() => openInEditor(item.id, 'dashboard', item.isActiveOnly)}
                        className="flex-1 h-8 rounded-lg border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center justify-center gap-1 transition"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" /> 大屏编排
                      </button>
                    </>
                  ) : null}
                  {canDelete && !item.isActiveOnly ? (
                    <button
                      type="button"
                      onClick={() => void deleteFromLibrary(item.id)}
                      className="h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      title="删除本地工程"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-bg-panel overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-bg-elevated border-b border-border-subtle text-text-muted">
              <tr>
                <th className="px-4 py-3">工程名称</th>
                <th className="px-4 py-3">行业</th>
                <th className="px-4 py-3">采集点编码</th>
                <th className="px-4 py-3">规模</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {merged.map((item) => (
                <tr key={item.id} className="hover:bg-bg-hover/30">
                  <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{INDUSTRY_LABELS[item.industry]}</td>
                  <td className="px-4 py-3 font-mono text-accent">{item.stationCode ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {item.nodeCount} 设备 / {item.widgetCount} 卡片
                  </td>
                  <td className="px-4 py-3 text-text-muted">{new Date(item.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openInEditor(item.id, 'studio', item.isActiveOnly)}
                          className="text-accent hover:underline"
                        >
                          3D 搭建
                        </button>
                        <button
                          type="button"
                          onClick={() => openInEditor(item.id, 'dashboard', item.isActiveOnly)}
                          className="text-emerald-400 hover:underline"
                        >
                          大屏编排
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 编辑名称与绑定采集点弹窗 */}
      {editingMeta ? (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md studio-glass rounded-2xl border border-border-strong p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">修改厂站工程信息</span>
              <button type="button" onClick={() => setEditingMeta(null)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-text-muted">厂站工程名称</span>
              <input
                value={editingMeta.name}
                onChange={(e) => setEditingMeta({ ...editingMeta, name: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-text-muted">关联 SCADA 采集点编码 (stationCode)</span>
              <input
                value={editingMeta.stationCode}
                onChange={(e) => setEditingMeta({ ...editingMeta, stationCode: e.target.value })}
                placeholder="如 STATION_201"
                className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-text-primary"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingMeta(null)}
                className="h-8 px-3 rounded-lg border border-border-subtle text-text-secondary"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSaveMeta()}
                className="h-8 px-4 rounded-lg bg-accent text-slate-950 font-semibold"
              >
                保存更新
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const ConsoleReleasesPage: FC = () => {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewFrameUrl, setPreviewFrameUrl] = useState<string | null>(null);

  const publishedList = usePublishStore((s) => s.publishedList);
  const deletePublished = usePublishStore((s) => s.deletePublished);

  const filtered = publishedList.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.sceneId.toLowerCase().includes(q) ||
      (item.stationCode ?? '').toLowerCase().includes(q)
    );
  });

  const copyUrl = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(key);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" /> 已发布大屏中心 ({publishedList.length})
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            管理全部已发布的 3D 厂站大屏链接、修订版本号与 Token 防盗链策略
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索场景 ID / 标题 / 采集点..."
            className="h-8 w-64 pl-8 pr-2.5 rounded-lg bg-bg-panel border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border-subtle text-center text-xs text-text-muted">
          暂无匹配的已发布大屏。进入「3D 工作台」点击顶栏「发布预览」即可生成并登记到此处。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const urls = buildPreviewUrls({
              sceneId: item.sceneId,
              token: item.shareToken,
              requireToken: item.requireToken,
              standaloneDataMode: item.embedDefaultDataMode,
            });
            return (
              <div
                key={item.sceneId}
                className="p-4 rounded-2xl border border-border-subtle bg-bg-panel flex flex-col sm:flex-row gap-4 hover:border-border-strong transition"
              >
                <div className="w-full sm:w-44 h-28 rounded-xl bg-slate-950 border border-border-subtle overflow-hidden shrink-0 flex items-center justify-center">
                  {item.thumbnailDataUrl ? (
                    <img src={item.thumbnailDataUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Globe className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-text-primary truncate">{item.title}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] shrink-0">
                        v{item.revision}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-text-muted truncate mt-0.5">
                      {item.sceneId} {item.stationCode ? `· 采集点 ${item.stationCode}` : ''}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">
                      {item.nodeCount} 设备 · {item.widgetCount} 大屏卡片 · {item.requireToken ? 'Token校验已开启' : '公开免Token'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => copyUrl(`scada-${item.sceneId}`, urls.scadaEmbedUrl)}
                      className="h-7 px-2.5 rounded-lg bg-accent-soft border border-border-strong text-accent text-xs flex items-center gap-1"
                    >
                      {copiedId === `scada-${item.sceneId}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      SCADA 嵌入链接
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFrameUrl(urls.standaloneUrl)}
                      className="h-7 px-2.5 rounded-lg border border-border-subtle bg-bg-canvas/70 text-xs text-text-primary hover:bg-bg-hover"
                    >
                      弹窗试看
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(urls.standaloneUrl, '_blank', 'noopener')}
                      className="h-7 px-2 rounded-lg border border-border-subtle bg-bg-canvas/70 text-xs text-text-secondary hover:text-text-primary"
                      title="新窗口打开"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <AuthGuard perm="scene:unpublish">
                      <button
                        type="button"
                        onClick={() => void deletePublished(item.sceneId)}
                        className="ml-auto h-7 px-2 rounded-lg text-text-muted hover:text-red-400"
                        title="下线删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </AuthGuard>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewFrameUrl ? (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-6 flex items-center justify-center">
          <div className="w-full max-w-6xl h-[86vh] studio-glass rounded-2xl border border-border-strong overflow-hidden flex flex-col">
            <div className="h-11 px-4 bg-bg-elevated border-b border-border-subtle flex items-center justify-between text-xs">
              <span className="font-mono text-accent truncate">{previewFrameUrl}</span>
              <button type="button" onClick={() => setPreviewFrameUrl(null)} className="p-1 text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe src={previewFrameUrl} title="独立大屏预览" className="flex-1 w-full border-0 bg-slate-950" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const ConsoleCardTemplatesPage: FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<'all' | CardTemplateSchema['category']>('all');
  const [query, setQuery] = useState('');
  const [inspectingTpl, setInspectingTpl] = useState<CardTemplateSchema | null>(null);
  const [applyingTpl, setApplyingTpl] = useState<CardTemplateSchema | null>(null);

  const customTemplates = useCardTemplateStore((s) => s.customTemplates);
  const importTemplates = useCardTemplateStore((s) => s.importTemplates);
  const deleteTemplate = useCardTemplateStore((s) => s.deleteTemplate);
  const canManage = useHasPerm('card_template:manage');
  const canEditProject = useHasPerm('project:edit');

  const list = [...customTemplates, ...BUILTIN_CARD_TEMPLATES].filter((t) => {
    if (cat !== 'all' && t.category !== cat) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      (t.bindCatalogKind ?? '').toLowerCase().includes(q)
    );
  });

  const createCustomTemplate = async () => {
    const tpl: CardTemplateSchema = {
      id: `tpl-custom-${Date.now().toString(36)}`,
      name: `自定义监视卡 ${customTemplates.length + 1}`,
      category: 'custom',
      description: '在控制台创建的可复用组态卡片模板，支持大屏拖拽与设备绑定',
      defaultSize: { w: 7, h: 8 },
      createdAt: Date.now(),
      isBuiltin: false,
      elements: [
        createDefaultCardElement('text'),
        createDefaultCardElement('kpi'),
        createDefaultCardElement('chart-gauge'),
      ],
    };
    await importTemplates([tpl]);
    setInspectingTpl(tpl);
  };

  const handleCloneTemplate = async (src: CardTemplateSchema) => {
    const cloned: CardTemplateSchema = {
      ...(JSON.parse(JSON.stringify(src)) as CardTemplateSchema),
      id: `tpl-clone-${Date.now().toString(36)}`,
      name: `${src.name} (副本)`,
      isBuiltin: false,
      createdAt: Date.now(),
    };
    await importTemplates([cloned]);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(customTemplates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'card-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as CardTemplateSchema[];
      await importTemplates(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      window.alert('模板 JSON 格式无效');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">大屏卡片模板库 ({list.length} 套)</h1>
          <p className="text-xs text-text-muted mt-0.5">
            纯静态轻量缩略画廊 + 独立详情预览空间，支持动态工况试跑与一键应用至厂站大屏
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-8 px-3 rounded-lg border border-border-subtle bg-bg-panel hover:bg-bg-hover text-xs text-text-secondary flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" /> 导入
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => void handleImport(e)} />
            <button
              type="button"
              onClick={handleExport}
              className="h-8 px-3 rounded-lg border border-border-subtle bg-bg-panel hover:bg-bg-hover text-xs text-text-secondary flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> 导出自定义
            </button>
            <button
              type="button"
              onClick={() => void createCustomTemplate()}
              className="h-8 px-3.5 rounded-lg bg-accent text-slate-950 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 新建模板
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'equipment', 'chart', 'kpi', 'custom'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                cat === c
                  ? 'bg-accent text-slate-950 border-transparent font-semibold'
                  : 'border-border-subtle bg-bg-panel text-text-secondary hover:text-text-primary'
              }`}
            >
              {c === 'all' ? '全部' : c === 'equipment' ? '设备联动' : c === 'chart' ? '趋势图表' : c === 'kpi' ? '核心指标' : '自定义'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模板名称 / 描述 / 关联设备..."
            className="h-8 w-64 pl-8 pr-3 rounded-lg bg-bg-panel border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((t) => (
          <div
            key={t.id}
            onClick={() => setInspectingTpl(t)}
            className="cursor-pointer p-3.5 rounded-2xl border border-border-subtle bg-bg-panel hover:border-border-strong transition group flex flex-col justify-between gap-3 shadow-sm"
          >
            <div className="space-y-3">
              {/* 上部：纯静态轻量预览舞台 */}
              <div className="relative">
                <CardTemplateThumb template={t} />
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-950/85 border border-border-subtle text-accent">
                  {t.elements.length} 元素
                </span>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/45 text-[10px] text-sky-200 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                  <Eye className="w-3 h-3" /> 详情预览
                </span>
              </div>

              {/* 中部：标题、简述与原子标签 */}
              <div className="space-y-1.5 px-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary truncate">{t.name}</span>
                  <span className="text-[10px] font-mono text-text-muted shrink-0">
                    {t.isBuiltin ? '官方内置' : '自定义'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                  {t.description || '自定义组态卡片模板'}
                </p>
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted px-0.5">
              <span className="text-accent flex items-center gap-1 font-medium">
                <Eye className="w-3.5 h-3.5" /> 进入详情试跑
              </span>

              <div className="flex items-center gap-2.5">
                {canEditProject ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setApplyingTpl(t);
                    }}
                    className="text-text-secondary hover:text-accent flex items-center gap-1 font-medium"
                  >
                    <LayoutDashboard className="w-3 h-3" /> 应用到大屏
                  </button>
                ) : null}
                {!t.isBuiltin && canManage ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteTemplate(t.id);
                    }}
                    className="text-red-400 hover:underline flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" /> 删除
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {inspectingTpl ? (
        <CardTemplateDetailViewer
          template={inspectingTpl}
          canManage={canManage}
          onClose={() => setInspectingTpl(null)}
          onCloneTemplate={handleCloneTemplate}
          onApplyToProject={(tpl) => {
            setInspectingTpl(null);
            setApplyingTpl(tpl);
          }}
        />
      ) : null}

      {applyingTpl ? (
        <ApplyTemplateProjectModal
          template={applyingTpl}
          onClose={() => setApplyingTpl(null)}
        />
      ) : null}
    </div>
  );
};
