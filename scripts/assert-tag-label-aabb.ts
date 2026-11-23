/**
 * Node check: HOV / PCS / TURBOJET AABB top-center is not the group origin.
 * Run: npx tsx scripts/assert-tag-label-aabb.ts
 */
import * as THREE from 'three';
import { buildCatalogMesh, type CatalogKind } from '../src/scene/catalog';
import { TAG_LABEL_GAP, meshAabbTopCenterWorld, meshAabbWorld } from '../src/scene/tagLabel';

function check(kind: CatalogKind, pos: THREE.Vector3) {
  const obj = buildCatalogMesh(kind, { tag: `T-${kind}` });
  obj.position.copy(pos);
  obj.updateWorldMatrix(true, true);
  const box = meshAabbWorld(obj);
  const top = meshAabbTopCenterWorld(obj);
  const origin = new THREE.Vector3();
  obj.getWorldPosition(origin);
  if (box.isEmpty()) throw new Error(`${kind}: empty AABB`);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const wantY = box.max.y + TAG_LABEL_GAP;
  const dx = Math.abs(top.x - cx);
  const dy = Math.abs(top.y - wantY);
  const dz = Math.abs(top.z - cz);
  if (dx > 1e-5 || dy > 1e-5 || dz > 1e-5) {
    throw new Error(
      `${kind}: label ${fmt(top)} != AABB top-center (${cx.toFixed(4)}, ${wantY.toFixed(4)}, ${cz.toFixed(4)})`,
    );
  }
  if (TAG_LABEL_GAP > 0.04 || TAG_LABEL_GAP < 0.02) {
    throw new Error(`gap ${TAG_LABEL_GAP} outside 0.02–0.04`);
  }
  const offX = Math.abs(top.x - origin.x);
  const offZ = Math.abs(top.z - origin.z);
  const offY = top.y - origin.y;
  console.log(
    `${kind} origin ${fmt(origin)} AABB ${fmt(box.min)}..${fmt(box.max)} ` +
      `label ${fmt(top)} Δxz=(${offX.toFixed(3)},${offZ.toFixed(3)}) Δy=${offY.toFixed(3)}`,
  );
}

function fmt(v: THREE.Vector3) {
  return `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
}

check('HOV', new THREE.Vector3(3.2, 1, -1.4));
check('PCS', new THREE.Vector3(-2.5, 1, 0.8));
check('TURBOJET', new THREE.Vector3(1.1, 1, 2.2));
console.log('ok');
