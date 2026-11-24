import * as THREE from 'three';
import type { PipeEdge } from '../domain/schema';
import { extractObjectPorts } from './AssetManager';

const MEDIUM_COLOR: Record<PipeEdge['medium'], number> = {
  gas: 0xf59e0b,
  water: 0x0ea5e9,
  air: 0x22d3ee,
};

const MEDIUM_PULSE: Record<PipeEdge['medium'], number> = {
  gas: 0xfef08a,
  water: 0xbae6fd,
  air: 0xa5f3fc,
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

  // 合并过近冗余点
  const clean: THREE.Vector3[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].distanceTo(clean[clean.length - 1]) > 0.02) {
      clean.push(raw[i]);
    }
  }
  return clean;
}

/** 根据折线生成带倒角弯头的平滑曲线 */
function buildRoundedPipeCurve(points: THREE.Vector3[], cornerRadius = 0.09): THREE.CurvePath<THREE.Vector3> {
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
  group: THREE.Group;
  curve: THREE.CurvePath<THREE.Vector3>;
  pulses: THREE.Mesh[];
  phase: number;
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

export function buildPipeMesh(
  edge: PipeEdge,
  fromObj: THREE.Object3D,
  toObj: THREE.Object3D,
): BuiltPipe | null {
  const start = resolvePortWorld(fromObj, edge.fromPort);
  const end = resolvePortWorld(toObj, edge.toPort);
  if (!start || !end) return null;

  const pts = computeOrthogonalPoints(start.pos, start.normal, end.pos, end.normal);
  const curve = buildRoundedPipeCurve(pts);
  const radius = Math.max(0.032, (edge.diameterMm / 1000) * 0.45);
  const tubeGeo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 10), radius, 14, false);
  const pipeMat = new THREE.MeshStandardMaterial({
    color: MEDIUM_COLOR[edge.medium],
    metalness: 0.48,
    roughness: 0.34,
  });

  const group = new THREE.Group();
  group.name = `pipe:${edge.id}`;
  group.userData.pipeId = edge.id;

  const tubeMesh = new THREE.Mesh(tubeGeo, pipeMat);
  tubeMesh.castShadow = true;
  tubeMesh.receiveShadow = true;
  tubeMesh.userData.pipeId = edge.id;
  group.add(tubeMesh);

  // 起止点接口法兰盘
  const flangeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.78,
    roughness: 0.28,
  });
  const flangeGeo = new THREE.CylinderGeometry(radius * 1.65, radius * 1.65, 0.036, 18);
  for (const tip of [start, end]) {
    const flange = new THREE.Mesh(flangeGeo, flangeMat);
    flange.position.copy(tip.pos);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      tip.normal,
    );
    flange.quaternion.copy(quat);
    group.add(flange);
  }

  // 介质流向脉冲光点
  const pulseGeo = new THREE.SphereGeometry(radius * 1.18, 10, 8);
  const pulseMat = new THREE.MeshStandardMaterial({
    color: MEDIUM_PULSE[edge.medium],
    emissive: MEDIUM_PULSE[edge.medium],
    emissiveIntensity: 1.25,
    roughness: 0.15,
  });
  const pulses: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(pulseGeo, pulseMat);
    group.add(p);
    pulses.push(p);
  }

  return { id: edge.id, group, curve, pulses, phase: 0 };
}

export function disposeBuiltPipe(bp: BuiltPipe) {
  bp.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}
