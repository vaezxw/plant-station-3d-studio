import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CatalogKind } from '../domain/catalog';
import { getCatalogItem } from '../domain/catalog';
import type { GroundStyle, Vec3 } from '../domain/schema';
import { enhanceIndustrialMaterials } from './MaterialLibrary';
import { preloadTurbojetMapping } from './turbojet/createTurbojetViewer';
import { TURBOJET_GLB_URL } from './turbojet/types';

const STUDIO_MANIFEST_URL = '/assets/studio/manifest.json';
const studioGlbTemplates = new Map<string, THREE.Object3D>();
const customGlbTemplates = new Map<string, THREE.Object3D>();
let turbojetTemplate: THREE.Object3D | null = null;
const assetListeners = new Set<() => void>();
let studioPreloadStarted = false;

export function subscribeAssets(fn: () => void): () => void {
  assetListeners.add(fn);
  return () => {
    assetListeners.delete(fn);
  };
}

export function getAssetSourceKey(kind: CatalogKind | 'CUSTOM_GLB', customGlbId?: string): string {
  if (kind === 'CUSTOM_GLB') {
    return customGlbId && customGlbTemplates.has(customGlbId) ? `custom:${customGlbId}` : 'fallback';
  }
  if (kind === 'TEXT') return 'studio-text';
  if (kind === 'TURBOJET') return turbojetTemplate ? 'turbojet' : 'fallback';
  if (studioGlbTemplates.has(kind)) return 'studio';
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

async function preloadTurbojetGlb(): Promise<void> {
  if (turbojetTemplate) return;
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(TURBOJET_GLB_URL);
    const scene = gltf.scene ?? gltf.scenes[0];
    if (!scene) return;
    scene.userData.fromGlb = true;
    turbojetTemplate = scene;
    notifyAssetListeners();
  } catch {
    // ignore missing turbojet glb
  }
}

export function preloadAllAssets(): void {
  void preloadStudioGlbs();
  void preloadTurbojetGlb();
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

function makeTurbojetFallback(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 1.15, 22),
    new THREE.MeshStandardMaterial({ name: 'mat:stainless', color: 0x94a3b8, metalness: 0.85, roughness: 0.28 }),
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  return g;
}

function makeFloorPadFallback(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.12, 1.8),
    new THREE.MeshStandardMaterial({ name: 'mat:concretePlinth', color: 0x707884, roughness: 0.86, metalness: 0.06 }),
  );
  base.position.y = 0.06;
  const bevelTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.32, 0.04, 1.72),
    new THREE.MeshStandardMaterial({ name: 'mat:concretePlinth', color: 0x7b8390, roughness: 0.84, metalness: 0.06 }),
  );
  bevelTop.position.y = 0.14;
  const plateMat = new THREE.MeshStandardMaterial({ name: 'mat:stainless', color: 0xc2ccd6, metalness: 0.88, roughness: 0.28 });
  for (const sx of [-0.95, 0.95]) {
    for (const sz of [-0.68, 0.68]) {
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.016, 0.18), plateMat);
      anchor.position.set(sx, 0.168, sz);
      g.add(anchor);
    }
  }
  g.add(base, bevelTop);
  return g;
}

function makeFloorSlabFallback(): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 0.016, 4.0),
    new THREE.MeshStandardMaterial({ name: 'mat:floorSlab', color: 0x2a333f, roughness: 0.52, metalness: 0.12 }),
  );
  slab.position.y = -0.008;
  const trimMat = new THREE.MeshStandardMaterial({ name: 'mat:darkSteel', color: 0x1e2530, metalness: 0.72, roughness: 0.42 });
  for (const sz of [-2.015, 2.015]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.06, 0.022, 0.03), trimMat);
    bar.position.set(0, -0.007, sz);
    g.add(bar);
  }
  for (const sx of [-2.015, 2.015]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 4.06), trimMat);
    bar.position.set(sx, -0.007, 0);
    g.add(bar);
  }
  g.add(slab);
  return g;
}

function makePlatformFallback(): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.08, 1.2),
    new THREE.MeshStandardMaterial({ name: 'mat:diamondPlate', color: 0x334155, metalness: 0.74, roughness: 0.38 }),
  );
  deck.position.y = 0.62;
  g.add(deck);
  const railMat = new THREE.MeshStandardMaterial({ name: 'mat:stainless', color: 0xc4cdd6, metalness: 0.88, roughness: 0.25 });
  const legMat = new THREE.MeshStandardMaterial({ name: 'mat:darkSteel', color: 0x222934, metalness: 0.72, roughness: 0.42 });
  for (const sx of [-0.95, 0, 0.95]) {
    for (const sz of [-0.55, 0.55]) {
      if (sz === 0.55 && sx === 0) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 10), railMat);
      post.position.set(sx, 1.1, sz);
      g.add(post);
    }
    for (const sz of [-0.54, 0.54]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), legMat);
      leg.position.set(sx, 0.31, sz);
      g.add(leg);
    }
  }
  for (const sy of [1.15, 1.56]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.94, 10), railMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, sy, -0.55);
    g.add(bar);
  }
  return g;
}

function buildIndustrialTextSign(opts: {
  tag: string;
  labelText?: string;
  section?: string;
  accentHex: number;
}): THREE.Group {
  const g = new THREE.Group();
  const titleText = (opts.labelText?.trim() || opts.tag || '工艺工段标识').slice(0, 24);
  const subText = opts.section?.trim() ? `${opts.tag} · ${opts.section.trim()}` : `${opts.tag} · PROCESS ZONE`;
  const accentCss = `#${opts.accentHex.toString(16).padStart(6, '0')}`;

  // 高清 1024x512 牌面纹理（确保中英文清晰饱满不裁切）
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // 深海军工业金属面板底色
    ctx.fillStyle = '#0c1626';
    ctx.fillRect(0, 0, 1024, 512);

    // 顶部工业钴蓝（或自定义色）标题装饰条
    ctx.fillStyle = accentCss;
    ctx.fillRect(18, 18, 988, 92);

    // 不锈钢外框双线
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 1004, 492);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 126, 964, 356);

    // 顶部小标（位号与工段）
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 42px "JetBrains Mono", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subText.slice(0, 28), 512, 66);

    // 中央自适应主文字（自动按字符宽度微调字号，保证完整显示）
    const charLen = [...titleText].reduce((acc, ch) => acc + (/[\u4e00-\u9fa5]/.test(ch) ? 1.8 : 1.0), 0);
    const fontSize = charLen > 18 ? 72 : charLen > 12 ? 92 : 112;
    ctx.fillStyle = '#f1f5f9';
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillText(titleText, 512, 295, 920);

    // 底部辅助工段标尺文字
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px "JetBrains Mono", sans-serif';
    ctx.fillText('PLANT STATION SCADA · PROCESS SIGN', 512, 434);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // 底部倒角混凝土基座（底面稳稳贴合 y=0）
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.09, 0.36),
    new THREE.MeshStandardMaterial({ name: 'mat:concretePlinth', color: 0x8b95a2, roughness: 0.84, metalness: 0.06 }),
  );
  plinth.position.y = 0.045;
  g.add(plinth);

  const postMat = new THREE.MeshStandardMaterial({ name: 'mat:stainless', color: 0xd4dde6, metalness: 0.88, roughness: 0.24 });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'mat:castIron', color: 0x262d38, metalness: 0.76, roughness: 0.44 });
  const accentMat = new THREE.MeshStandardMaterial({ name: 'mat:paint', color: opts.accentHex, metalness: 0.4, roughness: 0.3 });

  // 双不锈钢立柱 + 地脚压板 + 柱顶球冠
  for (const px of [-0.52, 0.52]) {
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.14), postMat);
    basePlate.position.set(px, 0.099, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.34, 14), postMat);
    post.position.set(px, 0.09 + 0.67, 0);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), postMat);
    cap.position.set(px, 1.44, 0);
    g.add(basePlate, post, cap);
  }

  // 主标牌防雨金属背板箱（宽 1.24m × 高 0.62m，离地中心 y = 1.04m）
  const boardW = 1.24;
  const boardH = 0.62;
  const boardY = 1.04;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(boardW, boardH, 0.048), frameMat);
  backing.position.y = boardY;
  const topHood = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.06, 0.036, 0.095), accentMat);
  topHood.position.set(0, boardY + boardH * 0.5 + 0.018, 0);
  g.add(backing, topHood);

  // 前后双面独立高清文字显示面（避免 BoxGeometry 侧边拉伸与共面闪烁）
  const faceGeo = new THREE.PlaneGeometry(boardW - 0.04, boardH - 0.04);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.34,
    metalness: 0.12,
  });
  faceMat.userData.disposeMap = true;

  const frontFace = new THREE.Mesh(faceGeo, faceMat);
  frontFace.position.set(0, boardY, 0.026);
  const backFace = new THREE.Mesh(faceGeo, faceMat);
  backFace.rotation.y = Math.PI;
  backFace.position.set(0, boardY, -0.026);
  g.add(frontFace, backFace);

  return g;
}

export function instantiateAssetObject(
  kind: CatalogKind | 'CUSTOM_GLB',
  opts: {
    nodeId: string;
    tag: string;
    labelText?: string;
    section?: string;
    customGlbId?: string;
    colorHex?: string;
    floorStyle?: GroundStyle;
    scale?: Vec3;
  },
): THREE.Object3D {
  const item = getCatalogItem(kind);
  const accentHex = opts.colorHex
    ? Number.parseInt(opts.colorHex.replace('#', ''), 16)
    : Number.parseInt((item?.defaultColor ?? '#1555b0').replace('#', ''), 16);

  let obj: THREE.Object3D | null = null;

  if (kind === 'CUSTOM_GLB' && opts.customGlbId) {
    const tpl = customGlbTemplates.get(opts.customGlbId);
    if (tpl) obj = cloneWithFreshMaterials(tpl);
  } else if (kind === 'TEXT') {
    obj = buildIndustrialTextSign({
      tag: opts.tag,
      labelText: opts.labelText,
      section: opts.section,
      accentHex,
    });
  } else if (kind === 'TURBOJET') {
    obj = turbojetTemplate ? cloneWithFreshMaterials(turbojetTemplate) : makeTurbojetFallback();
  } else if (studioGlbTemplates.has(kind)) {
    // 使用 Studio 高精度重工业 GLB
    obj = cloneWithFreshMaterials(studioGlbTemplates.get(kind)!);
  } else if (kind === 'FLOOR_SLAB') {
    obj = makeFloorSlabFallback();
  } else if (kind === 'BASE_PAD') {
    obj = makeFloorPadFallback();
  } else if (kind === 'PLATFORM_RAIL') {
    obj = makePlatformFallback();
  }

  if (obj && (kind === 'FLOOR_SLAB' || kind === 'BASE_PAD' || kind === 'TEXT')) {
    const sx = Math.max(1, Math.round((opts.scale?.[0] ?? 1) * 2));
    const sz = Math.max(1, Math.round((opts.scale?.[2] ?? 1) * 2));
    enhanceIndustrialMaterials(obj, {
      floorStyle: opts.floorStyle ?? 'weathered-concrete',
      floorRepeat: [sx, sz],
    });
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
        child.material instanceof THREE.MeshStandardMaterial &&
        (child.material.name.startsWith('mat:paint') ||
          child.material.name === 'mat:industrialBlue' ||
          (!obj?.userData.fromGlb && kind !== 'TEXT' && kind !== 'FLOOR_SLAB' && kind !== 'BASE_PAD'))
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
      if (Array.isArray(m)) {
        m.forEach((x) => {
          if (x instanceof THREE.MeshStandardMaterial && x.userData?.disposeMap && x.map) {
            x.map.dispose();
          }
          x.dispose();
        });
      } else {
        if (m instanceof THREE.MeshStandardMaterial && m.userData?.disposeMap && m.map) {
          m.map.dispose();
        }
        m.dispose();
      }
    }
  });
}
