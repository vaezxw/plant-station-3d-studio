import type { FC } from 'react';
import { ChevronLeft, ChevronRight, Copy, Crosshair, RotateCcw, Trash2 } from 'lucide-react';
import { getCatalogItem } from '../../domain/catalog';
import type { Vec3 } from '../../domain/schema';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { POINT_CATALOG, useTelemetryStore } from '../../store/useTelemetryStore';

const SWATCHES = ['#38bdf8', '#d97706', '#ef4444', '#10b981', '#64748b', '#cbd5e1', '#818cf8'];

const InspectorPanel: FC = () => {
  const project = useProjectStore((s) => s.project);
  const updateNode = useProjectStore((s) => s.updateNode);
  const duplicateNode = useProjectStore((s) => s.duplicateNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removePipe = useProjectStore((s) => s.removePipe);

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectedPipeId = useEditorStore((s) => s.selectedPipeId);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useEditorStore((s) => s.setRightPanelOpen);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const setSelectedPipeId = useEditorStore((s) => s.setSelectedPipeId);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const valueMap = useTelemetryStore((s) => s.valueMap);

  const node = project.nodes.find((n) => n.id === selectedNodeId);
  const pipe = project.pipes.find((p) => p.id === selectedPipeId);

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

  const updateScaleUniform = (val: number) => {
    if (!node || Number.isNaN(val) || val <= 0.05) return;
    updateNode(node.id, { scale: [val, val, val] }, true);
  };

  const rotYDeg = node ? Math.round((node.rotation[1] * 180) / Math.PI) : 0;

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
        <div className="p-4 space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-accent-soft border border-border-strong space-y-1">
            <div className="font-mono font-bold text-accent">工艺管路 · {pipe.medium.toUpperCase()}</div>
            <div className="text-text-secondary">
              起点：{project.nodes.find((n) => n.id === pipe.fromNodeId)?.tag ?? pipe.fromNodeId} ({pipe.fromPort})
            </div>
            <div className="text-text-secondary">
              终点：{project.nodes.find((n) => n.id === pipe.toNodeId)?.tag ?? pipe.toNodeId} ({pipe.toPort})
            </div>
            <div className="text-text-muted">公称通径：DN{pipe.diameterMm}</div>
          </div>

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
        <div className="p-4 space-y-4 text-xs text-text-secondary">
          <div className="p-3 rounded-lg bg-bg-canvas/60 border border-border-subtle space-y-1.5">
            <div className="font-semibold text-text-primary">{project.name}</div>
            <div className="text-text-muted">设备数量：{project.nodes.length} 台套</div>
            <div className="text-text-muted">工艺管线：{project.pipes.length} 条</div>
            <div className="text-text-muted">视角书签：{project.bookmarks.length} 个</div>
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
