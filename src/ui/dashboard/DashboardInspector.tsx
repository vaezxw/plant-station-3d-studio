import { useState, type FC } from 'react';
import {
  Activity,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Link2,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { STUDIO_CATALOG, type CatalogKind } from '../../domain/catalog';
import {
  createDefaultCardElement,
  createDefaultDataSources,
  createWidgetsForTemplate,
  normalizeWidgetsTo24Cols,
  type CardElementSchema,
  type CardTemplateSchema,
  type DashboardTemplateId,
  type DashboardWidgetConfig,
  type ElementDataBinding,
  type SceneActionConfig,
  type ThresholdRule,
} from '../../domain/schema';
import { BUILTIN_CARD_TEMPLATES, useCardTemplateStore } from '../../store/useCardTemplateStore';
import { useEditorStore, type DashboardRightTab } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { POINT_CATALOG, useTelemetryStore } from '../../store/useTelemetryStore';
import { DASHBOARD_ICON_MAP } from './iconRegistry';

const COLOR_SWATCHES = ['#f1f5f9', '#38bdf8', '#22d3ee', '#34d399', '#f59e0b', '#ef4444', '#a78bfa'];

function convertBuiltinToElements(widget: DashboardWidgetConfig): CardElementSchema[] {
  if (widget.type === 'kpi') {
    const pairs: [string, string, string][] = [
      ['入口压力', 'HG-UF-101.pressure', 'kPa'],
      ['介质温度', 'HG-UF-101.temperature', '℃'],
      ['瞬时流量', 'HG-UF-101.flowWork', 'm³/h'],
      ['标况累积', 'HG-UF-101.cumStd', 'Nm³'],
    ];
    return pairs.map(([label, pid, unit]) => {
      const el = createDefaultCardElement('kpi');
      el.name = label;
      el.props.label = label;
      el.binding = { mode: 'point', dataSourceId: 'builtin-sim', pointKey: pid, format: { precision: 2, unit } };
      return el;
    });
  }
  if (widget.type === 'trend') {
    return [createDefaultCardElement('chart-line')];
  }
  if (widget.type === 'production') {
    return [createDefaultCardElement('progress'), createDefaultCardElement('kpi')];
  }
  return [createDefaultCardElement('text'), createDefaultCardElement('kpi')];
}

const DashboardInspector: FC = () => {
  const [tplSaveOpen, setTplSaveOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState<CardTemplateSchema['category']>('equipment');
  const [tplKind, setTplKind] = useState<CatalogKind | ''>('');
  const [tplSavedTip, setTplSavedTip] = useState(false);

  const project = useProjectStore((s) => s.project);
  const updateDashboardWidget = useProjectStore((s) => s.updateDashboardWidget);
  const duplicateDashboardWidget = useProjectStore((s) => s.duplicateDashboardWidget);
  const removeDashboardWidget = useProjectStore((s) => s.removeDashboardWidget);
  const updateCardElement = useProjectStore((s) => s.updateCardElement);
  const removeCardElement = useProjectStore((s) => s.removeCardElement);
  const setDashboardTemplate = useProjectStore((s) => s.setDashboardTemplate);
  const setDashboardWidgets = useProjectStore((s) => s.setDashboardWidgets);
  const setKindTemplateMapping = useProjectStore((s) => s.setKindTemplateMapping);

  const customTemplates = useCardTemplateStore((s) => s.customTemplates);
  const saveWidgetAsTemplate = useCardTemplateStore((s) => s.saveWidgetAsTemplate);

  const externalDefs = useTelemetryStore((s) => s.externalDefs);
  const bridgeCatalog = useTelemetryStore((s) => s.bridgeCatalog);

  const dashboardRightOpen = useEditorStore((s) => s.dashboardRightOpen);
  const dashboardRightTab = useEditorStore((s) => s.dashboardRightTab);
  const selectedWidgetId = useEditorStore((s) => s.selectedWidgetId);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setDashboardRightOpen = useEditorStore((s) => s.setDashboardRightOpen);
  const setDashboardRightTab = useEditorStore((s) => s.setDashboardRightTab);
  const setSelectedWidgetId = useEditorStore((s) => s.setSelectedWidgetId);
  const setDataSourceModalOpen = useEditorStore((s) => s.setDataSourceModalOpen);

  if (!dashboardRightOpen) {
    return (
      <button
        type="button"
        onClick={() => setDashboardRightOpen(true)}
        className="pointer-events-auto self-start studio-glass px-2.5 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 shadow-lg"
      >
        <ChevronLeft className="w-4 h-4 text-accent" />
        <span>属性</span>
      </button>
    );
  }

  const widgets = normalizeWidgetsTo24Cols(
    project.dashboardWidgets ?? createWidgetsForTemplate(project.dashboardTemplate),
  );
  const widget = widgets.find((w) => w.id === selectedWidgetId);
  const element = widget?.elements?.find((el) => el.id === selectedElementId);
  const dataSources = project.dataSources ?? createDefaultDataSources();
  const allTemplates = [...customTemplates, ...BUILTIN_CARD_TEMPLATES];
  const seenPointIds = new Set<string>();
  const allPoints: { id: string; label: string }[] = [];
  for (const bp of bridgeCatalog) {
    if (seenPointIds.has(bp.id)) continue;
    seenPointIds.add(bp.id);
    allPoints.push({ id: bp.id, label: `[SCADA] ${bp.name} (${bp.id})` });
  }
  for (const p of POINT_CATALOG) {
    if (seenPointIds.has(p.id)) continue;
    seenPointIds.add(p.id);
    allPoints.push({ id: p.id, label: `${p.tag} · ${p.name}` });
  }
  for (const e of Object.values(externalDefs)) {
    if (seenPointIds.has(e.id)) continue;
    seenPointIds.add(e.id);
    allPoints.push({ id: e.id, label: `[外部] ${e.name} (${e.id})` });
  }
  const uniqueSections = [...new Set(project.nodes.map((n) => n.section))];

  const updateElBinding = (patch: Partial<ElementDataBinding>, record = true) => {
    if (!widget || !element) return;
    const base: ElementDataBinding = element.binding ?? { mode: 'static' };
    updateCardElement(widget.id, element.id, { binding: { ...base, ...patch } }, record);
  };

  const renderSceneActionEditor = (
    action: SceneActionConfig | undefined,
    onUpdate: (act: SceneActionConfig) => void,
  ) => {
    const curType = action?.type ?? 'none';
    return (
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-[11px] text-text-muted">点击后 3D 场景联动动作</span>
          <select
            value={curType}
            onChange={(e) => {
              const t = e.target.value as SceneActionConfig['type'];
              if (t === 'none') onUpdate({ type: 'none' });
              else if (t === 'focus-node')
                onUpdate({ type: 'focus-node', nodeId: project.nodes[0]?.id ?? '' });
              else if (t === 'fly-bookmark')
                onUpdate({ type: 'fly-bookmark', bookmarkId: project.bookmarks[0]?.id ?? '' });
              else if (t === 'highlight-section')
                onUpdate({ type: 'highlight-section', section: uniqueSections[0] ?? '' });
              else if (t === 'highlight-pipe')
                onUpdate({ type: 'highlight-pipe', pipeId: project.pipes[0]?.id ?? '' });
              else if (t === 'toggle-turbojet') {
                const tj = project.nodes.find((n) => n.kind === 'TURBOJET');
                onUpdate({ type: 'toggle-turbojet', nodeId: tj?.id ?? '', mode: 'explode' });
              }
            }}
            className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
          >
            <option value="none">无动作</option>
            <option value="focus-node">聚焦并选中指定 3D 设备</option>
            <option value="fly-bookmark">飞往指定 3D 视角书签</option>
            <option value="highlight-section">高亮并聚焦所属工段</option>
            <option value="highlight-pipe">高亮工艺管路</option>
            <option value="toggle-turbojet">控制涡喷透平（拆解/旋转/剖切）</option>
          </select>
        </label>

        {action?.type === 'focus-node' ? (
          <select
            value={action.nodeId}
            onChange={(e) => onUpdate({ type: 'focus-node', nodeId: e.target.value })}
            className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
          >
            {project.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.tag} · {n.name}
              </option>
            ))}
          </select>
        ) : null}

        {action?.type === 'fly-bookmark' ? (
          <select
            value={action.bookmarkId}
            onChange={(e) => onUpdate({ type: 'fly-bookmark', bookmarkId: e.target.value })}
            className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
          >
            {project.bookmarks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}

        {action?.type === 'highlight-section' ? (
          <select
            value={action.section}
            onChange={(e) => onUpdate({ type: 'highlight-section', section: e.target.value })}
            className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
          >
            {uniqueSections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}

        {action?.type === 'highlight-pipe' ? (
          <select
            value={action.pipeId}
            onChange={(e) => onUpdate({ type: 'highlight-pipe', pipeId: e.target.value })}
            className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
          >
            {project.pipes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} ({p.medium.toUpperCase()})
              </option>
            ))}
          </select>
        ) : null}

        {action?.type === 'toggle-turbojet' ? (
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={action.nodeId}
              onChange={(e) =>
                onUpdate({ type: 'toggle-turbojet', nodeId: e.target.value, mode: action.mode })
              }
              className="h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle text-text-primary"
            >
              {project.nodes
                .filter((n) => n.kind === 'TURBOJET')
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.tag}
                  </option>
                ))}
            </select>
            <select
              value={action.mode}
              onChange={(e) =>
                onUpdate({
                  type: 'toggle-turbojet',
                  nodeId: action.nodeId,
                  mode: e.target.value as 'spin' | 'explode' | 'cutaway',
                })
              }
              className="h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle text-text-primary"
            >
              <option value="spin">切换运转</option>
              <option value="explode">切换爆炸视图</option>
              <option value="cutaway">切换剖切</option>
            </select>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="pointer-events-auto w-64 xl:w-72 h-full studio-glass rounded-xl border border-border-subtle flex flex-col overflow-hidden shadow-2xl select-none shrink-0">
      <div className="h-9 px-3 border-b border-border-subtle flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-text-primary truncate">
          {element ? `元素 · ${element.name}` : widget ? `卡片 · ${widget.title}` : '大屏全局与设备关联'}
        </span>
        <button
          type="button"
          onClick={() => setDashboardRightOpen(false)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="收起属性面板"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* A. 选中卡片内子元素时 */}
      {widget && element ? (
        <div className="flex-1 min-h-0 flex flex-col text-xs">
          <div className="px-2 pt-2 pb-1.5 border-b border-border-subtle flex items-center justify-between gap-1">
            {(
              [
                ['style', '样式', Palette],
                ['data', '数据', Database],
                ['chart', '图表', Activity],
                ['scene', '联动', Link2],
              ] as [DashboardRightTab, string, typeof Palette][]
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDashboardRightTab(id)}
                className={`flex-1 py-1 rounded text-[11px] flex items-center justify-center gap-1 transition ${
                  dashboardRightTab === id
                    ? 'bg-accent-soft text-accent border border-border-strong font-medium'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {dashboardRightTab === 'style' ? (
              <>
                <label className="block space-y-1">
                  <span className="text-[11px] text-text-muted">元素名称</span>
                  <input
                    value={element.name}
                    onChange={(e) =>
                      updateCardElement(widget.id, element.id, { name: e.target.value }, false)
                    }
                    className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                  />
                </label>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-text-muted">
                    <span>卡片内跨列宽度</span>
                    <span className="font-mono text-accent">{element.layout.colSpan}/12 列</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[3, 4, 6, 8, 12].map((cols) => (
                      <button
                        key={cols}
                        type="button"
                        onClick={() =>
                          updateCardElement(widget.id, element.id, { layout: { colSpan: cols } }, true)
                        }
                        className={`h-6 rounded border text-[10px] font-mono ${
                          element.layout.colSpan === cols
                            ? 'bg-accent/20 border-border-strong text-accent'
                            : 'bg-bg-canvas border-border-subtle text-text-muted'
                        }`}
                      >
                        {cols === 12 ? '整行' : `${cols}列`}
                      </button>
                    ))}
                  </div>
                </div>

                {element.type === 'text' ? (
                  <label className="block space-y-1">
                    <span className="text-[11px] text-text-muted">显示文本内容</span>
                    <textarea
                      rows={2}
                      value={element.props.text ?? ''}
                      onChange={(e) =>
                        updateCardElement(
                          widget.id,
                          element.id,
                          { props: { ...element.props, text: e.target.value } },
                          false,
                        )
                      }
                      className="w-full p-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                    />
                  </label>
                ) : (
                  <label className="block space-y-1">
                    <span className="text-[11px] text-text-muted">标题 / 指标标签</span>
                    <input
                      value={element.props.label ?? ''}
                      onChange={(e) =>
                        updateCardElement(
                          widget.id,
                          element.id,
                          { props: { ...element.props, label: e.target.value } },
                          false,
                        )
                      }
                      className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                    />
                  </label>
                )}

                {element.type === 'icon' || element.type === 'kpi' ? (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-text-muted">选择工业图标</span>
                    <div className="grid grid-cols-6 gap-1">
                      {Object.entries(DASHBOARD_ICON_MAP).map(([name, info]) => {
                        const Ic = info.icon;
                        return (
                          <button
                            key={name}
                            type="button"
                            title={info.label}
                            onClick={() =>
                              updateCardElement(
                                widget.id,
                                element.id,
                                { props: { ...element.props, iconName: name } },
                                true,
                              )
                            }
                            className={`h-7 rounded border flex items-center justify-center transition ${
                              element.props.iconName === name
                                ? 'bg-accent/20 border-border-strong text-accent'
                                : 'bg-bg-canvas border-border-subtle text-text-muted hover:text-text-primary'
                            }`}
                          >
                            <Ic className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {element.type.startsWith('chart-') ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-text-muted">
                      <span>图表高度</span>
                      <span className="font-mono">{element.style.heightPx ?? 145}px</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={320}
                      step={8}
                      value={element.style.heightPx ?? 145}
                      onChange={(e) =>
                        updateCardElement(
                          widget.id,
                          element.id,
                          { style: { ...element.style, heightPx: Number(e.target.value) } },
                          false,
                        )
                      }
                      className="w-full accent-sky-400"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-[11px] text-text-muted">字号 (px)</span>
                        <input
                          type="number"
                          min={10}
                          max={42}
                          value={element.style.fontSize ?? 14}
                          onChange={(e) =>
                            updateCardElement(
                              widget.id,
                              element.id,
                              { style: { ...element.style, fontSize: Number(e.target.value) } },
                              true,
                            )
                          }
                          className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle font-mono text-text-primary"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-text-muted">字体家族</span>
                        <select
                          value={element.style.fontFamily ?? 'sans'}
                          onChange={(e) =>
                            updateCardElement(
                              widget.id,
                              element.id,
                              { style: { ...element.style, fontFamily: e.target.value as 'sans' | 'mono' } },
                              true,
                            )
                          }
                          className="w-full h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                        >
                          <option value="sans">标准黑体</option>
                          <option value="mono">等宽数字 Mono</option>
                        </select>
                      </label>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-text-muted">文字 / 主题强调色</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {COLOR_SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              updateCardElement(
                                widget.id,
                                element.id,
                                { style: { ...element.style, color: c } },
                                true,
                              )
                            }
                            className={`w-5 h-5 rounded-full border ${
                              element.style.color === c ? 'border-white scale-110' : 'border-white/20'
                            }`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : dashboardRightTab === 'data' ? (
              <>
                <label className="block space-y-1">
                  <span className="text-[11px] text-text-muted">数据绑定方式</span>
                  <select
                    value={element.binding?.mode ?? 'static'}
                    onChange={(e) =>
                      updateElBinding({ mode: e.target.value as ElementDataBinding['mode'] })
                    }
                    className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                  >
                    <option value="static">静态展示（不绑定测点）</option>
                    <option value="point">绑定具体测点（内置/外部点号）</option>
                    <option value="device-slot">关联 3D 设备动态槽位</option>
                  </select>
                </label>

                {element.binding?.mode === 'point' ? (
                  <div className="space-y-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-muted">所属数据源</span>
                      <select
                        value={element.binding.dataSourceId ?? 'builtin-sim'}
                        onChange={(e) => updateElBinding({ dataSourceId: e.target.value })}
                        className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                      >
                        {dataSources.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-muted">从点表字典快选</span>
                      <select
                        value={element.binding.pointKey ?? ''}
                        onChange={(e) => updateElBinding({ pointKey: e.target.value })}
                        className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                      >
                        <option value="">-- 选择测点或下方手填 --</option>
                        {allPoints.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-muted">点位 Key（支持手填外部接口点号）</span>
                      <input
                        value={element.binding.pointKey ?? ''}
                        onChange={(e) => updateElBinding({ pointKey: e.target.value }, false)}
                        placeholder="如 PLC_DB1_PT01"
                        className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle font-mono text-text-primary"
                      />
                    </label>
                  </div>
                ) : null}

                {element.binding?.mode === 'device-slot' ? (
                  <div className="p-2.5 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-muted">目标来源</span>
                      <select
                        value={element.binding.deviceSlot?.target ?? 'bound-node'}
                        onChange={(e) =>
                          updateElBinding({
                            deviceSlot: {
                              ...element.binding?.deviceSlot,
                              target: e.target.value as 'bound-node' | 'selected-node',
                            },
                          })
                        }
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary"
                      >
                        <option value="bound-node">随本卡片关联设备</option>
                        <option value="selected-node">实时跟随 3D 选中设备</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-muted">读取设备字段</span>
                      <select
                        value={element.binding.deviceSlot?.prop ?? 'metric'}
                        onChange={(e) =>
                          updateElBinding({
                            deviceSlot: {
                              target: element.binding?.deviceSlot?.target ?? 'bound-node',
                              prop: e.target.value as 'tag' | 'name' | 'section' | 'metric',
                              metricIndex: element.binding?.deviceSlot?.metricIndex ?? 0,
                            },
                          })
                        }
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary"
                      >
                        <option value="metric">设备绑定的实时测点值</option>
                        <option value="tag">设备位号 (Tag)</option>
                        <option value="name">设备名称</option>
                        <option value="section">所属工段</option>
                      </select>
                    </label>
                    {(element.binding.deviceSlot?.prop ?? 'metric') === 'metric' ? (
                      <label className="block space-y-1">
                        <span className="text-[11px] text-text-muted">第 N 个关联测点槽位 (0 起)</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={element.binding.deviceSlot?.metricIndex ?? 0}
                          onChange={(e) =>
                            updateElBinding({
                              deviceSlot: {
                                target: element.binding?.deviceSlot?.target ?? 'bound-node',
                                prop: 'metric',
                                metricIndex: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono text-text-primary"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {element.binding && element.binding.mode !== 'static' ? (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      <label className="space-y-1">
                        <span className="text-[10px] text-text-muted">倍率</span>
                        <input
                          type="number"
                          step={0.1}
                          value={element.binding.format?.multiplier ?? 1}
                          onChange={(e) =>
                            updateElBinding({
                              format: { ...element.binding?.format, multiplier: Number(e.target.value) },
                            })
                          }
                          className="w-full h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle font-mono text-text-primary"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-text-muted">小数位</span>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={element.binding.format?.precision ?? 2}
                          onChange={(e) =>
                            updateElBinding({
                              format: { ...element.binding?.format, precision: Number(e.target.value) },
                            })
                          }
                          className="w-full h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle font-mono text-text-primary"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-text-muted">显示单位</span>
                        <input
                          value={element.binding.format?.unit ?? ''}
                          onChange={(e) =>
                            updateElBinding(
                              { format: { ...element.binding?.format, unit: e.target.value } },
                              false,
                            )
                          }
                          className="w-full h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle text-text-primary"
                        />
                      </label>
                    </div>

                    <div className="pt-2 border-t border-border-subtle space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-text-secondary">越限阈值告警色</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextRules: ThresholdRule[] = [
                              ...(element.binding?.thresholds ?? []),
                              { operator: '>', value: 100, color: '#ef4444', blink: true },
                            ];
                            updateElBinding({ thresholds: nextRules });
                          }}
                          className="text-[10px] text-accent hover:underline"
                        >
                          + 新增阈值
                        </button>
                      </div>
                      {(element.binding.thresholds ?? []).map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <select
                            value={rule.operator}
                            onChange={(e) => {
                              const list = [...(element.binding?.thresholds ?? [])];
                              list[idx] = { ...rule, operator: e.target.value as ThresholdRule['operator'] };
                              updateElBinding({ thresholds: list });
                            }}
                            className="h-6 px-1 rounded bg-bg-canvas border border-border-subtle font-mono text-[10px]"
                          >
                            {['>', '>=', '<', '<=', '=='].map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={rule.value}
                            onChange={(e) => {
                              const list = [...(element.binding?.thresholds ?? [])];
                              list[idx] = { ...rule, value: Number(e.target.value) };
                              updateElBinding({ thresholds: list }, false);
                            }}
                            className="w-16 h-6 px-1 rounded bg-bg-canvas border border-border-subtle font-mono text-[10px]"
                          />
                          <input
                            type="color"
                            value={rule.color}
                            onChange={(e) => {
                              const list = [...(element.binding?.thresholds ?? [])];
                              list[idx] = { ...rule, color: e.target.value };
                              updateElBinding({ thresholds: list });
                            }}
                            className="w-6 h-6 bg-transparent border-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const list = (element.binding?.thresholds ?? []).filter((_, i) => i !== idx);
                              updateElBinding({ thresholds: list });
                            }}
                            className="p-0.5 text-text-muted hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : dashboardRightTab === 'chart' ? (
              element.type.startsWith('chart-') ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-text-muted">图表绑定数据系列</span>
                    {(element.props.seriesPointIds ?? []).map((pid, idx) => (
                      <div key={`${pid}-${idx}`} className="flex items-center gap-1">
                        <select
                          value={pid}
                          onChange={(e) => {
                            const next = [...(element.props.seriesPointIds ?? [])];
                            next[idx] = e.target.value;
                            updateCardElement(
                              widget.id,
                              element.id,
                              { props: { ...element.props, seriesPointIds: next } },
                              true,
                            );
                          }}
                          className="flex-1 h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle text-[11px]"
                        >
                          {allPoints.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (element.props.seriesPointIds ?? []).filter((_, i) => i !== idx);
                            updateCardElement(
                              widget.id,
                              element.id,
                              { props: { ...element.props, seriesPointIds: next } },
                              true,
                            );
                          }}
                          className="p-1 text-text-muted hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {element.type !== 'chart-gauge' ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateCardElement(
                            widget.id,
                            element.id,
                            {
                              props: {
                                ...element.props,
                                seriesPointIds: [...(element.props.seriesPointIds ?? []), 'HG-UF-101.flowWork'],
                              },
                            },
                            true,
                          )
                        }
                        className="w-full h-7 rounded border border-border-strong bg-accent/10 text-accent text-[11px]"
                      >
                        + 添加曲线/柱图系列
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-text-muted">最小值</span>
                      <input
                        type="number"
                        value={element.props.min ?? ''}
                        placeholder="自动"
                        onChange={(e) =>
                          updateCardElement(
                            widget.id,
                            element.id,
                            {
                              props: {
                                ...element.props,
                                min: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            },
                            true,
                          )
                        }
                        className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle font-mono"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-text-muted">最大值</span>
                      <input
                        type="number"
                        value={element.props.max ?? ''}
                        placeholder="自动"
                        onChange={(e) =>
                          updateCardElement(
                            widget.id,
                            element.id,
                            {
                              props: {
                                ...element.props,
                                max: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            },
                            true,
                          )
                        }
                        className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle font-mono"
                      />
                    </label>
                  </div>

                  {element.type === 'chart-line' ? (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-text-muted">面积渐变填充</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateCardElement(
                            widget.id,
                            element.id,
                            { props: { ...element.props, areaFill: !element.props.areaFill } },
                            true,
                          )
                        }
                        className={`px-2 py-0.5 rounded border text-[10px] ${
                          element.props.areaFill
                            ? 'bg-accent/20 border-border-strong text-accent'
                            : 'bg-bg-canvas border-border-subtle text-text-muted'
                        }`}
                      >
                        {element.props.areaFill ? '已开启' : '关闭'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-[11px] text-text-muted py-4 text-center">
                  当前选中元素并非图表组件（请切换到「样式」或「数据」页签配置）。
                </div>
              )
            ) : (
              renderSceneActionEditor(element.onClickAction, (act) =>
                updateCardElement(widget.id, element.id, { onClickAction: act }, true),
              )
            )}
          </div>

          <div className="p-2.5 border-t border-border-subtle flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedWidgetId(widget.id)}
              className="flex-1 h-7 rounded border border-border-subtle bg-bg-canvas/70 text-[11px] text-text-secondary hover:text-text-primary"
            >
              返回所属卡片属性
            </button>
            <button
              type="button"
              onClick={() => removeCardElement(widget.id, element.id)}
              className="h-7 px-2.5 rounded border border-red-500/40 bg-red-500/10 text-red-400 text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : widget ? (
        /* B. 选中整张卡片时 */
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3.5 text-xs">
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">卡片标题</span>
              <input
                value={widget.title}
                onChange={(e) => updateDashboardWidget(widget.id, { title: e.target.value }, false)}
                className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary"
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">显示顶部标题栏</span>
              <button
                type="button"
                onClick={() =>
                  updateDashboardWidget(widget.id, { showHeader: widget.showHeader === false }, true)
                }
                className={`px-2 py-0.5 rounded border text-[10px] ${
                  widget.showHeader !== false
                    ? 'bg-accent/20 border-border-strong text-accent'
                    : 'bg-bg-canvas border-border-subtle text-text-muted'
                }`}
              >
                {widget.showHeader !== false ? '显示' : '隐藏'}
              </button>
            </div>
          </div>

          {widget.type !== 'custom' ? (
            <div className="p-2.5 rounded-lg bg-accent-soft border border-border-strong space-y-2">
              <div className="text-[11px] text-text-secondary leading-snug">
                这是系统默认快捷卡。转为「自由组态卡片」后即可拖拽、增删内部所有图表、文本框和图标并保存模板。
              </div>
              <button
                type="button"
                onClick={() =>
                  updateDashboardWidget(
                    widget.id,
                    { type: 'custom', elements: convertBuiltinToElements(widget) },
                    true,
                  )
                }
                className="w-full h-7 rounded bg-accent text-slate-950 font-semibold text-[11px]"
              >
                转为可自由编辑自定义卡片
              </button>
            </div>
          ) : null}

          <div className="p-2.5 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2.5">
            <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
              卡片容器样式
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>圆角弧度</span>
                <span className="font-mono">{widget.cardStyle?.borderRadius ?? 12}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={2}
                value={widget.cardStyle?.borderRadius ?? 12}
                onChange={(e) =>
                  updateDashboardWidget(
                    widget.id,
                    { cardStyle: { ...widget.cardStyle, borderRadius: Number(e.target.value) } },
                    false,
                  )
                }
                className="w-full accent-sky-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-text-muted">背景填充色</span>
                <input
                  type="color"
                  value={widget.cardStyle?.background ?? '#0f172a'}
                  onChange={(e) =>
                    updateDashboardWidget(
                      widget.id,
                      { cardStyle: { ...widget.cardStyle, background: e.target.value } },
                      true,
                    )
                  }
                  className="w-full h-7 rounded bg-bg-canvas border border-border-subtle cursor-pointer"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-text-muted">边框高亮色</span>
                <input
                  type="color"
                  value={widget.cardStyle?.borderColor ?? '#38bdf8'}
                  onChange={(e) =>
                    updateDashboardWidget(
                      widget.id,
                      { cardStyle: { ...widget.cardStyle, borderColor: e.target.value } },
                      true,
                    )
                  }
                  className="w-full h-7 rounded bg-bg-canvas border border-border-subtle cursor-pointer"
                />
              </label>
            </div>
            {widget.cardStyle ? (
              <button
                type="button"
                onClick={() => updateDashboardWidget(widget.id, { cardStyle: undefined }, true)}
                className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> 恢复主题默认毛玻璃样式
              </button>
            ) : null}
          </div>

          <div className="p-2.5 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2.5">
            <div className="text-[11px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" /> 关联 3D 设备场景
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">固定关联 3D 设备</span>
              <select
                value={widget.sceneBinding?.targetNodeId ?? ''}
                onChange={(e) =>
                  updateDashboardWidget(
                    widget.id,
                    {
                      sceneBinding: {
                        ...widget.sceneBinding,
                        targetNodeId: e.target.value || undefined,
                      },
                    },
                    true,
                  )
                }
                className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary"
              >
                <option value="">不固定（可通过跟随选中响应任意设备）</option>
                {project.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.tag} · {n.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">跟随当前 3D 选中设备</span>
              <button
                type="button"
                onClick={() =>
                  updateDashboardWidget(
                    widget.id,
                    {
                      sceneBinding: {
                        ...widget.sceneBinding,
                        followSelectedNode: !widget.sceneBinding?.followSelectedNode,
                      },
                    },
                    true,
                  )
                }
                className={`px-2 py-0.5 rounded border text-[10px] ${
                  widget.sceneBinding?.followSelectedNode
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-bg-elevated border-border-subtle text-text-muted'
                }`}
              >
                {widget.sceneBinding?.followSelectedNode ? '已开启跟随' : '关闭'}
              </button>
            </div>
            {renderSceneActionEditor(widget.sceneBinding?.clickAction, (act) =>
              updateDashboardWidget(
                widget.id,
                { sceneBinding: { ...widget.sceneBinding, clickAction: act } },
                true,
              ),
            )}
          </div>

          {/* 保存为可复用组件模板 */}
          {widget.type === 'custom' ? (
            <div className="p-2.5 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2">
              {!tplSaveOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setTplName(widget.title);
                    setTplSaveOpen(true);
                  }}
                  className="w-full h-7 rounded border border-border-strong bg-accent/15 hover:bg-accent/25 text-accent font-medium flex items-center justify-center gap-1"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" /> 保存此卡片为组件模板
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-accent">存为大屏组件模板</div>
                  <input
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="模板名称"
                    className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={tplCategory}
                      onChange={(e) =>
                        setTplCategory(e.target.value as CardTemplateSchema['category'])
                      }
                      className="h-7 px-1.5 rounded bg-bg-elevated border border-border-subtle text-[11px]"
                    >
                      <option value="equipment">设备监视</option>
                      <option value="kpi">KPI 指标</option>
                      <option value="chart">趋势图表</option>
                      <option value="alarm">安全报警</option>
                      <option value="custom">通用自定义</option>
                    </select>
                    <select
                      value={tplKind}
                      onChange={(e) => setTplKind(e.target.value as CatalogKind | '')}
                      className="h-7 px-1.5 rounded bg-bg-elevated border border-border-subtle text-[11px]"
                    >
                      <option value="">不限 3D 机型</option>
                      {STUDIO_CATALOG.map((item) => (
                        <option key={item.kind} value={item.kind}>
                          {item.labelZh}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await saveWidgetAsTemplate(widget, {
                          name: tplName,
                          category: tplCategory,
                          bindCatalogKind: tplKind || undefined,
                        });
                        setTplSaveOpen(false);
                        setTplSavedTip(true);
                        window.setTimeout(() => setTplSavedTip(false), 2500);
                      }}
                      className="flex-1 h-7 rounded bg-accent text-slate-950 font-semibold"
                    >
                      确认保存模板
                    </button>
                    <button
                      type="button"
                      onClick={() => setTplSaveOpen(false)}
                      className="px-2.5 h-7 rounded border border-border-subtle text-text-muted"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              {tplSavedTip ? (
                <div className="text-[11px] text-emerald-400">已存入左侧「模板」库，随时可拖放复用！</div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const copy = duplicateDashboardWidget(widget.id);
                if (copy) setSelectedWidgetId(copy.id);
              }}
              className="h-7 rounded border border-border-subtle bg-bg-canvas/70 hover:text-accent flex items-center justify-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> 复制卡片
            </button>
            <button
              type="button"
              onClick={() => {
                removeDashboardWidget(widget.id);
                setSelectedWidgetId(null);
              }}
              className="h-7 rounded border border-red-500/40 bg-red-500/10 text-red-400 flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除卡片
            </button>
          </div>
        </div>
      ) : (
        /* C. 未选中任何卡片时：全局大屏与 3D 设备类型映射配置 */
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2">
            <div className="font-semibold text-text-primary">大屏编排说明</div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              点击任意卡片或卡片内部的图表/文本/KPI 元素，即可在此编辑样式、绑定数据源测点与配置 3D 联动动作；也可将拼装好的卡片保存为通用组件模板。
            </p>
            <button
              type="button"
              onClick={() => setDataSourceModalOpen(true)}
              className="w-full h-7 rounded border border-border-strong bg-accent/15 hover:bg-accent/25 text-accent font-medium flex items-center justify-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" /> 配置 / 对接外部数据源
            </button>
          </div>

          <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2">
            <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
              3D 设备类型 → 默认大屏组件模板
            </div>
            <div className="text-[10px] text-text-muted">
              点击 3D 中某类设备时，「选中设备详情」卡自动套用对应模板：
            </div>
            <div className="space-y-1.5">
              {(['WATER_PUMP', 'TANK', 'HEAT_EXCHANGER', 'HENG_GUANG_SKID'] as CatalogKind[]).map((k) => {
                const cat = STUDIO_CATALOG.find((c) => c.kind === k);
                return (
                  <label key={k} className="block space-y-0.5">
                    <span className="text-[11px] text-text-secondary">{cat?.labelZh ?? k}</span>
                    <select
                      value={project.kindTemplateMap?.[k] ?? ''}
                      onChange={(e) =>
                        setKindTemplateMapping(k, e.target.value || undefined)
                      }
                      className="w-full h-7 px-1.5 rounded bg-bg-elevated border border-border-subtle text-[11px] text-text-primary"
                    >
                      <option value="">默认 / 智能匹配</option>
                      {allTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-text-muted">快速切换画布布局模板</span>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['immersive', '沉浸悬浮'],
                  ['command', '指挥分栏'],
                  ['minimal', '极简演示'],
                ] as [DashboardTemplateId, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDashboardTemplate(id)}
                  className={`h-7 rounded border text-[11px] ${
                    project.dashboardTemplate === id
                      ? 'bg-accent text-slate-950 font-semibold border-accent'
                      : 'bg-bg-canvas border-border-subtle text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDashboardWidgets(createWidgetsForTemplate(project.dashboardTemplate))}
              className="w-full h-7 rounded border border-border-subtle bg-bg-canvas/60 text-text-muted hover:text-text-primary flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> 恢复模板默认卡片位置
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DashboardInspector;
