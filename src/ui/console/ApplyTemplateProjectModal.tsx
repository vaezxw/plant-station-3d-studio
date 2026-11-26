import { useEffect, useMemo, useState, type FC } from 'react';
import { get } from 'idb-keyval';
import { ArrowRight, Check, FolderOpen, LayoutDashboard, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCatalogItem } from '../../domain/catalog';
import type { CardTemplateSchema, ProjectSchema, SceneNode } from '../../domain/schema';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

type Props = {
  template: CardTemplateSchema;
  onClose: () => void;
};

const ApplyTemplateProjectModal: FC<Props> = ({ template, onClose }) => {
  const navigate = useNavigate();
  const savedProjects = useProjectStore((s) => s.savedProjects);
  const activeProject = useProjectStore((s) => s.project);
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const loadFromLibrary = useProjectStore((s) => s.loadFromLibrary);
  const addWidgetFromTemplate = useProjectStore((s) => s.addWidgetFromTemplate);
  const saveCurrentToLibrary = useProjectStore((s) => s.saveCurrentToLibrary);
  const setMode = useEditorStore((s) => s.setMode);
  const setSelectedWidgetId = useEditorStore((s) => s.setSelectedWidgetId);

  const [query, setQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject.id);
  const [candidateNodes, setCandidateNodes] = useState<SceneNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (savedProjects.length === 0) {
      void hydrateFromStorage();
    }
  }, [hydrateFromStorage, savedProjects.length]);

  const projectOptions = useMemo(() => {
    const base = savedProjects.some((p) => p.id === activeProject.id)
      ? savedProjects
      : [
          {
            id: activeProject.id,
            name: activeProject.name,
            industry: activeProject.industry,
            nodeCount: activeProject.nodes.length,
            widgetCount: (activeProject.dashboardWidgets ?? []).filter((w) => w.visible).length,
            stationCode: activeProject.stationCode,
            publishedSceneId: activeProject.publishedSceneId,
            thumbnailDataUrl: activeProject.thumbnailDataUrl,
            updatedAt: activeProject.updatedAt,
          },
          ...savedProjects,
        ];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.stationCode ?? '').toLowerCase().includes(q),
    );
  }, [activeProject, query, savedProjects]);

  useEffect(() => {
    let cancelled = false;
    const loadNodes = async () => {
      let nodes: SceneNode[] = [];
      if (selectedProjectId === activeProject.id) {
        nodes = activeProject.nodes;
      } else {
        const stored = await get<ProjectSchema>(`plant-studio:lib:${selectedProjectId}`);
        if (stored?.nodes) nodes = stored.nodes;
      }
      if (cancelled) return;
      const filtered = template.bindCatalogKind
        ? nodes.filter((n) => n.kind === template.bindCatalogKind)
        : nodes;
      setCandidateNodes(filtered);
      setSelectedNodeId(filtered[0]?.id ?? '');
    };
    void loadNodes();
    return () => {
      cancelled = true;
    };
  }, [activeProject.id, activeProject.nodes, selectedProjectId, template.bindCatalogKind]);

  const handleConfirm = async () => {
    if (!selectedProjectId || submitting) return;
    setSubmitting(true);
    try {
      if (useProjectStore.getState().project.id !== selectedProjectId) {
        await loadFromLibrary(selectedProjectId);
      }
      const created = addWidgetFromTemplate(template, selectedNodeId || undefined);
      await saveCurrentToLibrary();
      const targetId = useProjectStore.getState().project.id;
      setMode('dashboard');
      setSelectedWidgetId(created.id);
      onClose();
      navigate(`/editor/${encodeURIComponent(targetId)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const bindMeta = template.bindCatalogKind ? getCatalogItem(template.bindCatalogKind) : undefined;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border-strong bg-bg-panel shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-border-subtle bg-bg-elevated flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutDashboard className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-text-primary truncate">
                应用模板到厂站工程大屏
              </div>
              <div className="text-[11px] text-text-muted truncate">
                模板：{template.name} ({template.defaultSize.w}×{template.defaultSize.h})
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索目标厂站工程名称或站场编码..."
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-text-secondary">
              1. 选择目标厂站工程 ({projectOptions.length})
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {projectOptions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border-subtle text-center text-xs text-text-muted">
                  未找到匹配的厂站工程
                </div>
              ) : (
                projectOptions.map((p) => {
                  const active = selectedProjectId === p.id;
                  const isCurrent = p.id === activeProject.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                        active
                          ? 'border-accent bg-accent-soft/60'
                          : 'border-border-subtle bg-bg-canvas/70 hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FolderOpen className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 truncate">
                            <span className="truncate">{p.name}</span>
                            {isCurrent ? (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[9px] font-normal shrink-0">
                                当前工作区
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] font-mono text-text-muted mt-0.5">
                            {p.stationCode ? `${p.stationCode} · ` : ''}
                            {p.nodeCount} 设备 · {p.widgetCount} 大屏卡片
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                          active
                            ? 'bg-accent border-accent text-slate-950'
                            : 'border-border-subtle text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-text-secondary">
              2. 默认绑定 3D 设备节点（可选）
            </div>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-bg-canvas border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
            >
              <option value="">跟随 3D 画布当前选中设备（推荐通用联动）</option>
              {candidateNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.tag}] {n.name} · {n.section}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted">
              {bindMeta
                ? `该模板预设适配设备「${bindMeta.labelZh}」，已自动为您筛选该厂站内的匹配设备。`
                : '添加后将自动切换到该厂站的大屏编排模式，支持继续拖拽布局与修改绑点。'}
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border-subtle bg-bg-elevated flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded-lg border border-border-subtle bg-bg-panel hover:bg-bg-hover text-xs text-text-secondary"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selectedProjectId || submitting}
            onClick={() => void handleConfirm()}
            className="h-8 px-4 rounded-lg bg-accent hover:brightness-110 disabled:opacity-50 text-slate-950 text-xs font-semibold flex items-center gap-1.5"
          >
            {submitting ? '正在写入大屏...' : '确认添加并进入大屏编排'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplyTemplateProjectModal;
