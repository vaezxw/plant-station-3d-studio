import { useEffect, useMemo, useState, type FC } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Copy,
  Download,
  Layers,
  LayoutDashboard,
  Maximize2,
  Pause,
  Play,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { POINT_DEFS } from '../../data/points';
import { getCatalogItem } from '../../domain/catalog';
import type { CardElementSchema, CardTemplateSchema } from '../../domain/schema';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { PreviewOverrideProvider } from '../dashboard/PreviewOverrideContext';
import { CustomElementsBody } from '../dashboard/widgets';
import AssetPreview from '../studio/AssetPreview';
import {
  buildPreviewSampleNode,
  buildSampleTelemetryOverrides,
  resolveTemplateElementPointKey,
  type PreviewCondition,
} from './templatePreviewSample';

type Props = {
  template: CardTemplateSchema;
  canManage: boolean;
  onClose: () => void;
  onCloneTemplate: (tpl: CardTemplateSchema) => Promise<void>;
  onApplyToProject: (tpl: CardTemplateSchema) => void;
};

const CATEGORY_TEXT: Record<CardTemplateSchema['category'], string> = {
  equipment: '设备联动',
  chart: '趋势图表',
  kpi: '核心指标',
  alarm: '报警监视',
  custom: '自定义',
};

const SIZE_PRESETS = [
  { id: 'default', label: '默认尺寸' },
  { id: 'compact', label: '紧凑 (6×6)', w: 6, h: 6 },
  { id: 'wide', label: '宽幅 (10×7)', w: 10, h: 7 },
] as const;

const CardTemplateDetailViewer: FC<Props> = ({
  template,
  canManage,
  onClose,
  onCloneTemplate,
  onApplyToProject,
}) => {
  const [sizePreset, setSizePreset] = useState<'default' | 'compact' | 'wide'>('default');
  const [backdropMode, setBackdropMode] = useState<'grid' | 'scene'>('grid');
  const [simPlaying, setSimPlaying] = useState(true);
  const [condition, setCondition] = useState<PreviewCondition>('normal');
  const [manualScalePct, setManualScalePct] = useState(0);
  const [selectedElId, setSelectedElId] = useState<string | null>(template.elements[0]?.id ?? null);
  const [show3DWidget, setShow3DWidget] = useState(true);
  const [clonedTip, setClonedTip] = useState<string | null>(null);

  const stepSimulation = useTelemetryStore((s) => s.stepSimulation);
  const valueMap = useTelemetryStore((s) => s.valueMap);
  const pointHistory = useTelemetryStore((s) => s.pointHistory);
  const tickCount = useTelemetryStore((s) => s.tickCount);

  // 详情预览空间挂载局部仿真脉冲，使曲线、仪表盘与数值活起来
  useEffect(() => {
    if (!simPlaying) return;
    const timer = window.setInterval(() => {
      stepSimulation();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [simPlaying, stepSimulation]);

  const sampleNode = useMemo(() => buildPreviewSampleNode(template), [template]);
  const bindCatalogMeta = template.bindCatalogKind
    ? getCatalogItem(template.bindCatalogKind)
    : undefined;

  const overrides = useMemo(
    () =>
      buildSampleTelemetryOverrides(
        template,
        sampleNode,
        condition,
        valueMap,
        pointHistory,
        manualScalePct,
        POINT_DEFS,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, sampleNode, condition, valueMap, pointHistory, manualScalePct, tickCount],
  );

  const stageGridSize = useMemo(() => {
    if (sizePreset === 'compact') return { w: 6, h: 6 };
    if (sizePreset === 'wide') return { w: 10, h: 7 };
    return template.defaultSize;
  }, [sizePreset, template.defaultSize]);

  // 24 列宽换算展示像素宽，限制在合适视觉范围
  const cardWidthPx = Math.max(320, Math.min(720, stageGridSize.w * 56));
  const cardMinHeightPx = Math.max(220, Math.min(500, stageGridSize.h * 38));

  const selectedElement: CardElementSchema | undefined = useMemo(
    () => template.elements.find((e) => e.id === selectedElId) ?? template.elements[0],
    [selectedElId, template.elements],
  );

  const cs = template.cardStyle;

  const handleExportOne = () => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClone = async () => {
    await onCloneTemplate(template);
    setClonedTip('已另存为自定义模板副本');
    window.setTimeout(() => setClonedTip(null), 2600);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[88vh] rounded-2xl border border-border-strong bg-bg-panel shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="h-12 px-4 border-b border-border-subtle bg-bg-elevated flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="h-7 px-2.5 rounded-lg border border-border-subtle bg-bg-panel hover:bg-bg-hover text-xs text-text-secondary flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 返回列表
            </button>
            <div className="h-4 w-px bg-border-subtle" />
            <span className="text-sm font-bold text-text-primary truncate">{template.name}</span>
            <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent text-[10px] font-mono shrink-0">
              {CATEGORY_TEXT[template.category]}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-bg-canvas border border-border-subtle text-text-muted text-[10px] font-mono shrink-0">
              {template.defaultSize.w}×{template.defaultSize.h} · {template.isBuiltin ? '官方内置' : '自定义'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportOne}
              className="h-7 px-2.5 rounded-lg border border-border-subtle bg-bg-panel hover:bg-bg-hover text-xs text-text-secondary flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> 导出 JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"
              title="关闭详情预览"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主体：左/中实时渲染空间 + 右结构检查区 */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* 左/中渲染舞台 */}
          <div className="flex-1 min-w-0 flex flex-col bg-[#050a14] relative overflow-hidden">
            {/* 顶部画布环境控制条 */}
            <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between gap-2 flex-wrap z-10">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                  <Maximize2 className="w-3 h-3 text-sky-400" /> 画布尺寸:
                </span>
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSizePreset(p.id)}
                    className={`px-2 py-1 rounded-md text-[11px] border transition ${
                      sizePreset === p.id
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 font-semibold'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.id === 'default'
                      ? `默认 (${template.defaultSize.w}×${template.defaultSize.h})`
                      : p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                  <Layers className="w-3 h-3 text-sky-400" /> 背景底图:
                </span>
                <button
                  type="button"
                  onClick={() => setBackdropMode('grid')}
                  className={`px-2 py-1 rounded-md text-[11px] border ${
                    backdropMode === 'grid'
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 font-semibold'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400'
                  }`}
                >
                  深空点阵网格
                </button>
                <button
                  type="button"
                  onClick={() => setBackdropMode('scene')}
                  className={`px-2 py-1 rounded-md text-[11px] border ${
                    backdropMode === 'scene'
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 font-semibold'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400'
                  }`}
                >
                  模拟 3D 厂站场景
                </button>
              </div>
            </div>

            {/* 中央舞台 */}
            <div
              className="flex-1 min-h-0 relative flex items-center justify-center p-6 overflow-auto"
              style={
                backdropMode === 'scene'
                  ? {
                      background:
                        'radial-gradient(circle at 30% 25%, rgba(14,165,233,0.22), transparent 55%), radial-gradient(circle at 75% 75%, rgba(16,185,129,0.16), transparent 50%), linear-gradient(160deg, #071326 0%, #030712 100%)',
                    }
                  : {
                      backgroundImage:
                        'radial-gradient(rgba(56,189,248,0.18) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }
              }
            >
              {backdropMode === 'scene' ? (
                <div className="absolute inset-0 pointer-events-none opacity-25 flex items-center justify-center">
                  <div className="w-[520px] h-[260px] rounded-full border border-sky-400/40 rotate-[-14deg] blur-[1px]" />
                </div>
              ) : null}

              {/* 真实比例卡片本体 */}
              <div
                className="relative studio-glass rounded-xl flex flex-col overflow-hidden shadow-2xl border border-sky-400/30 transition-all duration-300"
                style={{
                  width: `${cardWidthPx}px`,
                  minHeight: `${cardMinHeightPx}px`,
                  backgroundColor: cs?.background || undefined,
                  borderColor: cs?.borderColor || undefined,
                  borderRadius: cs?.borderRadius !== undefined ? `${cs.borderRadius}px` : undefined,
                  backdropFilter: cs?.blurPx !== undefined ? `blur(${cs.blurPx}px)` : undefined,
                }}
              >
                <div className="h-8 px-3 border-b border-border-subtle flex items-center justify-between shrink-0 bg-slate-950/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        condition === 'alarm'
                          ? 'bg-red-500 animate-ping'
                          : condition === 'warn'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                    />
                    <span className="text-xs font-semibold text-text-primary truncate">
                      {template.bindCatalogKind ? `${sampleNode.tag} · ${template.name}` : template.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted">
                    {stageGridSize.w}×{stageGridSize.h} 栅格
                  </span>
                </div>

                <div className="p-3 flex-1 overflow-y-auto">
                  <PreviewOverrideProvider
                    value={{
                      previewNode: sampleNode,
                      valueOverrides: overrides.valueOverrides,
                      historyOverrides: overrides.historyOverrides,
                      defOverrides: overrides.defOverrides,
                      highlightElementId: selectedElId,
                      onPreviewSelectElement: (id) => setSelectedElId(id),
                    }}
                  >
                    <CustomElementsBody
                      widgetId={`detail-${template.id}`}
                      elements={template.elements}
                      sceneBinding={{ targetNodeId: sampleNode.id, targetCatalogKind: template.bindCatalogKind }}
                      isEditing={false}
                    />
                  </PreviewOverrideProvider>
                </div>
              </div>

              {/* 左下角：关联 3D 设备同框预览小窗 */}
              {template.bindCatalogKind && bindCatalogMeta ? (
                <div className="hidden md:block absolute bottom-4 left-4 z-10">
                  {show3DWidget ? (
                    <div className="w-44 rounded-xl border border-sky-500/35 bg-slate-950/90 backdrop-blur-md p-2 shadow-xl space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-sky-300 font-semibold flex items-center gap-1 truncate">
                          <Box className="w-3 h-3 shrink-0" /> {bindCatalogMeta.labelZh}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShow3DWidget(false)}
                          className="text-slate-400 hover:text-slate-200 px-1"
                        >
                          收起
                        </button>
                      </div>
                      <AssetPreview
                        kind={template.bindCatalogKind}
                        alt={bindCatalogMeta.labelZh}
                        hovered={true}
                        className="h-24"
                      />
                      <div className="text-[9px] font-mono text-slate-400 truncate">
                        样本位号：{sampleNode.tag}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShow3DWidget(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-sky-500/35 text-[11px] text-sky-300 flex items-center gap-1 shadow-lg"
                    >
                      <Box className="w-3.5 h-3.5" /> 展开关联 3D 设备
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {/* 底部仿真控制条 */}
            <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/85 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSimPlaying((v) => !v)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
                    simPlaying
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {simPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {simPlaying ? '实时仿真推流中' : '仿真已暂停'}
                </button>

                <div className="h-4 w-px bg-slate-800" />

                <span className="text-[11px] text-slate-400">工况模拟：</span>
                <button
                  type="button"
                  onClick={() => {
                    setCondition('normal');
                    setManualScalePct(0);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] border flex items-center gap-1 ${
                    condition === 'normal'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 font-semibold'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" /> 正常
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCondition('warn');
                    setManualScalePct(0);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] border flex items-center gap-1 ${
                    condition === 'warn'
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 font-semibold'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Activity className="w-3 h-3" /> 预警
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCondition('alarm');
                    setManualScalePct(0);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] border flex items-center gap-1 ${
                    condition === 'alarm'
                      ? 'bg-red-500/20 border-red-400/50 text-red-300 font-semibold'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" /> 超限告警
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>测点幅值微调</span>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={manualScalePct}
                  onChange={(e) => setManualScalePct(Number(e.target.value))}
                  className="w-24 accent-sky-400 cursor-pointer"
                />
                <span className="font-mono w-10 text-right text-sky-300">
                  {manualScalePct >= 0 ? `+${manualScalePct}%` : `${manualScalePct}%`}
                </span>
              </div>
            </div>
          </div>

          {/* 右侧检查器与操作面板 */}
          <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border-subtle bg-bg-panel p-4 flex flex-col justify-between gap-4 overflow-y-auto text-xs">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                  模板说明与设备映射
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {template.description || '可复用大屏组态卡片模板，支持拖拽排布与实时遥测绑定。'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-bg-canvas/70 border border-border-subtle">
                  <div className="text-[10px] text-text-muted">关联 3D 模型</div>
                  <div className="font-semibold text-text-primary mt-0.5 truncate">
                    {bindCatalogMeta ? bindCatalogMeta.labelZh : '通用无绑定'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-bg-canvas/70 border border-border-subtle">
                  <div className="text-[10px] text-text-muted">演示样本位号</div>
                  <div className="font-mono font-bold text-accent mt-0.5 truncate">
                    {sampleNode.tag}
                  </div>
                </div>
              </div>

              {/* 原子元素列表（点击高亮联动） */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-accent flex items-center justify-between">
                  <span>原子元素结构 ({template.elements.length})</span>
                  <span className="text-[10px] font-normal text-text-muted">点击可定位高亮</span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {template.elements.map((el) => {
                    const active = selectedElement?.id === el.id;
                    const modeText =
                      el.binding?.mode === 'device-slot'
                        ? `设备槽位 (${el.binding.deviceSlot?.prop ?? 'metric'} #${el.binding.deviceSlot?.metricIndex ?? 0})`
                        : el.binding?.mode === 'point'
                          ? `直绑测点 (${el.binding.pointKey ?? '--'})`
                          : '静态文案/样式';
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => setSelectedElId(el.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl border transition ${
                          active
                            ? 'border-cyan-400/70 bg-cyan-500/10'
                            : 'border-border-subtle bg-bg-canvas/60 hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-text-primary truncate">{el.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-bg-panel border border-border-subtle text-[9px] font-mono text-text-muted shrink-0">
                            {el.type} · {el.layout.colSpan}/12
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-text-muted mt-1 truncate">
                          {modeText}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 当前选中元素详细绑定规则 */}
              {selectedElement ? (
                <div className="p-3 rounded-xl bg-bg-canvas/75 border border-border-subtle space-y-2">
                  <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    选中元素：{selectedElement.name}
                  </div>
                  <div className="text-[10px] font-mono text-text-secondary space-y-1">
                    <div>
                      解析测点：
                      <span className="text-cyan-300">
                        {resolveTemplateElementPointKey(selectedElement, sampleNode) ?? '静态/设备属性'}
                      </span>
                    </div>
                    <div>
                      单位与精度：{selectedElement.binding?.format?.unit || '--'} / 小数{' '}
                      {selectedElement.binding?.format?.precision ?? 2} 位
                    </div>
                    {selectedElement.binding?.thresholds?.length ? (
                      <div className="pt-1 space-y-1">
                        <div className="text-text-muted">告警阈值规则：</div>
                        {selectedElement.binding.thresholds.map((rule, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-0.5 rounded bg-bg-panel border border-border-subtle flex items-center justify-between"
                          >
                            <span>
                              值 {rule.operator} {rule.value}
                            </span>
                            <span className="flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: rule.color }}
                              />
                              {rule.blink ? '闪烁' : '变色'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-text-muted">暂未配置阈值变色规则</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* 底部业务操作 */}
            <div className="space-y-2 pt-2 border-t border-border-subtle shrink-0">
              {clonedTip ? (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[11px] text-emerald-300 text-center">
                  {clonedTip}
                </div>
              ) : null}

              {canManage ? (
                <button
                  type="button"
                  onClick={() => void handleClone()}
                  className="w-full h-9 rounded-xl border border-border-subtle bg-bg-canvas hover:bg-bg-hover text-text-primary font-medium text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-accent" /> 克隆为自定义模板
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => onApplyToProject(template)}
                className="w-full h-9 rounded-xl bg-accent hover:brightness-110 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
              >
                <LayoutDashboard className="w-4 h-4" /> 应用到厂站工程大屏
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CardTemplateDetailViewer;
