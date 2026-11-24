import { useEffect, useRef, type CSSProperties, type FC, type PointerEvent } from 'react';
import * as THREE from 'three';
import { installStudioPbr } from '../studioPbr';
import { syncLine2Resolution } from './annotationLines';
import { buildCatalogMesh } from './meshes';
import { preloadCatalogGlbs, subscribeGlbCatalog } from './glbCatalog';
import type { CatalogKind } from './types';

const THUMB_W = 72;
const THUMB_H = 56;
const IDLE_SPEED = 0.45;
const HOVER_SPEED = 1.65;

type ThumbSlot = {
  kind: CatalogKind;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hovered: boolean;
  visible: boolean;
  angle: number;
};

let hub: ThumbHub | null = null;

class ThumbHub {
  private renderer: THREE.WebGLRenderer;
  private uninstallPbr: () => void;
  private scenes = new Map<
    CatalogKind,
    { scene: THREE.Scene; camera: THREE.PerspectiveCamera; root: THREE.Object3D }
  >();
  private slots = new Set<ThumbSlot>();
  private raf = 0;
  private last = performance.now();
  private running = false;
  private envScene: THREE.Scene;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.setSize(THUMB_W, THUMB_H, false);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x0b1220, 1);
    this.envScene = new THREE.Scene();
    this.uninstallPbr = installStudioPbr(this.renderer, this.envScene);
  }

  add(slot: ThumbSlot) {
    this.slots.add(slot);
    this.ensureKind(slot.kind);
    this.start();
  }

  remove(slot: ThumbSlot) {
    this.slots.delete(slot);
    if (this.slots.size === 0) this.stop();
  }

  invalidate(kind?: CatalogKind) {
    if (kind) this.scenes.delete(kind);
    else this.scenes.clear();
    for (const slot of this.slots) {
      if (!kind || slot.kind === kind) this.ensureKind(slot.kind);
    }
  }

  private ensureKind(kind: CatalogKind) {
    if (this.scenes.has(kind)) return;
    const scene = new THREE.Scene();
    scene.environment = this.envScene.environment;
    scene.add(new THREE.HemisphereLight(0xc9d6e3, 0x1e293b, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.35);
    key.position.set(0.6, 0.8, 0.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fill.position.set(-0.5, 0.2, -0.3);
    scene.add(fill);

    const root = buildCatalogMesh(kind);
    syncLine2Resolution(root, THUMB_W, THUMB_H);
    scene.add(root);

    const camera = new THREE.PerspectiveCamera(32, THUMB_W / THUMB_H, 0.05, 40);
    frameCamera(camera, root);
    this.scenes.set(kind, { scene, camera, root });
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.render(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private render(dt: number) {
    for (const slot of this.slots) {
      if (!slot.visible) continue;
      const entry = this.scenes.get(slot.kind);
      if (!entry) continue;
      const speed = slot.hovered ? HOVER_SPEED : IDLE_SPEED;
      slot.angle += speed * dt;
      entry.root.rotation.y = slot.angle;
      this.renderer.render(entry.scene, entry.camera);
      slot.ctx.clearRect(0, 0, THUMB_W, THUMB_H);
      slot.ctx.drawImage(this.renderer.domElement, 0, 0, THUMB_W, THUMB_H);
    }
  }

  dispose() {
    this.stop();
    this.uninstallPbr();
    this.renderer.dispose();
  }
}

function frameCamera(camera: THREE.PerspectiveCamera, obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const radius = Math.max(size.x, size.y, size.z, 0.2) * 0.72;
  camera.position.set(center.x + radius * 1.35, center.y + radius * 0.7, center.z + radius * 1.45);
  camera.near = Math.max(0.02, radius / 40);
  camera.far = radius * 24;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function getHub(): ThumbHub {
  if (!hub) hub = new ThumbHub();
  return hub;
}

type Props = {
  kind: CatalogKind;
  style?: CSSProperties;
};

/**
 * 共享 WebGL 的目录缩略图：慢速自转，悬停加速。GLB 优先，否则 meshes 原语。
 */
const CatalogThumb: FC<Props> = ({ kind, style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef<ThumbSlot | null>(null);

  useEffect(() => {
    void preloadCatalogGlbs();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const slot: ThumbSlot = {
      kind,
      canvas,
      ctx,
      hovered: false,
      visible: true,
      angle: Math.random() * 0.6,
    };
    slotRef.current = slot;
    const h = getHub();
    h.add(slot);
    const unsub = subscribeGlbCatalog(() => h.invalidate(kind));
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                slot.visible = entry.isIntersecting;
              }
            },
            { threshold: 0.01 },
          )
        : null;
    io?.observe(canvas);
    return () => {
      io?.disconnect();
      unsub();
      h.remove(slot);
      slotRef.current = null;
    };
  }, [kind]);

  const onEnter = () => {
    if (slotRef.current) slotRef.current.hovered = true;
  };
  const onLeave = () => {
    if (slotRef.current) slotRef.current.hovered = false;
  };
  const ignore = (e: PointerEvent) => {
    // 拖放由外层按钮处理；避免 canvas 抢走 pointer
    void e;
  };

  return (
    <span style={{ ...wrap, ...style }} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <canvas
        ref={canvasRef}
        width={THUMB_W}
        height={THUMB_H}
        style={canvasStyle}
        onPointerDown={ignore}
      />
    </span>
  );
};

const wrap: CSSProperties = {
  position: 'relative',
  display: 'block',
  width: THUMB_W,
  height: THUMB_H,
  borderRadius: 3,
  overflow: 'hidden',
  background: 'radial-gradient(ellipse at 40% 30%, #1e3a5f 0%, #0b1220 75%)',
};

const canvasStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'block',
  width: THUMB_W,
  height: THUMB_H,
  pointerEvents: 'none',
};

export default CatalogThumb;
