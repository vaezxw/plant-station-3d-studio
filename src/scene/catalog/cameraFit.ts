import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Half-height of the ortho frustum at zoom 1 (world metres). */
export const ORTHO_FRUSTUM = 7.2;
export const ORTHO_MIN_ZOOM = 0.45;
/** ~0.4 m valve fills ≥70% of the short side: 14.4 * 0.8 / 0.4 = 28.8 */
export const ORTHO_MAX_ZOOM = 30;
const FIT_PADDING = 1.45;
const ISO_DIR = new THREE.Vector3(0.55, 1.0, 0.68).normalize();

/**
 * Frame one catalog object in the ortho camera (1.3–1.6 padding).
 * Does not change world scale of the mesh.
 */
export function fitOrthoToObject(
  camera: THREE.OrthographicCamera,
  controls: OrbitControls,
  obj: THREE.Object3D,
  padding = FIT_PADDING,
): void {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const span = Math.max(size.x, size.y, size.z, 0.08) * padding;
  const heightAtZoom1 = 2 * ORTHO_FRUSTUM;
  camera.zoom = THREE.MathUtils.clamp(heightAtZoom1 / span, ORTHO_MIN_ZOOM, ORTHO_MAX_ZOOM);
  camera.updateProjectionMatrix();
  camera.position.copy(center).addScaledVector(ISO_DIR, 10);
  controls.target.copy(center);
  controls.update();
}

export function buildScaleGrid(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'scale-grid';
  const minor = new THREE.GridHelper(12, 120, 0x3d4a5c, 0x3d4a5c);
  minor.userData.pickable = false;
  const minMat = minor.material;
  if (!Array.isArray(minMat)) {
    minMat.transparent = true;
    minMat.opacity = 0.16;
  }
  const major = new THREE.GridHelper(12, 12, 0x64748b, 0x4b5568);
  major.userData.pickable = false;
  const majMat = major.material;
  if (!Array.isArray(majMat)) {
    majMat.transparent = true;
    majMat.opacity = 0.4;
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  ground.userData.pickable = false;
  ground.name = 'scale-ground';
  g.add(minor, major, ground);
  g.userData.pickable = false;
  return g;
}
