import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Crosshair,
  ExternalLink,
  FolderOpen,
  Globe,
  HardDrive,
  Layers,
  Play,
  RefreshCw,
  Rocket,
  Send,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { generateSceneId, generateShareToken } from '../../api/scenePublishClient';
import { buildPreviewUrls } from '../../domain/runtimeUrl';
import type { DataFeedMode, PublishedSceneSummary } from '../../domain/schema';
import { captureProjectCompositeSnapshot } from '../../engine/CompositeThumbnail';
import {
  PLANT_3D_BRIDGE_CHANNEL,
  PLANT_3D_BRIDGE_VERSION,
  collectProjectBoundPointKeys,
} from '../../engine/ScadaBridge';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { usePublishStore } from '../../store/usePublishStore';

type PublishTab = 'publish' | 'library' | 'sandbox';

type BridgeLogEntry = {
  id: string;
  dir: 'HOST -> 3D' | '3D -> HOST';
  type: string;
  detail: string;
  time: string;
};

const PublishSceneModal: FC = () => {
  const open = useEditorStore((s) => s.publishModalOpen);
  const setOpen = useEditorStore((s) => s.setPublishModalOpen);
  const setMode = useEditorStore((s) => s.setMode);

  const project = useProjectStore((s) => s.project);

  const settings = usePublishStore((s) => s.settings);
  const publishedList = usePublishStore((s) => s.publishedList);
  const loading = usePublishStore((s) => s.loading);
  const publishing = usePublishStore((s) => s.publishing);
  const lastPublished = usePublishStore((s) => s.lastPublished);
  const updateSettings = usePublishStore((s) => s.updateSettings);
  const refreshList = usePublishStore((s) => s.refreshList);
  const publishCurrentProject = usePublishStore((s) => s.publishCurrentProject);
  const loadPublishedIntoStudio = usePublishStore((s) => s.loadPublishedIntoStudio);
  const deletePublished = usePublishStore((s) => s.deletePublished);
  const testRemoteConnection = usePublishStore((s) => s.testRemoteConnection);

  const [tab, setTab] = useState<PublishTab>('publish');
  const [stationCode, setStationCode] = useState('');
  const [title, setTitle] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [requireToken, setRequireToken] = useState(true);
  const [embedDefaultDataMode, setEmbedDefaultDataMode] = useState<DataFeedMode>('auto');
  const [publishAsNew, setPublishAsNew] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | undefined>(undefined);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [connTest, setConnTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingConn, setTestingConn] = useState(false);

  // 联调沙盒状态
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxFocusTag, setSandboxFocusTag] = useState('');
  const [alarmActive, setAlarmActive] = useState(false);
  const [bridgeLogs, setBridgeLogs] = useState<BridgeLogEntry[]>([]);

  useEffect(() => {
    if (!open) {
      setSandboxRunning(false);
      return;
    }
    void refreshList();
    setTitle(project.name);
    setStationCode(project.stationCode ?? '');
    void captureProjectCompositeSnapshot(project).then((shot) => {
      if (shot) setThumbUrl(shot);
    });
    setPublishMsg(null);
    setConnTest(null);
    setPublishAsNew(false);
    setSandboxFocusTag(project.nodes[0]?.tag ?? '');
  }, [open, project.name, project.stationCode, project.nodes, refreshList]);

  useEffect(() => {
    if (!open) return;
    const existing = publishedList.find((x) => x.sceneId === project.publishedSceneId);
    if (existing) {
      setShareToken(existing.shareToken);
      setRequireToken(existing.requireToken);
      setEmbedDefaultDataMode(existing.embedDefaultDataMode);
    } else if (!shareToken) {
      setShareToken(generateShareToken());
    }
  }, [open, publishedList, project.publishedSceneId, shareToken]);

  const activeSummary: PublishedSceneSummary | undefined = useMemo(() => {
    if (lastPublished && (lastPublished.sceneId === project.publishedSceneId || publishAsNew)) {
      return lastPublished;
    }
    if (project.publishedSceneId) {
      return publishedList.find((x) => x.sceneId === project.publishedSceneId);
    }
    return lastPublished ?? publishedList[0];
  }, [lastPublished, project.publishedSceneId, publishedList, publishAsNew]);

  const urls = useMemo(() => {
    if (!activeSummary) return null;
    return buildPreviewUrls({
      sceneId: activeSummary.sceneId,
      token: activeSummary.shareToken,
      requireToken: activeSummary.requireToken,
      standaloneDataMode: activeSummary.embedDefaultDataMode,
    });
  }, [activeSummary]);

  const appendLog = (dir: BridgeLogEntry['dir'], type: string, detail: string) => {
    const entry: BridgeLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dir,
      type,
      detail,
      time: new Date().toTimeString().slice(0, 8),
    };
    setBridgeLogs((prev) => [entry, ...prev].slice(0, 40));
  };

  useEffect(() => {
    if (!open || tab !== 'sandbox') return;
    const onMsg = (ev: MessageEvent<unknown>) => {
      if (!ev.data || typeof ev.data !== 'object') return;
      const msg = ev.data as { channel?: string; type?: string; payload?: unknown };
      if (msg.channel !== PLANT_3D_BRIDGE_CHANNEL || !msg.type) return;
      if (ev.source !== iframeRef.current?.contentWindow) return;
      appendLog('3D -> HOST', msg.type, JSON.stringify(msg.payload ?? {}));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [open, tab]);

  if (!open) return null;

  const copyText = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const handlePublish = async () => {
    setPublishMsg(null);
    try {
      const targetSceneId = publishAsNew
        ? generateSceneId(stationCode)
        : project.publishedSceneId || generateSceneId(stationCode);
      const rec = await publishCurrentProject({
        sceneId: targetSceneId,
        stationCode: stationCode.trim() || undefined,
        title: title.trim() || project.name,
        shareToken: shareToken.trim() || generateShareToken(),
        requireToken,
        embedDefaultDataMode,
        thumbnailDataUrl: thumbUrl,
      });
      setPublishAsNew(false);
      setShareToken(rec.shareToken);
      setPublishMsg({
        ok: true,
        text: `发布成功！场景 ${rec.sceneId} 已更新至版本 v${rec.revision}，预览链接保持稳定可直接嵌入 SCADA。`,
      });
    } catch (err) {
      setPublishMsg({
        ok: false,
        text: err instanceof Error ? err.message : '发布失败，请检查存储配置',
      });
    }
  };

  const postToSandbox = (type: string, payload: unknown) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const msg = {
      channel: PLANT_3D_BRIDGE_CHANNEL,
      version: PLANT_3D_BRIDGE_VERSION,
      requestId: `req-${Date.now()}`,
      type,
      payload,
    };
    win.postMessage(msg, window.location.origin);
    appendLog('HOST -> 3D', type, JSON.stringify(payload));
  };

  const sendTelemetryPulse = () => {
    const keys = collectProjectBoundPointKeys(project);
    const targetIds = keys.length > 0 ? keys : ['HG-UF-101.pressure', 'HG-UF-101.flowWork', 'HG-UF-101.temperature'];
    const items = targetIds.map((id, idx) => {
      const base = id.includes('pressure')
        ? 4720
        : id.includes('temperature')
          ? 36.5
          : id.includes('cum')
            ? 31500000
            : 138;
      const val = Number((base + (Math.random() - 0.5) * (base * 0.08 + idx)).toFixed(2));
      return { id, value: val, quality: 'GOOD' as const, ts: new Date().toISOString() };
    });
    postToSandbox('TELEMETRY_PUSH', { items });
  };

  const toggleSandboxAlarm = () => {
    const nextAlarm = !alarmActive;
    setAlarmActive(nextAlarm);
    const node = project.nodes.find((n) => n.tag === sandboxFocusTag) ?? project.nodes[0];
    const pointId = node?.pointIds[0] ?? node?.customPoints?.[0]?.key ?? 'HG-UF-101.pressure';
    postToSandbox('ALARM_PUSH', {
      alarm: {
        id: 'sandbox-alm-1',
        pointId,
        level: 'critical',
        tag: node?.tag ?? 'P-201',
        message: nextAlarm ? `SCADA 联调告警：${node?.name ?? '主设备'} 出口压力超上限` : '告警已消除',
        time: new Date().toTimeString().slice(0, 8),
        active: nextAlarm,
      },
    });
  };

  const sendFocusTarget = () => {
    if (!sandboxFocusTag) return;
    postToSandbox('FOCUS_TARGET', { tag: sandboxFocusTag });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-5xl h-[84vh] studio-glass border border-border-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* 头部 */}
        <div className="h-12 px-4 border-b border-border-subtle flex items-center justify-between bg-bg-elevated shrink-0">
          <div className="flex items-center gap-2.5">
            <Rocket className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">
              3D 大屏发布中心 · 预览链接生成 &amp; SCADA 嵌入式接入
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                settings.storageMode === 'remote-api'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-400/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
              }`}
            >
              {settings.storageMode === 'remote-api' ? '选项B · 远程后端REST' : '选项B · 本地发布仓(IndexedDB预留)'}
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

        {/* 导航 Tabs */}
        <div className="px-4 py-2 border-b border-border-subtle bg-bg-panel/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'publish', label: '发布与生成链接', icon: Globe },
                { id: 'library', label: `已发布场景 (${publishedList.length}) & 后端配置`, icon: Layers },
                { id: 'sandbox', label: 'SCADA 桥接联调沙盒 & 协议', icon: Code2 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    active
                      ? 'bg-accent text-slate-950 font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-text-muted font-mono">
            当前工程：{project.name} {project.publishedSceneId ? `· ${project.publishedSceneId}` : '· 尚未发布'}
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === 'publish' ? (
            <div className="grid grid-cols-12 gap-4">
              {/* 左侧发布表单 */}
              <div className="col-span-7 space-y-3">
                <div className="p-3.5 rounded-xl bg-bg-canvas/60 border border-border-subtle space-y-3">
                  <div className="font-semibold text-accent flex items-center justify-between">
                    <span>1. 厂站关联与发布元数据</span>
                    {project.publishedSceneId ? (
                      <label className="flex items-center gap-1.5 text-[11px] text-text-secondary font-normal cursor-pointer">
                        <input
                          type="checkbox"
                          checked={publishAsNew}
                          onChange={(e) => setPublishAsNew(e.target.checked)}
                          className="accent-sky-400"
                        />
                        另存为全新独立链接（不覆盖原 sceneId）
                      </label>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-[11px] text-text-muted">大屏发布标题</span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-text-muted">绑定 SCADA 采集点 / 厂站编码</span>
                      <input
                        value={stationCode}
                        onChange={(e) => setStationCode(e.target.value)}
                        placeholder="如 PUMP_201 或采集点 ID"
                        className="w-full h-8 px-2.5 rounded-lg bg-bg-elevated border border-border-subtle font-mono text-text-primary"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-[11px] text-text-muted">独立打开时默认数据模式</span>
                      <select
                        value={embedDefaultDataMode}
                        onChange={(e) => setEmbedDefaultDataMode(e.target.value as DataFeedMode)}
                        className="w-full h-8 px-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary"
                      >
                        <option value="auto">自动（有外部直连走直连，否则演示仿真）</option>
                        <option value="direct">仅直连（使用数据源弹窗 HTTP/WS 接口）</option>
                        <option value="sim">内置工艺仿真（适合演示投屏）</option>
                        <option value="bridge">强制等待宿主 postMessage 推送</option>
                      </select>
                    </label>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>访问令牌校验 (shareToken)</span>
                        <label className="flex items-center gap-1 cursor-pointer text-text-secondary">
                          <input
                            type="checkbox"
                            checked={requireToken}
                            onChange={(e) => setRequireToken(e.target.checked)}
                            className="accent-sky-400"
                          />
                          启用校验
                        </label>
                      </div>
                      <div className="flex gap-1">
                        <input
                          value={shareToken}
                          disabled={!requireToken}
                          onChange={(e) => setShareToken(e.target.value)}
                          className="flex-1 h-8 px-2 rounded-lg bg-bg-elevated border border-border-subtle font-mono text-text-primary disabled:opacity-40"
                        />
                        <button
                          type="button"
                          onClick={() => setShareToken(generateShareToken())}
                          title="刷新随机 Token"
                          className="h-8 px-2 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-text-secondary"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-text-muted">
                    嵌入 SCADA 时默认走 <span className="text-accent font-mono">dataMode=bridge</span>（复用宿主 MQTT），重发布自动保留同链接并递增版本号。
                  </div>
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => void handlePublish()}
                    className="h-9 px-5 rounded-xl bg-accent hover:brightness-110 text-slate-950 font-semibold flex items-center gap-1.5 shrink-0 shadow-lg disabled:opacity-50"
                  >
                    <Rocket className="w-4 h-4" />
                    {publishing
                      ? '发布中...'
                      : project.publishedSceneId && !publishAsNew
                        ? '更新发布 (链接不变 · 版本+1)'
                        : '发布并生成预览链接'}
                  </button>
                </div>

                {publishMsg ? (
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2 ${
                      publishMsg.ok
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/10 border-red-500/40 text-red-300'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{publishMsg.text}</span>
                  </div>
                ) : null}

                {urls && activeSummary ? (
                  <div className="p-3.5 rounded-xl bg-bg-canvas/75 border border-border-strong space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-accent">
                        2. 已生成可用预览链接（{activeSummary.sceneId} · v{activeSummary.revision}）
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTab('sandbox');
                          setSandboxRunning(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-accent/15 border border-border-strong text-accent hover:bg-accent/25 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> 进入联调沙盒测试
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-emerald-300 font-medium">
                        ⭐ SCADA 嵌入专用链接（贴入 SCADA 采集点配置，自动走宿主 MQTT 桥接，隐藏多余工具栏）
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          readOnly
                          value={urls.scadaEmbedUrl}
                          className="flex-1 h-8 px-2.5 rounded-lg bg-bg-elevated border border-border-subtle font-mono text-[11px] text-text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => copyText('scada', urls.scadaEmbedUrl)}
                          className="h-8 px-3 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-text-primary flex items-center gap-1 shrink-0"
                        >
                          {copiedKey === 'scada' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(urls.scadaEmbedUrl, '_blank', 'noopener')}
                          className="h-8 px-2.5 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-text-secondary flex items-center gap-1 shrink-0"
                          title="新窗口打开验证"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-text-muted">
                        标准独立大屏预览链接（用于电视大屏投屏 / 独立演示）
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          readOnly
                          value={urls.standaloneUrl}
                          className="flex-1 h-8 px-2.5 rounded-lg bg-bg-elevated border border-border-subtle font-mono text-[11px] text-text-secondary"
                        />
                        <button
                          type="button"
                          onClick={() => copyText('standalone', urls.standaloneUrl)}
                          className="h-8 px-3 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-text-primary flex items-center gap-1 shrink-0"
                        >
                          {copiedKey === 'standalone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(urls.standaloneUrl, '_blank', 'noopener')}
                          className="h-8 px-2.5 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-hover text-text-secondary flex items-center gap-1 shrink-0"
                          title="新窗口打开预览"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 右侧场景预览抓图 */}
              <div className="col-span-5 space-y-3">
                <div className="p-3.5 rounded-xl bg-bg-canvas/60 border border-border-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">实时 3D 视口缩略图快照</span>
                    <button
                      type="button"
                      onClick={() => {
                        void captureProjectCompositeSnapshot(project).then((s) => {
                          if (s) setThumbUrl(s);
                        });
                      }}
                      className="px-2 py-1 rounded bg-bg-elevated border border-border-subtle hover:border-border-strong text-[11px] text-accent flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" /> 重新合成抓图
                    </button>
                  </div>
                  <div className="aspect-video rounded-lg bg-slate-950 border border-border-subtle overflow-hidden flex items-center justify-center">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="3D预览缩略图" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-text-muted">切入 3D 或大屏视图后可自动截取缩略图</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-lg bg-bg-elevated border border-border-subtle">
                      <div className="text-[10px] text-text-muted">3D 设备数</div>
                      <div className="font-mono text-sm font-bold text-text-primary">{project.nodes.length}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-elevated border border-border-subtle">
                      <div className="text-[10px] text-text-muted">工艺管线</div>
                      <div className="font-mono text-sm font-bold text-text-primary">{project.pipes.length}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-elevated border border-border-subtle">
                      <div className="text-[10px] text-text-muted">大屏卡片</div>
                      <div className="font-mono text-sm font-bold text-accent">
                        {(project.dashboardWidgets ?? []).filter((w) => w.visible).length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'library' ? (
            <div className="space-y-4">
              {/* 存储适配器配置（选项B 预留切换） */}
              <div className="p-3.5 rounded-xl bg-bg-canvas/65 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-accent flex items-center gap-1.5">
                    <Server className="w-4 h-4" /> 发布存储适配模式（选择 B 后端接口预留）
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSettings({ storageMode: 'local-mock' })}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1 ${
                        settings.storageMode === 'local-mock'
                          ? 'bg-accent text-slate-950 border-transparent font-semibold'
                          : 'bg-bg-elevated text-text-secondary border-border-subtle'
                      }`}
                    >
                      <HardDrive className="w-3.5 h-3.5" /> 本地发布仓 (IndexedDB)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ storageMode: 'remote-api' })}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1 ${
                        settings.storageMode === 'remote-api'
                          ? 'bg-accent text-slate-950 border-transparent font-semibold'
                          : 'bg-bg-elevated text-text-secondary border-border-subtle'
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" /> 远程后端接口 (HTTP REST)
                    </button>
                  </div>
                </div>

                {settings.storageMode === 'remote-api' ? (
                  <div className="grid grid-cols-12 gap-2 pt-1">
                    <label className="col-span-5 space-y-1">
                      <span className="text-[10px] text-text-muted">场景服务 Base URL (POST /publish 等)</span>
                      <input
                        value={settings.apiBaseUrl}
                        onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
                        placeholder="https://scada.maobaoinfo.com/hub/api/scene3d"
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono text-text-primary"
                      />
                    </label>
                    <label className="col-span-2 space-y-1">
                      <span className="text-[10px] text-text-muted">鉴权 Header 键名</span>
                      <input
                        value={settings.authHeaderName}
                        onChange={(e) => updateSettings({ authHeaderName: e.target.value })}
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono text-text-primary"
                      />
                    </label>
                    <label className="col-span-3 space-y-1">
                      <span className="text-[10px] text-text-muted">Token / 密钥值 (选填)</span>
                      <input
                        value={settings.authHeaderValue}
                        onChange={(e) => updateSettings({ authHeaderValue: e.target.value })}
                        placeholder="Bearer xxx"
                        className="w-full h-7 px-2 rounded bg-bg-elevated border border-border-subtle font-mono text-text-primary"
                      />
                    </label>
                    <div className="col-span-2 flex items-end">
                      <button
                        type="button"
                        disabled={testingConn}
                        onClick={() => {
                          setTestingConn(true);
                          void testRemoteConnection().then((r) => {
                            setConnTest(r);
                            setTestingConn(false);
                            if (r.ok) void refreshList();
                          });
                        }}
                        className="w-full h-7 rounded bg-accent/15 border border-border-strong text-accent hover:bg-accent/25 font-medium"
                      >
                        {testingConn ? '探测中...' : '测试连通性'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-text-muted">
                    后端接口未上线前，发布记录持久化于当前浏览器 IndexedDB（完整模拟版本迭代、Token 校验与短链接预览）；后端按 <code className="text-accent font-mono">docs/SCADA_INTEGRATION_CONTRACT.md</code> 就绪后，切换至「远程后端接口」即可无缝生效。
                  </div>
                )}

                {connTest ? (
                  <div
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${
                      connTest.ok
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/10 border-red-500/40 text-red-300'
                    }`}
                  >
                    {connTest.message}
                  </div>
                ) : null}
              </div>

              {/* 已发布列表 */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">已发布的厂站 3D 工艺大屏列表</span>
                <button
                  type="button"
                  onClick={() => void refreshList()}
                  className="px-2.5 py-1 rounded border border-border-subtle bg-bg-canvas/60 text-text-secondary hover:text-text-primary flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 刷新
                </button>
              </div>

              {publishedList.length === 0 ? (
                <div className="py-12 rounded-xl border border-dashed border-border-subtle text-center text-text-muted">
                  暂无已发布的 3D 厂站大屏，请先切换至「发布与生成链接」发布当前工程。
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {publishedList.map((item) => {
                    const itemUrls = buildPreviewUrls({
                      sceneId: item.sceneId,
                      token: item.shareToken,
                      requireToken: item.requireToken,
                      standaloneDataMode: item.embedDefaultDataMode,
                    });
                    return (
                      <div
                        key={item.sceneId}
                        className="p-3 rounded-xl bg-bg-canvas/70 border border-border-subtle hover:border-border-strong flex gap-3 transition"
                      >
                        <div className="w-28 h-20 rounded-lg bg-slate-950 border border-border-subtle overflow-hidden shrink-0 flex items-center justify-center">
                          {item.thumbnailDataUrl ? (
                            <img src={item.thumbnailDataUrl} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <Layers className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-text-primary truncate">{item.title}</span>
                              <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono text-[10px] shrink-0">
                                v{item.revision}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-text-muted truncate mt-0.5">
                              {item.sceneId} {item.stationCode ? `· 采集点 ${item.stationCode}` : ''}
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5">
                              {item.nodeCount} 台设备 · {item.widgetCount} 卡片 · {new Date(item.updatedAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void loadPublishedIntoStudio(item.sceneId).then(() => {
                                  setOpen(false);
                                  setMode('dashboard');
                                });
                              }}
                              className="px-2 py-1 rounded bg-bg-elevated border border-border-subtle hover:border-border-strong text-[11px] text-text-primary flex items-center gap-1"
                            >
                              <FolderOpen className="w-3 h-3 text-accent" /> 加载编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => copyText(item.sceneId, itemUrls.scadaEmbedUrl)}
                              className="px-2 py-1 rounded bg-bg-elevated border border-border-subtle hover:border-border-strong text-[11px] text-accent flex items-center gap-1"
                            >
                              {copiedKey === item.sceneId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              嵌入链接
                            </button>
                            <button
                              type="button"
                              onClick={() => window.open(itemUrls.standaloneUrl, '_blank', 'noopener')}
                              className="px-2 py-1 rounded bg-bg-elevated border border-border-subtle hover:border-border-strong text-[11px] text-text-secondary"
                              title="新标签预览"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deletePublished(item.sceneId)}
                              className="ml-auto p-1 rounded text-text-muted hover:text-red-400"
                              title="删除发布记录"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'sandbox' ? (
            <div className="h-full grid grid-cols-12 gap-3 min-h-[430px]">
              {/* 左侧真实 iframe 沙盒 */}
              <div className="col-span-7 flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-accent">
                    SCADA &lt;iframe&gt; 实机嵌入沙盒（{urls ? activeSummary?.sceneId : '未发布'}）
                  </span>
                  {urls ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBridgeLogs([]);
                        setSandboxRunning((v) => !v);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                        sandboxRunning
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                          : 'bg-accent text-slate-950'
                      }`}
                    >
                      <Play className="w-3 h-3" /> {sandboxRunning ? '停止沙盒实例' : '启动嵌入沙盒加载预览'}
                    </button>
                  ) : null}
                </div>

                <div className="flex-1 min-h-0 rounded-xl border border-border-strong bg-slate-950 overflow-hidden relative">
                  {!urls ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="text-text-muted">请先发布当前 3D 大屏生成预览链接，再进入沙盒模拟 SCADA 通信</div>
                      <button
                        type="button"
                        onClick={() => void handlePublish().then(() => setSandboxRunning(true))}
                        className="px-4 py-2 rounded-xl bg-accent text-slate-950 font-semibold flex items-center gap-1.5"
                      >
                        <Rocket className="w-4 h-4" /> 一键发布并启动联调沙盒
                      </button>
                    </div>
                  ) : !sandboxRunning ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="text-text-secondary">
                        将加载嵌入地址：<span className="font-mono text-accent break-all">{urls.scadaEmbedUrl}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBridgeLogs([]);
                          setSandboxRunning(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-accent text-slate-950 font-semibold flex items-center gap-1.5"
                      >
                        <Play className="w-4 h-4" /> 加载 SCADA 嵌入 iframe 并握手
                      </button>
                    </div>
                  ) : (
                    <iframe
                      ref={iframeRef}
                      src={urls.scadaEmbedUrl}
                      title="SCADA 嵌入沙盒预览"
                      allow="fullscreen; autoplay"
                      className="w-full h-full border-0"
                    />
                  )}
                </div>
              </div>

              {/* 右侧模拟控制与双向通信报文监控 */}
              <div className="col-span-5 flex flex-col gap-2.5 min-h-0">
                <div className="p-3 rounded-xl bg-bg-canvas/70 border border-border-subtle space-y-2 shrink-0">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-accent" /> 模拟 SCADA 宿主发送指令
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!sandboxRunning}
                      onClick={sendTelemetryPulse}
                      className="h-8 px-2.5 rounded-lg bg-accent/15 border border-border-strong text-accent hover:bg-accent/25 disabled:opacity-40 flex items-center justify-center gap-1 font-medium"
                    >
                      <Send className="w-3.5 h-3.5" /> 推送 MQTT 实时测点帧
                    </button>
                    <button
                      type="button"
                      disabled={!sandboxRunning}
                      onClick={toggleSandboxAlarm}
                      className={`h-8 px-2.5 rounded-lg border disabled:opacity-40 flex items-center justify-center gap-1 font-medium ${
                        alarmActive
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : 'bg-red-500/15 border-red-400/50 text-red-300'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {alarmActive ? '发送消警通知' : '模拟设备超限告警'}
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <select
                      value={sandboxFocusTag}
                      onChange={(e) => setSandboxFocusTag(e.target.value)}
                      className="flex-1 h-7 px-2 rounded bg-bg-elevated border border-border-subtle text-text-primary"
                    >
                      {project.nodes.map((n) => (
                        <option key={n.id} value={n.tag}>
                          {n.tag} · {n.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!sandboxRunning}
                      onClick={sendFocusTarget}
                      className="h-7 px-3 rounded bg-bg-elevated border border-border-subtle hover:border-border-strong text-text-primary disabled:opacity-40 flex items-center gap-1 shrink-0"
                    >
                      <Crosshair className="w-3 h-3 text-accent" /> 定位设备
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 p-3 rounded-xl bg-bg-canvas/70 border border-border-subtle flex flex-col gap-1.5">
                  <div className="flex items-center justify-between shrink-0">
                    <span className="font-semibold text-text-primary">双向 postMessage 通信监视器</span>
                    <button
                      type="button"
                      onClick={() => setBridgeLogs([])}
                      className="text-[10px] text-text-muted hover:text-text-primary"
                    >
                      清空
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1 font-mono text-[10px]">
                    {bridgeLogs.length === 0 ? (
                      <div className="text-text-muted py-4 text-center">
                        启动沙盒并点击右侧模拟指令，或在 iframe 内点击任意 3D 设备查看交互事件日志
                      </div>
                    ) : (
                      bridgeLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-1.5 rounded bg-bg-elevated/80 border border-border-subtle space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={
                                log.dir === '3D -> HOST' ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'
                              }
                            >
                              [{log.dir}] {log.type}
                            </span>
                            <span className="text-text-muted">{log.time}</span>
                          </div>
                          <div className="text-text-secondary break-all">{log.detail}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PublishSceneModal;
