import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * 与独立涡喷画布相同的 IBL：高金属度 GLB 没有 environment 会渲染成黑块。
 */
export function installStudioPbr(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): () => void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const hemi = new THREE.HemisphereLight(0xc9d6e3, 0x1e293b, 0.55);
  hemi.name = 'studio-hemi';
  scene.add(hemi);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const key = new THREE.DirectionalLight(0xfff4e6, 1.45);
  key.name = 'studio-key';
  key.position.set(4.5, 8.0, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.2;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x93c5fd, 0.4);
  fill.name = 'studio-fill';
  fill.position.set(-0.5, 0.2, -0.3);
  scene.add(fill);

  return () => {
    if (scene.environment === envTex) scene.environment = null;
    envTex.dispose();
    pmrem.dispose();
    hemi.parent?.remove(hemi);
    key.parent?.remove(key);
    fill.parent?.remove(fill);
  };
}
