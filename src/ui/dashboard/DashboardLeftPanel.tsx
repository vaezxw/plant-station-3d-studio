import { useRef, useState, type ChangeEvent, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity,
  BarChart3,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Gauge,
  LayoutGrid,
  Layers,
  Lock,
  Minus,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  createDefaultCardElement,
  createWidgetsForTemplate,
  normalizeWidgetsTo24Cols,
  type CardElementType,
  type CardTemplateSchema,
  type DashboardWidgetConfig,
} from '../../domain/schema';
import { BUILTIN_CARD_TEMPLATES, useCardTemplateStore } from '../../store/useCardTemplateStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

const ELEMENT_PALETTE: {
  type: CardElementType;
  label: string;
  desc: string;
  icon: typeof Type;
}[] = [
  { type: 'text', label: '文本框', desc: '标题、说明或动态测点文案', icon: Type },
  { type: 'kpi', label: 'KPI 指标', desc: '数值、单位与阈值告警卡', icon: Gauge },
  { type: 'icon', label: '工业图标', desc: '工艺设备图标与交互按钮', icon: Sparkles },
  { type: 'status-dot', label: '状态指示灯', desc: '运行/停机实时信号灯', icon: Radio },
  { type: 'progress', label: '液位进度条', desc: '储罐液位与百分比条', icon: Activity },
  { type: 'chart-line', label: '折线趋势图', desc: '多系列 ECharts 实时曲线', icon: Activity },
  { type: 'chart-bar', label: '对比柱状图', desc: '多路参数横向/纵向对比', icon: BarChart3 },
  { type: 'chart-gauge', label: '刻度仪表盘', desc: '工业指针量程表盘', icon: Gauge },
  { type: 'divider', label: '分割装饰线', desc: '卡片内分区线与标签', icon: Minus },
];

const DashboardLeftPanel: FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragBadge, setDragBadge] = useState<{ label: string; x: number; y: number } | null>(null);

  const project = useProjectStore((s) => s.project);
  const addCustomCardWidget = useProjectStore((s) => s.addCustomCardWidget);
  const addWidgetFromTemplate = useProjectStore((s) => s.addWidgetFromTemplate);
  const addCardElement = useProjectStore((s) => s.addCardElement);
  const updateDashboardWidget = useProjectStore((s) => s.updateDashboardWidget);
  const duplicateDashboardWidget = useProjectStore((s) => s.duplicateDashboardWidget);
  const removeDashboardWidget = useProjectStore((s) => s.removeDashboardWidget);

  const customTemplates = useCardTemplateStore((s) => s.customTemplates);
  const importTemplates = useCardTemplateStore((s) => s.importTemplates);
  const deleteTemplate = useCardTemplateStore((s) => s.deleteTemplate);

  const dashboardLeftTab = useEditorStore((s) => s.dashboardLeftTab);
  const dashboardLeftOpen = useEditorStore((s) => s.dashboardLeftOpen);
  const selectedWidgetId = useEditorStore((s) => s.selectedWidgetId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  const setDashboardLeftTab = useEditorStore((s) => s.setDashboardLeftTab);
  const setDashboardLeftOpen = useEditorStore((s) => s.setDashboardLeftOpen);
  const setSelectedWidgetId = useEditorStore((s) => s.setSelectedWidgetId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);

  const widgets: DashboardWidgetConfig[] = normalizeWidgetsTo24Cols(
    project.dashboardWidgets ?? createWidgetsForTemplate(project.dashboardTemplate),
  );
  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);

  if (!dashboardLeftOpen) {
    return (
      <button
        type="button"
        onClick={() => setDashboardLeftOpen(true)}
        className="pointer-events-auto self-start studio-glass px-2.5 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 shadow-lg"
      >
        <ChevronRight className="w-4 h-4 text-accent" />
        <span>组件库</span>
      </button>
    );
  }

  const handleInsertElement = (elType: CardElementType, targetWidgetId?: string) => {
    const newEl = createDefaultCardElement(elType);
    const target =
      (targetWidgetId ? widgets.find((w) => w.id === targetWidgetId) : undefined) ??
      (selectedWidget?.type === 'custom' ? selectedWidget : undefined);

    if (target && target.type === 'custom') {
      addCardElement(target.id, newEl);
      setSelectedElementId(target.id, newEl.id);
      return;
    }
    const created = addCustomCardWidget(newEl.name, [newEl], {
      w: elType.startsWith('chart-') ? 7 : 6,
      h: elType.startsWith('chart-') ? 7 : 6,
    });
    setSelectedElementId(created.id, newEl.id);
  };

  const startElementDrag = (elType: CardElementType, label: string, e: ReactPointerEvent) => {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
      if (moved) setDragBadge({ label, x: ev.clientX, y: ev.clientY });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDragBadge(null);

      if (!moved) {
        handleInsertElement(elType);
        return;
      }
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const dropCard = under?.closest('[data-drop-widget-id]') as HTMLElement | null;
      const hitId = dropCard?.dataset.dropWidgetId;
      if (hitId) {
        handleInsertElement(elType, hitId);
      } else {
        const newEl = createDefaultCardElement(elType);
        const created = addCustomCardWidget(newEl.name, [newEl], {
          w: elType.startsWith('chart-') ? 7 : 6,
          h: elType.startsWith('chart-') ? 7 : 6,
        });
        setSelectedElementId(created.id, newEl.id);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleExportTemplates = () => {
    const data = customTemplates.length > 0 ? customTemplates : BUILTIN_CARD_TEMPLATES;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-card-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplates = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as CardTemplateSchema | CardTemplateSchema[];
      await importTemplates(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      window.alert('组件模板 JSON 格式无效');
    }
  };

  const allTemplates = [...customTemplates, ...BUILTIN_CARD_TEMPLATES];

  return (
    <aside className="pointer-events-auto w-56 xl:w-64 h-full studio-glass rounded-xl border border-border-subtle flex flex-col overflow-hidden shadow-2xl select-none shrink-0">
      <div className="h-9 px-2 border-b border-border-subtle flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-0.5 bg-bg-canvas/70 p-0.5 rounded-md border border-border-subtle">
          {(
            [
              ['elements', '物料', LayoutGrid],
              ['templates', '模板', BookmarkPlus],
              ['layers', '大纲', Layers],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDashboardLeftTab(id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                dashboardLeftTab === id
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDashboardLeftOpen(false)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="收起组件库"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {dashboardLeftTab === 'elements' ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 text-xs">
          <button
            type="button"
            onClick={() => {
              const first = createDefaultCardElement('kpi');
              const created = addCustomCardWidget('新建监视卡片', [first], { w: 6, h: 6 });
              setSelectedWidgetId(created.id);
            }}
            className="w-full h-8 rounded-lg border border-border-strong bg-accent-soft hover:bg-accent hover:text-slate-950 text-accent font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> 新建空白可配置卡片
          </button>

          <div className="space-y-1.5">
            <div className="text-[10px] text-text-muted">
              {selectedWidget?.type === 'custom'
                ? `点击或拖入元素 → 将添加到「${selectedWidget.title}」`
                : '拖入画布创建新卡，或拖入已有自定义卡片内部'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ELEMENT_PALETTE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onPointerDown={(e) => startElementDrag(item.type, item.label, e)}
                    title={item.desc}
                    className="p-2 rounded-lg border border-border-subtle bg-bg-canvas/65 hover:bg-bg-hover hover:border-border-strong text-left flex flex-col gap-1 transition cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-1.5 text-text-primary font-medium text-[11px]">
                      <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-text-muted leading-tight line-clamp-2">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle space-y-1.5">
            <div className="text-[11px] font-medium text-text-secondary">系统内置快捷卡片显隐</div>
            <div className="flex flex-wrap gap-1.5">
              {widgets
                .filter((w) => w.type !== 'custom')
                .map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => updateDashboardWidget(w.id, { visible: !w.visible }, true)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 transition ${
                      w.visible
                        ? 'bg-accent-soft border-border-strong text-accent'
                        : 'bg-bg-canvas/60 border-border-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {w.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                    {w.title}
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : dashboardLeftTab === 'templates' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-2.5 py-2 border-b border-border-subtle flex items-center justify-between gap-1 text-[11px]">
            <span className="text-text-muted">点击添加到大屏</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="p-1 rounded border border-border-subtle bg-bg-canvas/70 hover:text-accent"
                title="导入组件模板 JSON"
              >
                <Upload className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleExportTemplates}
                className="p-1 rounded border border-border-subtle bg-bg-canvas/70 hover:text-accent"
                title="导出自定义模板库 JSON"
              >
                <Download className="w-3 h-3" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => void handleImportTemplates(e)}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
            {allTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-2.5 rounded-lg border border-border-subtle bg-bg-canvas/65 hover:border-border-strong space-y-1.5 transition"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-primary truncate">{tpl.name}</div>
                    <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                      <span>{tpl.isBuiltin ? '系统内置' : '我的模板'}</span>
                      <span>· {tpl.elements.length} 元素</span>
                      {tpl.bindCatalogKind ? (
                        <span className="px-1 rounded bg-accent/15 text-accent font-mono">
                          <Cpu className="w-2.5 h-2.5 inline mr-0.5" />
                          {tpl.bindCatalogKind}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!tpl.isBuiltin ? (
                    <button
                      type="button"
                      onClick={() => void deleteTemplate(tpl.id)}
                      className="p-1 text-text-muted hover:text-red-400"
                      title="删除自定义模板"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>

                {tpl.description ? (
                  <p className="text-[10px] text-text-muted leading-snug">{tpl.description}</p>
                ) : null}

                <div className="flex gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const created = addWidgetFromTemplate(tpl, selectedNodeId ?? undefined);
                      setSelectedWidgetId(created.id);
                    }}
                    className="flex-1 h-6 rounded bg-accent-soft hover:bg-accent hover:text-slate-950 border border-border-strong text-[11px] text-accent font-medium transition"
                  >
                    + 放置到大屏
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 text-xs">
          {widgets.map((w) => {
            const isSel = selectedWidgetId === w.id;
            return (
              <div
                key={w.id}
                onClick={() => setSelectedWidgetId(w.id)}
                className={`p-2 rounded-lg border cursor-pointer space-y-1 transition ${
                  isSel
                    ? 'bg-accent-soft border-border-strong'
                    : 'bg-bg-canvas/60 border-border-subtle hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-text-primary truncate">{w.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDashboardWidget(w.id, { visible: !w.visible }, true);
                      }}
                      className="p-1 text-text-muted hover:text-text-primary"
                      title={w.visible ? '隐藏' : '显示'}
                    >
                      {w.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDashboardWidget(w.id, { locked: !w.locked }, true);
                      }}
                      className={`p-1 ${w.locked ? 'text-amber-400' : 'text-text-muted hover:text-text-primary'}`}
                      title={w.locked ? '解锁卡片' : '锁定位置与大小'}
                    >
                      {w.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const copy = duplicateDashboardWidget(w.id);
                        if (copy) setSelectedWidgetId(copy.id);
                      }}
                      className="p-1 text-text-muted hover:text-accent"
                      title="复制卡片"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDashboardWidget(w.id);
                        if (isSel) setSelectedWidgetId(null);
                      }}
                      className="p-1 text-text-muted hover:text-red-400"
                      title="删除卡片"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {w.elements && w.elements.length > 0 ? (
                  <div className="pl-2 space-y-0.5 border-l border-border-subtle">
                    {w.elements.map((el) => (
                      <div
                        key={el.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(w.id, el.id);
                        }}
                        className="px-1.5 py-0.5 rounded text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-elevated truncate"
                      >
                        · {el.name}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {dragBadge ? (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1 rounded-full studio-glass border border-border-strong text-xs font-medium text-accent shadow-xl"
          style={{ left: dragBadge.x + 12, top: dragBadge.y + 12 }}
        >
          + {dragBadge.label}
        </div>
      ) : null}
    </aside>
  );
};

export default DashboardLeftPanel;
