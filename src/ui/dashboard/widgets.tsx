import type { FC } from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Cpu, Gauge } from 'lucide-react';
import type { DashboardWidgetType } from '../../domain/schema';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { POINT_CATALOG, useTelemetryStore } from '../../store/useTelemetryStore';

function buildLinePath(values: number[], width: number, height: number, pad = 6): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-3, max - min);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return values
    .map((v, idx) => {
      const x = pad + (idx / (values.length - 1)) * innerW;
      const y = pad + (1 - (v - min) / span) * innerH;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const WidgetRenderer: FC<{ type: DashboardWidgetType }> = ({ type }) => {
  const project = useProjectStore((s) => s.project);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const valueMap = useTelemetryStore((s) => s.valueMap);
  const history = useTelemetryStore((s) => s.history);
  const alarms = useTelemetryStore((s) => s.alarms);
  const meterStats = useTelemetryStore((s) => s.meterStats);

  if (type === 'kpi') {
    const p1 = valueMap['HG-UF-101.pressure']?.value ?? 4676.98;
    const t1 = valueMap['HG-UF-101.temperature']?.value ?? 39.55;
    const f1 = valueMap['HG-UF-101.flowWork']?.value ?? 124.5;
    const c1 = valueMap['HG-UF-101.cumStd']?.value ?? 31378607;
    return (
      <div className="grid grid-cols-2 gap-2 h-full content-start">
        <div className="p-2.5 rounded-lg bg-bg-canvas/65 border border-border-subtle">
          <div className="text-[11px] text-text-muted flex items-center gap-1">
            <Gauge className="w-3 h-3 text-accent" /> 入口压力
          </div>
          <div className="text-base font-mono font-bold text-text-primary mt-0.5">
            {p1} <span className="text-[10px] font-normal text-text-muted">kPa</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg-canvas/65 border border-border-subtle">
          <div className="text-[11px] text-text-muted">介质温度</div>
          <div className="text-base font-mono font-bold text-text-primary mt-0.5">
            {t1} <span className="text-[10px] font-normal text-text-muted">℃</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg-canvas/65 border border-border-subtle">
          <div className="text-[11px] text-text-muted">瞬时流量</div>
          <div className="text-base font-mono font-bold text-accent mt-0.5">
            {f1} <span className="text-[10px] font-normal text-text-muted">m³/h</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg-canvas/65 border border-border-subtle">
          <div className="text-[11px] text-text-muted">标况累积</div>
          <div className="text-sm font-mono font-bold text-text-primary mt-1 truncate">
            {c1.toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'trend') {
    const pressures = history.map((h) => h.pressure);
    const flows = history.map((h) => h.flow);
    const pPath = buildLinePath(pressures, 280, 96);
    const fPath = buildLinePath(flows, 280, 96);
    const latest = history[history.length - 1];
    return (
      <div className="flex flex-col h-full justify-between gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-sky-400">压力 {latest?.pressure ?? '--'} kPa</span>
          <span className="text-amber-400">流量 {latest?.flow ?? '--'} m³/h</span>
        </div>
        <div className="flex-1 min-h-0 rounded-lg bg-bg-canvas/70 border border-border-subtle p-1.5 flex items-center">
          <svg viewBox="0 0 280 96" className="w-full h-full overflow-visible">
            <line x1="0" y1="24" x2="280" y2="24" stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
            <line x1="0" y1="48" x2="280" y2="48" stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
            <line x1="0" y1="72" x2="280" y2="72" stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
            <path d={pPath} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
            <path d={fPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex justify-between text-[10px] font-mono text-text-muted">
          <span>{history[0]?.label ?? ''}</span>
          <span>实时采样 ({history.length} 点)</span>
          <span>{latest?.label ?? ''}</span>
        </div>
      </div>
    );
  }

  if (type === 'alarms') {
    return (
      <div className="space-y-2 overflow-y-auto h-full pr-0.5">
        {alarms.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              const target = project.nodes.find((n) => n.tag === a.tag);
              if (target) {
                setSelectedNodeId(target.id);
                triggerCameraView('focus');
              }
            }}
            className="w-full text-left p-2 rounded-lg bg-bg-canvas/65 border border-border-subtle hover:border-border-strong transition text-[11px] space-y-0.5"
          >
            <div className="flex items-center justify-between font-mono">
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {a.tag}
              </span>
              <span className="text-text-muted">{a.time}</span>
            </div>
            <div className="text-text-secondary leading-snug">{a.message}</div>
          </button>
        ))}
      </div>
    );
  }

  if (type === 'production') {
    return (
      <div className="space-y-2.5 h-full flex flex-col justify-between">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-bg-canvas/65 border border-border-subtle">
            <div className="text-[11px] text-text-muted">今日表具下线</div>
            <div className="text-lg font-mono font-bold text-text-primary">
              {meterStats.dailyOutput} <span className="text-[10px] font-normal">台</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-bg-canvas/65 border border-border-subtle">
            <div className="text-[11px] text-text-muted">气密检漏通过</div>
            <div className="text-lg font-mono font-bold text-emerald-400">
              {meterStats.leakTestOk} <span className="text-[10px] font-normal">台</span>
            </div>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg-canvas/65 border border-border-subtle space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 音速喷嘴标定合格率
            </span>
            <span className="font-mono font-bold text-emerald-400">{meterStats.passRate}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full"
              style={{ width: `${meterStats.passRate}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'section-stats') {
    const counts = new Map<string, number>();
    for (const n of project.nodes) {
      counts.set(n.section, (counts.get(n.section) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const total = Math.max(1, project.nodes.length);
    return (
      <div className="space-y-2 overflow-y-auto h-full">
        {entries.map(([sec, cnt]) => (
          <div key={sec} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-text-secondary flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-accent" /> {sec}
              </span>
              <span className="font-mono text-text-primary">{cnt} 台套</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-bg-canvas overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{ width: `${Math.round((cnt / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // detail 选中设备详情
  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) {
    return (
      <div className="text-xs text-text-muted leading-relaxed py-6 text-center flex flex-col items-center gap-2">
        <Cpu className="w-6 h-6 text-accent/60" />
        <span>点击 3D 场景中的任意设备或位号标牌，即可在此联动查看实时测点与工段详情。</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 overflow-y-auto h-full">
      <div className="p-2.5 rounded-lg bg-accent-soft border border-border-strong">
        <div className="font-mono text-sm font-bold text-accent">{selectedNode.tag}</div>
        <div className="text-xs font-medium text-text-primary mt-0.5">{selectedNode.name}</div>
        <div className="text-[11px] text-text-muted mt-0.5">
          工段：{selectedNode.section} · 类型：{selectedNode.kind}
        </div>
      </div>

      {selectedNode.pointIds.length === 0 ? (
        <div className="text-[11px] text-text-muted">
          该设备暂未绑定测点（可在「3D 搭建 → 属性检查器」中绑定）。
        </div>
      ) : (
        <div className="space-y-1.5">
          {selectedNode.pointIds.map((pid) => {
            const def = POINT_CATALOG.find((p) => p.id === pid);
            const pv = valueMap[pid];
            return (
              <div
                key={pid}
                className="px-2.5 py-1.5 rounded-lg bg-bg-canvas/65 border border-border-subtle flex items-center justify-between text-xs"
              >
                <span className="text-text-secondary flex items-center gap-1">
                  <Activity className="w-3 h-3 text-accent" />
                  {def?.name ?? pid}
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  {pv?.value ?? '--'} {def?.unit ?? ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
