import * as THREE from 'three';
import type { PointValue } from '../data/points';
import {
  createDefaultPipeFlow,
  type PipeEdge,
  type PipeFlowConfig,
  type SceneNode,
} from '../domain/schema';
import { extractObjectPorts } from './AssetManager';
import { createPipeFlowTexture, enhanceIndustrialMaterials } from './MaterialLibrary';

const MEDIUM_MATERIAL_STYLE: Record<
  PipeEdge['medium'],
  { color: number; metalness: number; roughness: number; name: string; flowColor: number }
> = {
  // 工艺介质 / 燃气：高光 304 拉丝不锈钢管道 + 青金指示流向
  gas: { color: 0xc8d2dc, metalness: 0.88, roughness: 0.25, name: 'mat:stainless', flowColor: 0x38bdf8 },
  // 冷却 / 工艺水：重工业深钴蓝管道 + 冰蓝高亮流向
  water: { color: 0x1555b0, metalness: 0.44, roughness: 0.28, name: 'mat:industrialBlue', flowColor: 0x67e8f9 },
  // 仪控空气 / 氮气：枪灰镀锌钢管 + 清透绿青流向
  air: { color: 0x64748b, metalness: 0.74, roughness: 0.34, name: 'mat:steelSlate', flowColor: 0x34d399 },
};

function computeOrthogonalPoints(
  pStart: THREE.Vector3,
  nStart: THREE.Vector3,
  pEnd: THREE.Vector3,
  nEnd: THREE.Vector3,
): THREE.Vector3[] {
  const lead = 0.24;
  const a = pStart.clone().addScaledVector(nStart, lead);
  const b = pEnd.clone().addScaledVector(nEnd, lead);

  const raw: THREE.Vector3[] = [pStart.clone(), a.clone()];
  const midX = (a.x + b.x) * 0.5;

  if (Math.abs(a.y - b.y) > 0.05) {
    raw.push(new THREE.Vector3(midX, a.y, a.z));
    raw.push(new THREE.Vector3(midX, b.y, a.z));
    raw.push(new THREE.Vector3(midX, b.y, b.z));
  } else {
    raw.push(new THREE.Vector3(midX, a.y, a.z));
    raw.push(new THREE.Vector3(midX, a.y, b.z));
  }

  raw.push(b.clone(), pEnd.clone());

  const clean: THREE.Vector3[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].distanceTo(clean[clean.length - 1]) > 0.02) {
      clean.push(raw[i]);
    }
  }
  return clean;
}

/** 根据折线生成带倒角弯头的平滑曲线 */
function buildRoundedPipeCurve(points: THREE.Vector3[], cornerRadius = 0.095): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  if (points.length < 2) return path;
  if (points.length === 2) {
    path.add(new THREE.LineCurve3(points[0], points[1]));
    return path;
  }

  let prevEnd = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const v1 = new THREE.Vector3().subVectors(pCurr, pPrev);
    const v2 = new THREE.Vector3().subVectors(pNext, pCurr);
    const len1 = v1.length();
    const len2 = v2.length();
    if (len1 < 1e-4 || len2 < 1e-4) continue;

    const r = Math.min(cornerRadius, len1 * 0.38, len2 * 0.38);
    const cornerStart = pCurr.clone().addScaledVector(v1.normalize(), -r);
    const cornerEnd = pCurr.clone().addScaledVector(v2.normalize(), r);

    if (prevEnd.distanceTo(cornerStart) > 1e-4) {
      path.add(new THREE.LineCurve3(prevEnd, cornerStart));
    }
    path.add(new THREE.QuadraticBezierCurve3(cornerStart, pCurr.clone(), cornerEnd));
    prevEnd = cornerEnd;
  }

  const last = points[points.length - 1];
  if (prevEnd.distanceTo(last) > 1e-4) {
    path.add(new THREE.LineCurve3(prevEnd, last));
  }
  return path;
}

export type BuiltPipe = {
  id: string;
  edge: PipeEdge;
  flow: PipeFlowConfig;
  group: THREE.Group;
  curve: THREE.CurvePath<THREE.Vector3>;
  length: number;
  tubeMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  flowTex: THREE.CanvasTexture | null;
  flowMat: THREE.MeshStandardMaterial | null;
  arrows: THREE.Object3D[];
  phase: number;
  flowColorHex: number;
};

export type NodePipeFlowHandle = {
  flow: PipeFlowConfig;
  flowTex: THREE.CanvasTexture;
  flowMat: THREE.MeshStandardMaterial;
  overlayGroup: THREE.Group;
  phase: number;
  length: number;
};

export function resolvePortWorld(
  obj: THREE.Object3D,
  portId: string,
): { pos: THREE.Vector3; normal: THREE.Vector3 } | null {
  const ports = extractObjectPorts(obj);
  const found = ports.find((p) => p.id === portId) ?? ports[0];
  if (!found) return null;

  obj.updateMatrixWorld(true);
  const pos = found.localPos.clone().applyMatrix4(obj.matrixWorld);
  const normalMat = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
  const normal = found.localNormal.clone().applyMatrix3(normalMat).normalize();
  return { pos, normal };
}

/** 从遥测测点计算流动速度倍率：0 表示停流/阀门关闭，>0 表示正常流速系数 */
export function resolveTelemetryFlowFactor(
  flow: PipeFlowConfig,
  telemetryMap: Record<string, PointValue>,
): number {
  if (!flow.enabled || flow.mode === 'none') return 0;
  if (!flow.bindPointId) return 1.0;

  const pv = telemetryMap[flow.bindPointId];
  if (!pv || pv.quality === 'BAD' || pv.value === null || pv.value === undefined) return 0;

  const num = Number(pv.value);
  if (!Number.isFinite(num) || num <= 0.01) return 0;

  // 对小值开关/开度类（如 1 / 100）和大值流量类统一做平滑倍率映射
  if (num === 1) return 1.0;
  return Math.min(2.4, Math.max(0.35, num / 85));
}

function addPipeSupportStanchion(
  group: THREE.Group,
  pos: THREE.Vector3,
  radius: number,
  edgeId: string,
) {
  if (pos.y < 0.14 || pos.y > 2.2) return;
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.022, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x1b212b, metalness: 0.72, roughness: 0.48 }),
  );
  foot.position.set(pos.x, 0.011, pos.z);
  foot.castShadow = true;
  foot.receiveShadow = true;
  foot.userData.pipeId = edgeId;

  const postH = Math.max(0.08, pos.y - radius * 0.9);
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, postH, 10),
    new THREE.MeshStandardMaterial({ color: 0x262d38, metalness: 0.76, roughness: 0.44 }),
  );
  post.position.set(pos.x, postH * 0.5 + 0.01, pos.z);
  post.castShadow = true;
  post.userData.pipeId = edgeId;

  const clamp = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.18, 0.01, 8, 16),
    new THREE.MeshStandardMaterial({ name: 'mat:stainless', color: 0xc8d2dc, metalness: 0.88, roughness: 0.25 }),
  );
  clamp.position.copy(pos);
  clamp.userData.pipeId = edgeId;

  group.add(foot, post, clamp);
}

function make3DFlowArrow(radius: number, flowColorHex: number, edgeId: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: flowColorHex,
    emissive: flowColorHex,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.2,
  });

  // 上半弧形指示光环（贴紧管壁外部）
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.24, radius * 0.16, 8, 20), mat);
  ring.userData.pipeId = edgeId;
  g.add(ring);

  // 指向前方的三棱流向箭标（朝向 +Z 方向，tick 中用四元数对准切线）
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.52, radius * 1.35, 4), mat);
  cone.rotation.x = Math.PI / 2;
  cone.position.y = radius * 1.38;
  cone.userData.pipeId = edgeId;
  g.add(cone);

  return g;
}

export function buildPipeMesh(
  edge: PipeEdge,
  fromObj: THREE.Object3D,
  toObj: THREE.Object3D,
): BuiltPipe | null {
  const start = resolvePortWorld(fromObj, edge.fromPort);
  const end = resolvePortWorld(toObj, edge.toPort);
  if (!start || !end) return null;

  const flow: PipeFlowConfig = { ...createDefaultPipeFlow(), ...edge.flow };
  const pts = computeOrthogonalPoints(start.pos, start.normal, end.pos, end.normal);
  const curve = buildRoundedPipeCurve(pts);
  const length = Math.max(0.25, curve.getLength());
  const radius = Math.max(0.032, (edge.diameterMm / 1000) * 0.48);
  const style = MEDIUM_MATERIAL_STYLE[edge.medium];
  const flowColorHex = flow.color
    ? Number.parseInt(flow.color.replace('#', ''), 16) || style.flowColor
    : style.flowColor;
  const segs = Math.max(32, Math.round(length * 24));

  const group = new THREE.Group();
  group.name = `pipe:${edge.id}`;
  group.userData.pipeId = edge.id;

  let tubeMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  let flowTex: THREE.CanvasTexture | null = null;
  let flowMat: THREE.MeshStandardMaterial | null = null;
  const arrows: THREE.Object3D[] = [];

  if (flow.enabled && flow.mode === 'glass-stream') {
    // 模式 2：透明硼硅玻璃视镜外管 + 内部实心液体流速柱
    tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.12,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 18, false), tubeMat);
    outerMesh.castShadow = false;
    outerMesh.receiveShadow = true;
    outerMesh.userData.pipeId = edge.id;
    group.add(outerMesh);

    const repeatU = Math.max(2, length / 0.42);
    flowTex = createPipeFlowTexture(flowColorHex, 'glass-stream', repeatU, flow.direction === 'reverse');
    flowMat = new THREE.MeshStandardMaterial({
      map: flowTex,
      emissiveMap: flowTex,
      emissive: flowColorHex,
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.92,
      roughness: 0.15,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius * 0.68, 14, false), flowMat);
    coreMesh.userData.pipeId = edge.id;
    group.add(coreMesh);
  } else {
    // 经典重工业 304 拉丝不锈钢 / 钴蓝金属外管
    tubeMat = new THREE.MeshStandardMaterial({
      name: style.name,
      color: style.color,
      metalness: style.metalness,
      roughness: style.roughness,
    });
    const tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 16, false), tubeMat);
    tubeMesh.castShadow = true;
    tubeMesh.receiveShadow = true;
    tubeMesh.userData.pipeId = edge.id;
    group.add(tubeMesh);

    if (flow.enabled && flow.mode === 'uv-chevron') {
      // 模式 1：贴合金属管外壁的高对比发光流向箭头带
      const repeatU = Math.max(2, length / 0.38);
      flowTex = createPipeFlowTexture(flowColorHex, 'uv-chevron', repeatU, flow.direction === 'reverse');
      flowMat = new THREE.MeshStandardMaterial({
        map: flowTex,
        emissiveMap: flowTex,
        emissive: flowColorHex,
        emissiveIntensity: 1.25,
        transparent: true,
        opacity: 0.94,
        roughness: 0.2,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const sleeveMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segs, radius * 1.04, 16, false),
        flowMat,
      );
      sleeveMesh.userData.pipeId = edge.id;
      group.add(sleeveMesh);
    } else if (flow.enabled && flow.mode === '3d-arrow') {
      // 模式 3：沿弧长均匀排布的 3D 立体流向箭标环
      const count = Math.max(3, Math.min(12, Math.round(length / 0.65)));
      for (let i = 0; i < count; i++) {
        const arr = make3DFlowArrow(radius, flowColorHex, edge.id);
        group.add(arr);
        arrows.push(arr);
      }
    }
  }

  // 起止点高精度 PN16 带螺栓连接法兰盘
  const flangeMat = new THREE.MeshStandardMaterial({
    name: 'mat:stainless',
    color: 0xc8d2dc,
    metalness: 0.88,
    roughness: 0.25,
  });
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x1b212b, metalness: 0.78, roughness: 0.42 });
  const flangeGeo = new THREE.CylinderGeometry(radius * 1.68, radius * 1.68, 0.038, 20);
  const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.052, 6);
  for (const tip of [start, end]) {
    const flGroup = new THREE.Group();
    flGroup.position.copy(tip.pos);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.normal);
    flGroup.quaternion.copy(quat);

    const flange = new THREE.Mesh(flangeGeo, flangeMat);
    flange.userData.pipeId = edge.id;
    flGroup.add(flange);

    const br = radius * 1.35;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(boltGeo, boltMat);
      b.position.set(Math.cos(a) * br, 0, Math.sin(a) * br);
      b.userData.pipeId = edge.id;
      flGroup.add(b);
    }
    group.add(flGroup);
  }

  // 在较长的水平直管段中点自动布置地面管道支撑架
  let supportsAdded = 0;
  for (let i = 1; i < pts.length - 1 && supportsAdded < 2; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const horiz = Math.abs(p1.y - p2.y) < 0.04;
    const span = p1.distanceTo(p2);
    if (horiz && span > 0.75) {
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      addPipeSupportStanchion(group, mid, radius, edge.id);
      supportsAdded++;
    }
  }

  enhanceIndustrialMaterials(group);

  return {
    id: edge.id,
    edge,
    flow,
    group,
    curve,
    length,
    tubeMat,
    flowTex,
    flowMat,
    arrows,
    phase: 0,
    flowColorHex,
  };
}

const forwardVec = new THREE.Vector3(0, 0, 1);
const tmpPt = new THREE.Vector3();
const tmpTan = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();

/** 按真实物理弧长与遥测倍率更新管道流动帧 */
export function tickBuiltPipeFlow(
  bp: BuiltPipe,
  dt: number,
  telemetryMap: Record<string, PointValue>,
) {
  const factor = resolveTelemetryFlowFactor(bp.flow, telemetryMap);
  const dirSign = bp.flow.direction === 'reverse' ? -1 : 1;

  if (bp.flowMat) {
    bp.flowMat.opacity = factor <= 0 ? 0.16 : 0.94;
  }
  for (const a of bp.arrows) {
    a.visible = factor > 0;
  }
  if (factor <= 0) return;

  const worldSpeed = Math.max(0.15, bp.flow.speed) * 0.85 * factor;

  if (bp.flowTex) {
    // 贴图箭头随 offset 减小沿 +U 前进；当 reverse 时 tex.repeat.x 为负，同样需要对应符号使物理方向逆转
    bp.flowTex.offset.x = (bp.flowTex.offset.x - dirSign * (worldSpeed * dt) / 0.38) % 1;
  }

  if (bp.arrows.length > 0) {
    const count = bp.arrows.length;
    bp.phase = (bp.phase + dirSign * (worldSpeed * dt) / bp.length) % 1;
    if (bp.phase < 0) bp.phase += 1;

    for (let i = 0; i < count; i++) {
      const u = (bp.phase + i / count) % 1;
      bp.curve.getPointAt(u, tmpPt);
      bp.curve.getTangentAt(u, tmpTan);
      if (dirSign < 0) tmpTan.negate();
      tmpQuat.setFromUnitVectors(forwardVec, tmpTan.normalize());
      bp.arrows[i].position.copy(tmpPt);
      bp.arrows[i].quaternion.copy(tmpQuat);
    }
  }
}

export function setPipeSelectedHighlight(bp: BuiltPipe, selected: boolean) {
  if (bp.tubeMat instanceof THREE.MeshStandardMaterial) {
    if (selected) {
      bp.tubeMat.emissive.setHex(0x0284c7);
      bp.tubeMat.emissiveIntensity = 0.32;
    } else {
      bp.tubeMat.emissive.setHex(0x000000);
      bp.tubeMat.emissiveIntensity = 0;
    }
  }
}

/** 为画布中的独立管件资产（PIPE / PIPE_ELBOW / SIGHT_GLASS）挂载可配置流动层 */
export function attachNodePipeFlow(
  root: THREE.Object3D,
  node: SceneNode,
): NodePipeFlowHandle | null {
  if (node.kind !== 'PIPE' && node.kind !== 'PIPE_ELBOW' && node.kind !== 'SIGHT_GLASS') {
    return null;
  }
  const flow: PipeFlowConfig = { ...createDefaultPipeFlow(), ...node.pipeFlow };
  if (!flow.enabled || flow.mode === 'none') return null;

  const flowColorHex = flow.color
    ? Number.parseInt(flow.color.replace('#', ''), 16) || 0x38bdf8
    : 0x38bdf8;
  const overlayGroup = new THREE.Group();
  overlayGroup.name = 'node-flow-overlay';

  if (node.kind === 'SIGHT_GLASS') {
    const length = 0.56;
    const flowTex = createPipeFlowTexture(
      flowColorHex,
      flow.mode === 'uv-chevron' ? 'uv-chevron' : 'glass-stream',
      2.2,
      flow.direction === 'reverse',
    );
    const flowMat = new THREE.MeshStandardMaterial({
      map: flowTex,
      emissiveMap: flowTex,
      emissive: flowColorHex,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.92,
      roughness: 0.16,
      depthWrite: false,
    });
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(-0.28, 0.4, 0),
      new THREE.Vector3(0.28, 0.4, 0),
    );
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.068, 16, false), flowMat);
    core.userData.nodeId = node.id;
    core.userData.pickable = true;
    overlayGroup.add(core);
    root.add(overlayGroup);
    return { flow, flowTex, flowMat, overlayGroup, phase: 0, length };
  }

  // PIPE / PIPE_ELBOW 外壁紧贴流向带
  const length = node.kind === 'PIPE' ? 0.92 : 0.54;
  const curve =
    node.kind === 'PIPE'
      ? new THREE.LineCurve3(new THREE.Vector3(-0.46, 0.4, 0), new THREE.Vector3(0.46, 0.4, 0))
      : new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.34, 0.4, 0),
          new THREE.Vector3(0, 0.4, 0),
          new THREE.Vector3(0, 0.4, -0.34),
        );
  const flowTex = createPipeFlowTexture(
    flowColorHex,
    flow.mode === 'glass-stream' ? 'glass-stream' : 'uv-chevron',
    length / 0.36,
    flow.direction === 'reverse',
  );
  const flowMat = new THREE.MeshStandardMaterial({
    map: flowTex,
    emissiveMap: flowTex,
    emissive: flowColorHex,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.92,
    roughness: 0.2,
    depthWrite: false,
  });
  const sleeve = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.079, 16, false), flowMat);
  sleeve.userData.nodeId = node.id;
  sleeve.userData.pickable = true;
  overlayGroup.add(sleeve);
  root.add(overlayGroup);
  return { flow, flowTex, flowMat, overlayGroup, phase: 0, length };
}

export function tickNodePipeFlow(
  handle: NodePipeFlowHandle,
  dt: number,
  telemetryMap: Record<string, PointValue>,
) {
  const factor = resolveTelemetryFlowFactor(handle.flow, telemetryMap);
  handle.flowMat.opacity = factor <= 0 ? 0.16 : 0.92;
  if (factor <= 0) return;

  const dirSign = handle.flow.direction === 'reverse' ? -1 : 1;
  const worldSpeed = Math.max(0.15, handle.flow.speed) * 0.85 * factor;
  handle.flowTex.offset.x = (handle.flowTex.offset.x - dirSign * (worldSpeed * dt) / 0.36) % 1;
}

export function disposeNodePipeFlow(handle: NodePipeFlowHandle) {
  handle.flowTex.dispose();
  handle.flowMat.dispose();
  handle.overlayGroup.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
    }
  });
}

export function disposeBuiltPipe(bp: BuiltPipe) {
  bp.flowTex?.dispose();
  bp.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}
