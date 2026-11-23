import * as THREE from 'three';
import {
  composeOverrideMap,
  resolveComposePosition,
  type ComposeLayoutFile,
  type ComposeNodeOverride,
} from '../data/composeLayout';
import { PIPE_SEGMENTS, TOPOLOGY_NODES, type NodeKind } from '../data/topology';
import { M2_PRIMARY_TAG } from '../plant/events';

/**
 * 位号锚点（流程图三维化占位坐标，非现场实测）。
 * 与 PIPE_SEGMENTS 中心线对齐：上路 y=2、下路 y=0、汇管 y=1。
 * 可被 compose-layout.json 的 x/y/z 覆盖。
 */
const NODE_ANCHORS: Record<string, [number, number, number]> = {
  'HG-HOV10111': [0, 2, 0],
  'HG-FS-101': [1, 2, 0],
  'HG-UF-101': [2, 2, 0],
  'HG-MOV10112': [3, 2, 0],
  'HG-HOV10114': [4, 2, 0],
  'HG-MOV10211': [5, 2, 0],
  'HG-SSV10212': [6, 2, 0],
  'HG-PCV10213': [7, 2, 0],
  'HG-PV10214': [8, 2, 0],
  'HG-PV10215': [9, 2, 0],
  'HG-HOV10121': [0, 0, 0],
  'HG-FS-102': [1, 0, 0],
  'HG-UF-102': [2, 0, 0],
  'HG-MOV10122': [3, 0, 0],
  'HG-MOV10221': [4, 0, 0],
  'HG-SSV10222': [5, 0, 0],
  'HG-PCV10223': [6, 0, 0],
  'HG-PV10224': [7, 0, 0],
  'HG-MOV10225': [8, 0, 0],
  'HG-HOV10321': [9.5, 0, 0],
  'HG-MOV10311': [10, 1, 0],
  'HG-HOV10312': [12, 1, 0],
};

export type PlantNodeMap = Map<string, THREE.Object3D>;

export function resolveNodePositions(
  composeFile?: ComposeLayoutFile,
): Map<string, THREE.Vector3> {
  const overrides = composeFile ? composeOverrideMap(composeFile) : composeOverrideMap();
  const positions = new Map<string, THREE.Vector3>();

  for (const [tag, xyz] of Object.entries(NODE_ANCHORS)) {
    const p = resolveComposePosition(tag, { x: xyz[0], y: xyz[1], z: xyz[2] }, overrides);
    positions.set(tag, new THREE.Vector3(p.x, p.y, p.z));
  }

  // 编排草稿中出现、但拓扑/锚点尚无的节点：允许以 x/y/z 生成孤立预览位
  for (const [tag, o] of overrides) {
    if (positions.has(tag)) continue;
    if (o.x == null && o.y == null && o.z == null) continue;
    positions.set(
      tag,
      new THREE.Vector3(o.x ?? 0, o.y ?? 1, o.z ?? 0),
    );
  }

  for (const seg of PIPE_SEGMENTS) {
    const start = seg.centerline[0];
    const end = seg.centerline[seg.centerline.length - 1];
    if (!positions.has(seg.fromTag)) {
      positions.set(seg.fromTag, new THREE.Vector3(start[0], start[1], start[2]));
    }
    if (!positions.has(seg.toTag)) {
      positions.set(seg.toTag, new THREE.Vector3(end[0], end[1], end[2]));
    }
  }

  const missing = TOPOLOGY_NODES.map((n) => n.tag).filter((tag) => !positions.has(tag));
  if (missing.length > 0) {
    throw new Error(`场景布局缺节点（禁止静默绑邻设备）: ${missing.join(', ')}`);
  }
  if (!positions.has(M2_PRIMARY_TAG)) {
    throw new Error(`场景布局缺 M2 首刀位号 ${M2_PRIMARY_TAG}`);
  }

  return positions;
}

export function meshSizeForKind(kind: NodeKind): { w: number; h: number; d: number } {
  switch (kind) {
    case 'UF':
      return { w: 0.55, h: 1.2, d: 0.55 };
    case 'FS':
      return { w: 0.35, h: 0.55, d: 0.35 };
    case 'HOV':
    case 'MOV':
      return { w: 0.4, h: 0.35, d: 0.4 };
    case 'SSV':
    case 'PCV':
    case 'PV':
      return { w: 0.32, h: 0.32, d: 0.32 };
    default:
      return { w: 0.3, h: 0.3, d: 0.3 };
  }
}

export function colorForLane(lane: string): number {
  if (lane === 'elster') return 0xfbbf24;
  if (lane === 'weisi') return 0xf59e0b;
  return 0xeab308;
}

export type { ComposeNodeOverride };
