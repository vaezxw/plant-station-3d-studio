import { useEffect, useRef, useState, type FC } from 'react';
import {
  Box,
  Cable,
  Eye,
  Grid,
  Layers,
  Play,
  Pause,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getCatalogItem, type CatalogKind } from '../../domain/catalog';
import {
  disposeAssetObject,
  extractObjectPorts,
  instantiateAssetObject,
  preloadAllAssets,
  subscribeAssets,
} from '../../engine/AssetManager';
import { createIndustrialEnvTexture } from '../../engine/MaterialLibrary';

type Props = {
  kind: CatalogKind | 'CUSTOM_GLB';
  customGlbId?: string;
  customName?: string;
  onClose: () => void;
  onCreateProjectWithAsset?: () => void;
};

const SingleAssetViewer: FC<Props> = ({
  kind,
  customGlbId,
  customName,
  onClose,
  onCreateProjectWithAsset,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const camActionRef = useRef<((view: 'iso' | 'top' | 'front') => void) | null>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [showPedestal, setShowPedestal] = useState(true);
  const [showPorts, setShowPorts] = useState(true);
  const [showWireframe, setShowWireframe] = useState(false);
  const [dimensions, setDimensions] = useState<{ w: number; h: number; d: number } | null>(null);
  const [ports, setPorts] = useState<{ id: string; pos: [number, number, number] }[]>([]);

  const itemMeta = kind !== 'CUSTOM_GLB' ? getCatalogItem(kind) : undefined;
  const displayTitle = customName ?? itemMeta?.labelZh ?? kind;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const showPedestalRef = useRef(showPedestal);
  showPedestalRef.current = showPedestal;
  const showPortsRef = useRef(showPorts);
  showPortsRef.current = showPorts;
  const showWireframeRef = useRef(showWireframe);
  showWireframeRef.current = showWireframe;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    preloadAllAssets();

    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070c18);
    scene.fog = new THREE.FogExp2(0x070c18, 0.025);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = createIndustrialEnvTexture(renderer, pmrem);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.15;

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x162030, 0.6));
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.2);
    keyLight.position.set(6, 11, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fillLight.position.set(-6, 2, 7);
    scene.add(fillLight);

    // 工业圆形展台 + 网格
    const pedestalGroup = new THREE.Group();
    const grid = new THREE.GridHelper(18, 18, 0x243b61, 0x132038);
    grid.position.y = -0.01;
    pedestalGroup.add(grid);

    const baseGeo = new THREE.CylinderGeometry(2.2, 2.35, 0.12, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.72,
      roughness: 0.36,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.07;
    baseMesh.receiveShadow = true;
    pedestalGroup.add(baseMesh);

    const ringGeo = new THREE.RingGeometry(2.22, 2.27, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -0.004;
    pedestalGroup.add(ringMesh);
    scene.add(pedestalGroup);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = 0.6;
    orbit.maxDistance = 30;

    const pivot = new THREE.Group();
    scene.add(pivot);
    const portsGroup = new THREE.Group();
    pivot.add(portsGroup);

    let assetObj: THREE.Object3D | null = null;
    let boxHelper: THREE.BoxHelper | null = null;
    let frameRadius = 2.4;
    let centerY = 0.6;

    const buildModel = () => {
      if (assetObj) {
        pivot.remove(assetObj);
        disposeAssetObject(assetObj);
        assetObj = null;
      }
      if (boxHelper) {
        scene.remove(boxHelper);
        boxHelper.dispose();
        boxHelper = null;
      }
      while (portsGroup.children.length > 0) {
        const ch = portsGroup.children[0] as THREE.Mesh;
        portsGroup.remove(ch);
        ch.geometry.dispose();
        (ch.material as THREE.Material).dispose();
      }

      const obj = instantiateAssetObject(kind, {
        nodeId: '__single_preview__',
        tag: itemMeta?.tagPrefix ?? 'EQ',
        customGlbId,
        labelText: displayTitle,
        section: itemMeta?.defaultSection ?? '独立检视',
      });
      assetObj = obj;

      // 居中并贴地（min.y = 0）
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      if (!box.isEmpty()) {
        box.getSize(size);
        box.getCenter(center);
        obj.position.x -= center.x;
        obj.position.z -= center.z;
        obj.position.y -= box.min.y;
        setDimensions({
          w: Number(size.x.toFixed(2)),
          h: Number(size.y.toFixed(2)),
          d: Number(size.z.toFixed(2)),
        });
        frameRadius = Math.max(size.length() * 0.68, 1.35);
        centerY = size.y * 0.48;
      }

      pivot.add(obj);

      boxHelper = new THREE.BoxHelper(obj, 0x38bdf8);
      boxHelper.visible = showWireframeRef.current;
      scene.add(boxHelper);

      const extracted = extractObjectPorts(obj);
      setPorts(
        extracted.map((p) => ({
          id: p.id,
          pos: [
            Number(p.localPos.x.toFixed(2)),
            Number(p.localPos.y.toFixed(2)),
            Number(p.localPos.z.toFixed(2)),
          ],
        })),
      );
      for (const ep of extracted) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
        );
        marker.position.set(
          ep.localPos.x + obj.position.x,
          ep.localPos.y + obj.position.y,
          ep.localPos.z + obj.position.z,
        );
        portsGroup.add(marker);
      }

      const scaleBase = Math.max(1, frameRadius / 2.2);
      pedestalGroup.scale.setScalar(scaleBase);

      orbit.target.set(0, centerY, 0);
      camera.position.set(frameRadius * 1.4, centerY + frameRadius * 0.8, frameRadius * 1.6);
      orbit.update();
    };

    buildModel();
    const unsubAssets = subscribeAssets(buildModel);

    camActionRef.current = (view) => {
      orbit.target.set(0, centerY, 0);
      if (view === 'iso') {
        camera.position.set(frameRadius * 1.4, centerY + frameRadius * 0.8, frameRadius * 1.6);
      } else if (view === 'top') {
        camera.position.set(0, centerY + frameRadius * 2.1, 0.01);
      } else if (view === 'front') {
        camera.position.set(0, centerY + frameRadius * 0.15, frameRadius * 2.1);
      }
      orbit.update();
    };

    const ro = new ResizeObserver(() => {
      const nw = Math.max(1, host.clientWidth);
      const nh = Math.max(1, host.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(host);

    let disposed = false;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (autoRotateRef.current) {
        pivot.rotation.y += 0.45 * dt;
      }
      pedestalGroup.visible = showPedestalRef.current;
      portsGroup.visible = showPortsRef.current;
      if (boxHelper) {
        boxHelper.visible = showWireframeRef.current;
        if (assetObj && showWireframeRef.current) boxHelper.update();
      }
      orbit.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      camActionRef.current = null;
      cancelAnimationFrame(raf);
      unsubAssets();
      ro.disconnect();
      orbit.dispose();
      if (assetObj) disposeAssetObject(assetObj);
      if (boxHelper) boxHelper.dispose();
      grid.dispose();
      baseGeo.dispose();
      baseMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [kind, customGlbId, displayTitle, itemMeta]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center select-none">
      <div className="w-full max-w-6xl h-[86vh] studio-glass rounded-2xl border border-border-strong shadow-2xl flex flex-col overflow-hidden">
        {/* 头部控制栏 */}
        <div className="h-12 px-4 border-b border-border-subtle bg-bg-elevated flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Box className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm font-bold text-text-primary truncate">{displayTitle}</span>
            <span className="px-2 py-0.5 rounded bg-accent/15 text-accent font-mono text-[10px] shrink-0">
              {kind}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(['iso', 'top', 'front'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => camActionRef.current?.(v)}
                className="h-7 px-2.5 rounded-lg border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary transition"
              >
                {v === 'iso' ? '等轴' : v === 'top' ? '顶视' : '正视'}
              </button>
            ))}
            <div className="w-px h-4 bg-border-subtle mx-0.5" />
            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              className={`h-7 px-2.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                autoRotate
                  ? 'bg-accent-soft border-border-strong text-accent'
                  : 'border-border-subtle bg-bg-canvas/70 text-text-secondary'
              }`}
            >
              {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {autoRotate ? '暂停自转' : '开启自转'}
            </button>
            <button
              type="button"
              onClick={() => setShowPorts((v) => !v)}
              className={`h-7 px-2.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                showPorts
                  ? 'bg-accent-soft border-border-strong text-accent'
                  : 'border-border-subtle bg-bg-canvas/70 text-text-secondary'
              }`}
            >
              <Cable className="w-3 h-3" /> 管口锚点
            </button>
            <button
              type="button"
              onClick={() => setShowWireframe((v) => !v)}
              className={`h-7 px-2.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                showWireframe
                  ? 'bg-accent-soft border-border-strong text-accent'
                  : 'border-border-subtle bg-bg-canvas/70 text-text-secondary'
              }`}
            >
              <Eye className="w-3 h-3" /> 包络框
            </button>
            <button
              type="button"
              onClick={() => setShowPedestal((v) => !v)}
              className={`h-7 px-2.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                showPedestal
                  ? 'bg-accent-soft border-border-strong text-accent'
                  : 'border-border-subtle bg-bg-canvas/70 text-text-secondary'
              }`}
            >
              <Grid className="w-3 h-3" /> 展台
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"
              title="关闭独立 3D 检视"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主体：左 3D 渲染空间 + 右规格详情 */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 relative bg-slate-950">
            <div ref={hostRef} className="w-full h-full" />
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full studio-glass text-[11px] text-text-secondary font-mono pointer-events-none">
              左键 360° 旋转 · 滚轮缩放 · 右键平移 · 独立 3D 空间渲染
            </div>
          </div>

          <aside className="w-72 shrink-0 border-l border-border-subtle bg-bg-panel p-4 flex flex-col justify-between gap-4 overflow-y-auto text-xs">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                  设备组件参数
                </div>
                <div className="text-base font-bold text-text-primary">{displayTitle}</div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {itemMeta?.description ?? '用户上传的自定义工业 GLB 三维设备模型，支持直接放置与连管。'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-bg-canvas/70 border border-border-subtle">
                  <div className="text-[10px] text-text-muted">位号前缀</div>
                  <div className="font-mono font-bold text-accent mt-0.5">{itemMeta?.tagPrefix ?? 'IMP'}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-bg-canvas/70 border border-border-subtle">
                  <div className="text-[10px] text-text-muted">默认工段</div>
                  <div className="font-medium text-text-primary mt-0.5 truncate">
                    {itemMeta?.defaultSection ?? '自定义模型'}
                  </div>
                </div>
              </div>

              {dimensions ? (
                <div className="p-3 rounded-xl bg-bg-canvas/70 border border-border-subtle space-y-1">
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    <Layers className="w-3 h-3 text-accent" /> 三维包围盒尺寸 (L × H × D)
                  </div>
                  <div className="font-mono text-xs text-text-primary">
                    {dimensions.w}m × {dimensions.h}m × {dimensions.d}m
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-accent flex items-center justify-between">
                  <span>可连管口坐标锚点 ({ports.length})</span>
                  <RotateCcw
                    className="w-3 h-3 cursor-pointer text-text-muted hover:text-text-primary"
                    onClick={() => camActionRef.current?.('iso')}
                  />
                </div>
                {ports.length === 0 ? (
                  <div className="p-2.5 rounded-xl bg-bg-canvas/50 border border-border-subtle text-[11px] text-text-muted">
                    该组件为非管道接口设备或暂未定义管口锚点。
                  </div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {ports.map((p) => (
                      <div
                        key={p.id}
                        className="px-2.5 py-1.5 rounded-lg bg-bg-canvas/65 border border-border-subtle flex items-center justify-between font-mono text-[10px]"
                      >
                        <span className="text-cyan-300 font-semibold">{p.id}</span>
                        <span className="text-text-muted">
                          [{p.pos[0]}, {p.pos[1]}, {p.pos[2]}]
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {onCreateProjectWithAsset ? (
              <button
                type="button"
                onClick={onCreateProjectWithAsset}
                className="w-full h-9 rounded-xl bg-accent hover:brightness-110 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg transition shrink-0"
              >
                <Plus className="w-4 h-4" /> 以此设备新建厂站工程
              </button>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SingleAssetViewer;
