import * as THREE from 'three';
import type { PointValue, Quality } from '../data/points';
import { PIPE_SEGMENTS, type Lane } from '../data/topology';

export type LaneFlowState = {
  lane: Lane;
  qualityOk: boolean;
  /** 沿曲线弧长速度（单位/秒）；GOOD 必须 >0 且肉眼可见 */
  speed: number;
  instant: number | null;
  quality: Quality | 'MISSING';
};

const LANE_FLOW_POINT: Record<Lane, string> = {
  elster: 'HG-UF-101.flowWork',
  weisi: 'HG-UF-102.flowWork',
  common: 'HG-UF-101.flowWork',
};

/** 水色：半透明青，不用刺眼黄球 */
const WATER = 0x67e8f9;
const WATER_DEEP = 0x22d3ee;
const CHEVRON = 0xe0f2fe;

/** 按支路计算流动：GOOD 必动；坏质量可减速/停 */
export function computeLaneFlows(valueMap: Map<string, PointValue>): LaneFlowState[] {
  const lanes: Lane[] = ['elster', 'weisi', 'common'];
  return lanes.map((lane) => {
    const pv = valueMap.get(LANE_FLOW_POINT[lane]);
    if (!pv) {
      return { lane, qualityOk: false, speed: 0, instant: null, quality: 'MISSING' };
    }
    if (pv.quality === 'GOOD') {
      const instant = pv.value ?? 0;
      const speed = instant > 0 ? Math.min(1.6, 0.5 + instant * 0.05) : 0.4;
      return { lane, qualityOk: true, speed, instant, quality: pv.quality };
    }
    if (pv.quality === 'UNCERTAIN' || pv.quality === 'STALE') {
      return {
        lane,
        qualityOk: false,
        speed: 0.1,
        instant: pv.value,
        quality: pv.quality,
      };
    }
    return {
      lane,
      qualityOk: false,
      speed: 0,
      instant: pv.value,
      quality: pv.quality,
    };
  });
}

export type PipeFlowAnimator = {
  group: THREE.Group;
  update: (valueMap: Map<string, PointValue>, dt: number) => void;
  dispose: () => void;
};

type SegTrack = {
  lane: Lane;
  curve: THREE.CatmullRomCurve3;
  length: number;
  droplets: THREE.Mesh[];
  chevrons: THREE.Mesh[];
  phase: number[];
  ribbonMat: THREE.MeshStandardMaterial;
};

function makeDroplet(): THREE.Mesh {
  // 扁长水滴感：拉长的椭球
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshPhysicalMaterial({
      color: WATER,
      emissive: WATER_DEEP,
      emissiveIntensity: 0.45,
      metalness: 0.05,
      roughness: 0.15,
      transparent: true,
      opacity: 0.55,
      transmission: 0.35,
      thickness: 0.4,
      depthWrite: false,
    }),
  );
  mesh.scale.set(1.6, 0.55, 0.7);
  mesh.userData.pickable = false;
  return mesh;
}

function makeChevron(): THREE.Mesh {
  // 小 V 形箭头（沿切线的扁锥）
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.14, 3),
    new THREE.MeshStandardMaterial({
      color: CHEVRON,
      emissive: WATER_DEEP,
      emissiveIntensity: 0.7,
      metalness: 0.1,
      roughness: 0.35,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  mesh.userData.pickable = false;
  return mesh;
}

/**
 * 水色半透明水滴条纹 + 中心线小箭头；俯斜 PFD 相机可读。
 */
export function createPipeFlowAnimator(): PipeFlowAnimator {
  const group = new THREE.Group();
  group.name = 'pipe-flow';
  const tracks: SegTrack[] = [];
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);

  for (const seg of PIPE_SEGMENTS) {
    const pts = seg.centerline.map((p) => new THREE.Vector3(p[0], p[1] + 0.14, p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const length = Math.max(0.5, curve.getLength());
    const count = Math.max(4, Math.ceil(length / 0.45));
    const droplets: THREE.Mesh[] = [];
    const chevrons: THREE.Mesh[] = [];
    const phase: number[] = [];

    for (let i = 0; i < count; i += 1) {
      phase.push(i / count);
      const drop = makeDroplet();
      const chevron = makeChevron();
      group.add(drop, chevron);
      droplets.push(drop);
      chevrons.push(chevron);
    }

    const ribbonGeo = new THREE.TubeGeometry(curve, Math.max(10, pts.length * 8), 0.055, 8, false);
    const ribbonMat = new THREE.MeshPhysicalMaterial({
      color: WATER_DEEP,
      emissive: WATER,
      emissiveIntensity: 0.25,
      metalness: 0.05,
      roughness: 0.2,
      transparent: true,
      opacity: 0.28,
      transmission: 0.4,
      thickness: 0.5,
      depthWrite: false,
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.name = `flow-ribbon:${seg.id}`;
    ribbon.userData.pickable = false;
    group.add(ribbon);

    tracks.push({ lane: seg.lane, curve, length, droplets, chevrons, phase, ribbonMat });
  }

  const place = (
    track: SegTrack,
    index: number,
    u: number,
    visible: boolean,
    dim: boolean,
  ) => {
    const uu = ((u % 1) + 1) % 1;
    track.curve.getPointAt(uu, tmp);
    const drop = track.droplets[index];
    const chevron = track.chevrons[index];
    drop.visible = visible;
    chevron.visible = visible;
    if (!visible) return;

    drop.position.copy(tmp);
    chevron.position.copy(tmp);

    const tangent = track.curve.getTangentAt(uu).normalize();
    // 水滴长轴对齐流向
    drop.quaternion.setFromUnitVectors(xAxis, tangent);

    look.copy(tmp).add(tangent);
    chevron.up.copy(up);
    chevron.lookAt(look);
    chevron.rotateX(Math.PI / 2);

    const dropMat = drop.material as THREE.MeshPhysicalMaterial;
    const chevMat = chevron.material as THREE.MeshStandardMaterial;
    dropMat.opacity = dim ? 0.2 : 0.55;
    chevMat.opacity = dim ? 0.35 : 0.9;
    dropMat.emissiveIntensity = dim ? 0.15 : 0.45;
    chevMat.emissiveIntensity = dim ? 0.25 : 0.7;
    track.ribbonMat.opacity = dim ? 0.12 : 0.28;
  };

  const update = (valueMap: Map<string, PointValue>, dt: number) => {
    const states = computeLaneFlows(valueMap);
    const byLane = new Map(states.map((s) => [s.lane, s]));
    const step = Math.min(0.05, Math.max(0.008, dt));

    for (const track of tracks) {
      const st = byLane.get(track.lane);
      const speed = st?.speed ?? 0;
      const moving = speed > 0;
      const dim = Boolean(st && !st.qualityOk && speed > 0);

      for (let i = 0; i < track.phase.length; i += 1) {
        if (moving) {
          track.phase[i] = (track.phase[i] + (speed * step) / track.length) % 1;
        }
        if (!moving) {
          track.droplets[i].visible = false;
          track.chevrons[i].visible = false;
          continue;
        }
        place(track, i, track.phase[i], true, dim);
      }
      if (!moving) track.ribbonMat.opacity = 0.08;
    }
  };

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    group.clear();
  };

  return { group, update, dispose };
}
