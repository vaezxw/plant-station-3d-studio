import * as THREE from 'three';
import type { GroundStyle } from '../domain/schema';

let brushedBumpTex: THREE.CanvasTexture | null = null;
let brushedRoughTex: THREE.CanvasTexture | null = null;
let castIronBumpTex: THREE.CanvasTexture | null = null;
let perforatedMaps: { alpha: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
let hxPlateMaps: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
let concretePlinthMaps: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture; rough: THREE.CanvasTexture } | null = null;
const groundTextureCache = new Map<
  GroundStyle,
  { map: THREE.CanvasTexture; bump: THREE.CanvasTexture; rough: THREE.CanvasTexture }
>();

let diamondPlateTex: THREE.CanvasTexture | null = null;
let hazardTex: THREE.CanvasTexture | null = null;
let dialTex: THREE.CanvasTexture | null = null;
let screenTex: THREE.CanvasTexture | null = null;
let meterCounterTex: THREE.CanvasTexture | null = null;
let nameplateTex: THREE.CanvasTexture | null = null;

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function getBrushedMetalMaps(): { bump: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  if (brushedBumpTex && brushedRoughTex) {
    return { bump: brushedBumpTex, rough: brushedRoughTex };
  }
  const rand = makePrng(104729);
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rctx = roughCanvas.getContext('2d')!;

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  rctx.fillStyle = '#484848';
  rctx.fillRect(0, 0, 256, 256);

  // 精细横向金属拉丝纹理（带细腻明暗丝）
  for (let y = 0; y < 256; y++) {
    const streak = Math.sin(y * 1.9) * 14 + (rand() - 0.5) * 32;
    const bv = Math.max(40, Math.min(220, Math.floor(128 + streak)));
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(0, y, 256, 1);

    const rv = Math.max(38, Math.min(130, Math.floor(72 - streak * 0.55)));
    rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rctx.fillRect(0, y, 256, 1);
  }
  // 叠加工业冷轧微光晕
  for (let x = 0; x < 256; x += 2) {
    const shade = Math.floor(18 + Math.sin(x * 0.08) * 10);
    rctx.fillStyle = `rgba(255,255,255,${(shade / 255).toFixed(3)})`;
    rctx.fillRect(x, 0, 1, 256);
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 3);

  const rough = new THREE.CanvasTexture(roughCanvas);
  rough.wrapS = THREE.RepeatWrapping;
  rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(2, 3);

  brushedBumpTex = bump;
  brushedRoughTex = rough;
  return { bump, rough };
}

function getCastIronBumpMap(): THREE.CanvasTexture {
  if (castIronBumpTex) return castIronBumpTex;
  const rand = makePrng(40993);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 105 + Math.floor(rand() * 46);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  castIronBumpTex = tex;
  return tex;
}

function getPerforatedMetalMaps(): { alpha: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (perforatedMaps) return perforatedMaps;
  const alphaC = document.createElement('canvas');
  alphaC.width = 128;
  alphaC.height = 128;
  const actx = alphaC.getContext('2d')!;
  actx.fillStyle = '#ffffff';
  actx.fillRect(0, 0, 128, 128);
  actx.fillStyle = '#000000';

  const bumpC = document.createElement('canvas');
  bumpC.width = 128;
  bumpC.height = 128;
  const bctx = bumpC.getContext('2d')!;
  bctx.fillStyle = '#c8c8c8';
  bctx.fillRect(0, 0, 128, 128);
  bctx.fillStyle = '#202020';

  const step = 16;
  for (let row = 0; row * step < 128; row++) {
    const offsetX = (row % 2) * (step * 0.5);
    for (let col = -1; col * step < 128 + step; col++) {
      const cx = col * step + offsetX + step * 0.5;
      const cy = row * step + step * 0.5;
      actx.beginPath();
      actx.arc(cx, cy, 4.6, 0, Math.PI * 2);
      actx.fill();
      bctx.beginPath();
      bctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const alpha = new THREE.CanvasTexture(alphaC);
  alpha.wrapS = THREE.RepeatWrapping;
  alpha.wrapT = THREE.RepeatWrapping;
  alpha.repeat.set(4, 3);

  const bump = new THREE.CanvasTexture(bumpC);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(4, 3);

  perforatedMaps = { alpha, bump };
  return perforatedMaps;
}

function getHxPlateMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (hxPlateMaps) return hxPlateMaps;
  const cMap = document.createElement('canvas');
  cMap.width = 256;
  cMap.height = 256;
  const ctx = cMap.getContext('2d')!;

  const cBump = document.createElement('canvas');
  cBump.width = 256;
  cBump.height = 256;
  const bctx = cBump.getContext('2d')!;

  // 多片紧密夹紧的不锈钢波纹换热板片叠层纹理
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = '#b9c4d0';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = '#1e2631';
    ctx.fillRect(x + 3, 0, 2, 256);
    ctx.fillStyle = '#687788';
    ctx.fillRect(x + 5, 0, 1, 256);

    bctx.fillStyle = '#dcdcdc';
    bctx.fillRect(x, 0, 3, 256);
    bctx.fillStyle = '#262626';
    bctx.fillRect(x + 3, 0, 3, 256);
  }
  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1);

  const bump = new THREE.CanvasTexture(cBump);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 1);

  hxPlateMaps = { map, bump };
  return hxPlateMaps;
}

function getConcretePlinthMaps(): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
} {
  if (concretePlinthMaps) return concretePlinthMaps;
  const rand = makePrng(77813);
  const size = 256;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d')!;

  const cBump = document.createElement('canvas');
  cBump.width = size;
  cBump.height = size;
  const bctx = cBump.getContext('2d')!;

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rctx = cRough.getContext('2d')!;

  ctx.fillStyle = '#8b95a2';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#d4d4d4';
  rctx.fillRect(0, 0, size, size);

  // 水泥细砂斑驳与浇筑痕
  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 2.4;
    const delta = Math.floor((rand() - 0.5) * 34);
    const base = 136 + delta;
    ctx.fillStyle = `rgba(${base},${base + 3},${base + 7},0.42)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const bv = Math.max(40, Math.min(220, 128 + delta * 1.4));
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, y, 2, 2);
  }

  for (let i = 0; i < 24; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 18 + rand() * 44;
    const ry = 10 + rand() * 30;
    const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
    g.addColorStop(0, 'rgba(38,44,52,0.22)');
    g.addColorStop(1, 'rgba(38,44,52,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);

    rctx.fillStyle = 'rgba(240,240,240,0.25)';
    rctx.fillRect(x - rx * 0.5, y - ry * 0.5, rx, ry);
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const bump = new THREE.CanvasTexture(cBump);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 2);

  const rough = new THREE.CanvasTexture(cRough);
  rough.wrapS = THREE.RepeatWrapping;
  rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(2, 2);

  concretePlinthMaps = { map, bump, rough };
  return concretePlinthMaps;
}

export function getGroundStyleMaps(style: GroundStyle): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
} {
  const cached = groundTextureCache.get(style);
  if (cached) return cached;

  const size = 512;
  const rand = makePrng(style === 'weathered-concrete' ? 9127 : style === 'epoxy-dark' ? 3391 : 5519);

  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d')!;

  const cBump = document.createElement('canvas');
  cBump.width = size;
  cBump.height = size;
  const bctx = cBump.getContext('2d')!;

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rctx = cRough.getContext('2d')!;

  if (style === 'steel-grid-floor') {
    ctx.fillStyle = '#1f2733';
    ctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#585858';
    bctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#808080';
    rctx.fillRect(0, 0, size, size);
    // 防滑花纹凹凸金属方块
    for (let y = 16; y < size; y += 32) {
      for (let x = 16; x < size; x += 32) {
        for (const [dctx, fill] of [
          [ctx, '#334155'],
          [bctx, '#e2e2e2'],
          [rctx, '#484848'],
        ] as const) {
          dctx.save();
          dctx.translate(x, y);
          dctx.rotate(((x + y) % 64 === 0 ? 1 : -1) * (Math.PI / 4));
          dctx.fillStyle = fill;
          dctx.beginPath();
          dctx.ellipse(0, 0, 10, 3.4, 0, 0, Math.PI * 2);
          dctx.fill();
          dctx.restore();
        }
      }
    }
    ctx.strokeStyle = 'rgba(10, 15, 22, 0.72)';
    ctx.lineWidth = 4;
    for (let p = 0; p <= size; p += 256) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  } else {
    // weathered-concrete / epoxy-dark / slate-matte
    const baseHex =
      style === 'epoxy-dark' ? '#14202e' : style === 'slate-matte' ? '#1b2029' : '#252d38';
    const baseRVal =
      style === 'epoxy-dark' ? 54 : style === 'slate-matte' ? 195 : 112;

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);
    rctx.fillStyle = `rgb(${baseRVal},${baseRVal},${baseRVal})`;
    rctx.fillRect(0, 0, size, size);

    // 厂房做旧水印/磨损抛光变化区域（对应参考图中微反光与哑光交替的真实地面质感）
    const cloudCount = style === 'weathered-concrete' ? 42 : 24;
    for (let i = 0; i < cloudCount; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rad = 28 + rand() * 90;
      const bright = rand() > 0.45;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
      if (style === 'weathered-concrete') {
        g.addColorStop(0, bright ? 'rgba(82,95,112,0.22)' : 'rgba(15,20,28,0.28)');
        g.addColorStop(1, 'rgba(30,36,46,0)');
      } else {
        g.addColorStop(0, bright ? 'rgba(56,78,104,0.12)' : 'rgba(9,13,20,0.18)');
        g.addColorStop(1, 'rgba(15,23,36,0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);

      // 局部微镜面反射区 vs 粗糙磨损区
      const rg = rctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
      const rTone = bright
        ? Math.max(24, baseRVal - 58)
        : Math.min(235, baseRVal + 55);
      rg.addColorStop(0, `rgba(${rTone},${rTone},${rTone},0.65)`);
      rg.addColorStop(1, `rgba(${baseRVal},${baseRVal},${baseRVal},0)`);
      rctx.fillStyle = rg;
      rctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }

    // 混凝土骨料与防滑细微噪点
    const grainCount = style === 'weathered-concrete' ? 5200 : 1800;
    for (let i = 0; i < grainCount; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const tone = 110 + Math.floor((rand() - 0.5) * 60);
      bctx.fillStyle = `rgb(${tone},${tone},${tone})`;
      bctx.fillRect(x, y, 2, 2);
      if (style === 'weathered-concrete') {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(150,163,180,0.06)' : 'rgba(12,16,22,0.09)';
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // 大板混凝土伸缩分缝线（512px -> 2x2 块标准地坪伸缩缝）
    ctx.strokeStyle = style === 'epoxy-dark' ? 'rgba(56,189,248,0.08)' : 'rgba(12,16,22,0.58)';
    ctx.lineWidth = 3;
    bctx.strokeStyle = '#303030';
    bctx.lineWidth = 3;
    for (const p of [0, 256]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();

      bctx.beginPath();
      bctx.moveTo(p, 0);
      bctx.lineTo(p, size);
      bctx.stroke();
      bctx.beginPath();
      bctx.moveTo(0, p);
      bctx.lineTo(size, p);
      bctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = new THREE.CanvasTexture(cBump);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  const rough = new THREE.CanvasTexture(cRough);
  rough.wrapS = THREE.RepeatWrapping;
  rough.wrapT = THREE.RepeatWrapping;

  const out = { map, bump, rough };
  groundTextureCache.set(style, out);
  return out;
}

/** 将地坪样式直接应用到任意 MeshStandardMaterial（供全局地坪与独立地坪板块共享） */
export function applyGroundStyleToMaterial(
  mat: THREE.MeshStandardMaterial,
  style: GroundStyle,
  repeatX = 6,
  repeatZ = 5,
  roughnessOverride?: number,
  metalnessOverride?: number,
): void {
  if (style === 'grid-only') {
    mat.visible = false;
    return;
  }
  mat.visible = true;
  const maps = getGroundStyleMaps(style);
  for (const t of [maps.map, maps.bump, maps.rough]) {
    t.repeat.set(repeatX, repeatZ);
  }
  mat.map = maps.map;
  mat.bumpMap = maps.bump;
  mat.roughnessMap = maps.rough;
  mat.color.setHex(0xffffff);
  if (style === 'epoxy-dark') {
    mat.roughness = roughnessOverride ?? 0.34;
    mat.metalness = metalnessOverride ?? 0.16;
    mat.bumpScale = 0.004;
    mat.envMapIntensity = 1.25;
  } else if (style === 'steel-grid-floor') {
    mat.roughness = roughnessOverride ?? 0.44;
    mat.metalness = metalnessOverride ?? 0.68;
    mat.bumpScale = 0.016;
    mat.envMapIntensity = 1.15;
  } else if (style === 'slate-matte') {
    mat.roughness = roughnessOverride ?? 0.84;
    mat.metalness = metalnessOverride ?? 0.06;
    mat.bumpScale = 0.008;
    mat.envMapIntensity = 0.65;
  } else {
    // weathered-concrete
    mat.roughness = roughnessOverride ?? 0.52;
    mat.metalness = metalnessOverride ?? 0.12;
    mat.bumpScale = 0.012;
    mat.envMapIntensity = 1.15;
  }
  mat.needsUpdate = true;
}

function getDiamondPlateMap(): THREE.CanvasTexture {
  if (diamondPlateTex) return diamondPlateTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#dcdcdc';
  for (let y = 16; y < 128; y += 32) {
    for (let x = 16; x < 128; x += 32) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((x + y) % 64 === 0 ? 1 : -1) * (Math.PI / 4));
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  diamondPlateTex = tex;
  return tex;
}

function getHazardStripeTex(): THREE.CanvasTexture {
  if (hazardTex) return hazardTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d49b1a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#18202c';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  hazardTex = tex;
  return tex;
}

function getDialTexture(): THREE.CanvasTexture {
  if (dialTex) return dialTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const cx = 128;
  const cy = 128;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, 124, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 10;
  ctx.strokeStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy, 98, Math.PI * 0.75, Math.PI * 1.85);
  ctx.stroke();

  ctx.strokeStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, 98, Math.PI * 1.85, Math.PI * 2.25);
  ctx.stroke();

  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
    const major = i % 5 === 0;
    const r1 = major ? 82 : 90;
    const r2 = 106;
    ctx.lineWidth = major ? 4 : 2;
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MPa', cx, cy + 52);

  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 58, cy - 42);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  dialTex = tex;
  return tex;
}

function getScreenTexture(): THREE.CanvasTexture {
  if (screenTex) return screenTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#061325';
  ctx.fillRect(0, 0, 256, 160);

  ctx.strokeStyle = 'rgba(56,189,248,0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 160);
    ctx.stroke();
  }
  for (let y = 0; y <= 160; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('SYS OK · RUN', 16, 32);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('118.6 m3/h', 16, 72);

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 16; x <= 240; x += 10) {
    const y = 122 + Math.sin(x * 0.08) * 16;
    if (x === 16) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  screenTex = tex;
  return tex;
}

function getMeterCounterTexture(): THREE.CanvasTexture {
  if (meterCounterTex) return meterCounterTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(14, 16, 228, 44);

  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i >= 5 ? '#b91c1c' : '#1e293b';
    ctx.fillRect(20 + i * 27, 22, 23, 32);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(String((i * 3 + 1) % 10), 25 + i * 27, 45);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(14, 72, 130, 38);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('IC: 158.4 m3', 20, 97);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('G16 · Ex', 158, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  meterCounterTex = tex;
  return tex;
}

function getNameplateTexture(): THREE.CanvasTexture {
  if (nameplateTex) return nameplateTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('SCADA INDUSTRIAL', 18, 42);
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PN16 · DN100 · Ex d IIB', 18, 74);
  ctx.fillText('SUS304 · Q235B', 18, 102);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  nameplateTex = tex;
  return tex;
}

/** 生成高对比度工业厂房天棚灯带反射环境（使拉丝不锈钢罐体与管线呈现纵向锐利高光带） */
export function createIndustrialEnvTexture(
  renderer: THREE.WebGLRenderer,
  pmrem: THREE.PMREMGenerator,
): THREE.WebGLRenderTarget {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x070d18);

  const disposables: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rot?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    envScene.add(m);
    disposables.push({ geo, mat });
  };

  // 深邃工业棚内壁（压低杂散环境光，凸显金属暗部对比）
  addMesh(
    new THREE.BoxGeometry(38, 22, 38),
    new THREE.MeshBasicMaterial({ color: 0x09111e, side: THREE.BackSide }),
    [0, 6, 0],
  );

  // 顶部高亮度长条形工业吊灯带（形成纵贯储罐表面的清晰金属高光柱）
  const stripXs = [-10, -4, 2, 8];
  for (let i = 0; i < stripXs.length; i++) {
    const isAccent = i === 1 || i === 2;
    const mat = new THREE.MeshBasicMaterial({
      color: isAccent ? new THREE.Color(4.5, 5.0, 5.8) : new THREE.Color(3.0, 3.6, 4.4),
    });
    addMesh(new THREE.PlaneGeometry(1.1, 28), mat, [stripXs[i], 14.5, 0], [Math.PI / 2, 0, 0]);
  }

  // 四周与前斜侧垂直工业条形反光灯柱（关键：点亮立式不锈钢储罐正面圆柱曲面纵向高光）
  addMesh(
    new THREE.PlaneGeometry(2.6, 13),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.6, 4.2) }),
    [7.5, 6.2, 16.2],
    [0, Math.PI, 0],
  );
  addMesh(
    new THREE.PlaneGeometry(2.2, 13),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.9, 3.8) }),
    [-7.5, 6.2, 16.2],
    [0, Math.PI, 0],
  );
  addMesh(
    new THREE.PlaneGeometry(3.2, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 3.2, 3.9) }),
    [16.2, 6.0, 5.5],
    [0, -Math.PI / 2, 0],
  );
  addMesh(
    new THREE.PlaneGeometry(30, 3.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.1, 3.3) }),
    [0, 7.5, -16.5],
  );
  addMesh(
    new THREE.PlaneGeometry(30, 3.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.8, 3.1) }),
    [-16.5, 6.2, 0],
    [0, Math.PI / 2, 0],
  );
  addMesh(
    new THREE.PlaneGeometry(30, 3.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.85, 2.9) }),
    [16.5, 6.0, -4],
    [0, -Math.PI / 2, 0],
  );

  // 厂房地面微灰反射基底（为金属底边提供自然受光）
  addMesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshBasicMaterial({ color: 0x202938 }),
    [0, -4.5, 0],
    [-Math.PI / 2, 0, 0],
  );

  const prevTone = renderer.toneMapping;
  const rt = pmrem.fromScene(envScene, 0.032);
  renderer.toneMapping = prevTone;

  for (const d of disposables) {
    d.geo.dispose();
    d.mat.dispose();
  }
  return rt;
}

/** 生成管道流动方向指示带 / 视镜液体流束贴图（U 轴方向为正向起点->终点） */
export function createPipeFlowTexture(
  colorHex: number,
  mode: 'uv-chevron' | 'glass-stream',
  repeatU: number,
  reverse = false,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(colorHex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;

  if (mode === 'glass-stream') {
    // 视镜玻璃内流：半透明浓郁液体基底 + 高亮斜向波纹流丝与微小示踪气泡
    ctx.fillStyle = `rgba(${rgb}, 0.58)`;
    ctx.fillRect(0, 0, 256, 64);

    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, `rgba(${rgb}, 0.15)`);
    grad.addColorStop(0.45, 'rgba(255,255,255,0.82)');
    grad.addColorStop(0.75, `rgba(${rgb}, 0.45)`);
    grad.addColorStop(1, `rgba(${rgb}, 0.15)`);

    for (const bx of [24, 152]) {
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx, 12);
      ctx.lineTo(bx + 42, 32);
      ctx.lineTo(bx, 52);
      ctx.lineTo(bx + 18, 52);
      ctx.lineTo(bx + 60, 32);
      ctx.lineTo(bx + 18, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    for (const [px, py, r] of [
      [104, 18, 3.2],
      [124, 42, 2.4],
      [226, 24, 3.4],
      [244, 46, 2.2],
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 外挂金属管流向带：全透底色上绘锐利高对比发光 Chevron 箭标，不遮挡不锈钢/钴蓝底色
    ctx.clearRect(0, 0, 256, 64);
    for (const bx of [16, 144]) {
      // 微弱底部拖尾光束
      const tailGrad = ctx.createLinearGradient(bx - 22, 0, bx + 54, 0);
      tailGrad.addColorStop(0, `rgba(${rgb}, 0)`);
      tailGrad.addColorStop(0.65, `rgba(${rgb}, 0.55)`);
      tailGrad.addColorStop(1, 'rgba(255,255,255,0.95)');

      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.moveTo(bx, 14);
      ctx.lineTo(bx + 36, 32);
      ctx.lineTo(bx, 50);
      ctx.lineTo(bx + 16, 50);
      ctx.lineTo(bx + 54, 32);
      ctx.lineTo(bx + 16, 14);
      ctx.closePath();
      ctx.fill();

      // 细前导尖刺
      ctx.fillStyle = 'rgba(240,249,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(bx + 36, 20);
      ctx.lineTo(bx + 60, 32);
      ctx.lineTo(bx + 36, 44);
      ctx.lineTo(bx + 44, 32);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(reverse ? -Math.abs(repeatU) : Math.abs(repeatU), 3);
  return tex;
}

/** 为加载的 GLB 或程序化网格统一增强重工业 SCADA 级 PBR 材质细节 */
export function enhanceIndustrialMaterials(
  root: THREE.Object3D,
  options?: { floorStyle?: GroundStyle; floorRepeat?: [number, number] },
): void {
  const { bump: brushedBump, rough: brushedRough } = getBrushedMetalMaps();
  const castIronBump = getCastIronBumpMap();
  const perfMaps = getPerforatedMetalMaps();
  const hxMaps = getHxPlateMaps();
  const plinthMaps = getConcretePlinthMaps();

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;

      if (m.name === 'mat:stainless') {
        m.bumpMap = brushedBump;
        m.bumpScale = 0.0032;
        m.roughnessMap = brushedRough;
        m.metalness = Math.max(m.metalness, 0.88);
        m.roughness = Math.min(m.roughness, 0.34);
        m.envMapIntensity = 1.4;
        m.needsUpdate = true;
      } else if (m.name === 'mat:weldSeam') {
        m.bumpMap = castIronBump;
        m.bumpScale = 0.008;
        m.metalness = 0.72;
        m.roughness = 0.56;
        m.needsUpdate = true;
      } else if (m.name === 'mat:castAluminum') {
        m.bumpMap = brushedBump;
        m.bumpScale = 0.004;
        m.roughnessMap = brushedRough;
        m.envMapIntensity = 1.15;
        m.needsUpdate = true;
      } else if (m.name === 'mat:darkSteel' || m.name === 'mat:steelSlate' || m.name === 'mat:castIron') {
        m.bumpMap = castIronBump;
        m.bumpScale = 0.005;
        m.envMapIntensity = 1.05;
        m.needsUpdate = true;
      } else if (m.name === 'mat:industrialBlue' || m.name === 'mat:paintBlue') {
        m.envMapIntensity = 1.2;
        m.needsUpdate = true;
      } else if (m.name === 'mat:perforatedMetal') {
        m.alphaMap = perfMaps.alpha;
        m.bumpMap = perfMaps.bump;
        m.bumpScale = 0.01;
        m.alphaTest = 0.45;
        m.transparent = false;
        m.side = THREE.DoubleSide;
        m.metalness = 0.84;
        m.roughness = 0.32;
        m.envMapIntensity = 1.3;
        m.needsUpdate = true;
      } else if (m.name === 'mat:hxPlates') {
        m.map = hxMaps.map;
        m.bumpMap = hxMaps.bump;
        m.bumpScale = 0.025;
        m.metalness = 0.82;
        m.roughness = 0.36;
        m.envMapIntensity = 1.2;
        m.needsUpdate = true;
      } else if (m.name === 'mat:concretePlinth') {
        m.map = plinthMaps.map;
        m.bumpMap = plinthMaps.bump;
        m.bumpScale = 0.015;
        m.roughnessMap = plinthMaps.rough;
        m.metalness = 0.06;
        m.roughness = 0.86;
        m.envMapIntensity = 0.55;
        m.needsUpdate = true;
      } else if (m.name === 'mat:floorSlab') {
        const style = options?.floorStyle ?? 'weathered-concrete';
        const [rx, rz] = options?.floorRepeat ?? [3, 3];
        applyGroundStyleToMaterial(
          m,
          style === 'grid-only' ? 'weathered-concrete' : style,
          rx,
          rz,
        );
      } else if (m.name === 'mat:diamondPlate') {
        m.bumpMap = getDiamondPlateMap();
        m.bumpScale = 0.015;
        m.roughnessMap = getDiamondPlateMap();
        m.needsUpdate = true;
      } else if (m.name === 'mat:hazardStripe') {
        m.map = getHazardStripeTex();
        m.needsUpdate = true;
      } else if (m.name === 'mat:dial' || obj.name === 'dial-face') {
        m.map = getDialTexture();
        m.needsUpdate = true;
      } else if (m.name === 'mat:screen') {
        m.map = getScreenTexture();
        m.emissiveMap = getScreenTexture();
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.55;
        m.needsUpdate = true;
      } else if (m.name === 'mat:meterCounter') {
        m.map = getMeterCounterTexture();
        m.needsUpdate = true;
      } else if (m.name === 'mat:nameplate') {
        m.map = getNameplateTexture();
        m.needsUpdate = true;
      }
    }
  });
}
