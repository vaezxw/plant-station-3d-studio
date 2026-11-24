import { useMemo, useRef, useState, type ChangeEvent, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileBox,
  Layers,
  Lock,
  PackagePlus,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  STUDIO_CATALOG,
  STUDIO_CATEGORIES,
  type CatalogKind,
  type StudioCategoryId,
} from '../../domain/catalog';
import { importCustomGlbFile } from '../../engine/AssetManager';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import AssetPreview from './AssetPreview';

const LeftPanel: FC = () => {
  const glbInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<StudioCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [hoveredKind, setHoveredKind] = useState<CatalogKind | null>(null);
  const [dragLabel, setDragLabel] = useState<{ text: string; x: number; y: number } | null>(null);

  const nodes = useProjectStore((s) => s.project.nodes);
  const addNodeFromCatalog = useProjectStore((s) => s.addNodeFromCatalog);
  const addCustomGlbNode = useProjectStore((s) => s.addCustomGlbNode);
  const updateNode = useProjectStore((s) => s.updateNode);
  const removeNode = useProjectStore((s) => s.removeNode);

  const leftTab = useEditorStore((s) => s.leftTab);
  const leftPanelOpen = useEditorStore((s) => s.leftPanelOpen);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const canvasLocked = useEditorStore((s) => s.canvasLocked);

  const setLeftTab = useEditorStore((s) => s.setLeftTab);
  const setLeftPanelOpen = useEditorStore((s) => s.setLeftPanelOpen);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const setDraggingCatalogKind = useEditorStore((s) => s.setDraggingCatalogKind);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STUDIO_CATALOG.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.labelZh.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.kind.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  if (!leftPanelOpen) {
    return (
      <button
        type="button"
        onClick={() => setLeftPanelOpen(true)}
        className="absolute left-3 top-3 z-20 studio-glass px-2.5 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 shadow-lg"
        title="展开资产库与大纲"
      >
        <ChevronRight className="w-4 h-4 text-accent" />
        <span>资产库</span>
      </button>
    );
  }

  const startDrag = (kind: CatalogKind, labelZh: string, placeY: number, e: ReactPointerEvent) => {
    if (canvasLocked) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        moved = true;
        setDraggingCatalogKind(kind);
      }
      if (moved) {
        setDragLabel({ text: labelZh, x: ev.clientX, y: ev.clientY });
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDraggingCatalogKind(null);
      setDragLabel(null);

      if (!moved) {
        // 单击直接快速放在画布中心附近偏移位置
        const offset = (nodes.length % 5) * 0.5 - 1.0;
        const created = addNodeFromCatalog(kind, [offset, placeY, 0]);
        setSelectedNodeId(created.id);
        return;
      }

      window.dispatchEvent(
        new CustomEvent('studio:drop-catalog', {
          detail: { kind, clientX: ev.clientX, clientY: ev.clientY },
        }),
      );
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleImportGlb = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { customGlbId, name } = await importCustomGlbFile(file);
      const created = addCustomGlbNode(customGlbId, name, [0, 0, 0]);
      setSelectedNodeId(created.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'GLB 导入失败');
    }
  };

  return (
    <aside className="w-64 xl:w-72 shrink-0 h-full border-r border-border-subtle bg-bg-panel flex flex-col z-10 select-none">
      {/* 面板头：Tab 切换 + 折叠 */}
      <div className="h-10 px-2.5 border-b border-border-subtle flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-bg-canvas/70 p-0.5 rounded-md border border-border-subtle">
          <button
            type="button"
            onClick={() => setLeftTab('assets')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${
              leftTab === 'assets'
                ? 'bg-accent-soft text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" /> 资产库
          </button>
          <button
            type="button"
            onClick={() => setLeftTab('outline')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${
              leftTab === 'outline'
                ? 'bg-accent-soft text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> 大纲 ({nodes.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLeftPanelOpen(false)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="收起左侧面板"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {leftTab === 'assets' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* 搜索框 */}
          <div className="p-2.5 pb-2 space-y-2 border-b border-border-subtle shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索燃气表 / 阀门 / 报警 / 水泵..."
                className="w-full h-8 pl-8 pr-2.5 rounded-md bg-bg-canvas border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
              />
            </div>

            {/* 行业分类筛选 */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`px-2 py-0.5 rounded text-[11px] border transition ${
                  category === 'all'
                    ? 'bg-accent-soft border-border-strong text-accent font-medium'
                    : 'bg-bg-canvas/60 border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                全部 ({STUDIO_CATALOG.length})
              </button>
              {STUDIO_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition ${
                    category === c.id
                      ? 'bg-accent-soft border-border-strong text-accent font-medium'
                      : 'bg-bg-canvas/60 border-border-subtle text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {c.labelZh}
                </button>
              ))}
            </div>
          </div>

          {/* 资产卡片网格 */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
            <div className="text-[11px] text-text-muted mb-2">
              {canvasLocked
                ? '画布已锁定（仅可旋转预览，解锁后可拖入设备）'
                : '悬停可预览 3D 旋转 · 拖入画布或单击放置'}
            </div>
            <div className={`grid grid-cols-2 gap-2 ${canvasLocked ? 'opacity-50 pointer-events-none' : ''}`}>
              {filteredItems.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onPointerEnter={() => setHoveredKind(item.kind)}
                  onPointerLeave={() =>
                    setHoveredKind((prev) => (prev === item.kind ? null : prev))
                  }
                  onPointerDown={(e) => startDrag(item.kind, item.labelZh, item.placeY, e)}
                  title={item.description}
                  className="group p-1.5 rounded-lg border border-border-subtle bg-bg-canvas/65 hover:bg-bg-hover hover:border-border-strong text-left transition flex flex-col gap-1.5 cursor-grab active:cursor-grabbing"
                >
                  <AssetPreview
                    kind={item.kind}
                    alt={item.labelZh}
                    hovered={hoveredKind === item.kind}
                  />
                  <div className="px-0.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium text-text-primary truncate group-hover:text-accent">
                      {item.labelZh}
                    </span>
                    <span className="text-[9px] font-mono text-text-muted shrink-0">
                      {item.tagPrefix}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 底部自定义 GLB 导入 */}
          <div className="p-2.5 border-t border-border-subtle shrink-0">
            <button
              type="button"
              onClick={() => glbInputRef.current?.click()}
              className="w-full h-8 rounded-md border border-dashed border-border-strong bg-accent-soft/50 hover:bg-accent-soft text-xs text-accent font-medium flex items-center justify-center gap-1.5 transition"
            >
              <FileBox className="w-3.5 h-3.5" /> 导入本地 .glb 模型
            </button>
            <input
              ref={glbInputRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => void handleImportGlb(e)}
            />
          </div>
        </div>
      ) : (
        /* 大纲视图 */
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {nodes.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-muted">
              当前画布为空，请从「资产库」拖入设备模型。
            </div>
          ) : (
            nodes.map((node) => {
              const selected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    triggerCameraView('focus');
                  }}
                  className={`px-2.5 py-1.5 rounded-md border flex items-center justify-between gap-2 cursor-pointer transition ${
                    selected
                      ? 'bg-accent-soft border-border-strong'
                      : 'bg-bg-canvas/40 border-transparent hover:bg-bg-hover'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">{node.name}</div>
                    <div className="text-[10px] font-mono text-text-muted truncate">
                      {node.tag} · {node.section}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => updateNode(node.id, { visible: !node.visible }, true)}
                      className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary"
                      title={node.visible ? '隐藏' : '显示'}
                    >
                      {node.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateNode(node.id, { locked: !node.locked }, true)}
                      className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary"
                      title={node.locked ? '解锁' : '锁定位置'}
                    >
                      {node.locked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeNode(node.id);
                        if (selectedNodeId === node.id) setSelectedNodeId(null);
                      }}
                      className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 拖放鼠标跟随气泡 */}
      {dragLabel ? (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1 rounded-full bg-accent text-slate-950 text-xs font-semibold shadow-xl"
          style={{ left: dragLabel.x + 14, top: dragLabel.y + 14 }}
        >
          放置：{dragLabel.text}
        </div>
      ) : null}
    </aside>
  );
};

export default LeftPanel;
