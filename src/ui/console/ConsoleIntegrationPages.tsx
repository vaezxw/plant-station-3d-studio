import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Database,
  HardDrive,
  Play,
  Plus,
  Radio,
  Send,
  Server,
  Trash2,
} from 'lucide-react';
import { buildPreviewUrls } from '../../domain/runtimeUrl';
import {
  createDefaultDataSources,
  type DataSourceConfig,
  type DataSourceType,
} from '../../domain/schema';
import { testDataSourceConnection, type ParsedTelemetryItem } from '../../engine/DataSourceManager';
import {
  PLANT_3D_BRIDGE_CHANNEL,
  PLANT_3D_BRIDGE_VERSION,
} from '../../engine/ScadaBridge';
import { useProjectStore } from '../../store/useProjectStore';
import { usePublishStore } from '../../store/usePublishStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';

const FALLBACK_SOURCES = createDefaultDataSources();

const SAMPLE_JSON = JSON.stringify(
  {
    data: {
      points: [
        { id: 'PLC_P201_PRESS', name: '主泵出口压力', value: 0.44, unit: 'MPa', quality: 'GOOD' },
        { id: 'PLC_HX301_TEMP', name: '换热出口温度', value: 39.2, unit: '℃', quality: 'GOOD' },
      ],
    },
  },
  null,
  2,
);

export const ConsoleDataSourcesPage: FC = () => {
  const project = useProjectStore((s) => s.project);
  const upsertDataSource = useProjectStore((s) => s.upsertDataSource);
  const removeDataSource = useProjectStore((s) => s.removeDataSource);
  const sourceStatuses = useTelemetryStore((s) => s.sourceStatuses);
  const ingestExternalPoints = useTelemetryStore((s) => s.ingestExternalPoints);

  const sources = useMemo(() => project.dataSources ?? FALLBACK_SOURCES, [project.dataSources]);
  const [selectedId, setSelectedId] = useState(sources[0]?.id ?? 'builtin-sim');
  const [draft, setDraft] = useState<DataSourceConfig>(sources[0]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    items: ParsedTelemetryItem[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    const hit = sources.find((s) => s.id === selectedId) ?? sources[0];
    if (hit) {
      setDraft(JSON.parse(JSON.stringify(hit)) as DataSourceConfig);
      if (hit.id !== selectedId) setSelectedId(hit.id);
    }
    setTestResult(null);
  }, [selectedId, sources]);

  const handleAdd = () => {
    const id = `ds-${Date.now().toString(36)}`;
    const next: DataSourceConfig = {
      id,
      name: `外部 SCADA 接口 ${sources.length}`,
      type: 'static-json',
      enabled: true,
      staticJson: SAMPLE_JSON,
      http: { url: '/api/scada/points', method: 'GET', pollIntervalMs: 3000 },
      realtime: { url: 'ws://127.0.0.1:8080/ws/telemetry', reconnectMs: 5000 },
      parser: { mode: 'array', dataPath: 'data.points', idField: 'id', valueField: 'value', qualityField: 'quality' },
    };
    upsertDataSource(next);
    setSelectedId(id);
  };

  const handleTest = async () => {
    setTesting(true);
    const res = await testDataSourceConnection(draft);
    setTestResult(res);
    if (res.ok && res.items.length > 0) ingestExternalPoints(draft.id, res.items);
    setTesting(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" /> SCADA 数据源管理（当前工程：{project.name}）
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            配置独立投屏直连数据源（HTTP REST / WebSocket / Static JSON）；嵌入 SCADA 时自动切换宿主 MQTT 桥接模式
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="h-9 px-4 rounded-xl bg-accent text-slate-950 font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> 新增外部数据源
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 space-y-2">
          {sources.map((s) => {
            const st = sourceStatuses[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selectedId === s.id
                    ? 'bg-accent-soft border-border-strong'
                    : 'bg-bg-panel border-border-subtle hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary truncate">{s.name}</span>
                  <span className="font-mono text-[10px] text-accent">{s.type}</span>
                </div>
                <div className="text-[11px] text-text-muted mt-1">{st?.message ?? (s.enabled ? '就绪' : '已停用')}</div>
              </button>
            );
          })}
        </div>

        <div className="col-span-12 lg:col-span-8 p-5 rounded-2xl border border-border-subtle bg-bg-panel space-y-4">
          {draft.type === 'builtin-sim' ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-text-primary">{draft.name}</div>
              <p className="text-text-secondary">
                内置仿真引擎每 1.5 秒推送 22 个工艺标准点位变化值（当页面处于 SCADA `bridge` 模式时自动挂起不干扰真实数据）。
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-text-muted">数据源名称</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-text-muted">接入协议</span>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value as DataSourceType })}
                    className="w-full h-8 px-2 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary"
                  >
                    <option value="http-rest">HTTP REST 定时轮询</option>
                    <option value="websocket">WebSocket 实时推流</option>
                    <option value="static-json">静态 JSON 模拟报文</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 h-8 px-3 rounded-lg bg-bg-canvas border border-border-subtle w-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                      className="accent-sky-400"
                    />
                    <span>启用此数据源</span>
                  </label>
                </div>
              </div>

              {draft.type === 'static-json' ? (
                <label className="block space-y-1">
                  <span className="text-text-muted">模拟 JSON 报文内容</span>
                  <textarea
                    rows={6}
                    value={draft.staticJson ?? ''}
                    onChange={(e) => setDraft({ ...draft, staticJson: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono text-[11px] text-text-primary"
                  />
                </label>
              ) : draft.type === 'http-rest' ? (
                <div className="grid grid-cols-3 gap-2">
                  <label className="col-span-2 space-y-1">
                    <span className="text-text-muted">接口 URL</span>
                    <input
                      value={draft.http?.url ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          http: { method: 'GET', pollIntervalMs: 3000, ...draft.http, url: e.target.value },
                        })
                      }
                      className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-text-muted">轮询间隔 (ms)</span>
                    <input
                      type="number"
                      value={draft.http?.pollIntervalMs ?? 3000}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          http: { method: 'GET', url: '', ...draft.http, pollIntervalMs: Number(e.target.value) },
                        })
                      }
                      className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono"
                    />
                  </label>
                </div>
              ) : (
                <label className="block space-y-1">
                  <span className="text-text-muted">WebSocket 服务地址</span>
                  <input
                    value={draft.realtime?.url ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        realtime: { reconnectMs: 5000, ...draft.realtime, url: e.target.value },
                      })
                    }
                    className="w-full h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono"
                  />
                </label>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    removeDataSource(draft.id);
                    setSelectedId('builtin-sim');
                  }}
                  className="h-8 px-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 删除
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => void handleTest()}
                    className="h-8 px-3.5 rounded-lg border border-border-strong bg-accent/15 text-accent font-medium flex items-center gap-1"
                  >
                    <Play className="w-3.5 h-3.5" /> {testing ? '测试中...' : '测试解析'}
                  </button>
                  <button
                    type="button"
                    onClick={() => upsertDataSource(draft)}
                    className="h-8 px-4 rounded-lg bg-accent text-slate-950 font-semibold"
                  >
                    保存配置
                  </button>
                </div>
              </div>

              {testResult ? (
                <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle space-y-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    {testResult.ok ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">识别 {testResult.items.length} 个测点</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">{testResult.error}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const ConsoleIntegrationPage: FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const settings = usePublishStore((s) => s.settings);
  const publishedList = usePublishStore((s) => s.publishedList);
  const updateSettings = usePublishStore((s) => s.updateSettings);
  const testRemoteConnection = usePublishStore((s) => s.testRemoteConnection);

  const [selectedSceneId, setSelectedSceneId] = useState(publishedList[0]?.sceneId ?? '');
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [connRes, setConnRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [logs, setLogs] = useState<{ id: string; dir: string; type: string; detail: string }[]>([]);

  const selectedScene = publishedList.find((p) => p.sceneId === selectedSceneId) ?? publishedList[0];
  const embedUrl = selectedScene
    ? buildPreviewUrls({
        sceneId: selectedScene.sceneId,
        token: selectedScene.shareToken,
        requireToken: selectedScene.requireToken,
      }).scadaEmbedUrl
    : '';

  useEffect(() => {
    if (!sandboxRunning) return;
    const onMsg = (ev: MessageEvent<unknown>) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const d = ev.data as { channel?: string; type?: string; payload?: unknown };
      if (d?.channel === PLANT_3D_BRIDGE_CHANNEL && d.type) {
        setLogs((prev) => [
          { id: `${Date.now()}-${Math.random()}`, dir: '3D -> HOST', type: d.type!, detail: JSON.stringify(d.payload ?? {}) },
          ...prev.slice(0, 29),
        ]);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [sandboxRunning]);

  const sendMsg = (type: string, payload: unknown) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { channel: PLANT_3D_BRIDGE_CHANNEL, version: PLANT_3D_BRIDGE_VERSION, type, payload },
      window.location.origin,
    );
    setLogs((prev) => [
      { id: `${Date.now()}-${Math.random()}`, dir: 'HOST -> 3D', type, detail: JSON.stringify(payload) },
      ...prev.slice(0, 29),
    ]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 text-xs">
      <div>
        <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Radio className="w-5 h-5 text-accent" /> SCADA 联调中心
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          集中配置选项 B 发布后端接口并在线通过真实 &lt;iframe&gt; 沙盒测试 SCADA postMessage 双向交互
        </p>
      </div>

      {/* 选项 B 后端存储配置 */}
      <div className="p-4 rounded-2xl border border-border-subtle bg-bg-panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-accent flex items-center gap-1.5">
            <Server className="w-4 h-4" /> 发布存储适配引擎（选项 B）
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ storageMode: 'local-mock' })}
              className={`px-3 py-1 rounded-lg border flex items-center gap-1 ${
                settings.storageMode === 'local-mock' ? 'bg-accent text-slate-950 border-transparent font-semibold' : 'border-border-subtle'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" /> 本地发布仓 (IndexedDB)
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ storageMode: 'remote-api' })}
              className={`px-3 py-1 rounded-lg border flex items-center gap-1 ${
                settings.storageMode === 'remote-api' ? 'bg-accent text-slate-950 border-transparent font-semibold' : 'border-border-subtle'
              }`}
            >
              <Server className="w-3.5 h-3.5" /> 远程后端接口 (REST)
            </button>
          </div>
        </div>

        {settings.storageMode === 'remote-api' ? (
          <div className="grid grid-cols-12 gap-2">
            <input
              value={settings.apiBaseUrl}
              onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
              placeholder="Base URL"
              className="col-span-6 h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono"
            />
            <input
              value={settings.authHeaderValue}
              onChange={(e) => updateSettings({ authHeaderValue: e.target.value })}
              placeholder="Authorization Token (选填)"
              className="col-span-4 h-8 px-2.5 rounded-lg bg-bg-canvas border border-border-subtle font-mono"
            />
            <button
              type="button"
              onClick={() => void testRemoteConnection().then(setConnRes)}
              className="col-span-2 h-8 rounded-lg bg-accent-soft border border-border-strong text-accent font-medium"
            >
              测试连通性
            </button>
          </div>
        ) : null}
        {connRes ? (
          <div className={connRes.ok ? 'text-emerald-400' : 'text-red-400'}>{connRes.message}</div>
        ) : null}
      </div>

      {/* 嵌入式联调沙盒 */}
      <div className="grid grid-cols-12 gap-4 min-h-[460px]">
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <select
              value={selectedScene?.sceneId ?? ''}
              onChange={(e) => {
                setSelectedSceneId(e.target.value);
                setSandboxRunning(false);
              }}
              className="flex-1 h-8 px-2.5 rounded-lg bg-bg-panel border border-border-subtle text-text-primary"
            >
              {publishedList.length === 0 ? (
                <option value="">暂无已发布大屏（请先在编辑器发布）</option>
              ) : (
                publishedList.map((p) => (
                  <option key={p.sceneId} value={p.sceneId}>
                    {p.title} (v{p.revision} · {p.sceneId})
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={!embedUrl}
              onClick={() => {
                setLogs([]);
                setSandboxRunning((v) => !v);
              }}
              className="h-8 px-4 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
            >
              {sandboxRunning ? '停止沙盒' : '启动嵌入沙盒'}
            </button>
          </div>

          <div className="flex-1 min-h-[420px] rounded-2xl border border-border-strong bg-slate-950 overflow-hidden">
            {sandboxRunning && embedUrl ? (
              <iframe ref={iframeRef} src={embedUrl} title="SCADA 联调沙盒" className="w-full h-full border-0" />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted">
                选择已发布大屏并点击「启动嵌入沙盒」测试 MQTT 推送与双向联动
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">
          <div className="p-3.5 rounded-2xl border border-border-subtle bg-bg-panel space-y-2">
            <div className="font-semibold text-text-primary flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-accent" /> 模拟宿主推流控制
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!sandboxRunning}
                onClick={() =>
                  sendMsg('TELEMETRY_PUSH', {
                    items: [
                      { id: 'HG-UF-101.pressure', value: Number((4700 + Math.random() * 80).toFixed(2)), quality: 'GOOD' },
                      { id: 'HG-UF-101.flowWork', value: Number((130 + Math.random() * 15).toFixed(2)), quality: 'GOOD' },
                    ],
                  })
                }
                className="h-8 rounded-lg bg-accent-soft border border-border-strong text-accent disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <Send className="w-3 h-3" /> 推测点帧
              </button>
              <button
                type="button"
                disabled={!sandboxRunning}
                onClick={() =>
                  sendMsg('ALARM_PUSH', {
                    alarm: {
                      id: 'int-alm-1',
                      pointId: 'HG-UF-101.pressure',
                      level: 'critical',
                      tag: 'P-201',
                      message: '模拟压力告警测试',
                      time: new Date().toTimeString().slice(0, 8),
                      active: true,
                    },
                  })
                }
                className="h-8 rounded-lg bg-red-500/15 border border-red-400/40 text-red-300 disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" /> 模拟告警
              </button>
              <button
                type="button"
                disabled={!sandboxRunning}
                onClick={() => sendMsg('FOCUS_TARGET', { tag: 'P-201' })}
                className="h-8 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <Crosshair className="w-3 h-3 text-accent" /> 聚焦 P-201
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[300px] p-3.5 rounded-2xl border border-border-subtle bg-bg-panel flex flex-col gap-2">
            <div className="font-semibold text-text-primary">双向 postMessage 通信报文</div>
            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[10px]">
              {logs.map((l) => (
                <div key={l.id} className="p-2 rounded-lg bg-bg-canvas border border-border-subtle">
                  <div className={l.dir === '3D -> HOST' ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>
                    [{l.dir}] {l.type}
                  </div>
                  <div className="text-text-secondary break-all">{l.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
