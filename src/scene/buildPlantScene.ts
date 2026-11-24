import * as THREE from 'three';
import {
  composeOverrideMap,
  isFrozenProcessTag,
  type ComposeLayoutFile,
} from '../data/composeLayout';
import type { PointValue } from '../data/points';
import { TOPOLOGY_BY_TAG, TOPOLOGY_NODES } from '../data/topology';
import {
  buildCatalogMesh,
  defaultColorForKind,
  hasGlbTemplate,
  isCatalogKind,
  isTurbojetKind,
  type CatalogKind,
} from './catalog';
import { buildScaleGrid } from './catalog/cameraFit';
import { buildHengGuangSkidGroup } from './hengGuangSkid';
import { type PlantNodeMap } from './layout';
import { labelFromEquipment, styleCss2dTagLabel } from './tagLabel';
import {
  attachTurbojetRig,
  getTurbojetMapping,
  type TurbojetRig,
} from './turbojet/createTurbojetViewer';

export type BuiltPlantScene = {
  root: THREE.Group;
  nodeMap: PlantNodeMap;
  pickables: THREE.Object3D[];
  turbojetRigs: Map<string, TurbojetRig>;
};

function ensureTurbojetRig(obj: THREE.Object3D): TurbojetRig | null {
  const existing = obj.userData.turbojetRig as TurbojetRig | undefined;
  if (existing) return existing;
  const mapping = getTurbojetMapping();
  if (!mapping) return null;
  const rig = attachTurbojetRig(obj, mapping);
  obj.userData.turbojetRig = rig;
  return rig;
}

export type BuildPlantSceneOptions = {
  composeFile?: ComposeLayoutFile;
  valueMap?: Map<string, PointValue>;
};

/**
 * 空白 3D 画布：地面 + 已拖入的目录件。
 * 恒光环路不再默认铺上；请拖「恒光橇装」。不改 topology.ts。
 */
export function buildPlantScene(options: BuildPlantSceneOptions = {}): BuiltPlantScene {
  const composeFile = options.composeFile ?? { version: 1, notes: [], nodes: [] };
  const overrides = composeOverrideMap(composeFile);
  const root = new THREE.Group();
  root.name = 'plant-root';

  root.add(buildScaleGrid());

  const nodeMap: PlantNodeMap = new Map();
  const pickables: THREE.Object3D[] = [];
  const turbojetRigs = new Map<string, TurbojetRig>();

  for (const [tag, o] of overrides) {
    if (isFrozenProcessTag(tag)) continue;
    if (!o.kind || !isCatalogKind(o.kind)) continue;
    const kind = o.kind as CatalogKind;
    const pos = new THREE.Vector3(o.x ?? 0, o.y ?? 1, o.z ?? 0);

    let equipment: THREE.Object3D;
    if (kind === 'HENG_GUANG_SKID' && !hasGlbTemplate('HENG_GUANG_SKID')) {
      equipment = buildHengGuangSkidGroup({
        tag,
        valueMap: options.valueMap,
        includeFlow: true,
      });
    } else {
      equipment = buildCatalogMesh(kind, {
        tag,
        color: defaultColorForKind(kind),
        labelText: o.labelText ?? tag,
      });
    }
    equipment.position.copy(pos);
    equipment.userData.tag = tag;
    equipment.userData.kind = kind;
    equipment.userData.catalogKind = kind;
    equipment.userData.pickable = true;
    root.add(equipment);
    if (isTurbojetKind(kind)) {
      const rig = ensureTurbojetRig(equipment);
      if (rig) turbojetRigs.set(tag, rig);
    }

    nodeMap.set(tag, equipment);
    pickables.push(equipment);
    equipment.traverse((child) => {
      if (child !== equipment && child.userData.pickable) pickables.push(child);
    });
  }

  return { root, nodeMap, pickables, turbojetRigs };
}

export type SelectionVisual = {
  clear: () => void;
  apply: (object: THREE.Object3D | undefined, tag: string | null) => void;
};

export function createSelectionVisual(): SelectionVisual {
  let outline: THREE.LineSegments | null = null;
  let boxHelper: THREE.BoxHelper | null = null;
  let previousEmissives: Array<{
    mat: THREE.MeshStandardMaterial;
    color: THREE.Color;
    intensity: number;
  }> = [];
  let previousLabel: HTMLElement | null = null;

  const clear = () => {
    if (outline) {
      outline.parent?.remove(outline);
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
      outline = null;
    }
    if (boxHelper) {
      boxHelper.parent?.remove(boxHelper);
      boxHelper.dispose();
      boxHelper = null;
    }
    for (const prev of previousEmissives) {
      prev.mat.emissive.copy(prev.color);
      prev.mat.emissiveIntensity = prev.intensity;
    }
    previousEmissives = [];
    if (previousLabel) {
      styleCss2dTagLabel(previousLabel, false);
      previousLabel = null;
    }
  };

  const apply = (object: THREE.Object3D | undefined, tag: string | null) => {
    clear();
    if (!object || !tag) return;

    const body = object.getObjectByName(`${tag}::body`);
    if (body instanceof THREE.Mesh && body.material instanceof THREE.MeshStandardMaterial) {
      previousEmissives.push({
        mat: body.material,
        color: body.material.emissive.clone(),
        intensity: body.material.emissiveIntensity,
      });
      body.material.emissive.setHex(0x22d3ee);
      body.material.emissiveIntensity = 0.85;

      const edges = new THREE.EdgesGeometry(body.geometry);
      outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xf0f9ff }),
      );
      outline.position.copy(body.position);
      outline.rotation.copy(body.rotation);
      outline.scale.copy(body.scale);
      object.add(outline);
    } else {
      // GLB 模板通常是 Group，使用 BoxHelper 并给子 Mesh 叠加轻微高亮
      const seenMats = new Set<THREE.MeshStandardMaterial>();
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (!(m instanceof THREE.MeshStandardMaterial) || seenMats.has(m)) continue;
          seenMats.add(m);
          previousEmissives.push({
            mat: m,
            color: m.emissive.clone(),
            intensity: m.emissiveIntensity,
          });
          m.emissive.setHex(0x22d3ee);
          m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.35);
        }
      });
      boxHelper = new THREE.BoxHelper(object, 0x38bdf8);
      (object.parent ?? object).add(boxHelper);
    }

    const el = labelFromEquipment(object)?.element ?? null;
    if (el) {
      previousLabel = el;
      styleCss2dTagLabel(el, true);
    }
  };

  return { clear, apply };
}

/** 供外部确认拓扑全覆盖 */
export function listSelectableTags(): string[] {
  return TOPOLOGY_NODES.map((n) => n.tag);
}

export function topologyHasTag(tag: string): boolean {
  return TOPOLOGY_BY_TAG.has(tag);
}
