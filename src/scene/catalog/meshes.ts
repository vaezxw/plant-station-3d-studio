import * as THREE from 'three';
import type { NodeKind } from '../../data/topology';
import {
  attachTurbojetRig,
  getTurbojetMapping,
} from '../turbojet/createTurbojetViewer';
import { buildAnnotationLine } from './annotationLines';
import { cloneGlbTemplate } from './glbCatalog';
import type { CatalogKind } from './types';

const METAL = { metalness: 0.35, roughness: 0.42 } as const;

function std(color: number, extras?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.MeshStandardMaterial({ color, ...METAL, ...extras });
}

function markPickable(obj: THREE.Object3D, tag: string | null, pickable: boolean) {
  obj.userData.tag = tag;
  obj.userData.pickable = pickable;
  if (tag && pickable) {
    obj.traverse((c) => {
      if (c !== obj) {
        c.userData.tag = tag;
        c.userData.pickable = true;
      }
    });
  }
}

/** 管端法兰盘（目录 PIPE 预设的一部分） */
export function buildFlangeDisk(
  radius = 0.14,
  thickness = 0.04,
  color = 0x94a3b8,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, thickness, 16),
    std(color, { metalness: 0.45, roughness: 0.35 }),
  );
  mesh.rotation.z = Math.PI / 2;
  mesh.name = 'flange';
  mesh.userData.pickable = false;
  mesh.userData.catalogKind = 'PIPE';
  return mesh;
}

function buildUF(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 20), std(color));
  body.rotation.z = Math.PI / 2;
  body.name = 'body-core';
  g.add(body);
  const f1 = buildFlangeDisk(0.28, 0.05, 0xcbd5e1);
  f1.position.x = -0.45;
  const f2 = buildFlangeDisk(0.28, 0.05, 0xcbd5e1);
  f2.position.x = 0.45;
  g.add(f1, f2);
  const bossMat = std(0x0ea5e9, { metalness: 0.2, roughness: 0.5 });
  for (const z of [-0.16, 0.16]) {
    const boss = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), bossMat);
    boss.position.set(0, 0.22, z);
    g.add(boss);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), std(0x1e293b));
  cap.position.y = 0.28;
  g.add(cap);
  return g;
}

function buildFS(color: number): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.7, 18), std(color));
  shell.position.y = 0.15;
  shell.name = 'body-core';
  g.add(shell);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.22, 16), std(0x94a3b8));
  cone.position.y = 0.61;
  g.add(cone);
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), std(0x64748b));
  drain.position.y = -0.28;
  g.add(drain);
  const inlet = buildFlangeDisk(0.12, 0.035, 0xcbd5e1);
  inlet.position.set(-0.28, 0.05, 0);
  const outlet = buildFlangeDisk(0.12, 0.035, 0xcbd5e1);
  outlet.position.set(0.28, 0.05, 0);
  g.add(inlet, outlet);
  return g;
}

function buildHOV(color: number): THREE.Group {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 14), std(0x94a3b8));
  barrel.rotation.z = Math.PI / 2;
  g.add(barrel);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), std(color));
  ball.name = 'body-core';
  g.add(ball);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), std(0xcbd5e1));
  stem.position.y = 0.22;
  g.add(stem);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.06), std(0xf87171));
  handle.position.y = 0.34;
  g.add(handle);
  const left = buildFlangeDisk(0.13, 0.03);
  left.position.x = -0.22;
  const right = buildFlangeDisk(0.13, 0.03);
  right.position.x = 0.22;
  g.add(left, right);
  return g;
}

function buildMOV(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), std(color));
  body.name = 'body-core';
  g.add(body);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 12), std(0x94a3b8));
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const actuator = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.22), std(0x1e293b));
  actuator.position.y = 0.28;
  g.add(actuator);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 8),
    std(0x4ade80, { emissive: 0x166534, emissiveIntensity: 0.4 }),
  );
  lamp.position.set(0.1, 0.4, 0.08);
  g.add(lamp);
  const left = buildFlangeDisk(0.12, 0.03);
  left.position.x = -0.22;
  const right = buildFlangeDisk(0.12, 0.03);
  right.position.x = 0.22;
  g.add(left, right);
  return g;
}

function buildSSV(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 14), std(color));
  body.name = 'body-core';
  g.add(body);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 12), std(0x94a3b8));
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 12), std(0xcbd5e1));
  column.position.y = 0.36;
  g.add(column);
  const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 14), std(0xf97316));
  spring.position.y = 0.62;
  g.add(spring);
  const left = buildFlangeDisk(0.12, 0.03);
  left.position.x = -0.2;
  const right = buildFlangeDisk(0.12, 0.03);
  right.position.x = 0.2;
  g.add(left, right);
  return g;
}

function buildPCV(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), std(color));
  body.name = 'body-core';
  g.add(body);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.38, 12), std(0x94a3b8));
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    std(0x38bdf8),
  );
  dome.position.y = 0.22;
  g.add(dome);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), std(0xcbd5e1));
  neck.position.y = 0.16;
  g.add(neck);
  const left = buildFlangeDisk(0.12, 0.03);
  left.position.x = -0.2;
  const right = buildFlangeDisk(0.12, 0.03);
  right.position.x = 0.2;
  g.add(left, right);
  return g;
}

function buildPV(color: number): THREE.Group {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), std(color));
  ball.name = 'body-core';
  g.add(ball);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 12), std(0x94a3b8));
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 10), std(0xef4444));
  stack.position.y = 0.28;
  g.add(stack);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 10), std(0xfca5a5));
  tip.position.y = 0.5;
  g.add(tip);
  const left = buildFlangeDisk(0.11, 0.03);
  left.position.x = -0.18;
  const right = buildFlangeDisk(0.11, 0.03);
  right.position.x = 0.18;
  g.add(left, right);
  return g;
}

function buildPipePreset(color: number): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 14), std(color));
  tube.rotation.z = Math.PI / 2;
  tube.name = 'body-core';
  g.add(tube);
  const left = buildFlangeDisk(0.14, 0.04);
  left.position.x = -0.45;
  const right = buildFlangeDisk(0.14, 0.04);
  right.position.x = 0.45;
  g.add(left, right);
  return g;
}

function buildElbow(color: number): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.35, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0.35),
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 12, 0.08, 10, false),
    std(color),
  );
  tube.name = 'body-core';
  g.add(tube);
  g.add(buildFlangeDisk(0.12, 0.03));
  const f2 = buildFlangeDisk(0.12, 0.03);
  f2.position.set(0, 0, 0.35);
  f2.rotation.y = Math.PI / 2;
  g.add(f2);
  return g;
}

function buildFlangeOnly(color: number): THREE.Group {
  const g = new THREE.Group();
  const a = buildFlangeDisk(0.18, 0.05, color);
  a.position.x = -0.04;
  a.name = 'body-core';
  const b = buildFlangeDisk(0.18, 0.05, 0xcbd5e1);
  b.position.x = 0.04;
  g.add(a, b);
  return g;
}

function buildInstr(color: number): THREE.Group {
  const g = new THREE.Group();
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), std(color));
  dial.rotation.x = Math.PI / 2;
  dial.name = 'body-core';
  g.add(dial);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10), std(0x94a3b8));
  stem.position.y = -0.18;
  g.add(stem);
  return g;
}

function buildTank(color: number): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 18), std(color));
  shell.name = 'body-core';
  shell.position.y = 0.1;
  g.add(shell);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xcbd5e1));
  cap.position.y = 0.45;
  g.add(cap);
  return g;
}

function buildElecCb(color: number): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.12), std(color));
  box.name = 'body-core';
  g.add(box);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), std(0xf87171));
  lever.position.set(0.08, 0.18, 0.08);
  g.add(lever);
  return g;
}

function buildElecM(color: number): THREE.Group {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24), std(color));
  disk.rotation.x = Math.PI / 2;
  disk.name = 'body-core';
  g.add(disk);
  return g;
}

function buildElecGnd(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = std(color);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), mat);
  post.position.y = 0.14;
  post.name = 'body-core';
  g.add(post);
  for (let i = 0; i < 3; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28 - i * 0.07, 0.03, 0.03), mat);
    bar.position.y = -0.02 - i * 0.07;
    g.add(bar);
  }
  return g;
}

function buildTextPlate(color: number, text = 'PV-101'): THREE.Group {
  const g = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e8e0c4';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#2a2e32';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, 496, 240);
    ctx.fillStyle = '#14181c';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 12), 256, 110);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = '#3a4048';
    ctx.fillText('DN100 PN16', 256, 180);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.22, 0.10),
    new THREE.MeshStandardMaterial({ map: tex, metalness: 0.15, roughness: 0.5, side: THREE.DoubleSide }),
  );
  plate.name = 'body-core';
  g.add(plate);
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.23, 0.11),
    new THREE.MeshStandardMaterial({ color: 0x3f4650, metalness: 0.35, roughness: 0.45 }),
  );
  g.add(rim);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x3f4650, metalness: 0.4, roughness: 0.4 }),
  );
  stem.position.y = -0.09;
  g.add(stem);
  void color;
  return g;
}

function buildSolidLine(_color: number): THREE.Group {
  void _color;
  return buildAnnotationLine(false);
}

/** GLB 缺失时的能源站占位柜体（不替代已加载模型） */
function buildEnergyCabinet(color: number, w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color));
  body.position.y = h / 2;
  body.name = 'body-core';
  g.add(body);
  return g;
}

/** 缩略图用的橇装示意（完整 PFD 装配在 hengGuangSkid.ts，避免循环依赖） */
function buildSkidPlaceholder(color: number): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.42), std(0x334155));
  deck.position.y = -0.02;
  deck.name = 'body-core';
  g.add(deck);
  const pipeA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10), std(0xfbbf24));
  pipeA.rotation.z = Math.PI / 2;
  pipeA.position.set(0, 0.16, -0.1);
  const pipeB = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10), std(0xf59e0b));
  pipeB.rotation.z = Math.PI / 2;
  pipeB.position.set(0, 0.08, 0.1);
  g.add(pipeA, pipeB);
  for (const x of [-0.4, 0, 0.4]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.16), std(color));
    box.position.set(x, 0.2, -0.1);
    g.add(box);
  }
  return g;
}

function buildTurbojetFallback(color: number): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 16), std(color));
  core.rotation.z = Math.PI / 2;
  core.name = 'body-core';
  g.add(core);
  const intake = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 14), std(0xcbd5e1));
  intake.rotation.z = -Math.PI / 2;
  intake.position.x = -0.42;
  g.add(intake);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.22, 14), std(0x64748b));
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.x = 0.44;
  g.add(nozzle);
  return g;
}

function fitGroup(root: THREE.Object3D, target = 0.9) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.multiplyScalar(target / maxDim);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

function buildDashedLine(_color: number): THREE.Group {
  void _color;
  return buildAnnotationLine(true);
}

const DEFAULT_COLORS: Record<CatalogKind, number> = {
  UF: 0x38bdf8,
  FS: 0x94a3b8,
  HOV: 0xfbbf24,
  MOV: 0xf59e0b,
  SSV: 0xfb923c,
  PCV: 0x22d3ee,
  PV: 0xf87171,
  PIPE: 0xeab308,
  PIPE_ELBOW: 0xca8a04,
  FLANGE: 0xcbd5e1,
  INSTR: 0xa78bfa,
  TANK: 0x64748b,
  ELEC_CB: 0x475569,
  ELEC_M: 0x1e3a5f,
  ELEC_GND: 0x166534,
  TEXT: 0x38bdf8,
  LINE_SOLID: 0xe2e8f0,
  LINE_DASHED: 0x94a3b8,
  PCS: 0x38bdf8,
  TRANSFORMER: 0x4ade80,
  BESS: 0x334155,
  LOAD: 0xf97316,
  DIST_ROOM: 0x94a3b8,
  TURBOJET: 0xb45309,
  HENG_GUANG_SKID: 0x0ea5e9,
};

/**
 * 按目录 kind 生成网格：若 `public/assets/plant` 已加载对应 GLB 则用模型，否则 primitive。
 * 有 tag 时整组可点选（编排放置件均可选删）。拖拽编排逻辑不变。
 */
export function buildCatalogMesh(
  kind: CatalogKind,
  options?: { tag?: string | null; color?: number; labelText?: string },
): THREE.Group {
  const color = options?.color ?? DEFAULT_COLORS[kind] ?? 0x94a3b8;
  const tag = options?.tag ?? null;
  const pickable = Boolean(tag);

  const skipGlb = kind === 'LINE_SOLID' || kind === 'LINE_DASHED';
  const glb = skipGlb ? null : cloneGlbTemplate(kind);
  if (glb) {
    if (kind === 'TURBOJET') {
      fitGroup(glb, 0.95);
      if (tag) {
        const mapping = getTurbojetMapping();
        if (mapping) {
          glb.userData.turbojetRig = attachTurbojetRig(glb, mapping);
        }
      }
    }
    glb.name = tag ?? `catalog:${kind}`;
    glb.userData.catalogKind = kind;
    glb.userData.kind = kind;
    markPickable(glb, tag, pickable);
    const core = glb.getObjectByName('body-core');
    if (core && tag) {
      core.name = `${tag}::body`;
      core.userData.tag = tag;
      core.userData.pickable = pickable;
    }
    return glb;
  }

  let mesh: THREE.Group;
  switch (kind) {
    case 'UF':
      mesh = buildUF(color);
      break;
    case 'FS':
      mesh = buildFS(color);
      break;
    case 'HOV':
      mesh = buildHOV(color);
      break;
    case 'MOV':
      mesh = buildMOV(color);
      break;
    case 'SSV':
      mesh = buildSSV(color);
      break;
    case 'PCV':
      mesh = buildPCV(color);
      break;
    case 'PV':
      mesh = buildPV(color);
      break;
    case 'PIPE':
      mesh = buildPipePreset(color);
      break;
    case 'PIPE_ELBOW':
      mesh = buildElbow(color);
      break;
    case 'FLANGE':
      mesh = buildFlangeOnly(color);
      break;
    case 'INSTR':
      mesh = buildInstr(color);
      break;
    case 'TANK':
      mesh = buildTank(color);
      break;
    case 'ELEC_CB':
      mesh = buildElecCb(color);
      break;
    case 'ELEC_M':
      mesh = buildElecM(color);
      break;
    case 'ELEC_GND':
      mesh = buildElecGnd(color);
      break;
    case 'TEXT':
      mesh = buildTextPlate(color, options?.labelText ?? options?.tag ?? 'TEXT');
      break;
    case 'LINE_SOLID':
      mesh = buildSolidLine(color);
      break;
    case 'LINE_DASHED':
      mesh = buildDashedLine(color);
      break;
    case 'PCS':
      mesh = buildEnergyCabinet(color, 0.55, 0.7, 0.35);
      break;
    case 'TRANSFORMER':
      mesh = buildEnergyCabinet(color, 0.55, 0.6, 0.4);
      break;
    case 'BESS':
      mesh = buildEnergyCabinet(color, 0.5, 0.65, 0.32);
      break;
    case 'LOAD':
      mesh = buildEnergyCabinet(color, 0.7, 0.45, 0.5);
      break;
    case 'DIST_ROOM':
      mesh = buildEnergyCabinet(color, 0.75, 0.42, 0.55);
      break;
    case 'TURBOJET':
      mesh = buildTurbojetFallback(color);
      break;
    case 'HENG_GUANG_SKID':
      mesh = buildSkidPlaceholder(color);
      break;
    default:
      mesh = buildPipePreset(color);
      break;
  }

  mesh.name = tag ?? `catalog:${kind}`;
  mesh.userData.catalogKind = kind;
  mesh.userData.kind = kind;
  markPickable(mesh, tag, pickable);
  mesh.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  const core = mesh.getObjectByName('body-core');
  if (core) {
    core.name = tag ? `${tag}::body` : `catalog:${kind}::body`;
    if (tag) {
      core.userData.tag = tag;
      core.userData.pickable = pickable;
    }
  }

  return mesh;
}

export function defaultColorForKind(kind: CatalogKind): number {
  return DEFAULT_COLORS[kind] ?? 0x94a3b8;
}

export function labelOffsetY(kind: CatalogKind | NodeKind): number {
  switch (kind) {
    case 'UF':
      return 0.48;
    case 'FS':
    case 'SSV':
    case 'TANK':
      return 0.78;
    case 'MOV':
      return 0.52;
    case 'PCV':
    case 'INSTR':
      return 0.48;
    case 'PV':
      return 0.58;
    case 'HOV':
      return 0.42;
    case 'TEXT':
      return 0.28;
    case 'ELEC_CB':
    case 'ELEC_M':
      return 0.36;
    case 'PCS':
    case 'TRANSFORMER':
    case 'BESS':
      return 0.95;
    case 'LOAD':
    case 'DIST_ROOM':
      return 1.05;
    case 'TURBOJET':
      return 0.7;
    case 'HENG_GUANG_SKID':
      return 1.4;
    default:
      return 0.35;
  }
}
