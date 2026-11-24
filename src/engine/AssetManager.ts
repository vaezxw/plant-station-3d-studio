import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CatalogKind } from '../domain/catalog';
import { getCatalogItem } from '../domain/catalog';
import {
  buildCatalogMesh,
  cloneGlbTemplate,
  hasGlbTemplate,
  preloadCatalogGlbs,
  subscribeGlbCatalog,
} from '../scene/catalog';
import type { CatalogKind as LegacyCatalogKind } from '../scene/catalog/types';
import { buildHengGuangSkidGroup } from '../scene/hengGuangSkid';
import { preloadTurbojetMapping } from '../scene/turbojet/createTurbojetViewer';
import { enhanceIndustrialMaterials } from './MaterialLibrary';

const STUDIO_MANIFEST_URL = '/assets/studio/manifest.json';
const studioGlbTemplates = new Map<string, THREE.Object3D>();
const customGlbTemplates = new Map<string, THREE.Object3D>();
const assetListeners = new Set<() => void>();
let studioPreloadStarted = false;

export function subscribeAssets(fn: () => void): () => void {
  const unsubLegacy = subscribeGlbCatalog(fn);
  assetListeners.add(fn);
  return () => {
    unsubLegacy();
    assetListeners.delete(fn);
  };
}

export function getAssetSourceKey(kind: CatalogKind | 'CUSTOM_GLB', customGlbId?: string): string {
  if (kind === 'CUSTOM_GLB') {
    return customGlbId && customGlbTemplates.has(customGlbId) ? `custom:${customGlbId}` : 'fallback';
  }
  if (studioGlbTemplates.has(kind)) return 'studio';
  if (LEGACY_KINDS.has(kind) && hasGlbTemplate(kind as LegacyCatalogKind)) return 'legacy';
  return 'fallback';
}

let notifyTimer: number | null = null;
function notifyAssetListeners() {
  if (notifyTimer !== null) return;
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null;
    for (const fn of assetListeners) fn();
  }, 16);
}

async function preloadStudioGlbs(): Promise<void> {
  if (studioPreloadStarted) return;
  studioPreloadStarted = true;
  try {
    const res = await fetch(STUDIO_MANIFEST_URL);
    if (!res.ok) return;
    const manifest = (await res.json()) as {
      base?: string;
      files?: Record<string, string>;
    };
    const base = (manifest.base ?? '/assets/studio').replace(/\/$/, '');
    const entries = Object.entries(manifest.files ?? {});
    const loader = new GLTFLoader();
    await Promise.all(
      entries.map(async ([kind, file]) => {
        try {
          const gltf = await loader.loadAsync(`${base}/${file}`);
          const scene = gltf.scene ?? gltf.scenes[0];
          if (!scene) return;
          scene.userData.fromGlb = true;
          studioGlbTemplates.set(kind, scene);
          notifyAssetListeners();
        } catch {
          // ignore individual missing glb
        }
      }),
    );
  } catch {
    // ignore manifest errors
  }
}

export function preloadAllAssets(): void {
  void preloadStudioGlbs();
  void preloadCatalogGlbs();
  void preloadTurbojetMapping().then(() => notifyAssetListeners());
}

function cloneWithFreshMaterials(tpl: THREE.Object3D): THREE.Group {
  const clone = tpl.clone(true);
  clone.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      const ms = Array.isArray(c.material) ? c.material : [c.material];
      c.material = Array.isArray(c.material) ? ms.map((m) => m.clone()) : ms[0].clone();
    }
  });
  const root = new THREE.Group();
  root.userData.fromGlb = true;
  root.add(clone);
  enhanceIndustrialMaterials(root);
  return root;
}

function normalizeCustomModel(root: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
  if (maxDim > 4 || maxDim < 0.3) {
    root.scale.multiplyScalar(1.4 / maxDim);
  }
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  root.userData.fromGlb = true;
  return root;
}

export async function importCustomGlbFile(
  file: File,
): Promise<{ customGlbId: string; name: string }> {
  const buffer = await file.arrayBuffer();
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, '');
  const root = gltf.scene ?? gltf.scenes[0];
  if (!root) {
    throw new Error('GLB 文件中未包含有效三维场景');
  }
  const normalized = normalizeCustomModel(root);
  const customGlbId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  customGlbTemplates.set(customGlbId, normalized);
  notifyAssetListeners();
  const cleanName = file.name.replace(/\.(glb|gltf)$/i, '');
  return { customGlbId, name: cleanName || '自定义模型' };
}

const LEGACY_KINDS = new Set<string>([
  'UF', 'FS', 'HOV', 'MOV', 'SSV', 'PCV', 'PV',
  'PIPE', 'PIPE_ELBOW', 'FLANGE', 'INSTR', 'TANK',
  'ELEC_CB', 'ELEC_M', 'ELEC_GND', 'TEXT',
  'LINE_SOLID', 'LINE_DASHED',
  'PCS', 'TRANSFORMER', 'BESS', 'LOAD', 'DIST_ROOM',
  'TURBOJET', 'HENG_GUANG_SKID',
]);

function makeFloorPadFallback(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.14, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85, metalness: 0.1 }),
  );
  m.position.y = 0.07;
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 0.04, 1.84),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, metalness: 0.25 }),
  );
  rim.position.y = 0.025;
  g.add(m, rim);
  return g;
}

function makePlatformFallback(): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.08, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.72, roughness: 0.4 }),
  );
  deck.position.y = 0.62;
  g.add(deck);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.35, roughness: 0.42 });
  for (const sx of [-0.95, 0, 0.95]) {
    for (const sz of [-0.55, 0.55]) {
      if (sz === 0.55 && sx === 0) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 10), postMat);
      post.position.set(sx, 1.1, sz);
      g.add(post);
    }
    for (const sz of [-0.54, 0.54]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.62, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.45 }),
      );
      leg.position.set(sx, 0.31, sz);
      g.add(leg);
    }
  }
  for (const sy of [1.15, 1.56]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.94, 10), postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, sy, -0.55);
    g.add(bar);
  }
  return g;
}

export function instantiateAssetObject(
  kind: CatalogKind | 'CUSTOM_GLB',
  opts: {
    nodeId: string;
    tag: string;
    labelText?: string;
    customGlbId?: string;
    colorHex?: string;
  },
): THREE.Object3D {
  const item = getCatalogItem(kind);
  const accentHex = opts.colorHex
    ? Number.parseInt(opts.colorHex.replace('#', ''), 16)
    : Number.parseInt((item?.defaultColor ?? '#38bdf8').replace('#', ''), 16);

  let obj: THREE.Object3D | null = null;

  if (kind === 'CUSTOM_GLB' && opts.customGlbId) {
    const tpl = customGlbTemplates.get(opts.customGlbId);
    if (tpl) obj = cloneWithFreshMaterials(tpl);
  } else if (studioGlbTemplates.has(kind)) {
    // 优先使用新生成的 Studio 高精度 GLB
    obj = cloneWithFreshMaterials(studioGlbTemplates.get(kind)!);
  } else if (kind === 'HENG_GUANG_SKID' && !hasGlbTemplate('HENG_GUANG_SKID')) {
    obj = buildHengGuangSkidGroup({ tag: opts.tag, includeFlow: true });
  } else if (LEGACY_KINDS.has(kind)) {
    const legacyKind = kind as LegacyCatalogKind;
    const glb = cloneGlbTemplate(legacyKind, { fit: false });
    obj =
      glb ??
      buildCatalogMesh(legacyKind, {
        tag: opts.tag,
        color: accentHex,
        labelText: opts.labelText ?? opts.tag,
      });
  } else if (kind === 'BASE_PAD') {
    obj = makeFloorPadFallback();
  } else if (kind === 'PLATFORM_RAIL') {
    obj = makePlatformFallback();
  }

  if (!obj) {
    obj = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: accentHex, metalness: 0.4, roughness: 0.4 }),
    );
  }

  obj.name = opts.nodeId;
  obj.userData.nodeId = opts.nodeId;
  obj.userData.tag = opts.tag;
  obj.userData.catalogKind = kind;
  obj.userData.pickable = true;

  obj.traverse((child) => {
    child.userData.nodeId = opts.nodeId;
    child.userData.tag = opts.tag;
    child.userData.pickable = true;
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (
        opts.colorHex &&
        (child.material instanceof THREE.MeshStandardMaterial) &&
        (child.material.name.startsWith('mat:paint') || !obj?.userData.fromGlb)
      ) {
        child.material = child.material.clone();
        child.material.color.set(opts.colorHex);
      }
    }
  });

  return obj;
}

export type ResolvedPort = {
  id: string;
  localPos: THREE.Vector3;
  localNormal: THREE.Vector3;
};

/** 从模型中提取标准管口锚点（Port_*）；无内置管口时按包围盒自动推导左右管口 */
export function extractObjectPorts(obj: THREE.Object3D): ResolvedPort[] {
  const ports: ResolvedPort[] = [];
  obj.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(obj.matrixWorld).invert();

  obj.traverse((child) => {
    if (!child.name.startsWith('Port_')) return;
    const portId = String(child.userData.portId ?? child.name.slice(5));
    const nArr = child.userData.normal as [number, number, number] | undefined;
    const worldPos = new THREE.Vector3();
    child.getWorldPosition(worldPos);
    const localPos = worldPos.applyMatrix4(invRoot);
    const localNormal = nArr ? new THREE.Vector3(...nArr).normalize() : new THREE.Vector3(1, 0, 0);
    ports.push({ id: portId, localPos, localNormal });
  });

  if (ports.length > 0) return ports;

  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return ports;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const localCenter = center.applyMatrix4(invRoot);
  const halfX = Math.max(0.25, size.x * 0.5);
  return [
    {
      id: 'in',
      localPos: new THREE.Vector3(localCenter.x - halfX, localCenter.y, localCenter.z),
      localNormal: new THREE.Vector3(-1, 0, 0),
    },
    {
      id: 'out',
      localPos: new THREE.Vector3(localCenter.x + halfX, localCenter.y, localCenter.z),
      localNormal: new THREE.Vector3(1, 0, 0),
    },
  ];
}

function hasGlbAncestor(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData?.fromGlb) return true;
    cur = cur.parent;
  }
  return false;
}

export function disposeAssetObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      if (!hasGlbAncestor(obj)) {
        obj.geometry.dispose();
      }
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}
