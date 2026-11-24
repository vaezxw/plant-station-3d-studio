import { useMemo, useState, type FC, type RefObject } from 'react';
import {
  Camera,
  Eye,
  EyeOff,
  GripHorizontal,
  Layout,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
} from 'lucide-react';
import { GridLayout, noCompactor, useContainerWidth, type Layout as RglLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  createWidgetsForTemplate,
  type DashboardTemplateId,
  type DashboardWidgetConfig,
} from '../../domain/schema';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { WidgetRenderer } from './widgets';

const DASHBOARD_TEMPLATES: { id: DashboardTemplateId; label: string }[] = [
  { id: 'immersive', label: '沉浸悬浮大屏' },
  { id: 'command', label: '指挥中心分栏' },
  { id: 'minimal', label: '极简汇报演示' },
];

const DashboardOverlay: FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const project = useProjectStore((s) => s.project);
  const setDashboardTemplate = useProjectStore((s) => s.setDashboardTemplate);
  const setDashboardWidgets = useProjectStore((s) => s.setDashboardWidgets);
  const removeBookmark = useProjectStore((s) => s.removeBookmark);

  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const triggerBookmark = useEditorStore((s) => s.triggerBookmark);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const simRunning = useTelemetryStore((s) => s.simRunning);
  const toggleSim = useTelemetryStore((s) => s.toggleSim);

  const isEditing = mode === 'dashboard';
  const tpl = project.dashboardTemplate;

  const widgets = useMemo<DashboardWidgetConfig[]>(
    () => project.dashboardWidgets ?? createWidgetsForTemplate(tpl),
    [project.dashboardWidgets, tpl],
  );

  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);

  const rglLayout = useMemo<RglLayout>(
    () =>
      visibleWidgets.map((w) => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: 2,
        minH: 3,
      })),
    [visibleWidgets],
  );

  const handleLayoutChange = (nextLayout: RglLayout) => {
    if (!isEditing) return;
    const byId = new Map(nextLayout.map((item) => [item.i, item]));
    const updated = widgets.map((w) => {
      const hit = byId.get(w.id);
      return hit ? { ...w, x: hit.x, y: hit.y, w: hit.w, h: hit.h } : w;
    });
    setDashboardWidgets(updated);
  };

  const toggleWidgetVisibility = (id: string) => {
    setDashboardWidgets(
      widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    );
  };

  const handleCaptureBookmark = () => {
    const name = window.prompt('输入当前 3D 视角书签名称：', `巡检视角 ${project.bookmarks.length + 1}`);
    if (name === null) return;
    window.dispatchEvent(new CustomEvent('studio:capture-bookmark', { detail: { name } }));
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 gap-2">
      {/* 顶部大屏编排工具条或全屏演示标题 */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        {mode === 'present' ? (
          <div className="pointer-events-auto studio-glass rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold tracking-wide text-text-primary">{project.name}</span>
            <span className="text-xs text-text-muted font-mono">3D 数字孪生实时监视 · 只读</span>
          </div>
        ) : (
          <div className="pointer-events-auto studio-glass rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-xl flex-wrap">
            <Layout className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-text-secondary">布局模板:</span>
            {DASHBOARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDashboardTemplate(t.id)}
                className={`px-2 py-1 rounded-md text-xs transition ${
                  tpl === t.id
                    ? 'bg-accent text-slate-950 font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="w-px h-4 bg-border-subtle mx-1" />
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition ${
                drawerOpen
                  ? 'bg-accent-soft text-accent border border-border-strong'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> 卡片管理 ({visibleWidgets.length}/{widgets.length})
            </button>
            <button
              type="button"
              onClick={() => setDashboardWidgets(createWidgetsForTemplate(tpl))}
              title="恢复当前模板默认卡片位置"
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSim}
            className="studio-glass px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 shadow-lg"
          >
            {simRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 text-accent" /> 仿真运行中
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-400" /> 仿真暂停
              </>
            )}
          </button>

          {mode === 'present' ? (
            <button
              type="button"
              onClick={() => setMode('dashboard')}
              className="studio-glass px-3 py-1.5 rounded-lg text-xs text-text-primary hover:bg-bg-hover flex items-center gap-1.5 shadow-lg"
            >
              <Minimize2 className="w-3.5 h-3.5 text-accent" /> 退出演示
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('studio')}
              className="studio-glass px-3 py-1.5 rounded-lg text-xs text-text-primary hover:bg-bg-hover flex items-center gap-1.5 shadow-lg"
            >
              <Sliders className="w-3.5 h-3.5 text-accent" /> 返回 3D 搭建
            </button>
          )}
        </div>
      </div>

      {/* 卡片管理浮层抽屉（仅编辑态展开） */}
      {isEditing && drawerOpen ? (
        <div className="pointer-events-auto self-start studio-glass rounded-xl p-3 shadow-2xl border border-border-strong flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-secondary mr-1">显示/隐藏卡片：</span>
          {widgets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => toggleWidgetVisibility(w.id)}
              className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 border transition ${
                w.visible
                  ? 'bg-accent-soft border-border-strong text-accent'
                  : 'bg-bg-canvas/70 border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              {w.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {w.title}
            </button>
          ))}
          <span className="text-[11px] text-text-muted ml-2">
            提示：拖动卡片标题栏调整位置，拖动右下角调整尺寸，空白区域可自由旋转 3D 场景
          </span>
        </div>
      ) : null}

      {/* 中部自由拖拽网格（透明背景，空白处穿透到 3D 场景） */}
      <div ref={containerRef as RefObject<HTMLDivElement>} className="flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden">
        {mounted && visibleWidgets.length > 0 ? (
          <GridLayout
            className="dashboard-rgl"
            width={width}
            layout={rglLayout}
            compactor={noCompactor}
            gridConfig={{
              cols: 12,
              rowHeight: 46,
              margin: [12, 12],
              containerPadding: [0, 0],
            }}
            dragConfig={{
              enabled: isEditing,
              handle: '.rgl-drag-handle',
            }}
            resizeConfig={{
              enabled: isEditing,
            }}
            onLayoutChange={handleLayoutChange}
          >
            {visibleWidgets.map((w) => (
              <div
                key={w.id}
                className={`studio-glass rounded-xl flex flex-col overflow-hidden shadow-xl ${
                  isEditing ? 'border-border-strong/60' : 'border-border-subtle'
                }`}
              >
                <div
                  className={`h-8 px-3 border-b border-border-subtle flex items-center justify-between shrink-0 ${
                    isEditing ? 'rgl-drag-handle cursor-grab active:cursor-grabbing bg-bg-elevated/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isEditing ? <GripHorizontal className="w-3.5 h-3.5 text-text-muted shrink-0" /> : null}
                    <span className="text-xs font-semibold text-accent truncate">{w.title}</span>
                  </div>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWidgetVisibility(w.id);
                      }}
                      className="p-0.5 rounded text-text-muted hover:text-text-primary"
                      title="隐藏此卡片"
                    >
                      <EyeOff className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
                <div className="flex-1 min-h-0 p-3 overflow-hidden">
                  <WidgetRenderer type={w.type} />
                </div>
              </div>
            ))}
          </GridLayout>
        ) : null}
      </div>

      {/* 底部居中：视角书签巡检条 + 录制当前视角 */}
      <div className="flex justify-center shrink-0">
        <div className="pointer-events-auto studio-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-xl max-w-full overflow-x-auto whitespace-nowrap">
          <Camera className="w-3.5 h-3.5 text-accent ml-1 shrink-0" />
          <span className="text-[11px] text-text-muted mr-1 shrink-0">视角巡检:</span>
          <button
            type="button"
            onClick={() => triggerCameraView('iso')}
            className="px-2.5 py-1 rounded-full text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition shrink-0"
          >
            默认全局
          </button>
          {project.bookmarks.map((bm) => (
            <div key={bm.id} className="flex items-center group shrink-0">
              <button
                type="button"
                onClick={() => triggerBookmark(bm)}
                className="px-2.5 py-1 rounded-full text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition"
              >
                {bm.name}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => removeBookmark(bm.id)}
                  className="p-0.5 rounded-full text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  title="删除书签"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          ))}
          {isEditing ? (
            <button
              type="button"
              onClick={handleCaptureBookmark}
              className="ml-1 px-2.5 py-1 rounded-full bg-accent-soft border border-border-strong text-xs text-accent flex items-center gap-1 hover:bg-accent hover:text-slate-950 transition shrink-0"
              title="将当前 3D 视口角度保存为巡检书签"
            >
              <Plus className="w-3 h-3" /> 记录当前视角
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverlay;
