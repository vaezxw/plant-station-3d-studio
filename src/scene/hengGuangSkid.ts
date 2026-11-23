import * as THREE from 'three';
import {
  COMPOSE_LAYOUT_FILE,
  composeOverrideMap,
  resolveComposeKind,
} from '../data/composeLayout';
import type { PointValue } from '../data/points';
import { PIPE_SEGMENTS, TOPOLOGY_NODES } from '../data/topology';
import { M2_PRIMARY_TAG } from '../plant/events';
import {
  buildCatalogMesh,
  buildFlangeDisk,
  defaultColorForKind,
} from './catalog';
import { colorForLane, resolveNodePositions } from './layout';
import { createPipeFlowAnimator, type PipeFlowAnimator } from './flow';

function buildPipeMesh(points: [number, number, number][], color: number, id: string): THREE.Group {
  const group = new THREE.Group();
  group.name = id;
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.1,
  );
  const tubularSegments = Math.max(8, points.length * 8);
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, 0.08, 10, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.35,
    roughness: 0.45,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${id}::tube`;
  mesh.userData.pickable = false;
  group.add(mesh);

  const start = new THREE.Vector3(...points[0]);
  const end = new THREE.Vector3(...points[points.length - 1]);
  const f0 = buildFlangeDisk(0.13, 0.035, 0xcbd5e1);
  f0.position.copy(start);
  const f1 = buildFlangeDisk(0.13, 0.035, 0xcbd5e1);
  f1.position.copy(end);
  group.add(f0, f1);
  group.userData.pickable = false;
  return group;
}

function valveStatusColor(tag: string, valueMap?: Map<string, PointValue>): number | null {
  if (!valueMap) return null;
  const pv = valueMap.get(`${tag}.valveColor`);
  if (!pv || pv.quality !== 'GOOD' || pv.value == null) return null;
  if (pv.value >= 0.9) return 0x22c55e;
  if (pv.value <= 0.1) return 0xef4444;
  return 0xeab308;
}

function markTreePickable(obj: THREE.Object3D, tag: string | null, pickable: boolean) {
  obj.userData.tag = tag;
  obj.userData.pickable = pickable;
  obj.traverse((c) => {
    if (c === obj) return;
    c.userData.tag = tag;
    c.userData.pickable = pickable;
  });
}

/**
 * 恒光橇装：现有 PFD 拓扑 + 管段作为 **一件** 装配。
 * 不改 topology.ts / points.ts；内部位号只用于着色。
 */
export function buildHengGuangSkidGroup(options?: {
  tag?: string | null;
  valueMap?: Map<string, PointValue>;
  includeFlow?: boolean;
}): THREE.Group {
  const pickTag = options?.tag ?? null;
  const pickable = Boolean(pickTag);
  const composeFile = COMPOSE_LAYOUT_FILE;
  const overrides = composeOverrideMap(composeFile);
  const positions = resolveNodePositions(composeFile);

  const root = new THREE.Group();
  root.name = pickTag ?? 'heng-guang-skid';
  root.userData.catalogKind = 'HENG_GUANG_SKID';
  root.userData.kind = 'HENG_GUANG_SKID';

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(13.6, 0.08, 3.2),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.25,
      roughness: 0.7,
    }),
  );
  deck.position.set(6, -0.64, 0);
  deck.name = 'body-core';
  deck.userData.pickable = false;
  root.add(deck);

  for (const seg of PIPE_SEGMENTS) {
    const color = colorForLane(seg.lane);
    const pipe = buildPipeMesh(seg.centerline, color, seg.id);
    root.add(pipe);
  }

  for (const node of TOPOLOGY_NODES) {
    const pos = positions.get(node.tag);
    if (!pos) continue;
    const kind = resolveComposeKind(node.tag, overrides) ?? node.kind;
    const statusColor = valveStatusColor(node.tag, options?.valueMap);
    const color =
      statusColor ??
      (kind === 'UF' && node.tag === M2_PRIMARY_TAG
        ? 0x38bdf8
        : defaultColorForKind(kind));
    const equipment = buildCatalogMesh(kind, { tag: pickTag, color });
    equipment.position.copy(pos);
    equipment.userData.topologyTag = node.tag;
    equipment.userData.lane = node.lane;
    markTreePickable(equipment, pickTag, pickable);
    root.add(equipment);
  }

  if (options?.includeFlow !== false && pickTag) {
    const flow: PipeFlowAnimator = createPipeFlowAnimator();
    flow.group.userData.pickable = false;
    root.add(flow.group);
    root.userData.pipeFlow = flow;
  }

  // 原点放到包围盒中心，底面贴 y=0，拖放时整橇一起动
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  for (const child of root.children) {
    child.position.x -= center.x;
    child.position.z -= center.z;
    child.position.y -= box.min.y;
  }

  markTreePickable(root, pickTag, pickable);
  if (deck) deck.name = pickTag ? `${pickTag}::body` : 'body-core';

  return root;
}

export function getSkidFlow(obj: THREE.Object3D): PipeFlowAnimator | null {
  const flow = obj.userData.pipeFlow as PipeFlowAnimator | undefined;
  return flow ?? null;
}
