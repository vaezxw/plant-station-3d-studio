import { useEffect, useMemo, useRef, type FC } from 'react';
import * as THREE from 'three';
import type { CatalogKind } from '../../domain/catalog';
import { resolveThemeById } from '../../domain/themes';
import {
  disposeAssetObject,
  instantiateAssetObject,
  preloadAllAssets,
  subscribeAssets,
} from '../../engine/AssetManager';
import { createIndustrialEnvTexture } from '../../engine/MaterialLibrary';
import { useEditorStore } from '../../store/useEditorStore';

type SceneThemeHandles = {
  scene: THREE.Scene;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  warmLight: THREE.PointLight;
  ringMat: THREE.MeshBasicMaterial;
  innerRingMat: THREE.MeshBasicMaterial;
  pMat: THREE.PointsMaterial;
  gridRef: { current: THREE.GridHelper | null };
};

/** 登录页全屏底层 3D 数字孪生全景动画场景（随全局主题实时换色） */
const LoginHero3DCanvas: FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<SceneThemeHandles | null>(null);

  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);
  const activeTheme = useMemo(
    () => resolveThemeById(themeId, customThemes),
    [themeId, customThemes],
  );
  const initialThemeRef = useRef(activeTheme);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    preloadAllAssets();

    const initT = initialThemeRef.current;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initT.scene3d.background);
    scene.fog = new THREE.FogExp2(initT.scene3d.fogColor, initT.mode === 'light' ? 0.014 : 0.032);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(8.5, 4.6, 9.2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = createIndustrialEnvTexture(renderer, pmrem);
    scene.environment = envRT.texture;
    scene.environmentIntensity = initT.scene3d.envIntensity;

    // 工业科技灯光布局
    const hemiLight = new THREE.HemisphereLight(
      initT.mode === 'light' ? 0xffffff : 0x93c5fd,
      initT.mode === 'light' ? 0x94a3b8 : 0x0f172a,
      initT.mode === 'light' ? 0.95 : 0.65,
    );
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.0);
    keyLight.position.set(9, 14, 8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(new THREE.Color(initT.tokens.accent), 1.3);
    rimLight.position.set(-10, 6, -8);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(new THREE.Color(initT.tokens.accent), 12, 22);
    warmLight.position.set(0, 3.5, 0);
    scene.add(warmLight);

    // 科技透视网格地面
    const initialGrid = new THREE.GridHelper(
      34,
      34,
      new THREE.Color(initT.scene3d.gridPrimary),
      new THREE.Color(initT.scene3d.gridSecondary),
    );
    initialGrid.position.y = -0.02;
    scene.add(initialGrid);
    const gridRef = { current: initialGrid as THREE.GridHelper | null };

    const ringGeo = new THREE.RingGeometry(4.4, 4.46, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(initT.tokens.accent),
      transparent: true,
      opacity: initT.mode === 'light' ? 0.45 : 0.35,
      side: THREE.DoubleSide,
    });
    const outerRing = new THREE.Mesh(ringGeo, ringMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.01;
    scene.add(outerRing);

    const innerRingGeo = new THREE.RingGeometry(2.6, 2.64, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(initT.tokens.accent),
      transparent: true,
      opacity: initT.mode === 'light' ? 0.35 : 0.26,
      side: THREE.DoubleSide,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.01;
    scene.add(innerRing);

    // 悬浮微尘科技粒子
    const particleCount = 120;
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 20;
      pPositions[i * 3 + 1] = Math.random() * 6 + 0.3;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: new THREE.Color(initT.tokens.accent),
      size: 0.06,
      transparent: true,
      opacity: initT.mode === 'light' ? 0.42 : 0.55,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    handlesRef.current = {
      scene,
      hemiLight,
      rimLight,
      warmLight,
      ringMat,
      innerRingMat,
      pMat,
      gridRef,
    };

    // 核心微缩工艺厂站设备组
    const stationGroup = new THREE.Group();
    scene.add(stationGroup);

    const layoutSpecs: { kind: CatalogKind; pos: [number, number, number]; rotY: number; scale: number }[] = [
      { kind: 'TANK', pos: [-2.3, 0, -1.3], rotY: 0.3, scale: 1.05 },
      { kind: 'WATER_PUMP', pos: [0.1, 0, 0.9], rotY: Math.PI * 0.25, scale: 1.15 },
      { kind: 'HEAT_EXCHANGER', pos: [2.1, 0, -0.5], rotY: -0.4, scale: 1.1 },
      { kind: 'HENG_GUANG_SKID', pos: [-0.4, 0, -2.5], rotY: 0, scale: 0.9 },
      { kind: 'BESS', pos: [2.5, 0, 2.1], rotY: -0.8, scale: 0.85 },
    ];

    const rebuildModels = () => {
      while (stationGroup.children.length > 0) {
        const ch = stationGroup.children[0];
        stationGroup.remove(ch);
        disposeAssetObject(ch);
      }
      for (const spec of layoutSpecs) {
        const obj = instantiateAssetObject(spec.kind, {
          nodeId: `hero_${spec.kind}`,
          tag: spec.kind,
        });
        obj.position.set(...spec.pos);
        obj.rotation.y = spec.rotY;
        obj.scale.setScalar(spec.scale);
        stationGroup.add(obj);
      }
    };
    rebuildModels();
    const unsubAssets = subscribeAssets(rebuildModels);

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
    const start = performance.now();
    const animate = (now: number) => {
      if (disposed) return;
      const t = (now - start) / 1000;
      const angle = t * 0.14;
      camera.position.set(Math.cos(angle) * 9.8, 4.1 + Math.sin(t * 0.3) * 0.35, Math.sin(angle) * 9.8);
      camera.lookAt(1.6, 0.85, 0);
      particles.rotation.y = t * 0.03;
      outerRing.rotation.z = t * 0.12;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      unsubAssets();
      ro.disconnect();
      handlesRef.current = null;
      while (stationGroup.children.length > 0) {
        const ch = stationGroup.children[0];
        stationGroup.remove(ch);
        disposeAssetObject(ch);
      }
      gridRef.current?.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      pGeo.dispose();
      pMat.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 主题变化时实时平滑刷新 3D 场景配色（不销毁重建 WebGL）
  useEffect(() => {
    const h = handlesRef.current;
    if (!h) return;
    h.scene.background = new THREE.Color(activeTheme.scene3d.background);
    h.scene.fog = new THREE.FogExp2(
      activeTheme.scene3d.fogColor,
      activeTheme.mode === 'light' ? 0.014 : 0.032,
    );
    h.scene.environmentIntensity = activeTheme.scene3d.envIntensity;

    const accentColor = new THREE.Color(activeTheme.tokens.accent);
    h.rimLight.color.copy(accentColor);
    h.warmLight.color.copy(accentColor);
    h.ringMat.color.copy(accentColor);
    h.ringMat.opacity = activeTheme.mode === 'light' ? 0.45 : 0.35;
    h.innerRingMat.color.copy(accentColor);
    h.innerRingMat.opacity = activeTheme.mode === 'light' ? 0.35 : 0.26;
    h.pMat.color.copy(accentColor);
    h.pMat.opacity = activeTheme.mode === 'light' ? 0.42 : 0.55;

    h.hemiLight.color.setHex(activeTheme.mode === 'light' ? 0xffffff : 0x93c5fd);
    h.hemiLight.groundColor.setHex(activeTheme.mode === 'light' ? 0x94a3b8 : 0x0f172a);
    h.hemiLight.intensity = activeTheme.mode === 'light' ? 0.95 : 0.65;

    if (h.gridRef.current) {
      h.scene.remove(h.gridRef.current);
      h.gridRef.current.dispose();
    }
    const nextGrid = new THREE.GridHelper(
      34,
      34,
      new THREE.Color(activeTheme.scene3d.gridPrimary),
      new THREE.Color(activeTheme.scene3d.gridSecondary),
    );
    nextGrid.position.y = -0.02;
    h.scene.add(nextGrid);
    h.gridRef.current = nextGrid;
  }, [activeTheme]);

  return <div ref={hostRef} className="fixed inset-0 pointer-events-none z-0" />;
};

export default LoginHero3DCanvas;
