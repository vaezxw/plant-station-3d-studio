import type { FC } from 'react';
import {
  Activity,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Grid,
  Layers,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { getCatalogItem } from '../../domain/catalog';
import type { PointValue } from '../../data/points';
import {
  createDefaultGroundConfig,
  createDefaultPipeFlow,
  type GroundStyle,
  type PipeEdge,
  type PipeFlowConfig,
  type PipeFlowMode,
  type Vec3,
} from '../../domain/schema';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { POINT_CATALOG, useTelemetryStore } from '../../store/useTelemetryStore';

const SWATCHES = ['#1555b0', '#b8c4d0', '#2b3340', '#0e7490', '#1d4ed8', '#475569', '#b45309'];
const FLOW_SWATCHES = ['#38bdf8', '#67e8f9', '#34d399', '#fbbf24', '#f87171'];

const FLOW_MODES: { id: PipeFlowMode; label: string; desc: string }[] = [
  { id: 'uv-chevron', label: '箭头光带', desc: '金属管外挂高对比箭头' },
  { id: 'glass-stream', label: '透明视镜', desc: '硼硅玻璃管内液流芯柱' },
  { id: '3d-arrow', label: '3D 箭标', desc: '沿管路推进立体流向环' },
  { id: 'none', label: '关闭流动', desc: '仅显示静态工业金属管' },
];

const PipeFlowConfigurator: FC<{
  flow: PipeFlowConfig;
  allow3dArrow: boolean;
  valueMap: Record<string, PointValue>;
  onChange: (patch: Partial<PipeFlowConfig>, recordHistory?: boolean) => void;
}> = ({ flow, allow3dArrow, valueMap, onChange }) => {
  const boundPv = flow.bindPointId ? valueMap[flow.bindPointId] : undefined;
  const boundDef = flow.bindPointId ? POINT_CATALOG.find((p) => p.id === flow.bindPointId) : undefined;
  const boundActive =
    !flow.bindPointId ||
    (boundPv && boundPv.quality !== 'BAD' && boundPv.value !== null && Number(boundPv.value) > 0.01);

  return (
    <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> 管道流动组件
        </span>
        <button
          type="button"
          onClick={() => onChange({ enabled: !flow.enabled }, true)}
          className={`px-2 py-0.5 rounded text-[10px] border transition ${
            flow.enabled && flow.mode !== 'none'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-bg-elevated text-text-muted border-border-subtle'
          }`}
        >
          {flow.enabled && flow.mode !== 'none' ? '流动中' : '已停流'}
        </button>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] text-text-muted">流动视觉样式</span>
        <div className="grid grid-cols-2 gap-1.5">
          {FLOW_MODES.filter((m) => allow3dArrow || m.id !== '3d-arrow').map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                onChange({ mode: m.id, enabled: m.id === 'none' ? false : true }, true)
              }
              title={m.desc}
              className={`h-7 rounded border text-[11px] transition ${
                flow.mode === m.id
                  ? 'bg-accent/20 border-border-strong text-accent font-medium'
                  : 'bg-bg-elevated border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] text-text-muted">输送方向</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ direction: 'forward' }, true)}
            className={`h-7 rounded border text-[11px] flex items-center justify-center gap-1 transition ${
              flow.direction === 'forward'
                ? 'bg-accent/20 border-border-strong text-accent'
                : 'bg-bg-elevated border-border-subtle text-text-muted hover:text-text-primary'
            }`}
          >
            正向 (起→终)
          </button>
          <button
            type="button"
            onClick={() => onChange({ direction: 'reverse' }, true)}
            className={`h-7 rounded border text-[11px] flex items-center justify-center gap-1 transition ${
              flow.direction === 'reverse'
                ? 'bg-accent/20 border-border-strong text-accent'
                : 'bg-bg-elevated border-border-subtle text-text-muted hover:text-text-primary'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" /> 反向 (终→起)
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-text-muted">
          <span>基准流速倍率</span>
          <span className="font-mono text-text-primary">{flow.speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.2}
          max={3.0}
          step={0.1}
          value={flow.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) }, false)}
          className="w-full accent-sky-400"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">流向指示色彩</span>
          {flow.color ? (
            <button
              type="button"
              onClick={() => onChange({ color: undefined }, true)}
              className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" /> 随介质
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FLOW_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChange({ color: hex }, true)}
              className={`w-4 h-4 rounded-full border transition ${
                flow.color === hex ? 'border-white scale-110' : 'border-white/20'
              }`}
              style={{ background: hex }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-border-subtle/60">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-muted">SCADA 测点联动驱动</span>
          {flow.bindPointId ? (
            <span className={boundActive ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
              {boundActive ? '运行流动' : '停流'}
            </span>
          ) : null}
        </div>
        <select
          value={flow.bindPointId ?? ''}
          onChange={(e) => onChange({ bindPointId: e.target.value || undefined }, true)}
          className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-border-strong"
        >
          <option value="">恒定流动（不绑定测点）</option>
          {POINT_CATALOG.map((p) => (
            <option key={p.id} value={p.id}>
              {p.tag} · {p.name}
            </option>
          ))}
        </select>
        {flow.bindPointId && boundDef ? (
          <div className="text-[10px] font-mono text-text-muted">
            当前值：{boundPv?.value ?? '--'} {boundDef.unit}（流量 &gt; 0 自动加速，为 0 自动停流）
          </div>
        ) : null}
      </div>
    </div>
  );
};

const GROUND_STYLE_OPTIONS: { id: GroundStyle; label: string; desc: string }[] = [
  { id: 'weathered-concrete', label: '做旧工业混凝土地坪', desc: '水磨斑驳微反光质感' },
  { id: 'epoxy-dark', label: '深蓝灰环氧防静电地坪', desc: '洁净泵房高光泽地坪' },
  { id: 'slate-matte', label: '冷峻深板岩地坪', desc: '低反光重工业水泥' },
  { id: 'steel-grid-floor', label: '防滑花纹工业钢板', desc: '金属凸点拼装平台地' },
  { id: 'grid-only', label: '纯净仅网格地面', desc: '隐藏实面仅留工程网格' },
];

const InspectorPanel: FC = () => {
  const project = useProjectStore((s) => s.project);
  const updateNode = useProjectStore((s) => s.updateNode);
  const updatePipe = useProjectStore((s) => s.updatePipe);
  const updateGroundConfig = useProjectStore((s) => s.updateGroundConfig);
  const addNodeFromCatalog = useProjectStore((s) => s.addNodeFromCatalog);
  const duplicateNode = useProjectStore((s) => s.duplicateNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removePipe = useProjectStore((s) => s.removePipe);

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectedPipeId = useEditorStore((s) => s.selectedPipeId);
  const showGrid = useEditorStore((s) => s.showGrid);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const setSelectedPipeId = useEditorStore((s) => s.setSelectedPipeId);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const valueMap = useTelemetryStore((s) => s.valueMap);

  const node = project.nodes.find((n) => n.id === selectedNodeId);
  const pipe = project.pipes.find((p) => p.id === selectedPipeId);
  const ground = project.ground ?? createDefaultGroundConfig();

  if (!rightPanelOpen) {
    return (
      <button
        type="button"
        onClick={() => setRightPanelOpen(true)}
        className="absolute right-3 top-3 z-20 studio-glass px-2.5 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 shadow-lg"
        title="展开属性检查器"
      >
        <ChevronLeft className="w-4 h-4 text-accent" />
        <span>属性</span>
      </button>
    );
  }

  const updatePos = (idx: 0 | 1 | 2, val: number) => {
    if (!node || Number.isNaN(val)) return;
    const next: Vec3 = [...node.position] as Vec3;
    next[idx] = val;
    updateNode(node.id, { position: next }, true);
  };

  const updateScaleAxis = (idx: 0 | 1 | 2, val: number) => {
    if (!node || Number.isNaN(val) || val <= 0.05) return;
    const next: Vec3 = [...node.scale] as Vec3;
    next[idx] = val;
    updateNode(node.id, { scale: next }, true);
  };

  const updateScaleUniform = (val: number) => {
    if (!node || Number.isNaN(val) || val <= 0.05) return;
    updateNode(node.id, { scale: [val, val, val] }, true);
  };

  const rotYDeg = node ? Math.round((node.rotation[1] * 180) / Math.PI) : 0;
  const isFloorComponent = node?.kind === 'FLOOR_SLAB' || node?.kind === 'BASE_PAD';
  const isFlowNodeComponent =
    node?.kind === 'PIPE' || node?.kind === 'PIPE_ELBOW' || node?.kind === 'SIGHT_GLASS';

  return (
    <aside className="w-64 xl:w-72 shrink-0 h-full border-l border-border-subtle bg-bg-panel flex flex-col z-10 select-none">
      <div className="h-10 px-3 border-b border-border-subtle flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-text-primary">属性检查器</span>
        <button
          type="button"
          onClick={() => setRightPanelOpen(false)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          title="收起属性面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {pipe ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-accent-soft border border-border-strong space-y-1">
            <div className="font-mono font-bold text-accent">工艺管路 · {pipe.medium.toUpperCase()}</div>
            <div className="text-text-secondary">
              起点：{project.nodes.find((n) => n.id === pipe.fromNodeId)?.tag ?? pipe.fromNodeId} ({pipe.fromPort})
            </div>
            <div className="text-text-secondary">
              终点：{project.nodes.find((n) => n.id === pipe.toNodeId)?.tag ?? pipe.toNodeId} ({pipe.toPort})
            </div>
          </div>

          <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2.5">
            <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
              管路材质与口径
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">介质类型</span>
              <select
                value={pipe.medium}
                onChange={(e) =>
                  updatePipe(pipe.id, { medium: e.target.value as PipeEdge['medium'] }, true)
                }
                className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
              >
                <option value="gas">工艺/燃气 (304 拉丝不锈钢管)</option>
                <option value="water">冷却/工艺水 (工业钴蓝管)</option>
                <option value="air">仪控空气 (镀锌金属管)</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">公称通径 (DN)</span>
              <select
                value={pipe.diameterMm}
                onChange={(e) =>
                  updatePipe(pipe.id, { diameterMm: Number(e.target.value) }, true)
                }
                className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono text-text-primary focus:outline-none focus:border-border-strong"
              >
                {[50, 80, 100, 125, 150, 200, 250].map((dn) => (
                  <option key={dn} value={dn}>
                    DN{dn}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <PipeFlowConfigurator
            flow={{ ...createDefaultPipeFlow(), ...pipe.flow }}
            allow3dArrow
            valueMap={valueMap}
            onChange={(patch, recordHistory = true) => {
              const cur = { ...createDefaultPipeFlow(), ...pipe.flow };
              updatePipe(pipe.id, { flow: { ...cur, ...patch } }, recordHistory);
            }}
          />

          <button
            type="button"
            onClick={() => {
              removePipe(pipe.id);
              setSelectedPipeId(null);
            }}
            className="w-full h-8 rounded border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> 删除此管段
          </button>
        </div>
      ) : !node ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 text-xs text-text-secondary">
          <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-1.5">
            <div className="font-semibold text-text-primary">{project.name}</div>
            <div className="text-text-muted">设备数量：{project.nodes.length} 台套</div>
            <div className="text-text-muted">工艺管线：{project.pipes.length} 条</div>
            <div className="text-text-muted">视角书签：{project.bookmarks.length} 个</div>
          </div>

          {/* 可配置工业地坪组件（保留网格地面） */}
          <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> 厂房地坪组件
              </span>
              <button
                type="button"
                onClick={() => updateGroundConfig({ enabled: !ground.enabled }, true)}
                className={`px-2 py-0.5 rounded text-[10px] border transition ${
                  ground.enabled && ground.style !== 'grid-only'
                    ? 'bg-accent/20 text-accent border-border-strong'
                    : 'bg-bg-elevated text-text-muted border-border-subtle'
                }`}
              >
                {ground.enabled && ground.style !== 'grid-only' ? '已启用' : '已隐藏'}
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">地坪表面材质</span>
              <select
                value={ground.style}
                onChange={(e) => {
                  const style = e.target.value as GroundStyle;
                  updateGroundConfig(
                    {
                      style,
                      enabled: style !== 'grid-only',
                      roughness:
                        style === 'epoxy-dark'
                          ? 0.34
                          : style === 'slate-matte'
                            ? 0.84
                            : style === 'steel-grid-floor'
                              ? 0.44
                              : 0.48,
                    },
                    true,
                  );
                }}
                className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
              >
                {GROUND_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateGroundConfig({ shape: 'rect' }, true)}
                className={`h-7 rounded border text-[11px] transition ${
                  ground.shape === 'rect'
                    ? 'bg-accent/20 border-border-strong text-accent'
                    : 'bg-bg-elevated border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                矩形厂区地坪
              </button>
              <button
                type="button"
                onClick={() => updateGroundConfig({ shape: 'circle' }, true)}
                className={`h-7 rounded border text-[11px] transition ${
                  ground.shape === 'circle'
                    ? 'bg-accent/20 border-border-strong text-accent'
                    : 'bg-bg-elevated border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                圆形展台地坪
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>地坪宽度 (X)</span>
                <span className="font-mono text-text-primary">{ground.width} m</span>
              </div>
              <input
                type="range"
                min={14}
                max={56}
                step={2}
                value={ground.width}
                onChange={(e) => updateGroundConfig({ width: Number(e.target.value) }, false)}
                className="w-full accent-sky-400"
              />
            </div>

            {ground.shape === 'rect' ? (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>地坪进深 (Z)</span>
                  <span className="font-mono text-text-primary">{ground.depth} m</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={48}
                  step={2}
                  value={ground.depth}
                  onChange={(e) => updateGroundConfig({ depth: Number(e.target.value) }, false)}
                  className="w-full accent-sky-400"
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>表面反光 / 粗糙度</span>
                <span className="font-mono text-text-primary">{ground.roughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.18}
                max={0.92}
                step={0.04}
                value={ground.roughness}
                onChange={(e) => updateGroundConfig({ roughness: Number(e.target.value) }, false)}
                className="w-full accent-sky-400"
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border-subtle/60">
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <Grid className="w-3 h-3 text-accent" /> 工程网格地面 (保留)
              </span>
              <button
                type="button"
                onClick={toggleGrid}
                className={`px-2 py-0.5 rounded text-[10px] border transition ${
                  showGrid
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-bg-elevated text-text-muted border-border-subtle'
                }`}
              >
                {showGrid ? '网格已开启' : '网格已关'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">金属收口嵌边</span>
              <button
                type="button"
                onClick={() => updateGroundConfig({ showBorder: !ground.showBorder }, true)}
                className={`px-2 py-0.5 rounded text-[10px] border transition ${
                  ground.showBorder
                    ? 'bg-accent/15 text-accent border-border-strong'
                    : 'bg-bg-elevated text-text-muted border-border-subtle'
                }`}
              >
                {ground.showBorder ? '显示' : '隐藏'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const created = addNodeFromCatalog('FLOOR_SLAB', [0, 0, 0]);
                setSelectedNodeId(created.id);
              }}
              className="w-full h-7 rounded border border-border-strong bg-accent/10 hover:bg-accent/20 text-accent text-[11px] flex items-center justify-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" /> 放置独立分区地坪块
            </button>
          </div>

          <div className="space-y-2">
            <div className="font-medium text-text-primary">常用快捷键</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-text-muted">
              <div className="p-1.5 rounded bg-bg-canvas/50 border border-border-subtle">
                <span className="font-mono text-accent">Q / W / E / R</span> 选/移/旋/缩
              </div>
              <div className="p-1.5 rounded bg-bg-canvas/50 border border-border-subtle">
                <span className="font-mono text-accent">P</span> 连管工具
              </div>
              <div className="p-1.5 rounded bg-bg-canvas/50 border border-border-subtle">
                <span className="font-mono text-accent">F</span> 聚焦选中设备
              </div>
              <div className="p-1.5 rounded bg-bg-canvas/50 border border-border-subtle">
                <span className="font-mono text-accent">Ctrl+Z / Y</span> 撤销/重做
              </div>
              <div className="p-1.5 rounded bg-bg-canvas/50 border border-border-subtle">
                <span className="font-mono text-accent">Del</span> 删除设备/管段
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 text-xs">
          {/* 基本工艺属性 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                基础信息
              </span>
              <span className="text-[10px] font-mono text-text-muted">
                {getCatalogItem(node.kind)?.labelZh ?? node.kind}
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">位号 (Tag)</span>
              <input
                value={node.tag}
                onChange={(e) => updateNode(node.id, { tag: e.target.value }, false)}
                className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle font-mono text-text-primary focus:outline-none focus:border-border-strong"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">设备名称</span>
              <input
                value={node.name}
                onChange={(e) => updateNode(node.id, { name: e.target.value }, false)}
                className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-text-muted">所属工段</span>
              <input
                value={node.section}
                onChange={(e) => updateNode(node.id, { section: e.target.value }, false)}
                className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
              />
            </label>

            {node.kind === 'TEXT' ? (
              <label className="block space-y-1">
                <span className="text-[11px] text-text-muted">标牌展示文案</span>
                <input
                  value={node.labelText ?? ''}
                  onChange={(e) => updateNode(node.id, { labelText: e.target.value }, false)}
                  className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
                />
              </label>
            ) : null}

            {isFloorComponent ? (
              <div className="p-2.5 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-2">
                <div className="text-[11px] font-semibold text-accent">
                  地坪 / 基座材质配置
                </div>
                <select
                  value={node.floorStyle ?? 'weathered-concrete'}
                  onChange={(e) =>
                    updateNode(node.id, { floorStyle: e.target.value as GroundStyle }, true)
                  }
                  className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
                >
                  {GROUND_STYLE_OPTIONS.filter((o) => o.id !== 'grid-only').map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-text-muted">
                      <span>长度 (X)</span>
                      <span className="font-mono text-text-primary">{node.scale[0].toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={6}
                      step={0.25}
                      value={node.scale[0]}
                      onChange={(e) => updateScaleAxis(0, Number(e.target.value))}
                      className="w-full accent-sky-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-text-muted">
                      <span>进深 (Z)</span>
                      <span className="font-mono text-text-primary">{node.scale[2].toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={6}
                      step={0.25}
                      value={node.scale[2]}
                      onChange={(e) => updateScaleAxis(2, Number(e.target.value))}
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {isFlowNodeComponent ? (
              <PipeFlowConfigurator
                flow={{ ...createDefaultPipeFlow(), ...node.pipeFlow }}
                allow3dArrow={false}
                valueMap={valueMap}
                onChange={(patch, recordHistory = true) => {
                  const cur = { ...createDefaultPipeFlow(), ...node.pipeFlow };
                  updateNode(node.id, { pipeFlow: { ...cur, ...patch } }, recordHistory);
                }}
              />
            ) : null}
          </div>

          {/* 空间变换 */}
          <div className="border-t border-border-subtle pt-3 space-y-2.5">
            <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
              空间变换 (米 / 度)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                <label key={axis} className="space-y-1">
                  <span className="text-[10px] font-mono text-text-muted">{axis}</span>
                  <input
                    type="number"
                    step={0.25}
                    value={Number(node.position[idx].toFixed(2))}
                    onChange={(e) => updatePos(idx as 0 | 1 | 2, Number(e.target.value))}
                    className="w-full h-7 px-1.5 rounded bg-bg-canvas border border-border-subtle font-mono text-text-primary focus:outline-none focus:border-border-strong"
                  />
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>水平旋转 (Y 轴)</span>
                <span className="font-mono text-text-primary">{rotYDeg}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={15}
                value={rotYDeg}
                onChange={(e) =>
                  updateNode(
                    node.id,
                    { rotation: [node.rotation[0], (Number(e.target.value) * Math.PI) / 180, node.rotation[2]] },
                    true,
                  )
                }
                className="w-full accent-sky-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>整体缩放倍数</span>
                <span className="font-mono text-text-primary">{node.scale[0].toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.5}
                step={0.1}
                value={node.scale[0]}
                onChange={(e) => updateScaleUniform(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          {/* 外观涂装 */}
          <div className="border-t border-border-subtle pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                涂装色彩
              </span>
              {node.color ? (
                <button
                  type="button"
                  onClick={() => updateNode(node.id, { color: undefined }, true)}
                  className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-0.5"
                >
                  <RotateCcw className="w-3 h-3" /> 还原
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => updateNode(node.id, { color: hex }, true)}
                  className={`w-5 h-5 rounded-full border transition ${
                    node.color === hex ? 'border-white scale-110' : 'border-white/20'
                  }`}
                  style={{ background: hex }}
                />
              ))}
            </div>
          </div>

          {/* 关联测点绑定 */}
          <div className="border-t border-border-subtle pt-3 space-y-2">
            <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
              监视测点绑定
            </div>
            <select
              value=""
              onChange={(e) => {
                const pid = e.target.value;
                if (!pid || node.pointIds.includes(pid)) return;
                updateNode(node.id, { pointIds: [...node.pointIds, pid] }, true);
              }}
              className="w-full h-7 px-2 rounded bg-bg-canvas border border-border-subtle text-xs text-text-secondary focus:outline-none focus:border-border-strong"
            >
              <option value="">+ 添加关联测点...</option>
              {POINT_CATALOG.filter((p) => !node.pointIds.includes(p.id)).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tag} · {p.name}
                </option>
              ))}
            </select>

            {node.pointIds.length > 0 ? (
              <div className="space-y-1">
                {node.pointIds.map((pid) => {
                  const def = POINT_CATALOG.find((p) => p.id === pid);
                  const pv = valueMap[pid];
                  return (
                    <div
                      key={pid}
                      className="px-2 py-1 rounded bg-bg-canvas/60 border border-border-subtle flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] text-text-primary truncate">
                          {def?.name ?? pid}
                        </div>
                        <div className="text-[10px] font-mono text-accent">
                          {pv?.value ?? '--'} {def?.unit ?? ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateNode(
                            node.id,
                            { pointIds: node.pointIds.filter((x) => x !== pid) },
                            true,
                          )
                        }
                        className="text-text-muted hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-text-muted">暂未绑定测点，大屏展示时可联动显示实时数据。</div>
            )}
          </div>

          {/* 快捷操作 */}
          <div className="border-t border-border-subtle pt-3 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => triggerCameraView('focus')}
              className="h-7 rounded border border-border-subtle bg-bg-canvas/60 hover:bg-bg-hover text-text-secondary hover:text-text-primary flex items-center justify-center gap-1"
            >
              <Crosshair className="w-3.5 h-3.5" /> 聚焦
            </button>
            <button
              type="button"
              onClick={() => {
                const copy = duplicateNode(node.id);
                if (copy) setSelectedNodeId(copy.id);
              }}
              className="h-7 rounded border border-border-subtle bg-bg-canvas/60 hover:bg-bg-hover text-text-secondary hover:text-text-primary flex items-center justify-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> 复制
            </button>
            <button
              type="button"
              onClick={() => {
                removeNode(node.id);
                setSelectedNodeId(null);
              }}
              className="h-7 rounded border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default InspectorPanel;
