import { useEffect, useMemo, useState, type FC } from 'react';
import { CheckCircle2, Database, Play, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import {
  createDefaultDataSources,
  type DataSourceConfig,
  type DataSourceType,
} from '../../domain/schema';
import { testDataSourceConnection, type ParsedTelemetryItem } from '../../engine/DataSourceManager';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';

const FALLBACK_DATA_SOURCES = createDefaultDataSources();

const SAMPLE_STATIC_JSON = JSON.stringify(
  {
    data: {
      points: [
        { id: 'PLC_P201_PRESS', name: '主泵出口压力', value: 0.42, unit: 'MPa', quality: 'GOOD' },
        { id: 'PLC_HX301_TEMP', name: '换热出口温度', value: 38.6, unit: '℃', quality: 'GOOD' },
        { id: 'PLC_FLOW_MAIN', name: '主管道瞬时流量', value: 132.4, unit: 'm³/h', quality: 'GOOD' },
      ],
    },
  },
  null,
  2,
);

const DataSourceModal: FC = () => {
  const open = useEditorStore((s) => s.dataSourceModalOpen);
  const setOpen = useEditorStore((s) => s.setDataSourceModalOpen);

  const project = useProjectStore((s) => s.project);
  const upsertDataSource = useProjectStore((s) => s.upsertDataSource);
  const removeDataSource = useProjectStore((s) => s.removeDataSource);

  const sourceStatuses = useTelemetryStore((s) => s.sourceStatuses);
  const ingestExternalPoints = useTelemetryStore((s) => s.ingestExternalPoints);

  const sources = useMemo(
    () => project.dataSources ?? FALLBACK_DATA_SOURCES,
    [project.dataSources],
  );
  const [selectedId, setSelectedId] = useState<string>(sources[0]?.id ?? 'builtin-sim');
  const [draft, setDraft] = useState<DataSourceConfig>(sources[0]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    items: ParsedTelemetryItem[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const hit = sources.find((s) => s.id === selectedId) ?? sources[0];
    if (hit) {
      setDraft(JSON.parse(JSON.stringify(hit)) as DataSourceConfig);
      if (hit.id !== selectedId) setSelectedId(hit.id);
    }
    setTestResult(null);
  }, [open, selectedId, sources]);

  if (!open) return null;

  const handleAddSource = () => {
    const id = `ds-${Date.now().toString(36)}`;
    const next: DataSourceConfig = {
      id,
      name: `外部 SCADA 接口 ${sources.length}`,
      type: 'static-json',
      enabled: true,
      staticJson: SAMPLE_STATIC_JSON,
      http: { url: '/api/scada/points', method: 'GET', pollIntervalMs: 3000 },
      realtime: { url: 'ws://127.0.0.1:8080/ws/telemetry', reconnectMs: 5000 },
      parser: {
        mode: 'array',
        dataPath: 'data.points',
        idField: 'id',
        valueField: 'value',
        qualityField: 'quality',
      },
    };
    upsertDataSource(next);
    setSelectedId(id);
  };

  const handleSave = () => {
    upsertDataSource(draft);
    if (draft.type === 'static-json' && draft.enabled) {
      void testDataSourceConnection(draft).then((res) => {
        if (res.ok && res.items.length > 0) ingestExternalPoints(draft.id, res.items);
      });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const res = await testDataSourceConnection(draft);
    setTestResult(res);
    if (res.ok && res.items.length > 0) {
      ingestExternalPoints(draft.id, res.items);
    }
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl h-[78vh] studio-glass border border-border-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        <div className="h-12 px-4 border-b border-border-subtle flex items-center justify-between bg-bg-elevated">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">
              SCADA 多数据源管理与外部接口对接配置
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 bg-sky-500/10 border-b border-border-subtle text-[11px] text-sky-200 flex items-center justify-between gap-2">
          <span>
            双模运行说明：嵌入 SCADA（<code className="font-mono text-accent">?embed=scada&amp;dataMode=bridge</code>）时由宿主通过 <code className="font-mono text-accent">postMessage</code> 实时喂数，无需重复连 MQTT；独立大屏投屏时可启用下方 HTTP / WebSocket 直连。
          </span>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* 左：数据源列表 */}
          <div className="w-60 border-r border-border-subtle p-3 flex flex-col gap-2 bg-bg-canvas/50">
            <button
              type="button"
              onClick={handleAddSource}
              className="w-full h-8 rounded-lg border border-border-strong bg-accent-soft hover:bg-accent hover:text-slate-950 text-accent font-semibold flex items-center justify-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" /> 新增外部数据源
            </button>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
              {sources.map((s) => {
                const st = sourceStatuses[s.id];
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer space-y-1 transition ${
                      selectedId === s.id
                        ? 'bg-accent-soft border-border-strong'
                        : 'bg-bg-elevated/60 border-border-subtle hover:bg-bg-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-text-primary truncate">{s.name}</span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          st?.status === 'active'
                            ? 'bg-emerald-400'
                            : st?.status === 'error'
                              ? 'bg-red-400'
                              : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-text-muted flex justify-between">
                      <span>{s.type}</span>
                      <span>{s.enabled ? '已启用' : '已停用'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右：详细配置与报文预览 */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 space-y-1">
                <span className="text-[11px] text-text-muted">数据源名称</span>
                <input
                  value={draft.name}
                  disabled={draft.type === 'builtin-sim'}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full h-8 px-2.5 rounded bg-bg-canvas border border-border-subtle text-text-primary disabled:opacity-60"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] text-text-muted">接入协议类型</span>
                <select
                  value={draft.type}
                  disabled={draft.type === 'builtin-sim'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      type: e.target.value as DataSourceType,
                      http: draft.http ?? { url: '/api/scada/points', method: 'GET', pollIntervalMs: 3000 },
                      realtime: draft.realtime ?? { url: 'ws://127.0.0.1:8080/ws/telemetry', reconnectMs: 5000 },
                      staticJson: draft.staticJson ?? SAMPLE_STATIC_JSON,
                      parser: draft.parser ?? {
                        mode: 'array',
                        dataPath: 'data.points',
                        idField: 'id',
                        valueField: 'value',
                        qualityField: 'quality',
                      },
                    })
                  }
                  className="w-full h-8 px-2 rounded bg-bg-canvas border border-border-subtle text-text-primary disabled:opacity-60"
                >
                  {draft.type === 'builtin-sim' ? (
                    <option value="builtin-sim">内置仿真引擎</option>
                  ) : null}
                  <option value="static-json">静态 JSON 调试源</option>
                  <option value="http-rest">HTTP / REST 轮询接口</option>
                  <option value="websocket">WebSocket 实时推送</option>
                </select>
              </label>
            </div>

            {draft.type === 'builtin-sim' ? (
              <div className="p-4 rounded-xl bg-bg-canvas/60 border border-border-subtle space-y-2">
                <div className="text-accent font-medium">内置 SCADA 工艺仿真源</div>
                <p className="text-text-secondary leading-relaxed">
                  当前内置 22 路标准工业测点，按 1.5s 周期步进供 3D 管道流动与大屏卡片演示。如需接入甲方真实 SCADA / PLC 网关，请点击左侧「+ 新增外部数据源」配置 HTTP 轮询或 WebSocket 推送并完成字段映射，大屏与 3D 管网将直接消费标准点表。
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-bg-canvas/60 border border-border-subtle">
                  <span className="text-text-secondary">启用此数据源实时同步</span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
                    className={`px-3 py-1 rounded border text-[11px] ${
                      draft.enabled
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-bg-elevated border-border-subtle text-text-muted'
                    }`}
                  >
                    {draft.enabled ? '已开启' : '已停用'}
                  </button>
                </div>

                {draft.type === 'http-rest' ? (
                  <div className="p-3 rounded-xl bg-bg-canvas/60 border border-border-subtle space-y-2.5">
                    <div className="font-medium text-accent">HTTP 轮询接口配置</div>
                    <div className="grid grid-cols-4 gap-2">
                      <select
                        value={draft.http?.method ?? 'GET'}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            http: {
                              url: draft.http?.url ?? '',
                              pollIntervalMs: draft.http?.pollIntervalMs ?? 3000,
                              method: e.target.value as 'GET' | 'POST',
                            },
                          })
                        }
                        className="h-8 px-2 rounded bg-bg-elevated border border-border-subtle font-mono"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                      <input
                        value={draft.http?.url ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            http: {
                              method: draft.http?.method ?? 'GET',
                              pollIntervalMs: draft.http?.pollIntervalMs ?? 3000,
                              url: e.target.value,
                            },
                          })
                        }
                        placeholder="/api/scada/points 或 http://..."
                        className="col-span-2 h-8 px-2.5 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                      <input
                        type="number"
                        min={1000}
                        step={500}
                        value={draft.http?.pollIntervalMs ?? 3000}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            http: {
                              method: draft.http?.method ?? 'GET',
                              url: draft.http?.url ?? '',
                              pollIntervalMs: Number(e.target.value),
                            },
                          })
                        }
                        title="轮询周期 (ms)"
                        className="h-8 px-2 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                    </div>
                  </div>
                ) : null}

                {draft.type === 'websocket' ? (
                  <div className="p-3 rounded-xl bg-bg-canvas/60 border border-border-subtle space-y-2.5">
                    <div className="font-medium text-accent">WebSocket 推送地址配置</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={draft.realtime?.url ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            realtime: {
                              reconnectMs: draft.realtime?.reconnectMs ?? 5000,
                              url: e.target.value,
                            },
                          })
                        }
                        placeholder="ws://127.0.0.1:8080/ws/telemetry"
                        className="col-span-2 h-8 px-2.5 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={draft.realtime?.reconnectMs ?? 5000}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            realtime: {
                              url: draft.realtime?.url ?? '',
                              reconnectMs: Number(e.target.value),
                            },
                          })
                        }
                        title="断线重连间隔 (ms)"
                        className="h-8 px-2 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                    </div>
                  </div>
                ) : null}

                {draft.type === 'static-json' ? (
                  <label className="block space-y-1">
                    <span className="text-[11px] text-text-muted">粘贴第三方模拟响应报文（用于联调字段映射与直接测试大屏联动）</span>
                    <textarea
                      rows={6}
                      value={draft.staticJson ?? SAMPLE_STATIC_JSON}
                      onChange={(e) => setDraft({ ...draft, staticJson: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-[11px] text-text-primary"
                    />
                  </label>
                ) : null}

                {/* 通用报文解析与字段映射 */}
                <div className="p-3 rounded-xl bg-bg-canvas/60 border border-border-subtle space-y-2">
                  <div className="font-medium text-accent">通用 JSON 响应解析与字段映射</div>
                  <div className="grid grid-cols-4 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-text-muted">结构格式</span>
                      <select
                        value={draft.parser?.mode ?? 'array'}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            parser: { ...draft.parser, mode: e.target.value as 'array' | 'key-value' },
                          })
                        }
                        className="w-full h-7 px-1.5 rounded bg-bg-elevated border border-border-subtle"
                      >
                        <option value="array">点表数组 Array</option>
                        <option value="key-value">键值字典 Object</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-text-muted">数据路径 (dataPath)</span>
                      <input
                        value={draft.parser?.dataPath ?? ''}
                        placeholder="如 data.points"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            parser: {
                              mode: draft.parser?.mode ?? 'array',
                              ...draft.parser,
                              dataPath: e.target.value,
                            },
                          })
                        }
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-text-muted">点位 ID 字段</span>
                      <input
                        value={draft.parser?.idField ?? 'id'}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            parser: {
                              mode: draft.parser?.mode ?? 'array',
                              ...draft.parser,
                              idField: e.target.value,
                            },
                          })
                        }
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-text-muted">数值字段</span>
                      <input
                        value={draft.parser?.valueField ?? 'value'}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            parser: {
                              mode: draft.parser?.mode ?? 'array',
                              ...draft.parser,
                              valueField: e.target.value,
                            },
                          })
                        }
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono"
                      />
                    </label>
                  </div>
                </div>

                {/* 操作按钮与解析结果预览 */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      removeDataSource(draft.id);
                      setSelectedId('builtin-sim');
                    }}
                    className="h-8 px-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 删除数据源
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={testing}
                      onClick={() => void handleTest()}
                      className="h-8 px-3.5 rounded-lg border border-border-strong bg-accent/15 hover:bg-accent/25 text-accent font-medium flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" /> {testing ? '测试中...' : '测试连接并预览解析'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="h-8 px-4 rounded-lg bg-accent text-slate-950 font-semibold"
                    >
                      保存配置并应用
                    </button>
                  </div>
                </div>

                {testResult ? (
                  <div className="p-3 rounded-xl bg-bg-canvas/80 border border-border-subtle space-y-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      {testResult.ok ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">
                            解析成功：共识别 {testResult.items.length} 个测点并已实时注入遥测总线
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400">连接失败：{testResult.error}</span>
                        </>
                      )}
                    </div>
                    {testResult.items.length > 0 ? (
                      <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                        {testResult.items.map((it) => (
                          <div
                            key={it.id}
                            className="px-2 py-1 rounded bg-bg-elevated border border-border-subtle flex items-center justify-between"
                          >
                            <span className="text-text-secondary truncate">{it.name ?? it.id}</span>
                            <span className="text-accent font-bold">
                              {it.value ?? '--'} {it.unit ?? ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSourceModal;
