import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CatalogKind } from '../domain/catalog';
import { disposeAssetObject, instantiateAssetObject, subscribeAssets } from './AssetManager';

export const THUMB_WIDTH = 160;
export const THUMB_HEIGHT = 112;

class ThumbnailHub {
  private renderer: THREE.WebGLRenderer;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cache = new Map<CatalogKind, string>();
  private listeners = new Set<() => void>();

  private hoverState: {
    kind: CatalogKind;
    ctx: CanvasRenderingContext2D;
    root: THREE.Object3D;
    center: THREE.Vector3;
    radius: number;
    angle: number;
    raf: number;
    lastTime: number;
  } | null = null;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(THUMB_WIDTH, THUMB_HEIGHT, false);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(new RoomEnvironment(), 0.04);

    this.scene = new THREE.Scene();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.95;

    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65));
    const key = new THREE.DirectionalLight(0xfff7ed, 1.7);
    key.position.set(2.5, 4.0, 2.8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.65);
    rim.position.set(-2.5, 1.5, -2.0);
    this.scene.add(rim);

    this.camera = new THREE.PerspectiveCamera(34, THUMB_WIDTH / THUMB_HEIGHT, 0.05, 60);

    subscribeAssets(() => {
      this.cache.clear();
      if (this.hoverState) {
        const { kind, ctx } = this.hoverState;
        this.stopHover();
        this.startHover(kind, ctx);
      }
      for (const fn of this.listeners) fn();
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private frameObject(obj: THREE.Object3D): { center: THREE.Vector3; radius: number } {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    if (box.isEmpty()) {
      return { center: new THREE.Vector3(), radius: 1 };
    }
    box.getSize(size);
    box.getCenter(center);
    // 将物体以中心对准旋转原点
    obj.position.sub(center);
    const radius = Math.max(size.length() * 0.52, 0.35);
    this.camera.position.set(radius * 1.45, radius * 0.92, radius * 1.65);
    this.camera.near = Math.max(0.02, radius * 0.05);
    this.camera.far = radius * 24;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    return { center: new THREE.Vector3(0, 0, 0), radius };
  }

  getThumbnail(kind: CatalogKind): string {
    const cached = this.cache.get(kind);
    if (cached) return cached;

    const pivot = new THREE.Group();
    const obj = instantiateAssetObject(kind, {
      nodeId: `__thumb_${kind}`,
      tag: kind,
    });
    pivot.add(obj);
    const { radius } = this.frameObject(obj);
    void radius;
    pivot.rotation.y = 0.25;

    this.scene.add(pivot);
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(pivot);
    disposeAssetObject(obj);

    this.cache.set(kind, dataUrl);
    return dataUrl;
  }

  startHover(kind: CatalogKind, ctx: CanvasRenderingContext2D) {
    this.stopHover();
    const pivot = new THREE.Group();
    const obj = instantiateAssetObject(kind, {
      nodeId: `__hover_${kind}`,
      tag: kind,
    });
    pivot.add(obj);
    const { center, radius } = this.frameObject(obj);
    this.scene.add(pivot);

    const state = {
      kind,
      ctx,
      root: pivot,
      center,
      radius,
      angle: 0.25,
      raf: 0,
      lastTime: performance.now(),
    };
    this.hoverState = state;

    const tick = (now: number) => {
      if (this.hoverState !== state) return;
      const dt = Math.min(0.05, (now - state.lastTime) / 1000);
      state.lastTime = now;
      state.angle += 1.45 * dt;
      state.root.rotation.y = state.angle;
      this.renderer.render(this.scene, this.camera);
      state.ctx.clearRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      state.ctx.drawImage(this.renderer.domElement, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }

  stopHover() {
    if (!this.hoverState) return;
    cancelAnimationFrame(this.hoverState.raf);
    this.scene.remove(this.hoverState.root);
    disposeAssetObject(this.hoverState.root);
    this.hoverState = null;
  }
}

let hub: ThumbnailHub | null = null;

export function getThumbnailHub(): ThumbnailHub {
  if (!hub) hub = new ThumbnailHub();
  return hub;
}
