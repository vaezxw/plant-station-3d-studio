import { useRef, type ChangeEvent, type FC } from 'react';
import {
  ArrowLeft,
  Box,
  Cable,
  Database,
  Download,
  FileOutput,
  FolderKanban,
  LayoutDashboard,
  Lock,
  Magnet,
  Maximize2,
  MousePointer,
  Move,
  Palette,
  Redo2,
  Rocket,
  RotateCw,
  Save,
  Scaling,
  Undo2,
  Unlock,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ProjectSchema, StudioMode, TransformTool } from '../../domain/schema';
import { BUILTIN_THEMES } from '../../domain/themes';
import { captureProjectCompositeSnapshot } from '../../engine/CompositeThumbnail';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useHasPerm } from './AuthGuard';

const MODE_ITEMS: { id: StudioMode; label: string; icon: typeof Box }[] = [
  { id: 'templates', label: '模板中心', icon: FolderKanban },
  { id: 'studio', label: '3D 搭建', icon: Box },
  { id: 'dashboard', label: '大屏编排', icon: LayoutDashboard },
  { id: 'present', label: '全屏演示', icon: Maximize2 },
];

const TOOL_ITEMS: { id: TransformTool; label: string; shortcut: string; icon: typeof MousePointer }[] = [
  { id: 'select', label: '选择', shortcut: 'Q', icon: MousePointer },
  { id: 'move', label: '移动', shortcut: 'W', icon: Move },
  { id: 'rotate', label: '旋转', shortcut: 'E', icon: RotateCw },
  { id: 'scale', label: '缩放', shortcut: 'R', icon: Scaling },
  { id: 'pipe', label: '连管', shortcut: 'P', icon: Cable },
];

const TopNav: FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = useHasPerm('project:edit');
  const canPublish = useHasPerm('scene:publish');
  const canDs = useHasPerm('datasource:manage');

  const project = useProjectStore((s) => s.project);
  const pastCount = useProjectStore((s) => s.past.length);
  const futureCount = useProjectStore((s) => s.future.length);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const saveCurrentToLibrary = useProjectStore((s) => s.saveCurrentToLibrary);
  const importProject = useProjectStore((s) => s.importProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const mode = useEditorStore((s) => s.mode);
  const tool = useEditorStore((s) => s.tool);
  const pipeMedium = useEditorStore((s) => s.pipeMedium);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const canvasLocked = useEditorStore((s) => s.canvasLocked);
  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);

  const setMode = useEditorStore((s) => s.setMode);
  const setTool = useEditorStore((s) => s.setTool);
  const setPipeMedium = useEditorStore((s) => s.setPipeMedium);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const toggleCanvasLock = useEditorStore((s) => s.toggleCanvasLock);
  const setThemeId = useEditorStore((s) => s.setThemeId);
  const setThemeModalOpen = useEditorStore((s) => s.setThemeModalOpen);
  const setDataSourceModalOpen = useEditorStore((s) => s.setDataSourceModalOpen);
  const setPublishModalOpen = useEditorStore((s) => s.setPublishModalOpen);

  if (mode === 'present') return null;

  const allThemes = [...BUILTIN_THEMES, ...customThemes];

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'plant-project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ProjectSchema;
      importProject(parsed);
      setMode('studio');
    } catch {
      window.alert('JSON 工程文件格式无效');
    }
  };

  return (
    <header className="h-12 shrink-0 px-2.5 flex items-center justify-between gap-2 border-b border-border-subtle bg-bg-elevated select-none z-20 overflow-x-auto">
      {/* 左侧返回控制台 + 品牌与工程名称 */}
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <button
          type="button"
          onClick={() => {
            void captureProjectCompositeSnapshot(project).then((shot) => {
              if (shot) updateProjectMeta({ thumbnailDataUrl: shot });
              navigate('/console/home');
            });
          }}
          title="返回平台首页控制台"
          className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1 shrink-0 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-accent" />
          <span className="hidden lg:inline">控制台</span>
        </button>
        <div className="w-7 h-7 rounded-md bg-accent-soft border border-border-strong flex items-center justify-center text-accent font-mono font-bold text-xs shrink-0">
          3D
        </div>
        <input
          value={project.name}
          onChange={(e) => updateProjectMeta({ name: e.target.value })}
          className="bg-transparent text-xs xl:text-sm font-semibold text-text-primary focus:outline-none focus:bg-bg-hover px-1.5 py-0.5 rounded w-20 xl:w-32 truncate border border-transparent focus:border-border-strong"
          title="点击修改工程名称"
        />
      </div>

      {/* 中部工作模式切换 */}
      <nav className="flex items-center gap-0.5 p-0.5 rounded-lg bg-bg-canvas/70 border border-border-subtle shrink-0">
        {MODE_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`px-1.5 xl:px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                active
                  ? 'bg-accent text-slate-950 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* 中右：Studio 变换工具栏 */}
      {mode === 'studio' ? (
        <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-bg-canvas/60 border border-border-subtle shrink-0">
          {TOOL_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTool(item.id)}
                title={`${item.label} (${item.shortcut})`}
                className={`p-1.5 rounded text-xs flex items-center gap-1 shrink-0 transition ${
                  active
                    ? 'bg-accent-soft text-accent border border-border-strong'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
          <div className="w-px h-4 bg-border-subtle mx-0.5" />
          <button
            type="button"
            onClick={toggleSnap}
            title="网格吸附 (0.25m / 15°)"
            className={`p-1.5 rounded text-xs flex items-center gap-1 shrink-0 transition ${
              snapEnabled
                ? 'bg-accent-soft text-accent border border-border-strong'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleCanvasLock}
            title={canvasLocked ? '点击解锁画布编辑' : '锁定画布（仅放大旋转预览）'}
            className={`p-1.5 rounded text-xs flex items-center gap-1 shrink-0 transition ${
              canvasLocked
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
            }`}
          >
            {canvasLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            disabled={pastCount === 0}
            onClick={undo}
            title="撤销 (Ctrl+Z)"
            className="p-1.5 rounded shrink-0 text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={futureCount === 0}
            onClick={redo}
            title="重做 (Ctrl+Y)"
            className="p-1.5 rounded shrink-0 text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          {tool === 'pipe' ? (
            <>
              <div className="w-px h-4 bg-border-subtle mx-0.5" />
              <select
                value={pipeMedium}
                onChange={(e) => setPipeMedium(e.target.value as 'gas' | 'water' | 'air')}
                className="h-6 px-1.5 rounded bg-bg-canvas border border-border-strong text-[11px] text-accent focus:outline-none"
                title="管道输送介质"
              >
                <option value="gas">燃气</option>
                <option value="water">水务</option>
                <option value="air">气源</option>
              </select>
            </>
          ) : null}
        </div>
      ) : null}

      {/* 右侧：发布、主题与工程保存导出 */}
      <div className="flex items-center gap-1 shrink-0">
        {canPublish ? (
          <button
            type="button"
            onClick={() => setPublishModalOpen(true)}
            title="发布 3D 大屏并生成 SCADA 嵌入预览链接"
            className="h-7 px-2.5 rounded border border-border-strong bg-accent hover:brightness-110 text-slate-950 text-xs font-semibold flex items-center gap-1 shadow-sm transition shrink-0"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>发布预览</span>
          </button>
        ) : null}

        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          className="hidden xl:block h-7 max-w-[136px] px-1.5 rounded bg-bg-canvas border border-border-subtle text-xs text-text-secondary focus:outline-none focus:border-border-strong truncate"
          title="切换主题风格"
        >
          {allThemes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {canDs ? (
          <button
            type="button"
            onClick={() => setDataSourceModalOpen(true)}
            title="SCADA 数据源接入配置"
            className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition shrink-0"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">数据源</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setThemeModalOpen(true)}
          title="自定义设计主题风格"
          className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition shrink-0"
        >
          <Palette className="w-3.5 h-3.5 text-accent" />
          <span className="hidden xl:inline">自定义主题</span>
        </button>

        {canEdit ? (
          <button
            type="button"
            onClick={() => void saveCurrentToLibrary()}
            title="保存到本地工程库"
            className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">保存</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="导入 JSON 工程"
          className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center"
        >
          <Upload className="w-3.5 h-3.5" />
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
          onClick={handleExportJson}
          title="导出 JSON 工程模板"
          className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('studio:export-glb'))}
          title="将整套搭建好的 3D 厂站导出为 .glb 模型"
          className="h-7 px-2 rounded border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
        >
          <FileOutput className="w-3.5 h-3.5 text-accent" />
          <span className="hidden xl:inline">导出 GLB</span>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
