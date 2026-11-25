import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  TURBOJET_GLB_URL,
  TURBOJET_MAP_URL,
  type TurbojetMapping,
  type TurbojetPartMap,
} from './types';

export type TurbojetSelect = {
  partId: string;
  labelZh: string;
  group: string;
  x: number;
  y: number;
};

export type TurbojetViewer = {
  dispose: () => void;
  setSpin: (on: boolean) => void;
  setExplode: (on: boolean) => void;
  setCutaway: (on: boolean) => void;
  resetView: () => void;
  resize: () => void;
};

export type TurbojetPick = {
  partId: string;
  labelZh: string;
  group: string;
};

export type TurbojetRig = {
  setSpin: (on: boolean) => void;
  setExplode: (on: boolean) => void;
  setCutaway: (on: boolean) => void;
  reset: () => void;
  tick: (dt: number) => void;
  pickFromObject: (obj: THREE.Object3D) => TurbojetPick | null;
  clearPick: () => void;
  getState: () => { spin: boolean; explode: boolean; cutaway: boolean };
  selected: () => TurbojetPick | null;
};

const FALLBACK_MAPPING: TurbojetMapping = {
  engine: 'small-axial-turbojet',
  monitorOnly: true,
  spin: { nodeName: 'RotorSpool', axis: [0, 0, -1] },
  clip: { planeNormal: [1, 0, 0], constant: 0, groups: ['casing'] },
  parts: [],
};

let mappingCache: TurbojetMapping | null = null;
let mappingInflight: Promise<TurbojetMapping> | null = null;

export function getTurbojetMapping(): TurbojetMapping | null {
  return mappingCache;
}

export async function preloadTurbojetMapping(): Promise<TurbojetMapping> {
  if (mappingCache) return mappingCache;
  if (mappingInflight) return mappingInflight;
  mappingInflight = (async () => {
    try {
      const res = await fetch(TURBOJET_MAP_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`映射 ${res.status}`);
      mappingCache = (await res.json()) as TurbojetMapping;
      return mappingCache;
    } catch {
      mappingCache = FALLBACK_MAPPING;
      return mappingCache;
    } finally {
      mappingInflight = null;
    }
  })();
  return mappingInflight;
}

/**
 * 把运转 / 爆炸 / 剖切 / 点选高亮挂到已放入共享 Scene 的涡喷根节点上。
 * 每件实例独立；不自建 renderer / OrbitControls。
 */
export function attachTurbojetRig(
  root: THREE.Object3D,
  mapping: TurbojetMapping = mappingCache ?? FALLBACK_MAPPING,
): TurbojetRig {
  const byName = new Map<string, TurbojetPartMap>();
  for (const p of mapping.parts) {
    byName.set(p.partId, p);
    byName.set(p.name, p);
  }

  const parts: PartHandle[] = [];
  const seen = new Set<THREE.Object3D>();
  let spool: THREE.Object3D | null = null;
  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (obj.name === mapping.spin.nodeName) spool = obj;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = Array.isArray(mesh.material)
      ? mats.map((m) => cloneMat(m))
      : cloneMat(mats[0]);
    const std: THREE.MeshStandardMaterial[] = [];
    const applied = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of applied) {
      const s = asStandard(m);
      if (s) std.push(s);
    }

    const info = findPartId(obj, byName);
    const anchor = info ? walkToNamed(obj, info.partId) : obj;
    if (seen.has(anchor)) return;
    seen.add(anchor);
    const partId = info?.partId ?? obj.name;
    const group = info?.group ?? String((obj.userData as { group?: string }).group ?? '');
    const labelZh = info?.labelZh ?? partId;
    const worldOff = new THREE.Vector3();
    if (info?.explode && info.explode.length >= 3) {
      worldOff.set(info.explode[0], info.explode[1], info.explode[2]);
    } else {
      const ud = obj.userData as { explodeX?: number; explodeY?: number; explodeZ?: number };
      worldOff.set(Number(ud.explodeX ?? 0), Number(ud.explodeY ?? 0), Number(ud.explodeZ ?? 0));
    }
    parts.push({
      object: anchor,
      partId,
      group,
      labelZh,
      restLocal: anchor.position.clone(),
      explodeLocal: explodeToLocal(anchor, worldOff),
      materials: std,
    });
  });

  if (!spool) spool = root.getObjectByName('RotorSpool') ?? null;
  const rotorNodes: THREE.Object3D[] = [];
  if (spool) rotorNodes.push(spool);
  else {
    for (const p of parts) {
      if (p.group === 'rotor') rotorNodes.push(p.object);
    }
  }

  const spinAxis = new THREE.Vector3(
    mapping.spin.axis[0] ?? 0,
    mapping.spin.axis[1] ?? 0,
    mapping.spin.axis[2] ?? -1,
  ).normalize();
  const localClipNormal = new THREE.Vector3(
    mapping.clip.planeNormal[0] ?? 1,
    mapping.clip.planeNormal[1] ?? 0,
    mapping.clip.planeNormal[2] ?? 0,
  ).normalize();
  const syncClipPlane = () => {
    root.updateMatrixWorld(true);
    const n = localClipNormal.clone().transformDirection(root.matrixWorld).normalize();
    const origin = new THREE.Vector3();
    root.getWorldPosition(origin);
    clipPlane.normal.copy(n);
    clipPlane.constant = -n.dot(origin) + (mapping.clip.constant ?? 0);
  };
  syncClipPlane();

  let spin = false;
  let explode = false;
  let explodeT = 0;
  let cutaway = false;
  let selected: PartHandle | null = null;
  const origEmissive = new Map<THREE.MeshStandardMaterial, THREE.Color>();

  const applyCutaway = (on: boolean) => {
    cutaway = on;
    const groups = new Set(mapping.clip.groups ?? ['casing']);
    for (const p of parts) {
      if (!groups.has(p.group)) continue;
      for (const m of p.materials) {
        m.clippingPlanes = on ? [clipPlane] : [];
        m.clipShadows = on;
        m.needsUpdate = true;
      }
    }
  };

  const applyHighlight = (part: PartHandle | null) => {
    for (const [mat, col] of origEmissive) {
      mat.emissive.copy(col);
    }
    origEmissive.clear();
    if (!part) return;
    for (const m of part.materials) {
      origEmissive.set(m, m.emissive.clone());
      m.emissive.set(0x1d4ed8);
      m.emissiveIntensity = 0.55;
    }
  };

  const toPick = (part: PartHandle | null): TurbojetPick | null =>
    part ? { partId: part.partId, labelZh: part.labelZh, group: part.group } : null;

  return {
    setSpin: (on) => {
      spin = on;
    },
    setExplode: (on) => {
      explode = on;
    },
    setCutaway: (on) => {
      applyCutaway(on);
      if (on) syncClipPlane();
    },
    reset: () => {
      spin = false;
      explode = false;
      explodeT = 0;
      applyCutaway(false);
      selected = null;
      applyHighlight(null);
      for (const p of parts) p.object.position.copy(p.restLocal);
      for (const n of rotorNodes) n.rotation.set(0, 0, 0);
    },
    tick: (dt) => {
      if (cutaway) syncClipPlane();
      if (spin) {
        const omega = 7.5 * dt;
        for (const n of rotorNodes) n.rotateOnAxis(spinAxis, omega);
      }
      const target = explode ? 1 : 0;
      explodeT += (target - explodeT) * Math.min(1, dt * 6);
      if (Math.abs(target - explodeT) < 0.002) explodeT = target;
      for (const p of parts) {
        p.object.position.lerpVectors(p.restLocal, p.restLocal.clone().add(p.explodeLocal), explodeT);
      }
    },
    pickFromObject: (obj) => {
      const info = findPartId(obj, byName);
      const part =
        (info && parts.find((p) => p.partId === info.partId)) ||
        parts.find((p) => obj === p.object || isChildOf(obj, p.object)) ||
        null;
      selected = part;
      applyHighlight(part);
      return toPick(part);
    },
    clearPick: () => {
      selected = null;
      applyHighlight(null);
    },
    getState: () => ({ spin, explode, cutaway }),
    selected: () => toPick(selected),
  };
}

type PartHandle = {
  object: THREE.Object3D;
  partId: string;
  group: string;
  labelZh: string;
  restLocal: THREE.Vector3;
  explodeLocal: THREE.Vector3;
  materials: THREE.MeshStandardMaterial[];
};

type Opts = {
  onSelect: (sel: TurbojetSelect | null) => void;
  onStatus: (msg: string | null) => void;
};

function asStandard(mat: THREE.Material): THREE.MeshStandardMaterial | null {
  if (mat instanceof THREE.MeshStandardMaterial) return mat;
  return null;
}

function cloneMat(mat: THREE.Material): THREE.Material {
  const c = mat.clone();
  c.side = THREE.DoubleSide;
  return c;
}

function findPartId(
  obj: THREE.Object3D,
  byName: Map<string, TurbojetPartMap>,
): TurbojetPartMap | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const ud = cur.userData as Record<string, unknown>;
    const pid = typeof ud.partId === 'string' ? ud.partId : cur.name;
    const mapped = byName.get(pid) ?? byName.get(cur.name);
    if (mapped) return mapped;
    cur = cur.parent;
  }
  return null;
}

function explodeToLocal(obj: THREE.Object3D, worldOff: THREE.Vector3): THREE.Vector3 {
  if (!obj.parent) return worldOff.clone();
  const restW = new THREE.Vector3();
  obj.getWorldPosition(restW);
  const tgtW = restW.clone().add(worldOff);
  const tgtL = obj.parent.worldToLocal(tgtW);
  return tgtL.sub(obj.position);
}

export async function createTurbojetViewer(
  host: HTMLDivElement,
  opts: Opts,
): Promise<TurbojetViewer> {
  let disposed = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  scene.fog = new THREE.Fog(0x0b1220, 1.6, 4.2);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 20);
  camera.position.set(0.42, 0.16, 0.38);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b1220, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.localClippingEnabled = true;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const labelEl = document.createElement('div');
  labelEl.style.cssText =
    'display:none;position:absolute;pointer-events:none;padding:4px 8px;border-radius:4px;background:rgba(15,23,42,0.92);border:1px solid rgba(56,189,248,0.55);color:#e0f2fe;font-size:12px;z-index:2;white-space:nowrap;font-family:"Microsoft YaHei","Segoe UI",sans-serif';
  host.appendChild(labelEl);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const hemi = new THREE.HemisphereLight(0xc9d6e3, 0x1e293b, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e6, 1.35);
  key.position.set(0.6, 0.8, 0.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x93c5fd, 0.45);
  fill.position.set(-0.5, 0.2, -0.3);
  scene.add(fill);

  const grid = new THREE.GridHelper(1.2, 24, 0x164e63, 0x1e293b);
  grid.position.y = -0.14;
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.01, 0);
  controls.minDistance = 0.18;
  controls.maxDistance = 1.8;
  controls.maxPolarAngle = Math.PI * 0.49;

  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

  let mapping: TurbojetMapping;
  try {
    const res = await fetch(TURBOJET_MAP_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`映射 ${res.status}`);
    mapping = (await res.json()) as TurbojetMapping;
  } catch (err) {
    opts.onStatus(`零件映射加载失败：${err instanceof Error ? err.message : String(err)}`);
    mapping = {
      engine: 'small-axial-turbojet',
      monitorOnly: true,
      spin: { nodeName: 'RotorSpool', axis: [0, 0, -1] },
      clip: { planeNormal: [1, 0, 0], constant: 0, groups: ['casing'] },
      parts: [],
    };
  }

  const byName = new Map<string, TurbojetPartMap>();
  for (const p of mapping.parts) {
    byName.set(p.partId, p);
    byName.set(p.name, p);
  }

  const loader = new GLTFLoader();
  let gltfScene: THREE.Group;
  try {
    const gltf = await loader.loadAsync(TURBOJET_GLB_URL);
    gltfScene = gltf.scene;
  } catch (err) {
    opts.onStatus(`GLB 加载失败：${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  if (disposed) {
    renderer.dispose();
    return {
      dispose: () => undefined,
      setSpin: () => undefined,
      setExplode: () => undefined,
      setCutaway: () => undefined,
      resetView: () => undefined,
      resize: () => undefined,
    };
  }

  scene.add(gltfScene);
  gltfScene.updateMatrixWorld(true);

  const parts: PartHandle[] = [];
  const seen = new Set<THREE.Object3D>();
  let spool: THREE.Object3D | null = null;
  const pickables: THREE.Object3D[] = [];

  gltfScene.traverse((obj) => {
    if (obj.name === mapping.spin.nodeName) spool = obj;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = Array.isArray(mesh.material)
      ? mats.map((m) => cloneMat(m))
      : cloneMat(mats[0]);
    const std: THREE.MeshStandardMaterial[] = [];
    const applied = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of applied) {
      const s = asStandard(m);
      if (s) std.push(s);
    }
    pickables.push(mesh);

    const info = findPartId(obj, byName);
    const anchor = info ? walkToNamed(obj, info.partId) : obj;
    if (seen.has(anchor)) return;
    seen.add(anchor);
    const partId = info?.partId ?? obj.name;
    const group = info?.group ?? String((obj.userData as { group?: string }).group ?? '');
    const labelZh = info?.labelZh ?? partId;
    const worldOff = new THREE.Vector3();
    if (info?.explode && info.explode.length >= 3) {
      worldOff.set(info.explode[0], info.explode[1], info.explode[2]);
    } else {
      const ud = obj.userData as { explodeX?: number; explodeY?: number; explodeZ?: number };
      worldOff.set(Number(ud.explodeX ?? 0), Number(ud.explodeY ?? 0), Number(ud.explodeZ ?? 0));
    }
    parts.push({
      object: anchor,
      partId,
      group,
      labelZh,
      restLocal: anchor.position.clone(),
      explodeLocal: explodeToLocal(anchor, worldOff),
      materials: std,
    });
  });

  if (!spool) {
    spool = gltfScene.getObjectByName('RotorSpool') ?? null;
  }
  const rotorNodes: THREE.Object3D[] = [];
  if (spool) rotorNodes.push(spool);
  else {
    for (const p of parts) {
      if (p.group === 'rotor') rotorNodes.push(p.object);
    }
  }

  const spinAxis = new THREE.Vector3(
    mapping.spin.axis[0] ?? 0,
    mapping.spin.axis[1] ?? 0,
    mapping.spin.axis[2] ?? -1,
  ).normalize();
  clipPlane.normal.set(
    mapping.clip.planeNormal[0] ?? 1,
    mapping.clip.planeNormal[1] ?? 0,
    mapping.clip.planeNormal[2] ?? 0,
  );
  clipPlane.constant = mapping.clip.constant ?? 0;

  const box = new THREE.Box3().setFromObject(gltfScene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.2);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(radius * 1.15, radius * 0.45, radius * 1.05));
  camera.near = Math.max(0.01, radius / 80);
  camera.far = radius * 20;
  camera.updateProjectionMatrix();
  const homePos = camera.position.clone();
  const homeTarget = controls.target.clone();

  let spin = false;
  let explode = false;
  let explodeT = 0;
  let selected: PartHandle | null = null;
  const origEmissive = new Map<THREE.MeshStandardMaterial, THREE.Color>();

  const applyCutaway = (on: boolean) => {
    const groups = new Set(mapping.clip.groups ?? ['casing']);
    for (const p of parts) {
      if (!groups.has(p.group)) continue;
      for (const m of p.materials) {
        m.clippingPlanes = on ? [clipPlane] : [];
        m.clipShadows = on;
        m.needsUpdate = true;
      }
    }
  };

  const applyHighlight = (part: PartHandle | null) => {
    for (const [mat, col] of origEmissive) {
      mat.emissive.copy(col);
    }
    origEmissive.clear();
    if (!part) return;
    for (const m of part.materials) {
      origEmissive.set(m, m.emissive.clone());
      m.emissive.set(0x1d4ed8);
      m.emissiveIntensity = 0.55;
    }
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const projectLabel = (obj: THREE.Object3D): { x: number; y: number } | null => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    const v = new THREE.Vector3();
    obj.getWorldPosition(v);
    v.project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  };

  const emitSelect = (part: PartHandle | null) => {
    selected = part;
    applyHighlight(part);
    if (!part) {
      labelEl.style.display = 'none';
      opts.onSelect(null);
      return;
    }
    labelEl.innerHTML = `<div style="font-weight:700">${part.labelZh}</div><div style="opacity:.7;font-size:10px">${part.partId} · ${part.group}</div>`;
    const xy = projectLabel(part.object);
    if (xy) {
      labelEl.style.left = `${Math.max(8, xy.x + 10)}px`;
      labelEl.style.top = `${Math.max(8, xy.y - 18)}px`;
      labelEl.style.display = 'block';
    }
    opts.onSelect({
      partId: part.partId,
      labelZh: part.labelZh,
      group: part.group,
      x: xy?.x ?? 12,
      y: xy?.y ?? 12,
    });
  };

  const onPointerDown = (ev: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (
      ev.clientX < rect.left ||
      ev.clientX > rect.right ||
      ev.clientY < rect.top ||
      ev.clientY > rect.bottom
    ) {
      return;
    }
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    if (!hits.length) {
      emitSelect(null);
      return;
    }
    const info = findPartId(hits[0].object, byName);
    const part =
      (info && parts.find((p) => p.partId === info.partId)) ||
      parts.find((p) => hits[0].object === p.object || isChildOf(hits[0].object, p.object)) ||
      null;
    emitSelect(part);
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (spin) {
      const omega = 7.5 * dt;
      for (const n of rotorNodes) n.rotateOnAxis(spinAxis, omega);
    }
    const target = explode ? 1 : 0;
    explodeT += (target - explodeT) * Math.min(1, dt * 6);
    if (Math.abs(target - explodeT) < 0.002) explodeT = target;
    for (const p of parts) {
      p.object.position.lerpVectors(p.restLocal, p.restLocal.clone().add(p.explodeLocal), explodeT);
    }
    controls.update();
    if (selected && labelEl) {
      const xy = projectLabel(selected.object);
      if (xy) {
        labelEl.style.left = `${Math.max(8, xy.x + 10)}px`;
        labelEl.style.top = `${Math.max(8, xy.y - 18)}px`;
        labelEl.style.display = 'block';
      } else {
        labelEl.style.display = 'none';
      }
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  opts.onStatus(null);

  return {
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelEl.remove();
    },
    setSpin: (on) => {
      spin = on;
    },
    setExplode: (on) => {
      explode = on;
    },
    setCutaway: (on) => {
      applyCutaway(on);
    },
    resetView: () => {
      spin = false;
      explode = false;
      explodeT = 0;
      applyCutaway(false);
      emitSelect(null);
      for (const p of parts) p.object.position.copy(p.restLocal);
      for (const n of rotorNodes) n.rotation.set(0, 0, 0);
      camera.position.copy(homePos);
      controls.target.copy(homeTarget);
      controls.update();
    },
    resize,
  };
}

function walkToNamed(obj: THREE.Object3D, partId: string): THREE.Object3D {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.name === partId || (cur.userData as { partId?: string }).partId === partId) return cur;
    cur = cur.parent;
  }
  return obj;
}

function isChildOf(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur === root) return true;
    cur = cur.parent;
  }
  return false;
}
