import { useMemo, type FC, type RefObject } from 'react';
import {
  Camera,
  Database,
  EyeOff,
  GripHorizontal,
  Layout,
  Lock,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  Unlock,
} from 'lucide-react';
import { GridLayout, noCompactor, useContainerWidth, type Layout as RglLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  createWidgetsForTemplate,
  normalizeWidgetsTo24Cols,
  type DashboardTemplateId,
  type DashboardWidgetConfig,
} from '../../domain/schema';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import DashboardInspector from './DashboardInspector';
import DashboardLeftPanel from './DashboardLeftPanel';
import { WidgetRenderer } from './widgets';

const DASHBOARD_TEMPLATES: { id: DashboardTemplateId; label: string }[] = [
  { id: 'immersive', label: '沉浸悬浮' },
  { id: 'command', label: '指挥分栏' },
  { id: 'minimal', label: '极简演示' },
];

const DashboardOverlay: FC = () => {
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 960 });

  const project = useProjectStore((s) => s.project);
  const setDashboardTemplate = useProjectStore((s) => s.setDashboardTemplate);
  const setDashboardWidgets = useProjectStore((s) => s.setDashboardWidgets);
  const updateDashboardWidget = useProjectStore((s) => s.updateDashboardWidget);
  const removeBookmark = useProjectStore((s) => s.removeBookmark);

  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const runtimeLockedPreview = useEditorStore((s) => s.runtimeLockedPreview);
  const runtimeHideChrome = useEditorStore((s) => s.runtimeHideChrome);
  const selectedWidgetId = useEditorStore((s) => s.selectedWidgetId);
  const dashboardSceneLock = useEditorStore((s) => s.dashboardSceneLock);
  const setSelectedWidgetId = useEditorStore((s) => s.setSelectedWidgetId);
  const toggleDashboardSceneLock = useEditorStore((s) => s.toggleDashboardSceneLock);
  const setDataSourceModalOpen = useEditorStore((s) => s.setDataSourceModalOpen);
  const triggerBookmark = useEditorStore((s) => s.triggerBookmark);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);
  const dispatchSceneAction = useEditorStore((s) => s.dispatchSceneAction);

  const simRunning = useTelemetryStore((s) => s.simRunning);
  const dataFeedMode = useTelemetryStore((s) => s.dataFeedMode);
  const bridgeStatus = useTelemetryStore((s) => s.bridgeStatus);
  const toggleSim = useTelemetryStore((s) => s.toggleSim);

  const isEditing = mode === 'dashboard';
  const tpl = project.dashboardTemplate;

  const widgets = useMemo<DashboardWidgetConfig[]>(
    () =>
      normalizeWidgetsTo24Cols(
        project.dashboardWidgets ?? createWidgetsForTemplate(tpl),
      ),
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
        minW: 5,
        minH: 5,
        static: Boolean(w.locked),
      })),
    [visibleWidgets],
  );

  const handleLayoutChange = (nextLayout: RglLayout) => {
    if (!isEditing) return;
    const byId = new Map(nextLayout.map((item) => [item.i, item]));
    let changed = false;
    const updated = widgets.map((w) => {
      const hit = byId.get(w.id);
      if (!hit) return w;
      if (hit.x !== w.x || hit.y !== w.y || hit.w !== w.w || hit.h !== w.h) {
        changed = true;
        return { ...w, x: hit.x, y: hit.y, w: hit.w, h: hit.h, gridCols: 24 as const };
      }
      return w;
    });
    if (changed) setDashboardWidgets(updated);
  };

  const handleCaptureBookmark = () => {
    const name = window.prompt('输入当前 3D 视角书签名称：', `巡检视角 ${project.bookmarks.length + 1}`);
    if (name === null) return;
    window.dispatchEvent(new CustomEvent('studio:capture-bookmark', { detail: { name } }));
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex p-2.5 gap-2.5 overflow-hidden">
      {isEditing ? <DashboardLeftPanel /> : null}

      {/* 中区：顶部条 + 24 列透传自由网格 + 底部视角书签 */}
      <div className="flex-1 min-w-0 h-full flex flex-col justify-between gap-2 pointer-events-none">
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          {mode === 'present' ? (
            <div className="pointer-events-auto studio-glass rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl">
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  dataFeedMode === 'bridge'
                    ? bridgeStatus.connected && bridgeStatus.packetCount > 0
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="text-sm font-bold tracking-wide text-text-primary">{project.name}</span>
              {project.stationCode ? (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono">
                  {project.stationCode}
                </span>
              ) : null}
              <span className="text-xs text-text-muted font-mono">
                {dataFeedMode === 'bridge'
                  ? bridgeStatus.packetCount > 0
                    ? `SCADA 桥接实时 · ${bridgeStatus.packetCount} 帧`
                    : 'SCADA 桥接就绪 · 等待宿主推流'
                  : dataFeedMode === 'direct'
                    ? '外部直连监视 · 只读'
                    : '3D 数字孪生实时监视 · 只读'}
              </span>
            </div>
          ) : (
            <div className="pointer-events-auto studio-glass rounded-xl px-2.5 py-1.5 flex items-center gap-1 shadow-xl flex-wrap">
              <Layout className="w-3.5 h-3.5 text-accent" />
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
              <div className="w-px h-4 bg-border-subtle mx-0.5" />
              <button
                type="button"
                onClick={() => setDataSourceModalOpen(true)}
                className="px-2 py-1 rounded-md text-xs text-text-secondary hover:text-accent hover:bg-bg-hover flex items-center gap-1 transition"
                title="配置 SCADA HTTP / WebSocket 外部数据源"
              >
                <Database className="w-3.5 h-3.5 text-accent" /> 数据源
              </button>
              <button
                type="button"
                onClick={toggleDashboardSceneLock}
                className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 transition ${
                  dashboardSceneLock
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
                title="锁定底层 3D 视角，防止拖放卡片时误转动"
              >
                {dashboardSceneLock ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                <span>{dashboardSceneLock ? '3D已锁' : '锁3D'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardWidgets(createWidgetsForTemplate(tpl))}
                title="恢复当前模板默认布局"
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="pointer-events-auto flex items-center gap-1.5">
            {dataFeedMode !== 'bridge' && !(runtimeLockedPreview && mode === 'present') ? (
              <button
                type="button"
                onClick={toggleSim}
                className="studio-glass px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 shadow-lg"
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
            ) : null}

            {mode === 'present' ? (
              runtimeLockedPreview ? null : (
                <button
                  type="button"
                  onClick={() => setMode('dashboard')}
                  className="studio-glass px-3 py-1.5 rounded-lg text-xs text-text-primary hover:bg-bg-hover flex items-center gap-1.5 shadow-lg"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-accent" /> 退出演示
                </button>
              )
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

        {/* 中部 24 列自由拖拽网格（空白处透传 3D 操作） */}
        <div
          ref={containerRef as RefObject<HTMLDivElement>}
          onClick={(e) => {
            if (isEditing && e.target === e.currentTarget) {
              setSelectedWidgetId(null);
            }
          }}
          className="flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden"
        >
          {mounted && visibleWidgets.length > 0 ? (
            <GridLayout
              className="dashboard-rgl"
              width={width}
              layout={rglLayout}
              compactor={noCompactor}
              gridConfig={{
                cols: 24,
                rowHeight: 34,
                margin: [10, 10],
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
              {visibleWidgets.map((w) => {
                const isSel = isEditing && selectedWidgetId === w.id;
                const cs = w.cardStyle;
                const boxStyle = {
                  backgroundColor: cs?.background || undefined,
                  borderColor: cs?.borderColor || undefined,
                  borderRadius: cs?.borderRadius !== undefined ? `${cs.borderRadius}px` : undefined,
                  backdropFilter: cs?.blurPx !== undefined ? `blur(${cs.blurPx}px)` : undefined,
                };
                return (
                  <div
                    key={w.id}
                    data-drop-widget-id={w.id}
                    onClick={() => {
                      if (isEditing) {
                        setSelectedWidgetId(w.id);
                      } else if (w.sceneBinding?.clickAction && w.sceneBinding.clickAction.type !== 'none') {
                        dispatchSceneAction(w.sceneBinding.clickAction);
                      } else if (w.sceneBinding?.targetNodeId) {
                        dispatchSceneAction({ type: 'focus-node', nodeId: w.sceneBinding.targetNodeId });
                      }
                    }}
                    style={boxStyle}
                    className={`studio-glass rounded-xl flex flex-col overflow-hidden shadow-xl transition ${
                      isSel
                        ? 'ring-2 ring-accent border-border-strong'
                        : isEditing
                          ? 'border-border-strong/60 hover:border-border-strong'
                          : 'border-border-subtle'
                    }`}
                  >
                    {w.showHeader !== false || isEditing ? (
                      <div
                        className={`h-7 px-2.5 border-b border-border-subtle flex items-center justify-between shrink-0 ${
                          isEditing ? 'rgl-drag-handle cursor-grab active:cursor-grabbing bg-bg-elevated/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isEditing ? <GripHorizontal className="w-3.5 h-3.5 text-text-muted shrink-0" /> : null}
                          <span className="text-[11px] font-semibold text-accent truncate">{w.title}</span>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-0.5">
                            {w.locked ? <Lock className="w-3 h-3 text-amber-400 mr-0.5" /> : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateDashboardWidget(w.id, { visible: false }, true);
                              }}
                              className="p-0.5 rounded text-text-muted hover:text-text-primary"
                              title="隐藏此卡片"
                            >
                              <EyeOff className="w-3 h-3" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex-1 min-h-0 p-2.5 overflow-y-auto overflow-x-hidden">
                      <WidgetRenderer widget={w} isEditing={isEditing} />
                    </div>
                  </div>
                );
              })}
            </GridLayout>
          ) : isEditing ? (
            <div className="pointer-events-none h-full flex items-center justify-center">
              <div className="studio-glass px-4 py-2 rounded-full text-xs text-text-muted border border-border-subtle">
                从左侧「物料」或「模板」库添加大屏卡片
              </div>
            </div>
          ) : null}
        </div>

        {/* 底部居中：视角书签巡检条 */}
        {!runtimeHideChrome ? (
          <div className="flex justify-center shrink-0">
            <div className="pointer-events-auto studio-glass rounded-full px-3 py-1 flex items-center gap-1.5 shadow-xl max-w-full overflow-x-auto whitespace-nowrap">
            <Camera className="w-3.5 h-3.5 text-accent ml-1 shrink-0" />
            <span className="text-[11px] text-text-muted mr-1 shrink-0">视角巡检:</span>
            <button
              type="button"
              onClick={() => triggerCameraView('iso')}
              className="px-2 py-0.5 rounded-full text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition shrink-0"
            >
              默认全局
            </button>
            {project.bookmarks.map((bm) => (
              <div key={bm.id} className="flex items-center group shrink-0">
                <button
                  type="button"
                  onClick={() => triggerBookmark(bm)}
                  className="px-2 py-0.5 rounded-full text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition"
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
                className="ml-1 px-2.5 py-0.5 rounded-full bg-accent-soft border border-border-strong text-xs text-accent flex items-center gap-1 hover:bg-accent hover:text-slate-950 transition shrink-0"
                title="将当前 3D 视口角度保存为巡检书签"
              >
                <Plus className="w-3 h-3" /> 记录当前视角
              </button>
            ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {isEditing ? <DashboardInspector /> : null}
    </div>
  );
};

export default DashboardOverlay;
