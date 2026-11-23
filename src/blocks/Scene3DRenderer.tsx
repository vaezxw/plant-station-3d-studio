import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  useEventBus,
  type BlockComponentProps,
} from '@lius1314/visual-dashboard-scaffold';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { contentBackgroundStyle, useBlockContentBackground } from './blockTheme';
import { installStudioPbr } from '../scene/studioPbr';
import { getActiveValueMap, getPlantCursor, usePlantCursor } from '../data/cursor';
import {
  createInitialDraft,
  isCatalogPlacedTag,
  isFrozenProcessTag,
  removeComposeNode,
  saveDraftToStorage,
  snapCoord,
  upsertComposeNode,
  type ComposeLayoutFile,
} from '../data/composeLayout';
import { PLANT_TAG_SELECTED, type TagSelectedPayload } from '../plant/events';
import { selectPlantTag } from '../plant/selectTag';
import {
  catalogPlaceY,
  isPlaceableCatalogKind,
  isTurbojetKind,
  preloadCatalogGlbs,
  subscribeGlbCatalog,
  syncLine2Resolution,
  type CatalogKind,
} from '../scene/catalog';
import {
  fitOrthoToObject,
  ORTHO_FRUSTUM,
  ORTHO_MAX_ZOOM,
  ORTHO_MIN_ZOOM,
} from '../scene/catalog/cameraFit';
import {
  buildPlantScene,
  createSelectionVisual,
  topologyHasTag,
} from '../scene/buildPlantScene';
import {
  disposeCss2dLabels,
  labelFromEquipment,
  makeCss2dTagLabel,
  syncCss2dTagLabel,
} from '../scene/tagLabel';
import { getSkidFlow } from '../scene/hengGuangSkid';
import { preloadTurbojetMapping, type TurbojetRig } from '../scene/turbojet/createTurbojetViewer';
import type { PipeFlowAnimator } from '../scene/flow';
import ComposePanel from './ComposePanel';

const wrap: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  background: 'transparent',
  boxSizing: 'border-box',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
};

type HostApi = HTMLDivElement & {
  __rebuildPlant?: () => void;
  __dropCatalogAt?: (clientX: number, clientY: number, kind: CatalogKind) => boolean;
};

type CatalogGhost = { kind: CatalogKind; x: number; y: number };

let placeSerial = 1;

/** 三维场景渲染器（与空白画布宿主分离；GLB 就绪后自动重建） */
const Scene3DRenderer: FC<BlockComponentProps> = ({
  width,
  height,
  pageId,
  blockId,
  emit,
}) => {
  const contentBackground = useBlockContentBackground(pageId, blockId);
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cursor = usePlantCursor();
  const [error, setError] = useState<string | null>(null);
  const [composeMode, setComposeMode] = useState(true);
  const [railOpen, setRailOpen] = useState(true);
  const [draft, setDraft] = useState<ComposeLayoutFile>(() => createInitialDraft());
  const [rebuildKey, setRebuildKey] = useState(0);
  const [dragHint, setDragHint] = useState<string | null>(null);
  const [catalogGhost, setCatalogGhost] = useState<CatalogGhost | null>(null);
  const [tjUi, setTjUi] = useState<{
    tag: string;
    spin: boolean;
    explode: boolean;
    cutaway: boolean;
    part: string | null;
  } | null>(null);

  const selectedRef = useRef<string | null>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const composeModeRef = useRef(composeMode);
  composeModeRef.current = composeMode;
  const persistPosRef = useRef<(tag: string, x: number, y: number, z: number) => void>(
    () => undefined,
  );
  const placeAtRef = useRef<
    (x: number, z: number, y: number, kind: CatalogKind) => void
  >(() => undefined);
  const rigsRef = useRef<Map<string, TurbojetRig>>(new Map());

  persistPosRef.current = (tag, x, y, z) => {
    const next = upsertComposeNode(draftRef.current, {
      tag,
      x: snapCoord(x),
      y,
      z: snapCoord(z),
    });
    saveDraftToStorage(next);
    draftRef.current = next;
    setDraft(next);
  };

  placeAtRef.current = (x, z, y, kind) => {
    if (!isPlaceableCatalogKind(kind)) return;
    const tag = `HG-PLACE-${String(placeSerial).padStart(3, '0')}`;
    placeSerial += 1;
    const next = upsertComposeNode(draftRef.current, {
      tag,
      kind,
      x: snapCoord(x),
      y,
      z: snapCoord(z),
      labelText: kind === 'TEXT' ? '标签' : undefined,
    });
    saveDraftToStorage(next);
    draftRef.current = next;
    setDraft(next);
    selectPlantTag(tag, 'scene', emitRef.current);
    selectedRef.current = tag;
    setDragHint(`已放置 ${kind} → ${tag}`);
    setRebuildKey((k) => k + 1);
  };

  const scope = pageId ? `page:${pageId}` : undefined;

  useEventBus<TagSelectedPayload>(
    PLANT_TAG_SELECTED,
    (payload) => {
      if (!payload?.tag) return;
      selectedRef.current = payload.tag;
    },
    { scope },
  );

  useEffect(() => {
    selectedRef.current = cursor.selectedTag;
  }, [cursor.selectedTag]);

  useEffect(() => {
    const tag = cursor.selectedTag;
    if (!tag) {
      setTjUi(null);
      return;
    }
    const kind = draft.nodes.find((n) => n.tag === tag)?.kind;
    if (!isTurbojetKind(kind)) {
      setTjUi(null);
      return;
    }
    const rig = rigsRef.current.get(tag);
    const st = rig?.getState();
    setTjUi((prev) => ({
      tag,
      spin: st?.spin ?? prev?.spin ?? false,
      explode: st?.explode ?? prev?.explode ?? false,
      cutaway: st?.cutaway ?? prev?.cutaway ?? false,
      part: prev?.tag === tag ? prev.part : (rig?.selected()?.labelZh ?? null),
    }));
  }, [cursor.selectedTag, draft, rebuildKey]);

  useEffect(() => {
    void preloadCatalogGlbs();
    void preloadTurbojetMapping().then(() => setRebuildKey((k) => k + 1));
    return subscribeGlbCatalog(() => setRebuildKey((k) => k + 1));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let raf = 0;
    let selection = createSelectionVisual();
    let nodeMap = new Map<string, THREE.Object3D>();
    let pickables: THREE.Object3D[] = [];
    let flows: PipeFlowAnimator[] = [];
    let camera: THREE.OrthographicCamera | null = null;

    const scene = new THREE.Scene();
    scene.background = null;
    const labelsRoot = new THREE.Group();
    labelsRoot.name = 'tag-labels';
    scene.add(labelsRoot);

    const frustum = ORTHO_FRUSTUM;
    camera = new THREE.OrthographicCamera(-frustum, frustum, frustum, -frustum, 0.05, 200);
    camera.position.set(7, 12.5, 8.5);
    camera.up.set(0, 1, 0);

    const drag = {
      active: false,
      tag: null as string | null,
      planeY: 1,
      moved: false,
    };
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const drawingSize = new THREE.Vector2();
    let lastTime = performance.now();

    const clientToNdc = (clientX: number, clientY: number) => {
      if (!renderer) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const worldOnPlaneY = (ndcX: number, ndcY: number, planeY: number) => {
      if (!camera) return null;
      pointer.set(ndcX, ndcY);
      raycaster.setFromCamera(pointer, camera);
      dragPlane.constant = -planeY;
      return raycaster.ray.intersectPlane(dragPlane, hitPoint) ? hitPoint.clone() : null;
    };

    let paintedTag: string | null | undefined = undefined;
    let lastFitTag: string | null = null;
    const applySelection = (tag: string | null) => {
      if (!tag) {
        selection.clear();
        lastFitTag = null;
        return;
      }
      const obj = nodeMap.get(tag);
      if (!obj) {
        selection.clear();
        return;
      }
      setError(null);
      selection.apply(obj, tag);
      if (camera && controls && tag !== lastFitTag) {
        fitOrthoToObject(camera, controls, obj);
        lastFitTag = tag;
      }
    };
    const paintIfNeeded = () => {
      const tag = selectedRef.current;
      if (tag === paintedTag) return;
      paintedTag = tag;
      applySelection(tag);
    };
    const syncAllLabels = () => {
      for (const obj of nodeMap.values()) {
        const label = labelFromEquipment(obj);
        if (label) syncCss2dTagLabel(label, obj);
      }
    };

    const bindLabelClicks = () => {
      for (const [tag, obj] of nodeMap) {
        const el = labelFromEquipment(obj)?.element ?? null;
        if (!el) continue;
        el.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!tag.startsWith('HG-')) {
            setError(`标签 ${tag} 非法`);
            return;
          }
          if (!topologyHasTag(tag) && !draftRef.current.nodes.some((n) => n.tag === tag)) {
            setError(`标签 ${tag} 无对应节点`);
            return;
          }
          selectPlantTag(tag, 'label', emitRef.current);
          selectedRef.current = tag;
          paintedTag = undefined;
          paintIfNeeded();
        };
        el.onpointerdown = (ev) => ev.stopPropagation();
      }
    };

    const rebuildScene = () => {
      const doomed: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o.name === 'plant-root' || o.name === 'pipe-flow') doomed.push(o);
      });
      disposeCss2dLabels(labelsRoot);
      for (const o of doomed) {
        disposeCss2dLabels(o);
        o.parent?.remove(o);
      }
      for (const f of flows) f.dispose();
      flows = [];
      selection.clear();

      const valueMap = getActiveValueMap();
      const built = buildPlantScene({
        composeFile: draftRef.current,
        valueMap,
      });
      scene.add(built.root);
      nodeMap = built.nodeMap;
      pickables = built.pickables;
      rigsRef.current = built.turbojetRigs;
      selection = createSelectionVisual();
      for (const [tag, obj] of nodeMap) {
        const f = getSkidFlow(obj);
        if (f) {
          flows.push(f);
          f.update(valueMap, 0);
        }
        const label = makeCss2dTagLabel(tag);
        obj.userData.tagLabel = label;
        labelsRoot.add(label);
      }
      bindLabelClicks();
      syncAllLabels();
    };

    try {
      rebuildScene();
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[scene] 建模失败:', message);
      setError(message);
      return;
    }

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    const uninstallPbr = installStudioPbr(renderer, scene);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minPolarAngle = 0.08;
    controls.minZoom = ORTHO_MIN_ZOOM;
    controls.maxZoom = ORTHO_MAX_ZOOM;
    camera.lookAt(controls.target);

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.top = '0';

    const css2d = new CSS2DRenderer();
    css2d.domElement.style.position = 'absolute';
    css2d.domElement.style.left = '0';
    css2d.domElement.style.top = '0';
    css2d.domElement.style.pointerEvents = 'none';
    host.style.position = 'relative';
    host.appendChild(css2d.domElement);

    const resize = () => {
      if (!renderer || !host || !camera) return;
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      const a = w / h;
      camera.left = -frustum * a;
      camera.right = frustum * a;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, true);
      css2d.setSize(w, h);
      renderer.getDrawingBufferSize(drawingSize);
      syncLine2Resolution(scene, drawingSize.x, drawingSize.y);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      css2d.domElement.style.width = `${w}px`;
      css2d.domElement.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    paintIfNeeded();

    const setPointerFromEvent = (event: PointerEvent) => {
      const ndc = clientToNdc(event.clientX, event.clientY);
      if (!ndc) return false;
      pointer.x = ndc.x;
      pointer.y = ndc.y;
      return true;
    };

    const noteTurbojetHit = (tag: string, hitObj: THREE.Object3D) => {
      const obj = nodeMap.get(tag);
      const kind = String(obj?.userData.catalogKind ?? obj?.userData.kind ?? '');
      if (!obj || !isTurbojetKind(kind)) {
        setTjUi(null);
        return;
      }
      const rig = rigsRef.current.get(tag);
      if (!rig) return;
      const part = rig.pickFromObject(hitObj);
      const st = rig.getState();
      setTjUi({
        tag,
        spin: st.spin,
        explode: st.explode,
        cutaway: st.cutaway,
        part: part?.labelZh ?? null,
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!renderer || !camera || !composeModeRef.current) {
        if (!renderer || !camera) return;
        if (!setPointerFromEvent(event)) return;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pickables, true);
        const hit = hits.find((h) => h.object.userData.pickable && h.object.userData.tag);
        if (!hit) return;
        const tag = String(hit.object.userData.tag);
        selectPlantTag(tag, hit.object.userData.isLabel ? 'label' : 'scene', emitRef.current);
        selectedRef.current = tag;
        paintedTag = undefined;
        paintIfNeeded();
        noteTurbojetHit(tag, hit.object);
        return;
      }

      if (!setPointerFromEvent(event)) return;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, true);
      const hit = hits.find((h) => h.object.userData.pickable && h.object.userData.tag);
      if (!hit) return;
      const tag = String(hit.object.userData.tag);
      if (!nodeMap.has(tag)) {
        setError(`拾取到未知 tag=${tag}`);
        return;
      }
      selectPlantTag(tag, hit.object.userData.isLabel ? 'label' : 'scene', emitRef.current);
      selectedRef.current = tag;
      paintedTag = undefined;
      paintIfNeeded();
      noteTurbojetHit(tag, hit.object);

      const obj = nodeMap.get(tag);
      if (!obj) return;
      drag.active = true;
      drag.tag = tag;
      drag.moved = false;
      drag.planeY = obj.position.y;
      if (controls) controls.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      setDragHint(`拖拽 ${tag}（松开保存 x/z）`);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active || !drag.tag || !camera) return;
      if (!setPointerFromEvent(event)) return;
      const pt = worldOnPlaneY(pointer.x, pointer.y, drag.planeY);
      if (!pt) return;
      const obj = nodeMap.get(drag.tag);
      if (!obj) return;
      obj.position.x = pt.x;
      obj.position.z = pt.z;
      drag.moved = true;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drag.active || !drag.tag) return;
      const tag = drag.tag;
      const obj = nodeMap.get(tag);
      drag.active = false;
      drag.tag = null;
      if (controls) controls.enabled = true;
      try {
        renderer?.domElement.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      if (obj && drag.moved) {
        const x = snapCoord(obj.position.x);
        const z = snapCoord(obj.position.z);
        obj.position.x = x;
        obj.position.z = z;
        persistPosRef.current(tag, x, obj.position.y, z);
        setDragHint(`已保存 ${tag} → x=${x}, z=${z}`);
      } else {
        setDragHint(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    let lastSnap = getPlantCursor().snapshotId;
    const tick = () => {
      if (disposed || !renderer || !camera) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      controls?.update();
      const live = getPlantCursor();
      const valueMap = getActiveValueMap();
      if (live.snapshotId !== lastSnap) {
        lastSnap = live.snapshotId;
        try {
          rebuildScene();
          paintedTag = undefined;
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
      for (const f of flows) f.update(valueMap, dt);
      for (const rig of rigsRef.current.values()) rig.tick(dt);
      paintIfNeeded();
      syncAllLabels();
      renderer.getDrawingBufferSize(drawingSize);
      syncLine2Resolution(scene, drawingSize.x, drawingSize.y);
      renderer.render(scene, camera);
      css2d.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    (host as HostApi).__rebuildPlant = () => {
      try {
        rebuildScene();
        paintedTag = undefined;
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    (host as HostApi).__dropCatalogAt = (clientX, clientY, kind) => {
      const ndc = clientToNdc(clientX, clientY);
      if (!ndc || !isPlaceableCatalogKind(kind)) return false;
      const pt = worldOnPlaneY(ndc.x, ndc.y, 1);
      if (!pt) return false;
      placeAtRef.current(pt.x, pt.z, catalogPlaceY(kind), kind);
      return true;
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer?.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer?.domElement.removeEventListener('pointermove', onPointerMove);
      renderer?.domElement.removeEventListener('pointerup', onPointerUp);
      renderer?.domElement.removeEventListener('pointercancel', onPointerUp);
      controls?.dispose();
      selection.clear();
      for (const f of flows) f.dispose();
      uninstallPbr();
      delete (host as HostApi).__rebuildPlant;
      delete (host as HostApi).__dropCatalogAt;
      disposeCss2dLabels(labelsRoot);
      disposeCss2dLabels(scene);
      if (css2d.domElement.parentNode === host) host.removeChild(css2d.domElement);
      if (renderer) {
        host.removeChild(renderer.domElement);
        renderer.dispose();
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey]);

  const requestRebuild = () => {
    const host = hostRef.current as HostApi | null;
    if (host?.__rebuildPlant) host.__rebuildPlant();
    else setRebuildKey((k) => k + 1);
  };

  const deleteSelected = () => {
    if (!composeMode) return;
    const tag = selectedRef.current ?? cursor.selectedTag;
    if (!tag) {
      setDragHint('未选中设备');
      return;
    }

    if (isCatalogPlacedTag(tag)) {
      const next = removeComposeNode(draftRef.current, tag);
      saveDraftToStorage(next);
      draftRef.current = next;
      setDraft(next);
      selectPlantTag(null, 'scene', emitRef.current);
      selectedRef.current = null;
      setDragHint(`已删除 ${tag}`);
      setRebuildKey((k) => k + 1);
      return;
    }

    if (isFrozenProcessTag(tag)) {
      const ok = window.confirm(
        `「${tag}」是冻结工艺位号，不会从拓扑删除。\n确认仅移除编排覆盖（坐标/类型复位到默认）？`,
      );
      if (!ok) {
        setDragHint('已取消删除冻结位号');
        return;
      }
      const next = removeComposeNode(draftRef.current, tag);
      saveDraftToStorage(next);
      draftRef.current = next;
      setDraft(next);
      setDragHint(`已清除 ${tag} 编排覆盖`);
      setRebuildKey((k) => k + 1);
      return;
    }

    // 非拓扑、非 PLACE：仍当作编排节点删
    if (draftRef.current.nodes.some((n) => n.tag === tag)) {
      const next = removeComposeNode(draftRef.current, tag);
      saveDraftToStorage(next);
      draftRef.current = next;
      setDraft(next);
      selectPlantTag(null, 'scene', emitRef.current);
      selectedRef.current = null;
      setDragHint(`已删除 ${tag}`);
      setRebuildKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (!composeMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeMode, cursor.selectedTag, draft]);

  const onCatalogDragStart = (kind: CatalogKind, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!composeMode) setComposeMode(true);
    setCatalogGhost({ kind, x: e.clientX, y: e.clientY });
    setDragHint(`拖放 ${kind} 到三维画布`);

    const onMove = (ev: PointerEvent) => {
      setCatalogGhost({ kind, x: ev.clientX, y: ev.clientY });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setCatalogGhost(null);
      const host = hostRef.current as HostApi | null;
      const ok = host?.__dropCatalogAt?.(ev.clientX, ev.clientY, kind) ?? false;
      if (!ok) setDragHint('未放到画布上，取消放置');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const wrapRect = wrapRef.current?.getBoundingClientRect();

  return (
    <div
      ref={wrapRef}
      style={{
        ...wrap,
        ...contentBackgroundStyle(contentBackground),
        width: width ?? '100%',
        height: height ?? '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          zIndex: 2,
          left: 12,
          top: 10,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          pointerEvents: 'none',
          color: '#e2e8f0',
          fontSize: 13,
          textShadow: '0 1px 2px rgba(15,23,42,0.85)',
        }}
      >
        <strong style={{ color: '#38bdf8', letterSpacing: 2 }}>3D 场景</strong>
        <span style={{ opacity: 0.65 }}>空白开局 · 拖入模型 · 监视-only</span>
        {cursor.selectedTag ? (
          <span style={{ color: '#67e8f9' }}>选中 {cursor.selectedTag}</span>
        ) : null}
        {tjUi?.part ? (
          <span style={{ color: '#bae6fd' }}>零件 {tjUi.part}</span>
        ) : null}
        {dragHint ? <span style={{ color: '#fde68a' }}>{dragHint}</span> : null}
        <button
          type="button"
          onClick={() => setComposeMode((v) => !v)}
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            border: '1px solid rgba(56,189,248,0.5)',
            background: composeMode ? 'rgba(14,165,233,0.35)' : 'rgba(15,23,42,0.7)',
            color: '#e0f2fe',
            padding: '3px 8px',
            borderRadius: 3,
            fontSize: 11,
          }}
        >
          {composeMode ? '编排开' : '打开编排'}
        </button>
        {tjUi ? (
          <span style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
            <button
              type="button"
              style={tjBtn(tjUi.spin)}
              onClick={() => {
                const rig = rigsRef.current.get(tjUi.tag);
                if (!rig) return;
                const next = !tjUi.spin;
                rig.setSpin(next);
                setTjUi({ ...tjUi, spin: next });
              }}
            >
              运转
            </button>
            <button
              type="button"
              style={tjBtn(tjUi.explode)}
              onClick={() => {
                const rig = rigsRef.current.get(tjUi.tag);
                if (!rig) return;
                const next = !tjUi.explode;
                rig.setExplode(next);
                setTjUi({ ...tjUi, explode: next });
              }}
            >
              爆炸视图
            </button>
            <button
              type="button"
              style={tjBtn(tjUi.cutaway)}
              onClick={() => {
                const rig = rigsRef.current.get(tjUi.tag);
                if (!rig) return;
                const next = !tjUi.cutaway;
                rig.setCutaway(next);
                setTjUi({ ...tjUi, cutaway: next });
              }}
            >
              剖切
            </button>
            <button
              type="button"
              style={tjBtn(false)}
              onClick={() => {
                const rig = rigsRef.current.get(tjUi.tag);
                if (!rig) return;
                rig.reset();
                setTjUi({ ...tjUi, spin: false, explode: false, cutaway: false, part: null });
              }}
            >
              复位
            </button>
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 3,
            left: 12,
            right: 12,
            bottom: 88,
            padding: '10px 12px',
            background: 'rgba(127,29,29,0.9)',
            border: '1px solid #f87171',
            color: '#fecaca',
            fontSize: 12,
          }}
        >
          场景错误：{error}
        </div>
      ) : null}

      <div
        ref={hostRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          cursor: composeMode ? 'grab' : 'default',
        }}
      />

      {composeMode ? (
        <ComposePanel
          selectedTag={cursor.selectedTag}
          draft={draft}
          expanded={railOpen}
          onExpandedChange={setRailOpen}
          onDraftChange={setDraft}
          onRebuild={requestRebuild}
          onDeleteSelected={deleteSelected}
          onCatalogDragStart={onCatalogDragStart}
        />
      ) : null}

      {catalogGhost && wrapRect ? (
        <div
          style={{
            position: 'fixed',
            left: catalogGhost.x + 12,
            top: catalogGhost.y + 12,
            zIndex: 20,
            pointerEvents: 'none',
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #67e8f9',
            background: 'rgba(14,165,233,0.85)',
            color: '#f8fafc',
            fontFamily: 'Consolas, monospace',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          }}
        >
          {catalogGhost.kind}
        </div>
      ) : null}
    </div>
  );
};

function tjBtn(active: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    border: '1px solid rgba(56,189,248,0.5)',
    background: active ? 'rgba(14,165,233,0.45)' : 'rgba(15,23,42,0.7)',
    color: '#e0f2fe',
    padding: '3px 8px',
    borderRadius: 3,
    fontSize: 11,
  };
}

export default Scene3DRenderer;
