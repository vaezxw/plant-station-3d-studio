import { useEffect, useRef, useState, type FC } from 'react';
import {
  Crosshair,
  Eye,
  EyeOff,
  Grid,
  Lock,
  Play,
  RotateCcw,
  RotateCw,
  Scissors,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { resolveThemeById } from '../../domain/themes';
import { preloadAllAssets, subscribeAssets } from '../../engine/AssetManager';
import { SceneCore, type DragFeedback } from '../../engine/SceneCore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

const SceneViewport: FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<SceneCore | null>(null);
  const [dragInfo, setDragInfo] = useState<DragFeedback | null>(null);

  const nodes = useProjectStore((s) => s.project.nodes);
  const pipes = useProjectStore((s) => s.project.pipes);
  const updateNode = useProjectStore((s) => s.updateNode);

  const mode = useEditorStore((s) => s.mode);
  const tool = useEditorStore((s) => s.tool);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const snapStep = useEditorStore((s) => s.snapStep);
  const canvasLocked = useEditorStore((s) => s.canvasLocked);
  const showLabels = useEditorStore((s) => s.showLabels);
  const showGrid = useEditorStore((s) => s.showGrid);
  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);
  const cameraCommand = useEditorStore((s) => s.cameraCommand);
  const draggingCatalogKind = useEditorStore((s) => s.draggingCatalogKind);
  const turbojetUi = useEditorStore((s) => s.turbojetUi);

  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const setSelectedPipeId = useEditorStore((s) => s.setSelectedPipeId);
  const toggleCanvasLock = useEditorStore((s) => s.toggleCanvasLock);
  const toggleLabels = useEditorStore((s) => s.toggleLabels);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);
  const setTurbojetUi = useEditorStore((s) => s.setTurbojetUi);

  useEffect(() => {
    preloadAllAssets();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const initTheme = resolveThemeById(
      useEditorStore.getState().themeId,
      useEditorStore.getState().customThemes,
    );

    const core = new SceneCore(host, initTheme.scene3d, {
      onSelectNode: (nodeId, partLabel) => {
        setSelectedNodeId(nodeId);
        if (!nodeId) {
          setTurbojetUi(null);
          return;
        }
        const node = useProjectStore.getState().project.nodes.find((n) => n.id === nodeId);
        if (node?.kind === 'TURBOJET') {
          const rig = core.getTurbojetRig(nodeId);
          const st = rig?.getState();
          setTurbojetUi({
            nodeId,
            spin: st?.spin ?? false,
            explode: st?.explode ?? false,
            cutaway: st?.cutaway ?? false,
            partLabel: partLabel ?? rig?.selected()?.labelZh ?? null,
          });
        } else {
          setTurbojetUi(null);
        }
      },
      onSelectPipe: (pipeId) => {
        setSelectedPipeId(pipeId);
      },
      onPipeConnect: (fromNodeId, fromPort, toNodeId, toPort) => {
        const medium = useEditorStore.getState().pipeMedium;
        const created = useProjectStore.getState().addPipe({
          fromNodeId,
          fromPort,
          toNodeId,
          toPort,
          medium,
          diameterMm: 100,
        });
        setSelectedPipeId(created.id);
      },
      onTransformCommit: (nodeId, pos, rot, scale) => {
        updateNode(nodeId, { position: pos, rotation: rot, scale }, true);
      },
      onDragMove: (info) => {
        setDragInfo(info);
      },
    });
    coreRef.current = core;
    core.syncNodes(useProjectStore.getState().project.nodes);
    core.syncPipes(useProjectStore.getState().project.pipes);
    core.setSelectedNode(useEditorStore.getState().selectedNodeId);

    const unsubAssets = subscribeAssets(() => {
      core.syncNodes(useProjectStore.getState().project.nodes);
      core.syncPipes(useProjectStore.getState().project.pipes);
    });

    const onExportGlb = () => {
      const name = useProjectStore.getState().project.name || 'plant-station';
      void core.exportPlantGlb(name);
    };
    const onCaptureBookmark = (ev: Event) => {
      const ce = ev as CustomEvent<{ name?: string }>;
      const pose = core.getCameraPose();
      useProjectStore
        .getState()
        .addBookmark(ce.detail?.name ?? '', pose.position, pose.target);
    };
    window.addEventListener('studio:export-glb', onExportGlb);
    window.addEventListener('studio:capture-bookmark', onCaptureBookmark);

    const onCustomDrop = (e: Event) => {
      const ce = e as CustomEvent<{ kind: Parameters<SceneCore['projectClientToGround']>[2] extends never ? never : string; clientX: number; clientY: number }>;
      const detail = ce.detail;
      core.clearDragGhost();
      if (!detail || useEditorStore.getState().canvasLocked) return;
      const itemKind = detail.kind as Parameters<typeof useProjectStore.getState> extends never ? never : any;
      const pos = core.projectClientToGround(detail.clientX, detail.clientY, 0);
      if (!pos) return;
      const created = useProjectStore.getState().addNodeFromCatalog(itemKind, pos);
      setSelectedNodeId(created.id);
    };
    window.addEventListener('studio:drop-catalog', onCustomDrop);

    return () => {
      window.removeEventListener('studio:capture-bookmark', onCaptureBookmark);
      window.removeEventListener('studio:export-glb', onExportGlb);
      window.removeEventListener('studio:drop-catalog', onCustomDrop);
      unsubAssets();
      core.dispose();
      coreRef.current = null;
    };
  }, [setSelectedNodeId, setSelectedPipeId, setTurbojetUi, updateNode]);

  useEffect(() => {
    coreRef.current?.syncNodes(nodes);
  }, [nodes]);

  useEffect(() => {
    coreRef.current?.syncPipes(pipes);
  }, [pipes]);

  useEffect(() => {
    coreRef.current?.setInteractive(mode === 'studio');
  }, [mode]);

  useEffect(() => {
    coreRef.current?.setTool(tool);
  }, [tool]);

  useEffect(() => {
    coreRef.current?.setSelectedNode(selectedNodeId);
    if (!selectedNodeId) {
      setTurbojetUi(null);
      return;
    }
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node?.kind === 'TURBOJET') {
      const rig = coreRef.current?.getTurbojetRig(selectedNodeId);
      const st = rig?.getState();
      setTurbojetUi({
        nodeId: selectedNodeId,
        spin: st?.spin ?? false,
        explode: st?.explode ?? false,
        cutaway: st?.cutaway ?? false,
        partLabel: rig?.selected()?.labelZh ?? null,
      });
    } else {
      setTurbojetUi(null);
    }
  }, [selectedNodeId, nodes, setTurbojetUi]);

  useEffect(() => {
    coreRef.current?.setSnap(snapEnabled, snapStep);
  }, [snapEnabled, snapStep]);

  useEffect(() => {
    coreRef.current?.setCanvasLocked(canvasLocked);
  }, [canvasLocked]);

  useEffect(() => {
    coreRef.current?.setLabelsVisible(showLabels);
  }, [showLabels]);

  useEffect(() => {
    coreRef.current?.setGridVisible(showGrid);
  }, [showGrid]);

  useEffect(() => {
    const theme = resolveThemeById(themeId, customThemes);
    coreRef.current?.applyTheme(theme.scene3d);
  }, [themeId, customThemes]);

  useEffect(() => {
    if (!cameraCommand) return;
    if (cameraCommand.bookmark) {
      coreRef.current?.flyTo(cameraCommand.bookmark.position, cameraCommand.bookmark.target);
    } else if (cameraCommand.view) {
      coreRef.current?.applyCameraPreset(cameraCommand.view);
    }
  }, [cameraCommand]);

  useEffect(() => {
    if (!draggingCatalogKind) {
      coreRef.current?.clearDragGhost();
      return;
    }
    const onMove = (e: PointerEvent) => {
      coreRef.current?.updateDragGhost(e.clientX, e.clientY, draggingCatalogKind);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      coreRef.current?.clearDragGhost();
    };
  }, [draggingCatalogKind]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const rotateSelectedBy = (deg: number) => {
    if (!selectedNode || selectedNode.locked) return;
    const rad = (deg * Math.PI) / 180;
    const [rx, ry, rz] = selectedNode.rotation;
    updateNode(
      selectedNode.id,
      { rotation: [rx, Number((ry + rad).toFixed(4)), rz] },
      true,
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={hostRef} className="w-full h-full" />

      {mode === 'studio' && canvasLocked ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 studio-glass rounded-full px-3.5 py-1 text-xs text-amber-300 border border-amber-400/50 shadow-lg whitespace-nowrap flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> 画布已锁定 · 仅可旋转缩放整体预览（点击底部解锁）
        </div>
      ) : mode === 'studio' && dragInfo ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 studio-glass rounded-full px-3.5 py-1 text-xs font-mono text-text-primary border border-border-strong shadow-lg whitespace-nowrap flex items-center gap-2">
          <span className="text-accent font-semibold">{dragInfo.tag}</span>
          <span>
            X: {dragInfo.x.toFixed(2)}m · Z: {dragInfo.z.toFixed(2)}m
          </span>
          {dragInfo.alignedX || dragInfo.alignedZ ? (
            <span className="text-emerald-400">· 已磁吸对齐</span>
          ) : null}
        </div>
      ) : mode === 'studio' && tool === 'pipe' ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 studio-glass rounded-full px-3.5 py-1 text-xs text-accent border border-border-strong shadow-lg whitespace-nowrap">
          连管模式：依次点击两台设备的青色管口球标，自动生成正交弯头管路
        </div>
      ) : null}

      {/* 涡喷设备上下文交互胶囊（仅选中涡喷总成时出现） */}
      {turbojetUi ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 studio-glass rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg">
          <span className="text-xs font-medium text-accent px-1">
            透平拆解控制{turbojetUi.partLabel ? ` · ${turbojetUi.partLabel}` : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              const rig = coreRef.current?.getTurbojetRig(turbojetUi.nodeId);
              if (!rig) return;
              const next = !turbojetUi.spin;
              rig.setSpin(next);
              setTurbojetUi({ ...turbojetUi, spin: next });
            }}
            className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 transition ${
              turbojetUi.spin
                ? 'bg-accent text-slate-950 font-semibold'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            <Play className="w-3 h-3" /> 运转
          </button>
          <button
            type="button"
            onClick={() => {
              const rig = coreRef.current?.getTurbojetRig(turbojetUi.nodeId);
              if (!rig) return;
              const next = !turbojetUi.explode;
              rig.setExplode(next);
              setTurbojetUi({ ...turbojetUi, explode: next });
            }}
            className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 transition ${
              turbojetUi.explode
                ? 'bg-accent text-slate-950 font-semibold'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sparkles className="w-3 h-3" /> 爆炸
          </button>
          <button
            type="button"
            onClick={() => {
              const rig = coreRef.current?.getTurbojetRig(turbojetUi.nodeId);
              if (!rig) return;
              const next = !turbojetUi.cutaway;
              rig.setCutaway(next);
              setTurbojetUi({ ...turbojetUi, cutaway: next });
            }}
            className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 transition ${
              turbojetUi.cutaway
                ? 'bg-accent text-slate-950 font-semibold'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            <Scissors className="w-3 h-3" /> 剖切
          </button>
          <button
            type="button"
            onClick={() => {
              const rig = coreRef.current?.getTurbojetRig(turbojetUi.nodeId);
              if (!rig) return;
              rig.reset();
              setTurbojetUi({
                ...turbojetUi,
                spin: false,
                explode: false,
                cutaway: false,
                partLabel: null,
              });
            }}
            className="px-2.5 py-1 rounded-full text-xs flex items-center gap-1 bg-bg-elevated text-text-secondary hover:text-text-primary"
          >
            <RotateCcw className="w-3 h-3" /> 复位
          </button>
        </div>
      ) : null}

      {/* Studio 底部居中视口快捷胶囊 */}
      {mode === 'studio' ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 studio-glass rounded-full px-1.5 py-1 flex items-center gap-0.5 shadow-xl max-w-[96%] overflow-x-auto whitespace-nowrap">
          <button
            type="button"
            onClick={() => triggerCameraView('iso')}
            className="px-1.5 xl:px-2 py-1 rounded-full text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition shrink-0"
          >
            等轴
          </button>
          <button
            type="button"
            onClick={() => triggerCameraView('top')}
            className="px-1.5 xl:px-2 py-1 rounded-full text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition shrink-0"
          >
            顶视
          </button>
          <button
            type="button"
            onClick={() => triggerCameraView('front')}
            className="px-1.5 xl:px-2 py-1 rounded-full text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition shrink-0"
          >
            正视
          </button>
          <button
            type="button"
            onClick={() => triggerCameraView('focus')}
            className="px-1.5 xl:px-2 py-1 rounded-full text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition flex items-center gap-1 shrink-0"
            title="聚焦选中设备 (F)"
          >
            <Crosshair className="w-3 h-3" /> 聚焦
          </button>
          {selectedNode && !selectedNode.locked && !canvasLocked ? (
            <>
              <div className="w-px h-3.5 bg-border-subtle mx-0.5 shrink-0" />
              <button
                type="button"
                onClick={() => rotateSelectedBy(-90)}
                className="px-1.5 py-1 rounded-full text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition flex items-center gap-0.5 shrink-0"
                title="向左旋转 90°"
              >
                <RotateCcw className="w-3 h-3" /> -90°
              </button>
              <button
                type="button"
                onClick={() => rotateSelectedBy(90)}
                className="px-1.5 py-1 rounded-full text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition flex items-center gap-0.5 shrink-0"
                title="向右旋转 90°"
              >
                <RotateCw className="w-3 h-3" /> +90°
              </button>
            </>
          ) : null}
          <div className="w-px h-3.5 bg-border-subtle mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={toggleLabels}
            className={`px-1.5 xl:px-2 py-1 rounded-full text-[11px] flex items-center gap-1 transition shrink-0 ${
              showLabels ? 'text-accent bg-accent-soft' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            标牌
          </button>
          <button
            type="button"
            onClick={toggleGrid}
            className={`px-1.5 xl:px-2 py-1 rounded-full text-[11px] flex items-center gap-1 transition shrink-0 ${
              showGrid ? 'text-accent bg-accent-soft' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Grid className="w-3 h-3" /> 网格
          </button>
          <div className="w-px h-3.5 bg-border-subtle mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={toggleCanvasLock}
            title={canvasLocked ? '点击解锁画布编辑' : '锁定画布（禁止拖放移动设备，仅放大旋转整体预览）'}
            className={`px-2 py-1 rounded-full text-[11px] flex items-center gap-1 transition shrink-0 font-medium ${
              canvasLocked
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {canvasLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>{canvasLocked ? '已锁定' : '锁定'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default SceneViewport;
