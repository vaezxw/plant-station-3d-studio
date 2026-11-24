import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getCatalogItem, type CatalogKind } from '../domain/catalog';
import type { PipeEdge, SceneNode, TransformTool, Vec3 } from '../domain/schema';
import type { StudioScene3DTheme } from '../domain/themes';
import { getSkidFlow } from '../scene/hengGuangSkid';
import type { PipeFlowAnimator } from '../scene/flow';
import {
  attachTurbojetRig,
  getTurbojetMapping,
  type TurbojetRig,
} from '../scene/turbojet/createTurbojetViewer';
import type { CameraPresetView } from '../store/useEditorStore';
import {
  disposeAssetObject,
  extractObjectPorts,
  getAssetSourceKey,
  instantiateAssetObject,
} from './AssetManager';
import { buildPipeMesh, disposeBuiltPipe, resolvePortWorld, type BuiltPipe } from './PipeSystem';
import { exportGroupToGlb } from './SceneExporter';

type NodeEntry = {
  node: SceneNode;
  sig: string;
  object: THREE.Object3D;
  label: CSS2DObject;
  labelEl: HTMLDivElement;
  flow: PipeFlowAnimator | null;
  rig: TurbojetRig | null;
};

export type DragFeedback = {
  tag: string;
  x: number;
  z: number;
  alignedX: boolean;
  alignedZ: boolean;
};

export type SceneCallbacks = {
  onSelectNode: (nodeId: string | null, partLabel?: string | null) => void;
  onSelectPipe: (pipeId: string | null) => void;
  onPipeConnect: (fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) => void;
  onTransformCommit: (nodeId: string, pos: Vec3, rot: Vec3, scale: Vec3) => void;
  onDragMove?: (info: DragFeedback | null) => void;
};

export class SceneCore {
  private host: HTMLElement;
  private callbacks: SceneCallbacks;
  private renderer: THREE.WebGLRenderer;
  private css2d: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orbit: OrbitControls;
  private transform: TransformControls;
  private transformHelper: THREE.Object3D;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;

  private groundMesh: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private gridMajor: THREE.GridHelper | null = null;
  private gridMinor: THREE.GridHelper | null = null;
  private gridGroup = new THREE.Group();
  private nodesGroup = new THREE.Group();
  private pipesGroup = new THREE.Group();
  private portsOverlayGroup = new THREE.Group();
  private alignGroup = new THREE.Group();
  private labelsGroup = new THREE.Group();

  private entries = new Map<string, NodeEntry>();
  private pipeList: PipeEdge[] = [];
  private builtPipes = new Map<string, BuiltPipe>();
  private pendingPipeStart: { nodeId: string; portId: string; marker: THREE.Mesh } | null = null;
  private selectionBox: THREE.BoxHelper | null = null;
  private directDrag = {
    active: false,
    nodeId: null as string | null,
    startY: 0,
    startPos: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    moved: false,
  };
  private selectedId: string | null = null;
  private tool: TransformTool = 'select';
  private snapEnabled = true;
  private snapStep = 0.25;
  private labelsVisible = true;
  private gridVisible = true;
  private interactive = true;
  private canvasLocked = false;

  private ghostRoot: THREE.Group | null = null;
  private ghostRing: THREE.LineLoop | null = null;
  private ghostKind: CatalogKind | null = null;

  private flyTargetPos: THREE.Vector3 | null = null;
  private flyTargetLook: THREE.Vector3 | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hitVec = new THREE.Vector3();
  private ro: ResizeObserver;
  private raf = 0;
  private lastTime = performance.now();
  private disposed = false;

  constructor(host: HTMLElement, initialTheme: StudioScene3DTheme, callbacks: SceneCallbacks) {
    this.host = host;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(initialTheme.background);
    this.scene.fog = new THREE.FogExp2(initialTheme.fogColor, initialTheme.fogDensity);
    this.scene.environmentIntensity = initialTheme.envIntensity;

    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 180);
    this.camera.position.set(7.5, 6.8, 8.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    host.appendChild(this.renderer.domElement);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;

    this.css2d = new CSS2DRenderer();
    this.css2d.setSize(w, h);
    this.css2d.domElement.style.position = 'absolute';
    this.css2d.domElement.style.inset = '0';
    this.css2d.domElement.style.pointerEvents = 'none';
    host.appendChild(this.css2d.domElement);

    // 三点光照明
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(8, 14, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    rimLight.position.set(-9, 6, -8);
    this.scene.add(rimLight);

    // 接收阴影的科技混凝土地坪
    this.groundMat = new THREE.MeshStandardMaterial({
      color: initialTheme.groundColor,
      roughness: 0.88,
      metalness: 0.08,
    });
    this.groundMesh = new THREE.Mesh(new THREE.CircleGeometry(48, 64), this.groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.002;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    this.scene.add(this.gridGroup);
    this.rebuildGrids(initialTheme.gridPrimary, initialTheme.gridSecondary);

    this.scene.add(this.nodesGroup);
    this.scene.add(this.pipesGroup);
    this.scene.add(this.portsOverlayGroup);
    this.scene.add(this.alignGroup);
    this.scene.add(this.labelsGroup);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.maxPolarAngle = Math.PI * 0.485;
    this.orbit.minDistance = 1.6;
    this.orbit.maxDistance = 42;
    this.orbit.target.set(0.5, 0.5, 0);
    this.orbit.update();

    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setSize(0.85);
    this.applySnapSettings();
    this.transformHelper = this.transform.getHelper();
    this.scene.add(this.transformHelper);

    this.transform.addEventListener('dragging-changed', (event) => {
      const dragging = Boolean(event.value);
      this.orbit.enabled = !dragging;
      if (!dragging && this.selectedId) {
        const entry = this.entries.get(this.selectedId);
        if (entry) {
          const p = entry.object.position;
          const r = entry.object.rotation;
          const s = entry.object.scale;
          this.callbacks.onTransformCommit(
            this.selectedId,
            [Number(p.x.toFixed(3)), Number(p.y.toFixed(3)), Number(p.z.toFixed(3))],
            [Number(r.x.toFixed(4)), Number(r.y.toFixed(4)), Number(r.z.toFixed(4))],
            [Number(s.x.toFixed(3)), Number(s.y.toFixed(3)), Number(s.z.toFixed(3))],
          );
        }
      }
    });

    this.transform.addEventListener('objectChange', () => {
      if (this.selectionBox) this.selectionBox.update();
      this.refreshAllPipes();
    });

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerUp);

    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(host);
    this.handleResize();

    this.raf = requestAnimationFrame(this.tick);
  }

  private pointerDownPos = { x: 0, y: 0 };

  private updatePointerFromEvent(e: PointerEvent): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  private clearAlignGuides() {
    while (this.alignGroup.children.length > 0) {
      const line = this.alignGroup.children[0] as THREE.Line;
      this.alignGroup.remove(line);
      line.geometry?.dispose();
      (line.material as THREE.Material)?.dispose();
    }
  }

  private drawAlignLine(p1: THREE.Vector3, p2: THREE.Vector3, colorHex: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 });
    this.alignGroup.add(new THREE.Line(geo, mat));
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.flyTargetPos = null;
    this.flyTargetLook = null;

    if (
      e.button !== 0 ||
      !this.interactive ||
      this.canvasLocked ||
      (this.tool !== 'select' && this.tool !== 'move') ||
      this.transform.dragging ||
      this.transform.axis !== null
    ) {
      return;
    }

    if (!this.updatePointerFromEvent(e)) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const pickables: THREE.Object3D[] = [];
    for (const entry of this.entries.values()) {
      if (entry.node.visible) pickables.push(entry.object);
    }
    const hits = this.raycaster.intersectObjects(pickables, true);
    if (hits.length === 0) return;

    const hit = hits[0];
    const nodeId = hit.object.userData.nodeId as string | undefined;
    if (!nodeId) return;
    const entry = this.entries.get(nodeId);
    if (!entry || entry.node.locked) return;

    let partLabel: string | null = null;
    if (entry.rig) {
      partLabel = entry.rig.pickFromObject(hit.object)?.labelZh ?? null;
    }
    this.callbacks.onSelectNode(nodeId, partLabel);

    // 投影到当前设备底面所在高度，直接抓起拖动
    this.groundPlane.constant = -entry.object.position.y;
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitVec)) return;

    this.directDrag.active = true;
    this.directDrag.nodeId = nodeId;
    this.directDrag.startY = entry.object.position.y;
    this.directDrag.startPos.copy(entry.object.position);
    this.directDrag.offset.subVectors(entry.object.position, this.hitVec);
    this.directDrag.offset.y = 0;
    this.directDrag.moved = false;

    this.orbit.enabled = false;
    this.renderer.domElement.style.cursor = 'grabbing';
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer events
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.updatePointerFromEvent(e)) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (!this.directDrag.active || !this.directDrag.nodeId) {
      if (
        this.interactive &&
        !this.canvasLocked &&
        (this.tool === 'select' || this.tool === 'move') &&
        !this.transform.dragging &&
        this.transform.axis === null
      ) {
        const pickables: THREE.Object3D[] = [];
        for (const entry of this.entries.values()) {
          if (entry.node.visible && !entry.node.locked) pickables.push(entry.object);
        }
        const hits = this.raycaster.intersectObjects(pickables, true);
        this.renderer.domElement.style.cursor = hits.length > 0 ? 'grab' : 'default';
      } else {
        this.renderer.domElement.style.cursor = 'default';
      }
      return;
    }

    const entry = this.entries.get(this.directDrag.nodeId);
    if (!entry) return;

    this.groundPlane.constant = -this.directDrag.startY;
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitVec)) return;

    const rawX = this.hitVec.x + this.directDrag.offset.x;
    const rawZ = this.hitVec.z + this.directDrag.offset.z;

    let nx = this.snapEnabled ? Math.round(rawX / this.snapStep) * this.snapStep : rawX;
    let nz = this.snapEnabled ? Math.round(rawZ / this.snapStep) * this.snapStep : rawZ;

    // 智能轴线磁吸对齐（类似 Figma / 酷家乐）
    const ALIGN_THRESHOLD = 0.16;
    let alignedXTarget: THREE.Vector3 | null = null;
    let alignedZTarget: THREE.Vector3 | null = null;
    let bestDx = ALIGN_THRESHOLD;
    let bestDz = ALIGN_THRESHOLD;

    for (const [otherId, other] of this.entries) {
      if (otherId === this.directDrag.nodeId || !other.node.visible) continue;
      const dx = Math.abs(rawX - other.object.position.x);
      if (dx < bestDx) {
        bestDx = dx;
        nx = other.object.position.x;
        alignedXTarget = other.object.position;
      }
      const dz = Math.abs(rawZ - other.object.position.z);
      if (dz < bestDz) {
        bestDz = dz;
        nz = other.object.position.z;
        alignedZTarget = other.object.position;
      }
    }

    nx = Number(nx.toFixed(3));
    nz = Number(nz.toFixed(3));

    entry.object.position.set(nx, this.directDrag.startY, nz);
    this.positionLabel(entry.label, entry.object);
    if (this.selectionBox) this.selectionBox.setFromObject(entry.object);
    this.refreshAllPipes();

    this.clearAlignGuides();
    if (alignedXTarget) {
      const zMin = Math.min(nz, alignedXTarget.z) - 1.0;
      const zMax = Math.max(nz, alignedXTarget.z) + 1.0;
      this.drawAlignLine(
        new THREE.Vector3(nx, 0.018, zMin),
        new THREE.Vector3(nx, 0.018, zMax),
        0x38bdf8,
      );
    }
    if (alignedZTarget) {
      const xMin = Math.min(nx, alignedZTarget.x) - 1.0;
      const xMax = Math.max(nx, alignedZTarget.x) + 1.0;
      this.drawAlignLine(
        new THREE.Vector3(xMin, 0.018, nz),
        new THREE.Vector3(xMax, 0.018, nz),
        0xf59e0b,
      );
    }

    if (entry.object.position.distanceTo(this.directDrag.startPos) > 0.01) {
      this.directDrag.moved = true;
    }

    this.callbacks.onDragMove?.({
      tag: entry.node.tag,
      x: nx,
      z: nz,
      alignedX: Boolean(alignedXTarget),
      alignedZ: Boolean(alignedZTarget),
    });
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.directDrag.active) {
      const nodeId = this.directDrag.nodeId;
      const moved = this.directDrag.moved;
      this.directDrag.active = false;
      this.directDrag.nodeId = null;
      this.directDrag.moved = false;
      this.orbit.enabled = true;
      this.renderer.domElement.style.cursor = 'grab';
      this.clearAlignGuides();
      this.callbacks.onDragMove?.(null);
      try {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (moved && nodeId) {
        const entry = this.entries.get(nodeId);
        if (entry) {
          const p = entry.object.position;
          const r = entry.object.rotation;
          const s = entry.object.scale;
          this.callbacks.onTransformCommit(
            nodeId,
            [Number(p.x.toFixed(3)), Number(p.y.toFixed(3)), Number(p.z.toFixed(3))],
            [Number(r.x.toFixed(4)), Number(r.y.toFixed(4)), Number(r.z.toFixed(4))],
            [Number(s.x.toFixed(3)), Number(s.y.toFixed(3)), Number(s.z.toFixed(3))],
          );
        }
      }
      return;
    }

    if (e.button !== 0) return;
    if (this.transform.dragging) return;
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 25) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 连管模式下优先拾取管口锚点
    if (this.tool === 'pipe' && this.interactive && !this.canvasLocked) {
      const portHits = this.raycaster.intersectObjects(this.portsOverlayGroup.children, false);
      if (portHits.length > 0) {
        const marker = portHits[0].object as THREE.Mesh;
        const pick = marker.userData.portPick as { nodeId: string; portId: string } | undefined;
        if (pick) {
          if (!this.pendingPipeStart) {
            this.pendingPipeStart = { ...pick, marker };
            (marker.material as THREE.MeshStandardMaterial).color.setHex(0x22c55e);
            (marker.material as THREE.MeshStandardMaterial).emissive.setHex(0x16a34a);
            marker.scale.setScalar(1.35);
          } else if (this.pendingPipeStart.nodeId !== pick.nodeId) {
            this.callbacks.onPipeConnect(
              this.pendingPipeStart.nodeId,
              this.pendingPipeStart.portId,
              pick.nodeId,
              pick.portId,
            );
            this.pendingPipeStart = null;
            this.rebuildPortMarkers();
          }
          return;
        }
      }
      this.pendingPipeStart = null;
      this.rebuildPortMarkers();
    }

    const pickables: THREE.Object3D[] = [];
    for (const entry of this.entries.values()) {
      if (entry.node.visible) pickables.push(entry.object);
    }
    const hits = this.raycaster.intersectObjects(pickables, true);
    if (hits.length === 0) {
      const pipeHits = this.raycaster.intersectObjects(this.pipesGroup.children, true);
      if (pipeHits.length > 0) {
        const pipeId = pipeHits[0].object.userData.pipeId as string | undefined;
        if (pipeId) {
          this.callbacks.onSelectPipe(pipeId);
          return;
        }
      }
      this.callbacks.onSelectNode(null, null);
      return;
    }
    const hit = hits[0];
    const nodeId = hit.object.userData.nodeId as string | undefined;
    if (!nodeId) return;
    const entry = this.entries.get(nodeId);
    let partLabel: string | null = null;
    if (entry?.rig) {
      const part = entry.rig.pickFromObject(hit.object);
      partLabel = part?.labelZh ?? null;
    }
    this.callbacks.onSelectNode(nodeId, partLabel);
  };

  private rebuildGrids(primaryHex: string, secondaryHex: string) {
    if (this.gridMajor) {
      this.gridGroup.remove(this.gridMajor);
      this.gridMajor.dispose();
    }
    if (this.gridMinor) {
      this.gridGroup.remove(this.gridMinor);
      this.gridMinor.dispose();
    }
    this.gridMinor = new THREE.GridHelper(32, 64, secondaryHex, secondaryHex);
    this.gridMinor.position.y = 0.001;
    (this.gridMinor.material as THREE.Material).transparent = true;
    (this.gridMinor.material as THREE.Material).opacity = 0.42;

    this.gridMajor = new THREE.GridHelper(32, 16, primaryHex, primaryHex);
    this.gridMajor.position.y = 0.002;
    (this.gridMajor.material as THREE.Material).transparent = true;
    (this.gridMajor.material as THREE.Material).opacity = 0.65;

    this.gridGroup.add(this.gridMinor, this.gridMajor);
  }

  applyTheme(theme: StudioScene3DTheme) {
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity);
    this.scene.environmentIntensity = theme.envIntensity;
    this.groundMat.color.set(theme.groundColor);
    this.rebuildGrids(theme.gridPrimary, theme.gridSecondary);
  }

  setGridVisible(visible: boolean) {
    this.gridVisible = visible;
    this.gridGroup.visible = this.gridVisible;
  }

  setLabelsVisible(visible: boolean) {
    this.labelsVisible = visible;
    this.labelsGroup.visible = visible;
    for (const entry of this.entries.values()) {
      entry.label.visible = visible && entry.node.visible;
    }
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive;
    this.syncTransformAttachment();
    this.rebuildPortMarkers();
  }

  setCanvasLocked(locked: boolean) {
    this.canvasLocked = locked;
    if (locked && this.directDrag.active) {
      this.directDrag.active = false;
      this.directDrag.nodeId = null;
      this.orbit.enabled = true;
      this.clearAlignGuides();
      this.callbacks.onDragMove?.(null);
    }
    this.renderer.domElement.style.cursor = 'default';
    this.syncTransformAttachment();
    this.rebuildPortMarkers();
  }

  setTool(tool: TransformTool) {
    this.tool = tool;
    this.pendingPipeStart = null;
    this.syncTransformAttachment();
    this.rebuildPortMarkers();
  }

  setSnap(enabled: boolean, step = 0.25) {
    this.snapEnabled = enabled;
    this.snapStep = step;
    this.applySnapSettings();
  }

  private applySnapSettings() {
    this.transform.setTranslationSnap(this.snapEnabled ? this.snapStep : null);
    this.transform.setRotationSnap(this.snapEnabled ? THREE.MathUtils.degToRad(15) : null);
    this.transform.setScaleSnap(this.snapEnabled ? 0.1 : null);
  }

  setSelectedNode(nodeId: string | null) {
    this.selectedId = nodeId;
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.dispose();
      this.selectionBox = null;
    }
    for (const [id, entry] of this.entries) {
      entry.labelEl.dataset.selected = id === nodeId ? 'true' : 'false';
    }
    if (nodeId) {
      const entry = this.entries.get(nodeId);
      if (entry && entry.node.visible) {
        this.selectionBox = new THREE.BoxHelper(entry.object, 0x38bdf8);
        this.scene.add(this.selectionBox);
      }
    }
    this.syncTransformAttachment();
  }

  private syncTransformAttachment() {
    if (
      !this.interactive ||
      this.canvasLocked ||
      this.tool === 'select' ||
      this.tool === 'pipe' ||
      !this.selectedId
    ) {
      this.transform.detach();
      this.transformHelper.visible = false;
      return;
    }
    const entry = this.entries.get(this.selectedId);
    if (!entry || entry.node.locked || !entry.node.visible) {
      this.transform.detach();
      this.transformHelper.visible = false;
      return;
    }
    const mode = this.tool === 'move' ? 'translate' : this.tool === 'rotate' ? 'rotate' : 'scale';
    this.transform.setMode(mode);
    this.transform.attach(entry.object);
    this.transformHelper.visible = true;
  }

  syncNodes(nodes: SceneNode[]) {
    const incomingIds = new Set(nodes.map((n) => n.id));
    for (const [id, entry] of this.entries) {
      if (!incomingIds.has(id)) {
        if (this.transform.object === entry.object) this.transform.detach();
        this.nodesGroup.remove(entry.object);
        this.labelsGroup.remove(entry.label);
        entry.flow?.dispose();
        disposeAssetObject(entry.object);
        this.entries.delete(id);
      }
    }

    for (const node of nodes) {
      const sourceKey = getAssetSourceKey(node.kind, node.customGlbId);
      const sig = `${node.kind}|${node.customGlbId ?? ''}|${node.color ?? ''}|${node.labelText ?? ''}|${sourceKey}`;
      const existing = this.entries.get(node.id);
      if (existing && existing.sig === sig) {
        existing.node = node;
        existing.object.position.set(...node.position);
        existing.object.rotation.set(...node.rotation);
        existing.object.scale.set(...node.scale);
        existing.object.visible = node.visible;
        existing.labelEl.textContent = node.tag;
        existing.label.visible = this.labelsVisible && node.visible;
        this.positionLabel(existing.label, existing.object);
        continue;
      }

      if (existing) {
        if (this.transform.object === existing.object) this.transform.detach();
        this.nodesGroup.remove(existing.object);
        this.labelsGroup.remove(existing.label);
        existing.flow?.dispose();
        disposeAssetObject(existing.object);
      }

      const object = instantiateAssetObject(node.kind, {
        nodeId: node.id,
        tag: node.tag,
        labelText: node.labelText ?? node.tag,
        customGlbId: node.customGlbId,
        colorHex: node.color,
      });
      object.position.set(...node.position);
      object.rotation.set(...node.rotation);
      object.scale.set(...node.scale);
      object.visible = node.visible;
      this.nodesGroup.add(object);

      let rig: TurbojetRig | null = null;
      if (node.kind === 'TURBOJET') {
        const mapping = getTurbojetMapping();
        if (mapping) rig = attachTurbojetRig(object, mapping);
      }

      const flow = getSkidFlow(object);

      const labelEl = document.createElement('div');
      labelEl.textContent = node.tag;
      labelEl.style.cssText = [
        'pointer-events:auto',
        'cursor:pointer',
        'padding:2px 7px',
        'border-radius:999px',
        'font-family:"JetBrains Mono",Consolas,monospace',
        'font-size:10px',
        'font-weight:600',
        'letter-spacing:0.4px',
        'color:#e0f2fe',
        'background:rgba(15,23,42,0.82)',
        'border:1px solid rgba(56,189,248,0.45)',
        'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
        'user-select:none',
        'white-space:nowrap',
      ].join(';');
      labelEl.dataset.selected = node.id === this.selectedId ? 'true' : 'false';
      labelEl.onclick = (ev) => {
        ev.stopPropagation();
        this.callbacks.onSelectNode(node.id, null);
      };

      const label = new CSS2DObject(labelEl);
      label.visible = this.labelsVisible && node.visible;
      this.labelsGroup.add(label);
      this.positionLabel(label, object);

      this.entries.set(node.id, {
        node,
        sig,
        object,
        label,
        labelEl,
        flow,
        rig,
      });
    }

    if (this.selectionBox && this.selectedId) {
      const sel = this.entries.get(this.selectedId);
      if (sel) this.selectionBox.setFromObject(sel.object);
    }
    this.syncTransformAttachment();
    this.refreshAllPipes();
    this.rebuildPortMarkers();
  }

  syncPipes(pipes: PipeEdge[]) {
    this.pipeList = pipes;
    this.refreshAllPipes();
  }

  private refreshAllPipes() {
    for (const bp of this.builtPipes.values()) {
      this.pipesGroup.remove(bp.group);
      disposeBuiltPipe(bp);
    }
    this.builtPipes.clear();

    for (const edge of this.pipeList) {
      const from = this.entries.get(edge.fromNodeId);
      const to = this.entries.get(edge.toNodeId);
      if (!from || !to || !from.node.visible || !to.node.visible) continue;
      const bp = buildPipeMesh(edge, from.object, to.object);
      if (!bp) continue;
      this.pipesGroup.add(bp.group);
      this.builtPipes.set(edge.id, bp);
    }
  }

  private rebuildPortMarkers() {
    while (this.portsOverlayGroup.children.length > 0) {
      const child = this.portsOverlayGroup.children[0] as THREE.Mesh;
      this.portsOverlayGroup.remove(child);
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
    }
    this.pendingPipeStart = null;
    if (this.tool !== 'pipe' || !this.interactive || this.canvasLocked) return;

    for (const [nodeId, entry] of this.entries) {
      if (!entry.node.visible) continue;
      const ports = extractObjectPorts(entry.object);
      for (const p of ports) {
        const resolved = resolvePortWorld(entry.object, p.id);
        if (!resolved) continue;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 14, 12),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.85,
            roughness: 0.2,
          }),
        );
        marker.position.copy(resolved.pos);
        marker.userData.portPick = { nodeId, portId: p.id };
        this.portsOverlayGroup.add(marker);
      }
    }
  }

  async exportPlantGlb(filename: string): Promise<void> {
    const exportGroup = new THREE.Group();
    exportGroup.name = 'plant-station-export';
    const nodesClone = this.nodesGroup.clone(true);
    const pipesClone = this.pipesGroup.clone(true);
    exportGroup.add(nodesClone, pipesClone);
    try {
      await exportGroupToGlb(exportGroup, filename);
    } finally {
      disposeAssetObject(nodesClone);
      pipesClone.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    }
  }

  private positionLabel(label: CSS2DObject, obj: THREE.Object3D) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) {
      label.position.set(obj.position.x, obj.position.y + 0.8, obj.position.z);
    } else {
      const center = new THREE.Vector3();
      box.getCenter(center);
      label.position.set(center.x, box.max.y + 0.22, center.z);
    }
  }

  /** 将屏幕坐标投影到 y = planeY 水平面，返回吸附后世界坐标 */
  projectClientToGround(clientX: number, clientY: number, planeY = 0): Vec3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.groundPlane.constant = -planeY;
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitVec)) return null;
    const snap = (v: number) =>
      this.snapEnabled ? Math.round(v / this.snapStep) * this.snapStep : Number(v.toFixed(2));
    return [snap(this.hitVec.x), planeY, snap(this.hitVec.z)];
  }

  updateDragGhost(clientX: number, clientY: number, kind: CatalogKind | null) {
    if (!kind) {
      this.clearDragGhost();
      return;
    }
    const item = getCatalogItem(kind);
    const placeY = item?.placeY ?? 0;
    const pt = this.projectClientToGround(clientX, clientY, placeY);
    if (!pt) {
      if (this.ghostRoot) this.ghostRoot.visible = false;
      if (this.ghostRing) this.ghostRing.visible = false;
      return;
    }
    if (this.ghostKind !== kind || !this.ghostRoot) {
      this.clearDragGhost();
      this.ghostKind = kind;
      const preview = instantiateAssetObject(kind, { nodeId: '__ghost__', tag: 'GHOST' });
      preview.traverse((c) => {
        c.userData.pickable = false;
        if (c instanceof THREE.Mesh) {
          c.castShadow = false;
          c.receiveShadow = false;
          c.material = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.42,
            emissive: 0x0284c7,
            emissiveIntensity: 0.45,
          });
        }
      });
      this.ghostRoot = new THREE.Group();
      this.ghostRoot.add(preview);
      this.scene.add(this.ghostRoot);

      const box = new THREE.Box3().setFromObject(preview);
      const size = new THREE.Vector3();
      box.getSize(size);
      const rx = Math.max(0.4, size.x * 0.55);
      const rz = Math.max(0.4, size.z * 0.55);
      const pts = [
        new THREE.Vector3(-rx, 0.02, -rz),
        new THREE.Vector3(rx, 0.02, -rz),
        new THREE.Vector3(rx, 0.02, rz),
        new THREE.Vector3(-rx, 0.02, rz),
      ];
      this.ghostRing = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x38bdf8 }),
      );
      this.scene.add(this.ghostRing);
    }
    this.ghostRoot.visible = true;
    this.ghostRoot.position.set(pt[0], pt[1], pt[2]);
    if (this.ghostRing) {
      this.ghostRing.visible = true;
      this.ghostRing.position.set(pt[0], 0.01, pt[2]);
    }
  }

  clearDragGhost() {
    if (this.ghostRoot) {
      this.scene.remove(this.ghostRoot);
      disposeAssetObject(this.ghostRoot);
      this.ghostRoot = null;
    }
    if (this.ghostRing) {
      this.scene.remove(this.ghostRing);
      this.ghostRing.geometry.dispose();
      (this.ghostRing.material as THREE.Material).dispose();
      this.ghostRing = null;
    }
    this.ghostKind = null;
  }

  flyTo(position: Vec3, target: Vec3) {
    this.flyTargetPos = new THREE.Vector3(...position);
    this.flyTargetLook = new THREE.Vector3(...target);
  }

  getCameraPose(): { position: Vec3; target: Vec3 } {
    const p = this.camera.position;
    const t = this.orbit.target;
    return {
      position: [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
      target: [Number(t.x.toFixed(2)), Number(t.y.toFixed(2)), Number(t.z.toFixed(2))],
    };
  }

  applyCameraPreset(view: CameraPresetView) {
    if (view === 'iso') {
      this.flyTo([7.5, 6.8, 8.5], [0.5, 0.5, 0]);
      return;
    }
    if (view === 'top') {
      this.flyTo([0.5, 13.5, 0.01], [0.5, 0, 0]);
      return;
    }
    if (view === 'front') {
      this.flyTo([0.5, 2.8, 10.5], [0.5, 0.8, 0]);
      return;
    }
    if (view === 'focus') {
      const entry = this.selectedId ? this.entries.get(this.selectedId) : null;
      if (!entry) {
        this.flyTo([7.5, 6.8, 8.5], [0.5, 0.5, 0]);
        return;
      }
      const box = new THREE.Box3().setFromObject(entry.object);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const dist = Math.max(2.4, size.length() * 1.75);
      this.flyTo(
        [center.x + dist * 0.72, center.y + dist * 0.58, center.z + dist * 0.78],
        [center.x, center.y, center.z],
      );
    }
  }

  getTurbojetRig(nodeId: string): TurbojetRig | null {
    return this.entries.get(nodeId)?.rig ?? null;
  }

  private handleResize() {
    if (this.disposed) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.css2d.setSize(w, h);
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.flyTargetPos && this.flyTargetLook) {
      const k = 1 - Math.exp(-6.5 * dt);
      this.camera.position.lerp(this.flyTargetPos, k);
      this.orbit.target.lerp(this.flyTargetLook, k);
      if (
        this.camera.position.distanceTo(this.flyTargetPos) < 0.04 &&
        this.orbit.target.distanceTo(this.flyTargetLook) < 0.04
      ) {
        this.camera.position.copy(this.flyTargetPos);
        this.orbit.target.copy(this.flyTargetLook);
        this.flyTargetPos = null;
        this.flyTargetLook = null;
      }
    }

    this.orbit.update();

    for (const entry of this.entries.values()) {
      if (entry.rig) entry.rig.tick(dt);
      if (this.transform.dragging && this.transform.object === entry.object) {
        this.positionLabel(entry.label, entry.object);
      }
    }

    for (const bp of this.builtPipes.values()) {
      bp.phase = (bp.phase + dt * 0.28) % 1;
      const count = bp.pulses.length;
      for (let i = 0; i < count; i++) {
        const u = (bp.phase + i / count) % 1;
        const pt = bp.curve.getPointAt(u);
        bp.pulses[i].position.copy(pt);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.css2d.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.onPointerUp);
    this.clearAlignGuides();
    this.clearDragGhost();
    if (this.selectionBox) this.selectionBox.dispose();
    this.transform.dispose();
    this.orbit.dispose();
    this.gridMajor?.dispose();
    this.gridMinor?.dispose();
    this.groundMesh.geometry.dispose();
    this.groundMat.dispose();
    for (const bp of this.builtPipes.values()) {
      disposeBuiltPipe(bp);
    }
    this.builtPipes.clear();
    for (const entry of this.entries.values()) {
      entry.flow?.dispose();
      disposeAssetObject(entry.object);
    }
    this.entries.clear();
    this.envRT.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.host) {
      this.host.removeChild(this.renderer.domElement);
    }
    if (this.css2d.domElement.parentElement === this.host) {
      this.host.removeChild(this.css2d.domElement);
    }
  }
}
