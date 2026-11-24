import * as THREE from 'three';

let brushedBumpTex: THREE.CanvasTexture | null = null;
let diamondPlateTex: THREE.CanvasTexture | null = null;
let hazardTex: THREE.CanvasTexture | null = null;
let dialTex: THREE.CanvasTexture | null = null;
let screenTex: THREE.CanvasTexture | null = null;
let meterCounterTex: THREE.CanvasTexture | null = null;
let nameplateTex: THREE.CanvasTexture | null = null;

function getBrushedMetalMap(): THREE.CanvasTexture {
  if (brushedBumpTex) return brushedBumpTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = 112 + Math.floor(Math.sin(y * 1.7) * 14 + (Math.random() - 0.5) * 26);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  brushedBumpTex = tex;
  return tex;
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
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#111827';
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
  ctx.fillText('24.82 m3/h', 16, 72);

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

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(14, 16, 228, 44);

  // 8 位机械字轮（前5位黑底白字，后3位红底白字小数）
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i >= 5 ? '#b91c1c' : '#1e293b';
    ctx.fillRect(20 + i * 27, 22, 23, 32);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(String((i * 3 + 1) % 10), 25 + i * 27, 45);
  }

  // 下部智能液晶读数 + 型号标识
  ctx.fillStyle = '#94a1b2';
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
  ctx.fillText('PLANT STATION', 22, 42);
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PN16 · DN100 · Ex d IIB', 22, 74);
  ctx.fillText('SN: HG-2026-0081', 22, 102);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  nameplateTex = tex;
  return tex;
}

/** 为加载的 GLB 或程序化网格统一增强 PBR 工业材质细节 */
export function enhanceIndustrialMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      if (m.name === 'mat:stainless' || m.name === 'mat:castAluminum') {
        m.bumpMap = getBrushedMetalMap();
        m.bumpScale = 0.004;
        m.roughnessMap = getBrushedMetalMap();
        m.needsUpdate = true;
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
