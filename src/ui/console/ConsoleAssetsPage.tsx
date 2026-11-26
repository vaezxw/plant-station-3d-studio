import { useMemo, useRef, useState, type ChangeEvent, type FC } from 'react';
import { Box, Eye, Plus, Search, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  STUDIO_CATALOG,
  STUDIO_CATEGORIES,
  type CatalogKind,
  type StudioCategoryId,
} from '../../domain/catalog';
import { createDefaultGroundConfig, type ProjectSchema } from '../../domain/schema';
import { importCustomGlbFile } from '../../engine/AssetManager';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { AuthGuard, useHasPerm } from '../components/AuthGuard';
import AssetPreview from '../studio/AssetPreview';
import SingleAssetViewer from './SingleAssetViewer';

type CustomGlbRecord = {
  customGlbId: string;
  name: string;
  uploadedAt: number;
};

const ConsoleAssetsPage: FC = () => {
  const navigate = useNavigate();
  const glbInputRef = useRef<HTMLInputElement>(null);
  const canCreate = useHasPerm('project:create');

  const [category, setCategory] = useState<StudioCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [hoveredKind, setHoveredKind] = useState<CatalogKind | null>(null);
  const [customModels, setCustomModels] = useState<CustomGlbRecord[]>([]);
  const [inspecting, setInspecting] = useState<{
    kind: CatalogKind | 'CUSTOM_GLB';
    customGlbId?: string;
    customName?: string;
  } | null>(null);

  const importProject = useProjectStore((s) => s.importProject);
  const addNodeFromCatalog = useProjectStore((s) => s.addNodeFromCatalog);
  const addCustomGlbNode = useProjectStore((s) => s.addCustomGlbNode);
  const setMode = useEditorStore((s) => s.setMode);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STUDIO_CATALOG.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.labelZh.toLowerCase().includes(q) ||
        item.kind.toLowerCase().includes(q) ||
        item.tagPrefix.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  const handleUploadGlb = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await importCustomGlbFile(file);
      setCustomModels((prev) => [{ ...res, uploadedAt: Date.now() }, ...prev]);
      setInspecting({ kind: 'CUSTOM_GLB', customGlbId: res.customGlbId, customName: res.name });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'GLB 导入失败');
    }
  };

  const createProjectWithInspecting = () => {
    if (!inspecting) return;
    const id = `proj-${Date.now()}`;
    const blank: ProjectSchema = {
      version: 2,
      id,
      name: `${inspecting.customName ?? inspecting.kind} 专场测试`,
      industry: 'custom',
      description: '从 3D 模型资产库直接创建的单设备起步工程',
      themeId: useEditorStore.getState().themeId,
      dashboardTemplate: 'immersive',
      ground: createDefaultGroundConfig(),
      nodes: [],
      pipes: [],
      bookmarks: [],
      updatedAt: Date.now(),
    };
    importProject(blank);
    const created =
      inspecting.kind === 'CUSTOM_GLB' && inspecting.customGlbId
        ? addCustomGlbNode(inspecting.customGlbId, inspecting.customName ?? '自定义模型', [0, 0, 0])
        : addNodeFromCatalog(inspecting.kind as CatalogKind, [0, 0, 0]);
    setSelectedNodeId(created.id);
    setInspecting(null);
    setMode('studio');
    navigate(`/editor/${encodeURIComponent(id)}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Box className="w-5 h-5 text-accent" /> 3D 模型资产库（{STUDIO_CATALOG.length} 类内置 + {customModels.length} 自定义）
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            悬停实时 3D 预览，点击任意设备组件卡片即可进入独立 3D 空间单独渲染与检查管口坐标
          </p>
        </div>

        <AuthGuard perm="asset:upload">
          <button
            type="button"
            onClick={() => glbInputRef.current?.click()}
            className="h-9 px-4 rounded-xl bg-accent text-slate-950 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm hover:brightness-110 transition"
          >
            <Upload className="w-4 h-4" /> 上传本地 .glb 模型预览
          </button>
          <input
            ref={glbInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={(e) => void handleUploadGlb(e)}
          />
        </AuthGuard>
      </div>

      {/* 筛选条 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs border transition ${
              category === 'all'
                ? 'bg-accent text-slate-950 border-transparent font-semibold'
                : 'border-border-subtle bg-bg-panel text-text-secondary hover:text-text-primary'
            }`}
          >
            全部 ({STUDIO_CATALOG.length})
          </button>
          {STUDIO_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                category === c.id
                  ? 'bg-accent text-slate-950 border-transparent font-semibold'
                  : 'border-border-subtle bg-bg-panel text-text-secondary hover:text-text-primary'
              }`}
            >
              {c.labelZh}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模型名称 / 前缀 / 编码..."
            className="h-8 w-56 pl-8 pr-3 rounded-lg bg-bg-panel border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
          />
        </div>
      </div>

      {/* 自定义上传的模型 */}
      {customModels.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-accent">本次上传的自定义 GLB 模型 ({customModels.length})</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {customModels.map((cm) => (
              <button
                key={cm.customGlbId}
                type="button"
                onClick={() =>
                  setInspecting({ kind: 'CUSTOM_GLB', customGlbId: cm.customGlbId, customName: cm.name })
                }
                className="text-left p-3 rounded-xl border border-border-strong bg-bg-panel hover:bg-bg-hover/40 transition space-y-2"
              >
                <div className="h-24 rounded-lg bg-slate-950/90 border border-border-subtle flex flex-col items-center justify-center gap-1 text-accent">
                  <Box className="w-7 h-7" />
                  <span className="text-[10px] font-mono">CUSTOM_GLB</span>
                </div>
                <div className="text-xs font-semibold text-text-primary truncate">{cm.name}</div>
                <div className="text-[10px] text-accent flex items-center gap-1">
                  <Eye className="w-3 h-3" /> 点击进入 3D 空间检视
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 内置 3D 模型缩略图画廊 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((item) => (
          <div
            key={item.kind}
            onMouseEnter={() => setHoveredKind(item.kind)}
            onMouseLeave={() => setHoveredKind((k) => (k === item.kind ? null : k))}
            onClick={() => setInspecting({ kind: item.kind })}
            className="cursor-pointer rounded-2xl border border-border-subtle bg-bg-panel hover:border-border-strong p-3 flex flex-col justify-between gap-2.5 transition group shadow-sm"
          >
            <div className="relative">
              <AssetPreview
                kind={item.kind}
                alt={item.labelZh}
                hovered={hoveredKind === item.kind}
                className="h-28"
              />
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 border border-border-subtle font-mono text-[10px] text-accent">
                {item.tagPrefix}
              </span>
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] text-sky-300 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                <Eye className="w-3 h-3" /> 3D 空间
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-text-primary truncate">{item.labelZh}</span>
              </div>
              <p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[10px] text-text-muted">
              <span>{item.defaultSection}</span>
              <span className="text-accent flex items-center gap-0.5 font-medium">
                <Plus className="w-3 h-3" /> 单独渲染
              </span>
            </div>
          </div>
        ))}
      </div>

      {inspecting ? (
        <SingleAssetViewer
          kind={inspecting.kind}
          customGlbId={inspecting.customGlbId}
          customName={inspecting.customName}
          onClose={() => setInspecting(null)}
          onCreateProjectWithAsset={canCreate ? createProjectWithInspecting : undefined}
        />
      ) : null}
    </div>
  );
};

export default ConsoleAssetsPage;
