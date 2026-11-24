import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function exportGroupToGlb(
  exportRoot: THREE.Object3D,
  filename = 'plant-station.glb',
): Promise<void> {
  const exporter = new GLTFExporter();
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      exportRoot,
      (res) => {
        if (res instanceof ArrayBuffer) resolve(res);
        else reject(new Error('导出格式非二进制 GLB'));
      },
      (err) => reject(err),
      { binary: true },
    );
  });

  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
  a.click();
  URL.revokeObjectURL(url);
}
