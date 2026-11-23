import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/** World-space annotation tube radius (not DN100). */
export const ANNOTATION_TUBE_R = 0.012;
export const ANNOTATION_LENGTH = 1.0;
/** Screen-space Line2 width in CSS pixels. */
export const ANNOTATION_LINE_PX = 3;

const SOLID = 0x4b5563;
const DASHED = 0x64748b;

function lineMaterial(color: number, dashed: boolean): LineMaterial {
  const mat = new LineMaterial({
    color,
    linewidth: ANNOTATION_LINE_PX,
    dashed,
    dashSize: 0.08,
    gapSize: 0.045,
    worldUnits: false,
    alphaToCoverage: true,
  });
  mat.resolution.set(1, 1);
  return mat;
}

/**
 * Industrial annotation segment: volume tube + Line2 (stable width).
 * Dashed uses world-length dashes on both the Line2 and a segmented tube.
 */
export function buildAnnotationLine(dashed: boolean): THREE.Group {
  const g = new THREE.Group();
  const color = dashed ? DASHED : SOLID;
  const half = ANNOTATION_LENGTH * 0.5;
  const paint = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.15,
    roughness: 0.45,
  });

  if (dashed) {
    const dash = 0.08;
    const gap = 0.045;
    const pitch = dash + gap;
    let i = 0;
    for (let x = -half; x < half - 1e-4; x += pitch) {
      const x1 = Math.min(x + dash, half);
      if (x1 <= x) continue;
      const len = x1 - x;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(ANNOTATION_TUBE_R, ANNOTATION_TUBE_R, len, 10),
        paint,
      );
      mesh.rotation.z = Math.PI / 2;
      mesh.position.x = x + len * 0.5;
      if (i === 2) mesh.name = 'body-core';
      mesh.userData.pickable = false;
      g.add(mesh);
      i += 1;
    }
  } else {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(ANNOTATION_TUBE_R, ANNOTATION_TUBE_R, ANNOTATION_LENGTH, 12),
      paint,
    );
    tube.rotation.z = Math.PI / 2;
    tube.name = 'body-core';
    tube.userData.pickable = false;
    g.add(tube);
  }

  if (!g.getObjectByName('body-core') && g.children[0]) {
    g.children[0].name = 'body-core';
  }

  const geom = new LineGeometry();
  geom.setPositions([-half, 0, 0, half, 0, 0]);
  const line = new Line2(geom, lineMaterial(color, dashed));
  line.computeLineDistances();
  line.name = dashed ? 'annotation-line-dashed' : 'annotation-line-solid';
  line.userData.pickable = false;
  g.add(line);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(ANNOTATION_TUBE_R * 2.2, 0.04, 10),
    paint,
  );
  cone.rotation.z = -Math.PI / 2;
  cone.position.x = half + 0.02;
  g.add(cone);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(ANNOTATION_TUBE_R * 1.6, 10, 8), paint);
  dot.position.x = -half;
  g.add(dot);

  g.userData.annotationLine = true;
  return g;
}

export function syncLine2Resolution(root: THREE.Object3D, width: number, height: number): void {
  root.traverse((obj) => {
    const line = obj as Line2;
    if (!line.isLine2) return;
    const mat = line.material as LineMaterial;
    mat.resolution.set(Math.max(1, width), Math.max(1, height));
  });
}
