import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/** World-unit gap between mesh AABB max.y and the chip's anchor (bottom edge). */
export const TAG_LABEL_GAP = 0.03;

const _box = new THREE.Box3();
const _meshBox = new THREE.Box3();
const _center = new THREE.Vector3();

function isCss2d(obj: THREE.Object3D): obj is CSS2DObject {
  return obj instanceof CSS2DObject;
}

function isEquipMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  const mesh = obj as THREE.Mesh;
  if (!mesh.isMesh || !mesh.geometry) return false;
  if (mesh.userData.isLabel) return false;
  const t = mesh.type;
  return t !== 'Line' && t !== 'LineSegments' && t !== 'LineLoop' && t !== 'GridHelper';
}

export function styleCss2dTagLabel(el: HTMLElement, selected: boolean): void {
  el.style.border = selected ? '1px solid #67e8f9' : '1px solid rgba(148,163,184,0.35)';
  el.style.background = selected ? 'rgba(14,165,233,0.88)' : 'rgba(15,23,42,0.82)';
  el.style.fontSize = selected ? '11px' : '9px';
  el.style.opacity = selected ? '1' : '0.85';
}

/**
 * Equipment mesh AABB top-center in **world** space (not the group's origin).
 * Precise vertex box per mesh, then union.
 */
export function meshAabbTopCenterWorld(
  root: THREE.Object3D,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  root.updateWorldMatrix(true, true);
  _box.makeEmpty();
  root.traverse((child) => {
    if (isCss2d(child) || child.userData.isLabel) return;
    if (!isEquipMesh(child)) return;
    _meshBox.setFromObject(child, true);
    if (!_meshBox.isEmpty()) _box.union(_meshBox);
  });
  if (_box.isEmpty()) {
    root.getWorldPosition(target);
    target.y += TAG_LABEL_GAP;
    return target;
  }
  _box.getCenter(_center);
  target.set(_center.x, _box.max.y + TAG_LABEL_GAP, _center.z);
  return target;
}

export function meshAabbWorld(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  box.makeEmpty();
  root.traverse((child) => {
    if (isCss2d(child) || child.userData.isLabel) return;
    if (!isEquipMesh(child)) return;
    _meshBox.setFromObject(child, true);
    if (!_meshBox.isEmpty()) box.union(_meshBox);
  });
  return box;
}

/**
 * Write AABB top-center into the CSS2D object's **world** position.
 * Parent must be a scene-level identity group (not the equipment).
 */
export function syncCss2dTagLabel(label: CSS2DObject, equipment: THREE.Object3D): void {
  meshAabbTopCenterWorld(equipment, label.position);
  const parent = label.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.worldToLocal(label.position);
  }
  label.updateMatrixWorld(true);
}

export function makeCss2dTagLabel(tag: string): CSS2DObject {
  const el = document.createElement('div');
  el.textContent = tag;
  el.title = tag;
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.style.pointerEvents = 'auto';
  el.style.cursor = 'pointer';
  el.style.color = '#f8fafc';
  el.style.fontFamily = 'Consolas, monospace';
  el.style.padding = '1px 5px';
  el.style.borderRadius = '2px';
  el.style.whiteSpace = 'nowrap';
  el.style.lineHeight = '1.2';
  el.style.userSelect = 'none';
  styleCss2dTagLabel(el, false);

  const obj = new CSS2DObject(el);
  obj.name = `${tag}::label`;
  obj.userData.tag = tag;
  obj.userData.isLabel = true;
  obj.userData.pickable = false;
  obj.center.set(0.5, 1);
  return obj;
}

export function disposeCss2dLabels(root: THREE.Object3D): void {
  const doomed: CSS2DObject[] = [];
  root.traverse((o) => {
    if (isCss2d(o)) doomed.push(o);
  });
  for (const o of doomed) {
    o.element.remove();
    o.parent?.remove(o);
  }
}

export function labelFromEquipment(obj: THREE.Object3D | undefined): CSS2DObject | null {
  const label = obj?.userData.tagLabel;
  return isCss2d(label) ? label : null;
}
