import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DEVICE_CATALOG, INDUSTRIAL_GLB_KINDS, type CatalogKind } from './types';

const PLANT_BASE = '/assets/plant';
const CATALOG_BASE = '/assets/catalog';
const PLANT_MANIFEST_URL = `${PLANT_BASE}/catalog-glb.json`;
const CATALOG_MANIFEST_URL = `${CATALOG_BASE}/catalog-glb.json`;

/** 不在 plant/ 约定路径下的 kind → 绝对 URL */
const EXTRA_GLB_URLS: Partial<Record<CatalogKind, string>> = {
  TURBOJET: '/assets/turbojet/turbojet.glb',
};

/** 涡喷 + 工业目录保持 1 m 世界比例，不做 fit-to-0.9 */
const SKIP_FIT = new Set<CatalogKind>(['TURBOJET', ...INDUSTRIAL_GLB_KINDS]);

/** kind → 已归一化的模板根（可 clone） */
const templates = new Map<CatalogKind, THREE.Object3D>();
/** kind → 加载中 Promise */
const inflight = new Map<CatalogKind, Promise<THREE.Object3D | null>>();
const listeners = new Set<() => void>();

let probed = false;

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeGlbCatalog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasGlbTemplate(kind: CatalogKind): boolean {
  return templates.has(kind);
}

export function listLoadedGlbKinds(): CatalogKind[] {
  return [...templates.keys()];
}

/** 克隆已加载的 GLB；无则 null（调用方回退 primitive） */
export function cloneGlbTemplate(
  kind: CatalogKind,
  opts?: { fit?: boolean },
): THREE.Group | null {
  const tpl = templates.get(kind);
  if (!tpl) return null;
  const clone = tpl.clone(true);
  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = Array.isArray(mesh.material)
      ? mats.map((m) => m.clone())
      : mats[0].clone();
  });
  const root = new THREE.Group();
  root.name = `glb:${kind}`;
  root.userData.fromGlb = true;
  root.userData.catalogKind = kind;
  root.add(clone);
  // 保证有 body-core 供选中框锚定
  if (!root.getObjectByName('body-core')) {
    clone.name = 'body-core';
  }
  if (opts?.fit === true && !SKIP_FIT.has(kind)) {
    normalizeTemplate(root, kind);
  }
  return root;
}

function normalizeTemplate(root: THREE.Object3D, kind: CatalogKind): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const target = 0.9;
  root.scale.multiplyScalar(target / maxDim);
  // 落在 y=0 附近
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  root.userData.catalogKind = kind;
  root.userData.fromGlb = true;
  return root;
}

async function loadGlbUrl(url: string, kind: CatalogKind): Promise<THREE.Object3D | null> {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(url);
    const scene = gltf.scene ?? gltf.scenes[0];
    if (!scene) return null;
    if (SKIP_FIT.has(kind)) {
      scene.userData.catalogKind = kind;
      scene.userData.fromGlb = true;
      return scene;
    }
    return normalizeTemplate(scene, kind);
  } catch (err) {
    console.warn(`[glb] 加载失败 ${kind} ← ${url}`, err);
    return null;
  }
}

async function ensureKind(kind: CatalogKind, url: string): Promise<THREE.Object3D | null> {
  if (templates.has(kind)) return templates.get(kind)!;
  const existing = inflight.get(kind);
  if (existing) return existing;

  const job = (async () => {
    const root = await loadGlbUrl(url, kind);
    if (root) {
      templates.set(kind, root);
      notify();
    }
    return root;
  })().finally(() => inflight.delete(kind));

  inflight.set(kind, job);
  return job;
}

type GlbManifest = Partial<Record<CatalogKind, string>> & { base?: string };

async function loadManifest(url: string): Promise<GlbManifest | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as GlbManifest;
  } catch {
    return null;
  }
}

function enqueueManifest(
  manifest: GlbManifest | null,
  fallbackBase: string,
  kindSet: Set<CatalogKind>,
  tasks: Promise<unknown>[],
) {
  if (!manifest) return;
  const base = (manifest.base ?? fallbackBase).replace(/\/$/, '');
  for (const [key, file] of Object.entries(manifest)) {
    if (key === 'base' || key === 'spec' || key === 'unit' || key === 'note' || key === 'yup') continue;
    if (key === 'dn' || key === 'pn') continue;
    if (!file || typeof file !== 'string') continue;
    if (!kindSet.has(key as CatalogKind)) continue;
    const url = file.startsWith('/') || file.startsWith('http') ? file : `${base}/${file}`;
    tasks.push(ensureKind(key as CatalogKind, url));
  }
}

/**
 * 探测：
 * 1) `public/assets/catalog/catalog-glb.json` — 工艺 / 管件 / 电气 / 铭牌（1 m，不 fit）
 * 2) `public/assets/plant/catalog-glb.json` — 能源站柜体（仍 fit-to-0.9）
 * 3) 涡喷 EXTRA_GLB_URLS
 * 无文件静默跳过（继续用 primitive）。不替换 plant/ 与 turbojet 二进制。
 */
export async function preloadCatalogGlbs(): Promise<CatalogKind[]> {
  if (probed && templates.size > 0) return listLoadedGlbKinds();
  probed = true;

  const kindSet = new Set(DEVICE_CATALOG.map((e) => e.kind));
  const extraTasks: Promise<unknown>[] = [];
  for (const [kind, url] of Object.entries(EXTRA_GLB_URLS)) {
    if (!url) continue;
    extraTasks.push(ensureKind(kind as CatalogKind, url));
  }

  const [catalogManifest, plantManifest] = await Promise.all([
    loadManifest(CATALOG_MANIFEST_URL),
    loadManifest(PLANT_MANIFEST_URL),
  ]);

  const tasks: Promise<unknown>[] = [...extraTasks];
  enqueueManifest(catalogManifest, CATALOG_BASE, kindSet, tasks);
  enqueueManifest(plantManifest, PLANT_BASE, kindSet, tasks);

  await Promise.all(tasks);
  return listLoadedGlbKinds();
}

/** 允许运行时手动登记（测试 / 热替换） */
export async function registerGlbForKind(kind: CatalogKind, url: string): Promise<boolean> {
  const root = await ensureKind(kind, url);
  return Boolean(root);
}
