import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, Radio, RefreshCw, ShieldAlert } from 'lucide-react';
import { ScenePublishError } from '../../api/scenePublishClient';
import { navigateToWorkbenchUrl, type RuntimeEntryParams } from '../../domain/runtimeUrl';
import type { DataFeedMode, PublishedSceneRecord } from '../../domain/schema';
import { DataSourceManager } from '../../engine/DataSourceManager';
import { startScadaBridge } from '../../engine/ScadaBridge';
import { useCardTemplateStore } from '../../store/useCardTemplateStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { usePublishStore } from '../../store/usePublishStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import DashboardOverlay from '../dashboard/DashboardOverlay';
import SceneViewport from './SceneViewport';

type Props = {
  entry: RuntimeEntryParams;
};

function resolveEffectiveDataMode(entry: RuntimeEntryParams, rec: PublishedSceneRecord): DataFeedMode {
  if (entry.dataMode !== 'auto') return entry.dataMode;
  if (entry.embed === 'scada') return 'bridge';
  if (rec.embedDefaultDataMode !== 'auto') return rec.embedDefaultDataMode;
  const hasNonSimSource = (rec.schema.dataSources ?? []).some(
    (ds) => ds.enabled && ds.type !== 'builtin-sim',
  );
  return hasNonSimSource ? 'direct' : 'sim';
}

const PreviewRuntimeShell: FC<Props> = ({ entry }) => {
  const dsManagerRef = useRef<DataSourceManager | null>(null);
  const bridgeCleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorCode, setErrorCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [record, setRecord] = useState<PublishedSceneRecord | null>(null);

  const getPublishedScene = usePublishStore((s) => s.getPublishedScene);
  const hydrateTemplates = useCardTemplateStore((s) => s.hydrateTemplates);
  const stepSimulation = useTelemetryStore((s) => s.stepSimulation);
  const setRuntimePreviewFlags = useEditorStore((s) => s.setRuntimePreviewFlags);
  const setMode = useEditorStore((s) => s.setMode);
  const setThemeId = useEditorStore((s) => s.setThemeId);

  const loadScene = useCallback(async () => {
    setStatus('loading');
    setErrorCode('');
    setErrorMessage('');

    bridgeCleanupRef.current?.();
    bridgeCleanupRef.current = null;
    dsManagerRef.current?.dispose();
    dsManagerRef.current = null;

    if (!entry.sceneId) {
      setStatus('error');
      setErrorCode('SCENE_NOT_FOUND');
      setErrorMessage('预览链接缺少有效的 sceneId 参数');
      return;
    }

    try {
      await hydrateTemplates();
      const rec = await getPublishedScene(entry.sceneId, entry.token);
      setRecord(rec);

      useProjectStore.getState().loadRuntimeProject(rec.schema);
      setThemeId(rec.schema.themeId);
      setRuntimePreviewFlags(true, entry.hideChrome);
      setMode('present');

      const effectiveMode = resolveEffectiveDataMode(entry, rec);
      const tel = useTelemetryStore.getState();

      if (effectiveMode === 'bridge') {
        tel.prepareForBridgeMode();
      } else if (effectiveMode === 'direct') {
        tel.setDataFeedMode('direct');
        const mgr = new DataSourceManager();
        mgr.sync(rec.schema.dataSources ?? []);
        dsManagerRef.current = mgr;
      } else {
        tel.setDataFeedMode('sim');
      }

      bridgeCleanupRef.current = startScadaBridge({
        sceneId: rec.sceneId,
        dataMode: effectiveMode,
        allowedParentOrigin: entry.parentOrigin,
      });

      setStatus('ready');
    } catch (err) {
      setStatus('error');
      if (err instanceof ScenePublishError) {
        setErrorCode(err.code);
        setErrorMessage(err.message);
      } else {
        setErrorCode('UNKNOWN');
        setErrorMessage(err instanceof Error ? err.message : '加载已发布 3D 大屏失败');
      }
    }
  }, [entry, getPublishedScene, hydrateTemplates, setMode, setRuntimePreviewFlags, setThemeId]);

  useEffect(() => {
    void loadScene();
    return () => {
      bridgeCleanupRef.current?.();
      bridgeCleanupRef.current = null;
      dsManagerRef.current?.dispose();
      dsManagerRef.current = null;
      useEditorStore.getState().setRuntimePreviewFlags(false, false);
      useTelemetryStore.getState().setDataFeedMode('sim');
    };
  }, [loadScene]);

  useEffect(() => {
    const timer = window.setInterval(() => stepSimulation(), 1500);
    return () => window.clearInterval(timer);
  }, [stepSimulation]);

  if (status === 'loading') {
    return (
      <div className="w-full h-full bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3 select-none">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <div className="text-sm font-medium">正在加载 3D 工艺数字孪生大屏...</div>
        <div className="text-xs font-mono text-slate-400">Scene ID: {entry.sceneId}</div>
      </div>
    );
  }

  if (status === 'error' || !record) {
    const isTokenErr = errorCode === 'INVALID_TOKEN';
    return (
      <div className="w-full h-full bg-slate-950 text-slate-200 flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isTokenErr ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {isTokenErr ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-base font-semibold text-white">
                {isTokenErr ? '访问令牌校验未通过' : '3D 工艺大屏加载失败'}
              </div>
              <div className="text-xs font-mono text-slate-400">
                {errorCode} · {entry.sceneId ?? '-'}
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300 bg-slate-950/70 rounded-xl p-3 border border-slate-800">
            {errorMessage}
          </p>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              当前存储模式：
              {usePublishStore.getState().settings.storageMode === 'remote-api'
                ? '远程后端 REST 接口'
                : '本地调试发布仓库 (IndexedDB)'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => void loadScene()}
              className="h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 重新拉取
            </button>
            {entry.embed !== 'scada' ? (
              <button
                type="button"
                onClick={navigateToWorkbenchUrl}
                className="h-8 px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> 返回 3D 工作台
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-bg-canvas text-text-primary">
      <SceneViewport />
      <DashboardOverlay />
    </div>
  );
};

export default PreviewRuntimeShell;
