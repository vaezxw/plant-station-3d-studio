import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
  };
}

const OUT_DIR = join(process.cwd(), 'public', 'assets', 'studio');
mkdirSync(OUT_DIR, { recursive: true });

// 严格对标参考图与视频的克制重工业 SCADA 材质体系
const M = {
  stainless: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:stainless',
      color: 0xd4dde6,
      metalness: 0.88,
      roughness: 0.24,
    }),
  weldSeam: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:weldSeam',
      color: 0x8b96a3,
      metalness: 0.74,
      roughness: 0.56,
    }),
  castIron: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:castIron',
      color: 0x262d38,
      metalness: 0.76,
      roughness: 0.44,
    }),
  darkSteel: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:darkSteel',
      color: 0x1b212b,
      metalness: 0.74,
      roughness: 0.48,
    }),
  steelSlate: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:steelSlate',
      color: 0x354152,
      metalness: 0.62,
      roughness: 0.42,
    }),
  castAluminum: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:castAluminum',
      color: 0xbac4cf,
      metalness: 0.66,
      roughness: 0.36,
    }),
  industrialBlue: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:industrialBlue',
      color: 0x1555b0,
      metalness: 0.38,
      roughness: 0.28,
    }),
  perforatedMetal: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:perforatedMetal',
      color: 0xd0d8e0,
      metalness: 0.85,
      roughness: 0.3,
    }),
  hxPlates: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:hxPlates',
      color: 0xaab6c4,
      metalness: 0.82,
      roughness: 0.34,
    }),
  concretePlinth: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:concretePlinth',
      color: 0x8b95a2,
      metalness: 0.06,
      roughness: 0.84,
    }),
  floorSlab: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:floorSlab',
      color: 0x2a333f,
      metalness: 0.12,
      roughness: 0.52,
    }),
  diamondPlate: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:diamondPlate',
      color: 0x3b4656,
      metalness: 0.76,
      roughness: 0.38,
    }),
  hazardStripe: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:hazardStripe',
      color: 0xb4821a,
      metalness: 0.22,
      roughness: 0.55,
    }),
  brass: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:brass',
      color: 0xb58947,
      metalness: 0.84,
      roughness: 0.28,
    }),
  paintAmber: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:paintAmber',
      color: 0xb45309,
      metalness: 0.36,
      roughness: 0.4,
    }),
  paintRed: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:paintRed',
      color: 0x991b1b,
      metalness: 0.38,
      roughness: 0.38,
    }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({
      name: 'mat:glass',
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.32,
      roughness: 0.06,
      metalness: 0.08,
    }),
  screen: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:screen',
      color: 0x0f172a,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    }),
  meterCounter: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:meterCounter', color: 0xdbe2ea, roughness: 0.35, metalness: 0.1 }),
  nameplate: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:nameplate', color: 0xcbd5e1, roughness: 0.35, metalness: 0.7 }),
  dial: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:dial', color: 0xf8fafc, roughness: 0.35, metalness: 0.05 }),
  lampGreen: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:lampGreen',
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    }),
  lampAmber: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:lampAmber',
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    }),
  lampRed: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:lampRed',
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    }),
};

function addPort(parent, id, x, y, z, nx, ny, nz) {
  const anchor = new THREE.Object3D();
  anchor.name = `Port_${id}`;
  anchor.position.set(x, y, z);
  anchor.userData.portId = id;
  anchor.userData.normal = [nx, ny, nz];
  parent.add(anchor);
}

function makeBeveledBox(w, h, d, bevel = 0.016, material = M.castIron()) {
  const hw = Math.max(0.01, w / 2 - bevel);
  const hh = Math.max(0.01, h / 2 - bevel);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.016, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.center();
  return new THREE.Mesh(geo, material);
}

/** 带倒角顶层与不锈钢地脚锚板的混凝土水泥设备基座（复刻参考图所有设备下方水泥台） */
function makeConcretePlinth(w, h, d, anchorCoords = null) {
  const g = new THREE.Group();
  const lowerH = h * 0.72;
  const upperH = h * 0.28;
  const lower = makeBeveledBox(w, lowerH, d, 0.012, M.concretePlinth());
  lower.position.y = lowerH * 0.5;
  const upper = makeBeveledBox(w - 0.05, upperH, d - 0.05, 0.01, M.concretePlinth());
  upper.position.y = lowerH + upperH * 0.5;
  g.add(lower, upper);

  // 地坪接缝压边钢条
  const curbMat = M.darkSteel();
  const curb = makeBeveledBox(w + 0.03, 0.018, d + 0.03, 0.004, curbMat);
  curb.position.y = 0.009;
  g.add(curb);

  if (anchorCoords) {
    const plateMat = M.stainless();
    const boltMat = M.darkSteel();
    const boltGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.028, 6);
    for (const [ax, az] of anchorCoords) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.14), plateMat);
      plate.position.set(ax, h + 0.007, az);
      g.add(plate);
      for (const bx of [-0.045, 0.045]) {
        for (const bz of [-0.045, 0.045]) {
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(ax + bx, h + 0.018, az + bz);
          g.add(bolt);
        }
      }
    }
  }
  return g;
}

function makeFlangeAssembly(radius = 0.15, pipeR = 0.085, bolts = 8, mat = M.stainless()) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.034, 24), mat);
  disc.rotation.z = Math.PI / 2;
  g.add(disc);
  const raisedFace = new THREE.Mesh(
    new THREE.CylinderGeometry(pipeR * 1.26, pipeR * 1.26, 0.042, 24),
    M.stainless(),
  );
  raisedFace.rotation.z = Math.PI / 2;
  g.add(raisedFace);
  const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.056, 6);
  const boltMat = M.darkSteel();
  const rBolt = (radius + pipeR * 1.2) * 0.52;
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0, Math.cos(a) * rBolt, Math.sin(a) * rBolt);
    g.add(bolt);
  }
  return g;
}

function makeHandwheel(radius = 0.14, mat = M.stainless()) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.014, 10, 28), mat);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, radius, 8), mat);
    const a = (i / 5) * Math.PI * 2;
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = a;
    spoke.position.set(Math.cos(a) * (radius * 0.5), 0, -Math.sin(a) * (radius * 0.5));
    g.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.044, 12), M.castIron());
  g.add(hub);
  return g;
}

function makeDialGauge(radius = 0.07) {
  const g = new THREE.Group();
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.04, 24), M.stainless());
  casing.rotation.x = Math.PI / 2;
  g.add(casing);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.043, 24), M.dial());
  face.rotation.x = Math.PI / 2;
  face.name = 'dial-face';
  g.add(face);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, 0.046, 24), M.glass());
  glass.rotation.x = Math.PI / 2;
  g.add(glass);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.065, 10), M.stainless());
  stem.position.y = -radius - 0.025;
  g.add(stem);
  return g;
}

function makeEllipticalHead(radius, height) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(t) * radius, Math.sin(t) * height));
  }
  return new THREE.LatheGeometry(pts, 32);
}

function makePipeSpan(p1, p2, radius = 0.055, mat = M.stainless()) {
  const v1 = new THREE.Vector3(...p1);
  const v2 = new THREE.Vector3(...p2);
  const dir = new THREE.Vector3().subVectors(v2, v1);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 20), mat);
  mesh.position.addVectors(v1, v2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** 带 U 型钢卡箍与底座钢板的地面立柱管道支架 */
function makePipeStanchion(x, yTop, z, radius = 0.055) {
  const g = new THREE.Group();
  const foot = makeBeveledBox(0.16, 0.024, 0.16, 0.005, M.darkSteel());
  foot.position.set(x, 0.012, z);
  g.add(foot);
  const postH = Math.max(0.08, yTop - radius);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, postH, 12), M.castIron());
  post.position.set(x, postH * 0.5 + 0.01, z);
  g.add(post);
  const saddle = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.15, 0.01, 8, 18, Math.PI), M.stainless());
  saddle.rotation.z = Math.PI;
  saddle.rotation.y = Math.PI / 2;
  saddle.position.set(x, yTop, z);
  g.add(saddle);
  return g;
}

/** YE3 重工业异步驱动电机（密集散热筋 + 防爆接线盒 + 冲压百叶风扇罩） */
function makeIndustrialMotor({ radius = 0.19, length = 0.5, bodyMat = M.industrialBlue(), ribCount = 18 } = {}) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), bodyMat);
  shell.rotation.z = Math.PI / 2;
  g.add(shell);

  // 密集散热翅片（围绕外壳径向分布，复刻 P-201/P-202/P-203 电机特征）
  const finLen = length * 0.72;
  const finGeo = new THREE.BoxGeometry(finLen, 0.012, radius * 2.12);
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    const fin = new THREE.Mesh(finGeo, bodyMat);
    fin.rotation.x = a;
    fin.position.x = -0.02;
    g.add(fin);
  }

  // 后端风扇罩
  const fanCowl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.04, radius * 0.96, length * 0.34, 24), M.castIron());
  fanCowl.rotation.z = Math.PI / 2;
  fanCowl.position.x = length * 0.5 + length * 0.14;
  g.add(fanCowl);
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.castIron());
  endCap.rotation.z = -Math.PI / 2;
  endCap.position.x = length * 0.67;
  g.add(endCap);

  // 顶置防爆接线盒 + 电缆格兰头
  const tBox = makeBeveledBox(0.14, 0.11, 0.14, 0.01, bodyMat);
  tBox.position.set(-0.04, radius + 0.055, 0);
  g.add(tBox);
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10), M.stainless());
  g.add(gland);
  gland.rotation.x = Math.PI / 2;
  gland.position.set(-0.04, radius + 0.055, 0.09);

  // 电机铸铁底座脚
  for (const sx of [-length * 0.28, length * 0.28]) {
    for (const sz of [-radius * 0.76, radius * 0.76]) {
      const foot = makeBeveledBox(0.1, 0.07, 0.09, 0.008, M.castIron());
      foot.position.set(sx, -radius - 0.02, sz);
      g.add(foot);
    }
  }
  return g;
}

/** 共用重工业立式压力容器/储罐/分离器内核（复刻 TK-101/102/103 全套护栏+爬梯+支腿+混凝土台） */
function makeVerticalVessel({
  radius = 0.52,
  bodyH = 1.65,
  headH = 0.28,
  legs = 6,
  legH = 0.5,
  plinthH = 0.18,
  withTopRail = true,
  withLadder = true,
  withSightGlass = true,
  vesselMat = M.stainless(),
  topNozzleCount = 2,
} = {}) {
  const g = new THREE.Group();
  const basePlateSize = radius * 2.55;
  const anchors = [
    [-basePlateSize * 0.38, -basePlateSize * 0.38],
    [basePlateSize * 0.38, -basePlateSize * 0.38],
    [-basePlateSize * 0.38, basePlateSize * 0.38],
    [basePlateSize * 0.38, basePlateSize * 0.38],
  ];
  const plinth = makeConcretePlinth(basePlateSize, plinthH, basePlateSize, anchors);
  g.add(plinth);

  const legTopY = plinthH + legH;
  const bodyBottomY = legTopY + headH * 0.35;
  const bodyCenterY = bodyBottomY + bodyH * 0.5;
  const bodyTopY = bodyBottomY + bodyH;

  // 圆管支撑腿 + 地脚法兰盘 + 环向交叉加强拉筋（参考 TK-101/102/103 罐底结构）
  const legMat = M.stainless();
  const footMat = M.stainless();
  const legRingR = radius * 0.86;
  const legPositions = [];
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + Math.PI / legs;
    const lx = Math.cos(a) * legRingR;
    const lz = Math.sin(a) * legRingR;
    legPositions.push([lx, lz]);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, legH + headH * 0.65, 14), legMat);
    leg.position.set(lx, plinthH + (legH + headH * 0.65) * 0.5, lz);
    g.add(leg);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.024, 14), footMat);
    pad.position.set(lx, plinthH + 0.012, lz);
    g.add(pad);
  }
  for (let i = 0; i < legs; i++) {
    const p1 = legPositions[i];
    const p2 = legPositions[(i + 1) % legs];
    const braceY = plinthH + legH * 0.42;
    g.add(makePipeSpan([p1[0], braceY, p1[1]], [p2[0], braceY, p2[1]], 0.016, M.stainless()));
  }

  // 主筒身 + 上下椭球碟形封头 + 环向焊缝圈
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, bodyH, 36), vesselMat);
  body.position.y = bodyCenterY;
  g.add(body);

  const botHead = new THREE.Mesh(makeEllipticalHead(radius, headH), vesselMat);
  botHead.rotation.x = Math.PI;
  botHead.position.y = bodyBottomY;
  g.add(botHead);

  const topHead = new THREE.Mesh(makeEllipticalHead(radius, headH), vesselMat);
  topHead.position.y = bodyTopY;
  g.add(topHead);

  // 显性焊缝圈（让纯不锈钢筒身更具真实压力容器分段质感）
  const seamMat = M.weldSeam();
  for (const sy of [bodyBottomY, bodyBottomY + bodyH * 0.34, bodyBottomY + bodyH * 0.68, bodyTopY]) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.005, 0.009, 8, 36), seamMat);
    seam.rotation.x = Math.PI / 2;
    seam.position.y = sy;
    g.add(seam);
  }

  // 顶部圆形双层不锈钢安全护栏（参考 TK-101/102/103 顶栏）
  const topCrownY = bodyTopY + headH;
  if (withTopRail) {
    const railR = radius * 0.92;
    const railH = 0.56;
    const postCount = 12;
    const baseRingY = bodyTopY + headH * 0.55;
    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, railH, 8), M.stainless());
      post.position.set(Math.cos(a) * railR, baseRingY + railH * 0.5, Math.sin(a) * railR);
      g.add(post);
    }
    for (const ry of [baseRingY + railH * 0.52, baseRingY + railH]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(railR, 0.015, 10, 32), M.stainless());
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry;
      g.add(ring);
    }
  }

  // 顶部人孔盖 & 工艺短接管法兰
  const manway = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 20), M.stainless());
  manway.position.set(0, topCrownY + 0.04, 0);
  const manwayLid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.036, 20), M.darkSteel());
  manwayLid.position.set(0, topCrownY + 0.12, 0);
  g.add(manway, manwayLid);

  for (let i = 0; i < topNozzleCount; i++) {
    const nx = i === 0 ? -radius * 0.36 : radius * 0.36;
    const nz = -radius * 0.2;
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 16), M.stainless());
    noz.position.set(nx, bodyTopY + headH * 0.72 + 0.1, nz);
    const fl = makeFlangeAssembly(0.1, 0.055, 6);
    fl.rotation.z = Math.PI / 2;
    fl.position.set(nx, bodyTopY + headH * 0.72 + 0.22, nz);
    g.add(noz, fl);
  }

  // 右侧全高带防滑横棍工业直爬梯（参考 TK-101 侧梯）
  if (withLadder) {
    const ladX = radius + 0.085;
    const ladW = 0.24;
    const ladBot = plinthH + 0.04;
    const ladTop = bodyTopY + headH * 0.55 + (withTopRail ? 0.56 : 0.18);
    const ladH = ladTop - ladBot;
    for (const sz of [-ladW * 0.5, ladW * 0.5]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, ladH, 8), M.stainless());
      rail.position.set(ladX, ladBot + ladH * 0.5, sz);
      g.add(rail);
    }
    const rungStep = 0.22;
    for (let ry = ladBot + 0.16; ry < ladTop - 0.1; ry += rungStep) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, ladW, 8), M.stainless());
      rung.rotation.x = Math.PI / 2;
      rung.position.set(ladX, ry, 0);
      g.add(rung);
    }
    // 爬梯与罐壁固定支撑耳
    for (const ry of [bodyBottomY + 0.2, bodyCenterY, bodyTopY - 0.1]) {
      for (const sz of [-ladW * 0.5, ladW * 0.5]) {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.025), M.darkSteel());
        bracket.position.set(radius + 0.04, ry, sz);
        g.add(bracket);
      }
    }
  }

  // 正前偏右侧磁翻板液位计与铭牌
  if (withSightGlass) {
    const sgZ = radius + 0.065;
    const sgH = bodyH * 0.68;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, sgH, 12), M.stainless());
    tube.position.set(-radius * 0.24, bodyCenterY, sgZ);
    g.add(tube);
    for (const dy of [-sgH * 0.45, sgH * 0.45]) {
      const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 10), M.stainless());
      conn.rotation.x = Math.PI / 2;
      conn.position.set(-radius * 0.24, bodyCenterY + dy, radius + 0.025);
      g.add(conn);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.012), M.nameplate());
    plate.position.set(0.08, bodyCenterY + 0.12, radius + 0.008);
    g.add(plate);
  }

  return { group: g, bodyBottomY, bodyCenterY, bodyTopY, plinthH };
}

// =====================================================================
// 1. TANK：工艺立式缓冲储罐（参考 TK-101 / TK-102 / TK-103）
// =====================================================================
function buildTank() {
  const { group: g, bodyBottomY, bodyTopY } = makeVerticalVessel({
    radius: 0.54,
    bodyH: 1.68,
    headH: 0.3,
    legs: 6,
    legH: 0.48,
    plinthH: 0.18,
    withTopRail: true,
    withLadder: true,
    withSightGlass: true,
  });

  // 左右工艺接管（底部出液法兰 + 上部进液弯接管）
  const pipeInY = bodyTopY - 0.16;
  const inPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.38, 18), M.stainless());
  inPipe.rotation.z = Math.PI / 2;
  inPipe.position.set(-0.62, pipeInY, 0);
  const fIn = makeFlangeAssembly(0.14, 0.075, 8);
  fIn.position.set(-0.81, pipeInY, 0);
  g.add(inPipe, fIn);

  const pipeOutY = bodyBottomY + 0.18;
  const outPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.38, 18), M.stainless());
  outPipe.rotation.z = Math.PI / 2;
  outPipe.position.set(0.62, pipeOutY, 0);
  const fOut = makeFlangeAssembly(0.14, 0.075, 8);
  fOut.position.set(0.81, pipeOutY, 0);
  g.add(outPipe, fOut);

  const gauge = makeDialGauge(0.068);
  gauge.position.set(-0.32, bodyTopY - 0.05, 0.56);
  g.add(gauge);

  addPort(g, 'in', -0.83, pipeInY, 0, -1, 0, 0);
  addPort(g, 'out', 0.83, pipeOutY, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 2. WATER_PUMP：重型变频离心泵组（完全对标 P-201 / P-203）
// =====================================================================
function buildWaterPump() {
  const g = new THREE.Group();
  const plinthH = 0.16;
  g.add(
    makeConcretePlinth(1.74, plinthH, 0.86, [
      [-0.74, -0.31],
      [0.74, -0.31],
      [-0.74, 0.31],
      [0.74, 0.31],
    ]),
  );

  // 铸铁重型共面机座
  const skidDeck = makeBeveledBox(1.48, 0.07, 0.6, 0.012, M.castIron());
  skidDeck.position.set(0, plinthH + 0.035, 0);
  g.add(skidDeck);

  const shaftY = plinthH + 0.34;
  // 工业钴蓝离心蜗壳泵头
  const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.17, 24), M.industrialBlue());
  volute.rotation.z = Math.PI / 2;
  volute.position.set(-0.46, shaftY, 0);
  g.add(volute);

  // 蜗壳加强耳肋
  const pumpFoot = makeBeveledBox(0.26, 0.14, 0.32, 0.01, M.industrialBlue());
  pumpFoot.position.set(-0.46, plinthH + 0.14, 0);
  g.add(pumpFoot);

  // 吸入短管 + 法兰 (左侧)
  const sucPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.095, 0.28, 20), M.industrialBlue());
  sucPipe.rotation.z = Math.PI / 2;
  sucPipe.position.set(-0.66, shaftY, 0);
  const fIn = makeFlangeAssembly(0.16, 0.088, 8);
  fIn.position.set(-0.8, shaftY, 0);
  g.add(sucPipe, fIn);

  // 顶部吐出直立颈管 + 法兰 + 压力表（也可向右弯出接管道，出口设在右前方便水平接管）
  const disPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.088, 0.34, 20), M.industrialBlue());
  disPipe.position.set(-0.46, shaftY + 0.24, 0);
  const fOut = makeFlangeAssembly(0.15, 0.082, 8);
  fOut.rotation.z = Math.PI / 2;
  fOut.position.set(-0.46, shaftY + 0.41, 0);
  g.add(disPipe, fOut);

  // 泵头轴承托架
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 18), M.castIron());
  bearing.rotation.z = Math.PI / 2;
  bearing.position.set(-0.28, shaftY, 0);
  g.add(bearing);

  // 标志性细节：不锈钢冲孔金属网联轴器安全护罩（可隐约透视内部传动轴）
  const shaftCore = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.26, 14), M.castIron());
  shaftCore.rotation.z = Math.PI / 2;
  shaftCore.position.set(-0.08, shaftY, 0);
  const couplingFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.06, 16), M.stainless());
  couplingFlange.rotation.z = Math.PI / 2;
  couplingFlange.position.set(-0.08, shaftY, 0);
  g.add(shaftCore, couplingFlange);

  const guardArch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.24, 20, 1, true, -Math.PI * 0.65, Math.PI * 1.3),
    M.perforatedMetal(),
  );
  guardArch.rotation.z = Math.PI / 2;
  guardArch.rotation.x = Math.PI * 0.5;
  guardArch.position.set(-0.08, shaftY, 0);
  g.add(guardArch);

  for (const gx of [-0.19, 0.03]) {
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.011, 8, 20), M.stainless());
    rimRing.rotation.y = Math.PI / 2;
    rimRing.position.set(gx, shaftY, 0);
    g.add(rimRing);
  }

  // 后置 YE3 钴蓝散热片重型电机
  const motor = makeIndustrialMotor({ radius: 0.19, length: 0.48, bodyMat: M.industrialBlue(), ribCount: 20 });
  motor.position.set(0.32, shaftY, 0);
  g.add(motor);

  const gauge = makeDialGauge(0.055);
  gauge.position.set(-0.46, shaftY + 0.3, 0.14);
  const nameplate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.085, 0.01), M.nameplate());
  nameplate.position.set(0.3, shaftY + 0.02, 0.21);
  g.add(gauge, nameplate);

  addPort(g, 'in', -0.82, shaftY, 0, -1, 0, 0);
  addPort(g, 'out', -0.46, shaftY + 0.43, 0, 0, 1, 0);
  return g;
}

// =====================================================================
// 3. HEAT_EXCHANGER：板式换热器（1:1 复刻 HX-301 板式换热器）
// =====================================================================
function buildHeatExchanger() {
  const g = new THREE.Group();
  const plinthH = 0.16;
  g.add(
    makeConcretePlinth(1.26, plinthH, 0.94, [
      [-0.48, -0.34],
      [0.48, -0.34],
      [-0.48, 0.34],
      [0.48, 0.34],
    ]),
  );

  const footY = plinthH + 0.035;
  const frameH = 1.38;
  const frameW = 0.64;
  const frameCenterY = footY + frameH * 0.5;

  // 前固定压紧板（工业钴蓝加厚钢板 + 侧缘螺栓孔位加强筋）
  const frontPlate = makeBeveledBox(0.1, frameH, frameW, 0.014, M.industrialBlue());
  frontPlate.position.set(-0.34, frameCenterY, 0);
  const backPlate = makeBeveledBox(0.09, frameH, frameW, 0.014, M.industrialBlue());
  backPlate.position.set(0.28, frameCenterY, 0);
  g.add(frontPlate, backPlate);

  // 压紧板底部重型地脚座
  for (const px of [-0.34, 0.28]) {
    const leg = makeBeveledBox(0.14, 0.07, frameW + 0.08, 0.008, M.castIron());
    leg.position.set(px, plinthH + 0.035, 0);
    g.add(leg);
  }

  // 右端落地导杆支撑柱（鹅颈柱）
  const endColumn = makeBeveledBox(0.09, frameH + 0.14, 0.12, 0.01, M.industrialBlue());
  endColumn.position.set(0.48, frameCenterY + 0.05, 0);
  const colFoot = makeBeveledBox(0.16, 0.06, 0.24, 0.008, M.castIron());
  colFoot.position.set(0.48, plinthH + 0.03, 0);
  g.add(endColumn, colFoot);

  // 上下两根 304 不锈钢圆柱形导杆贯穿前后
  const topGuideY = footY + frameH + 0.04;
  const botGuideY = footY + 0.08;
  for (const gy of [topGuideY, botGuideY]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.94, 16), M.stainless());
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0.06, gy, 0);
    g.add(bar);
  }

  // 核心波纹不锈钢板片叠层组（HX-301 最具辨识度的密排板片芯体）
  const packCore = new THREE.Mesh(new THREE.BoxGeometry(0.51, frameH - 0.16, frameW - 0.1), M.hxPlates());
  packCore.position.set(-0.03, frameCenterY, 0);
  g.add(packCore);

  // 四角 / 中部 8 根高强夹紧拉杆螺栓与六角螺母
  const rodMat = M.stainless();
  const nutMat = M.darkSteel();
  const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.78, 12);
  const nutGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 6);
  for (const sz of [-frameW * 0.44, frameW * 0.44]) {
    for (const sy of [footY + 0.18, footY + 0.52, footY + 0.88, footY + 1.2]) {
      const rod = new THREE.Mesh(boltGeo, rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(-0.03, sy, sz);
      g.add(rod);
      for (const nx of [-0.41, 0.35]) {
        const nut = new THREE.Mesh(nutGeo, nutMat);
        nut.rotation.z = Math.PI / 2;
        nut.position.set(nx, sy, sz);
        g.add(nut);
      }
    }
  }

  // 4 个大口径热侧（不锈钢）与冷侧（钴蓝）接管及法兰
  const portSpecs = [
    { id: 'in', y: footY + frameH - 0.24, z: -0.16, xSide: -1, mat: M.stainless() },
    { id: 'out', y: footY + frameH - 0.24, z: 0.16, xSide: 1, mat: M.stainless() },
    { id: 'cold_in', y: footY + 0.24, z: -0.16, xSide: -1, mat: M.industrialBlue() },
    { id: 'cold_out', y: footY + 0.24, z: 0.16, xSide: 1, mat: M.industrialBlue() },
  ];
  for (const ps of portSpecs) {
    const startX = ps.xSide < 0 ? -0.44 : 0.38;
    const endX = ps.xSide < 0 ? -0.57 : 0.51;
    const midX = (startX + endX) * 0.5;
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.22, 18), ps.mat);
    noz.rotation.z = Math.PI / 2;
    noz.position.set(midX, ps.y, ps.z);
    const fl = makeFlangeAssembly(0.128, 0.068, 8, ps.mat);
    fl.position.set(endX, ps.y, ps.z);
    g.add(noz, fl);
    addPort(g, ps.id, endX + ps.xSide * 0.02, ps.y, ps.z, ps.xSide, 0, 0);
  }

  const nameplate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.22), M.nameplate());
  nameplate.position.set(-0.395, frameCenterY + 0.18, 0);
  g.add(nameplate);

  return g;
}

// =====================================================================
// 4. HENG_GUANG_SKID：重工业双路调压计量撬（304不锈钢管汇 + 铸铁机架）
// =====================================================================
function buildHengGuangSkid() {
  const g = new THREE.Group();
  const plinthH = 0.12;
  g.add(
    makeConcretePlinth(2.96, plinthH, 1.72, [
      [-1.32, -0.7],
      [1.32, -0.7],
      [-1.32, 0.7],
      [1.32, 0.7],
    ]),
  );

  // 槽钢橇座平台
  const frameH = 0.09;
  const frameY = plinthH + frameH * 0.5;
  const baseBeam = makeBeveledBox(2.74, frameH, 1.5, 0.012, M.castIron());
  baseBeam.position.y = frameY;
  const deckPlate = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.018, 1.4), M.diamondPlate());
  deckPlate.position.y = plinthH + frameH + 0.009;
  g.add(baseBeam, deckPlate);

  const deckTopY = plinthH + frameH + 0.018;
  const pipeY = deckTopY + 0.42;
  const pipeR = 0.062;
  const pipeMat = M.stainless();

  // 进口集管 & 出口汇管
  g.add(makePipeSpan([-1.14, pipeY, -0.44], [-1.14, pipeY, 0.44], pipeR * 1.15, pipeMat));
  g.add(makePipeSpan([1.14, pipeY, -0.44], [1.14, pipeY, 0.44], pipeR * 1.15, pipeMat));
  g.add(makePipeSpan([-1.36, pipeY, 0], [-1.14, pipeY, 0], pipeR * 1.15, pipeMat));
  g.add(makePipeSpan([1.14, pipeY, 0], [1.36, pipeY, 0], pipeR * 1.15, pipeMat));

  const fIn = makeFlangeAssembly(0.145, pipeR * 1.15, 8);
  fIn.position.set(-1.36, pipeY, 0);
  const fOut = makeFlangeAssembly(0.145, pipeR * 1.15, 8);
  fOut.position.set(1.36, pipeY, 0);
  g.add(fIn, fOut);

  // 管道立柱支架
  for (const [sx, sz] of [
    [-1.14, -0.4],
    [-1.14, 0.4],
    [1.14, -0.4],
    [1.14, 0.4],
  ]) {
    const post = makePipeStanchion(sx, pipeY, sz, pipeR * 1.15);
    post.position.y = deckTopY;
    post.scale.y = (pipeY - deckTopY) / pipeY;
    g.add(post);
  }

  // 主副双路工艺支路（z = ±0.42）：卧式过滤筒 + 调压器 + 流量计 + 手轮球阀
  for (const branchZ of [-0.42, 0.42]) {
    g.add(makePipeSpan([-1.14, pipeY, branchZ], [1.14, pipeY, branchZ], pipeR, pipeMat));

    // 两端截断法兰与手轮阀
    for (const vx of [-0.88, 0.88]) {
      const flL = makeFlangeAssembly(0.115, pipeR, 6);
      flL.position.set(vx - 0.11, pipeY, branchZ);
      const flR = makeFlangeAssembly(0.115, pipeR, 6);
      flR.position.set(vx + 0.11, pipeY, branchZ);
      const valveBody = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 14), M.castIron());
      valveBody.position.set(vx, pipeY, branchZ);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.17, 10), M.stainless());
      stem.position.set(vx, pipeY + 0.12, branchZ);
      const hw = makeHandwheel(0.115, branchZ < 0 ? M.industrialBlue() : M.stainless());
      hw.position.set(vx, pipeY + 0.21, branchZ);
      g.add(flL, flR, valveBody, stem, hw);
    }

    // 卧式旋风过滤器
    const filterDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.145, 0.42, 24),
      M.stainless(),
    );
    filterDrum.rotation.z = Math.PI / 2;
    filterDrum.position.set(-0.42, pipeY, branchZ);
    const filterSeam = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.008, 8, 24), M.weldSeam());
    filterSeam.rotation.y = Math.PI / 2;
    filterSeam.position.set(-0.42, pipeY, branchZ);
    const gauge = makeDialGauge(0.058);
    gauge.position.set(-0.42, pipeY + 0.2, branchZ + 0.06);
    g.add(filterDrum, filterSeam, gauge);

    // 指挥器调压阀
    const regCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.09, 24),
      branchZ < 0 ? M.industrialBlue() : M.castIron(),
    );
    regCap.position.set(0.02, pipeY + 0.17, branchZ);
    const regTower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.068, 0.18, 16), M.stainless());
    regTower.position.set(0.02, pipeY + 0.3, branchZ);
    g.add(regCap, regTower);

    // 超声/涡轮流量计段
    const meterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.26, 20), M.stainless());
    meterBody.rotation.z = Math.PI / 2;
    meterBody.position.set(0.46, pipeY, branchZ);
    const meterHead = makeBeveledBox(0.14, 0.13, 0.11, 0.01, M.industrialBlue());
    meterHead.position.set(0.46, pipeY + 0.21, branchZ);
    const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.01), M.screen());
    lcd.position.set(0.46, pipeY + 0.21, branchZ + 0.056);
    g.add(meterBody, meterHead, lcd);
  }

  // 防爆现场数据控制箱（右侧边缘独立不锈钢立柱）
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.065, 1.15, 0.065), M.castIron());
  post.position.set(0.84, deckTopY + 0.575, 0.66);
  const cab = makeBeveledBox(0.42, 0.52, 0.24, 0.012, M.stainless());
  cab.position.set(0.84, deckTopY + 0.96, 0.66);
  const hmi = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.012), M.screen());
  hmi.position.set(0.84, deckTopY + 1.0, 0.785);
  const accentStrip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.036, 0.014), M.industrialBlue());
  accentStrip.position.set(0.84, deckTopY + 1.18, 0.782);
  g.add(post, cab, hmi, accentStrip);

  addPort(g, 'in', -1.39, pipeY, 0, -1, 0, 0);
  addPort(g, 'out', 1.39, pipeY, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 5. FS：立式旋风分离过滤器（重工业全套不锈钢梯栏+混凝土基座）
// =====================================================================
function buildFilterSeparator() {
  const { group: g, bodyBottomY, bodyTopY } = makeVerticalVessel({
    radius: 0.4,
    bodyH: 1.48,
    headH: 0.24,
    legs: 4,
    legH: 0.42,
    plinthH: 0.14,
    withTopRail: true,
    withLadder: true,
    withSightGlass: true,
  });

  const inY = bodyTopY - 0.34;
  const outY = bodyBottomY + 0.32;
  const pipeIn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 18), M.stainless());
  pipeIn.rotation.z = Math.PI / 2;
  pipeIn.position.set(-0.48, inY, 0);
  const fIn = makeFlangeAssembly(0.145, 0.08, 8);
  fIn.position.set(-0.65, inY, 0);

  const pipeOut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 18), M.stainless());
  pipeOut.rotation.z = Math.PI / 2;
  pipeOut.position.set(0.48, outY, 0);
  const fOut = makeFlangeAssembly(0.145, 0.08, 8);
  fOut.position.set(0.65, outY, 0);
  g.add(pipeIn, fIn, pipeOut, fOut);

  // 快开盲板盖 & 差压表
  const closure = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 20), M.industrialBlue());
  closure.position.set(0, bodyTopY + 0.24 + 0.06, 0);
  const dpGauge = makeDialGauge(0.062);
  dpGauge.position.set(-0.22, (inY + outY) * 0.5, 0.42);
  g.add(closure, dpGauge);

  addPort(g, 'in', -0.67, inY, 0, -1, 0, 0);
  addPort(g, 'out', 0.67, outY, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 6. DOSING_TANK：加药搅拌反应罐（不锈钢罐 + 钴蓝减速机电机 + 梯栏）
// =====================================================================
function buildDosingTank() {
  const { group: g, bodyBottomY, bodyTopY } = makeVerticalVessel({
    radius: 0.44,
    bodyH: 1.15,
    headH: 0.18,
    legs: 4,
    legH: 0.32,
    plinthH: 0.14,
    withTopRail: true,
    withLadder: false,
    withSightGlass: true,
    topNozzleCount: 1,
  });

  // 顶部中心立式搅拌减速电机
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.1, 18), M.castIron());
  mount.position.set(0, bodyTopY + 0.22, 0);
  const agitator = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 20), M.industrialBlue());
  agitator.position.set(0, bodyTopY + 0.4, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 20), M.castIron());
  cap.position.set(0, bodyTopY + 0.57, 0);
  g.add(mount, agitator, cap);

  const portY = bodyBottomY + 0.14;
  const pIn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 16), M.stainless());
  pIn.rotation.z = Math.PI / 2;
  pIn.position.set(-0.48, bodyTopY - 0.15, 0);
  const fIn = makeFlangeAssembly(0.105, 0.055, 6);
  fIn.position.set(-0.6, bodyTopY - 0.15, 0);

  const pOut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 16), M.stainless());
  pOut.rotation.z = Math.PI / 2;
  pOut.position.set(0.48, portY, 0);
  const fOut = makeFlangeAssembly(0.105, 0.055, 6);
  fOut.position.set(0.6, portY, 0);
  g.add(pIn, fIn, pOut, fOut);

  addPort(g, 'in', -0.62, bodyTopY - 0.15, 0, -1, 0, 0);
  addPort(g, 'out', 0.62, portY, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 7-11. 阀门与变送器统一高精重工业结构：HOV / MOV / SSV / PCV / PV / INSTR
// =====================================================================
function makeValveCore(pipeR = 0.088, bodyMat = M.stainless()) {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, 0.66, 22), M.stainless());
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const centerBody = new THREE.Mesh(new THREE.SphereGeometry(pipeR * 1.5, 22, 18), bodyMat);
  g.add(centerBody);
  const midFlange = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.68, pipeR * 1.68, 0.036, 22), M.stainless());
  midFlange.position.y = pipeR * 0.95;
  g.add(midFlange);
  const f1 = makeFlangeAssembly(pipeR * 1.78, pipeR, 8);
  f1.position.x = -0.33;
  const f2 = makeFlangeAssembly(pipeR * 1.78, pipeR, 8);
  f2.position.x = 0.33;
  g.add(f1, f2);
  addPort(g, 'in', -0.35, 0, 0, -1, 0, 0);
  addPort(g, 'out', 0.35, 0, 0, 1, 0, 0);
  return g;
}

function buildValveHOV() {
  const g = makeValveCore(0.088, M.castIron());
  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.24, 18), M.stainless());
  bonnet.position.y = 0.19;
  const yoke = makeBeveledBox(0.14, 0.16, 0.06, 0.006, M.castIron());
  yoke.position.y = 0.34;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 12), M.stainless());
  stem.position.y = 0.42;
  const hw = makeHandwheel(0.16, M.stainless());
  hw.position.y = 0.5;
  g.add(bonnet, yoke, stem, hw);
  return g;
}

function buildValveMOV() {
  const g = makeValveCore(0.088, M.castIron());
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.22, 18), M.stainless());
  neck.position.y = 0.18;
  const actBody = makeBeveledBox(0.28, 0.24, 0.24, 0.014, M.industrialBlue());
  actBody.position.y = 0.38;
  const motorSide = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.2, 18), M.castIron());
  motorSide.rotation.z = Math.PI / 2;
  motorSide.position.set(-0.2, 0.38, 0);
  const hw = makeHandwheel(0.11, M.stainless());
  hw.rotation.z = Math.PI / 2;
  hw.position.set(0.19, 0.38, 0);
  const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.01), M.screen());
  indicator.position.set(0, 0.39, 0.122);
  g.add(neck, actBody, motorSide, hw, indicator);
  return g;
}

function buildValveSSV() {
  const g = makeValveCore(0.088, M.castIron());
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.18, 18), M.stainless());
  neck.position.y = 0.18;
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.38, 22), M.castIron());
  cylinder.position.y = 0.44;
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.04, 22), M.stainless());
  topCap.position.y = 0.65;
  const redBand = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.036, 22), M.paintRed());
  redBand.position.y = 0.61;
  const solenoid = makeBeveledBox(0.12, 0.13, 0.12, 0.008, M.industrialBlue());
  solenoid.position.set(0.17, 0.4, 0.05);
  g.add(neck, cylinder, topCap, redBand, solenoid);
  return g;
}

function buildValvePCV() {
  const g = makeValveCore(0.088, M.stainless());
  const diaphragm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 26), M.industrialBlue());
  diaphragm.position.y = 0.24;
  const rimBoltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const b = new THREE.Mesh(rimBoltGeo, M.stainless());
    b.position.set(Math.cos(a) * 0.2, 0.24, Math.sin(a) * 0.2);
    g.add(b);
  }
  const springTower = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.28, 18), M.stainless());
  springTower.position.y = 0.42;
  const pilot = makeBeveledBox(0.11, 0.14, 0.11, 0.008, M.castIron());
  pilot.position.set(0.16, 0.38, 0.12);
  g.add(diaphragm, springTower, pilot);
  return g;
}

function buildValvePV() {
  const g = new THREE.Group();
  const baseFlange = makeFlangeAssembly(0.155, 0.08, 8);
  baseFlange.rotation.z = Math.PI / 2;
  baseFlange.position.y = 0.02;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.26, 20), M.castIron());
  body.position.y = 0.15;
  const sideFlange = makeFlangeAssembly(0.145, 0.075, 8);
  sideFlange.position.set(0.24, 0.15, 0);
  const sideNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 18), M.stainless());
  sideNeck.rotation.z = Math.PI / 2;
  sideNeck.position.set(0.13, 0.15, 0);

  const springBonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.36, 20), M.stainless());
  springBonnet.position.y = 0.44;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.09, 20), M.paintRed());
  cap.position.y = 0.65;
  const gauge = makeDialGauge(0.05);
  gauge.position.set(0, 0.2, 0.12);
  g.add(baseFlange, body, sideNeck, sideFlange, springBonnet, cap, gauge);

  addPort(g, 'in', 0, 0, 0, 0, -1, 0);
  addPort(g, 'out', 0.26, 0.15, 0, 1, 0, 0);
  return g;
}

function buildInstr() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 12), M.stainless());
  stem.position.y = 0.15;
  const manifold = makeBeveledBox(0.11, 0.11, 0.09, 0.008, M.stainless());
  manifold.position.y = 0.32;
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 22), M.industrialBlue());
  housing.rotation.x = Math.PI / 2;
  housing.position.y = 0.45;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.145, 22), M.screen());
  face.rotation.x = Math.PI / 2;
  face.position.y = 0.45;
  const topBox = makeBeveledBox(0.13, 0.07, 0.09, 0.006, M.castIron());
  topBox.position.y = 0.56;
  g.add(stem, manifold, housing, face, topBox);
  addPort(g, 'in', 0, 0, 0, 0, -1, 0);
  addPort(g, 'out', 0, 0.56, 0, 0, 1, 0);
  return g;
}

// =====================================================================
// 12-15. 燃气表、流量计、电磁流量计、音速喷嘴标定台
// =====================================================================
function buildMagMeter() {
  const g = new THREE.Group();
  const basePlate = makeConcretePlinth(0.84, 0.1, 0.54);
  g.add(basePlate);
  const pipeY = 0.34;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.56, 24), M.industrialBlue());
  body.rotation.z = Math.PI / 2;
  body.position.y = pipeY;
  const centerWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.24, 24), M.stainless());
  centerWrap.rotation.z = Math.PI / 2;
  centerWrap.position.y = pipeY;
  const f1 = makeFlangeAssembly(0.185, 0.12, 8);
  f1.position.set(-0.29, pipeY, 0);
  const f2 = makeFlangeAssembly(0.185, 0.12, 8);
  f2.position.set(0.29, pipeY, 0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.22, 14), M.stainless());
  neck.position.set(0, pipeY + 0.22, 0);
  const head = makeBeveledBox(0.22, 0.18, 0.15, 0.012, M.castIron());
  head.position.set(0, pipeY + 0.4, 0);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.01), M.screen());
  scr.position.set(0, pipeY + 0.4, 0.078);
  g.add(body, centerWrap, f1, f2, neck, head, scr);

  addPort(g, 'in', -0.31, pipeY, 0, -1, 0, 0);
  addPort(g, 'out', 0.31, pipeY, 0, 1, 0, 0);
  return g;
}

function buildUltrasonicMeter() {
  const g = new THREE.Group();
  const cradle = makeConcretePlinth(0.86, 0.1, 0.52);
  g.add(cradle);
  const pipeY = 0.32;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.68, 24), M.stainless());
  tube.rotation.z = Math.PI / 2;
  tube.position.y = pipeY;
  const f1 = makeFlangeAssembly(0.175, 0.115, 8);
  f1.position.set(-0.34, pipeY, 0);
  const f2 = makeFlangeAssembly(0.175, 0.115, 8);
  f2.position.set(0.34, pipeY, 0);
  g.add(tube, f1, f2);

  // 超声波声道传感器探头斜插对角分布
  for (const sx of [-0.14, 0.14]) {
    const transducer = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 12), M.castIron());
    transducer.rotation.z = sx < 0 ? 0.55 : -0.55;
    transducer.position.set(sx, pipeY + 0.09, 0.095);
    g.add(transducer);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.18, 12), M.stainless());
  neck.position.set(0, pipeY + 0.19, 0);
  const flowComputer = makeBeveledBox(0.24, 0.18, 0.15, 0.012, M.industrialBlue());
  flowComputer.position.set(0, pipeY + 0.35, 0);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.01), M.screen());
  scr.position.set(0, pipeY + 0.35, 0.077);
  g.add(neck, flowComputer, scr);

  addPort(g, 'in', -0.36, pipeY, 0, -1, 0, 0);
  addPort(g, 'out', 0.36, pipeY, 0, 1, 0, 0);
  return g;
}

function buildRootsMeter() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(0.92, 0.1, 0.56));
  const pipeY = 0.34;
  const waist = makeBeveledBox(0.36, 0.28, 0.32, 0.025, M.castIron());
  waist.position.y = pipeY;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 22), M.stainless());
  tube.rotation.z = Math.PI / 2;
  tube.position.y = pipeY;
  const f1 = makeFlangeAssembly(0.175, 0.11, 8);
  f1.position.set(-0.36, pipeY, 0);
  const f2 = makeFlangeAssembly(0.175, 0.11, 8);
  f2.position.set(0.36, pipeY, 0);

  const counterHead = makeBeveledBox(0.24, 0.19, 0.16, 0.012, M.stainless());
  counterHead.position.set(0, pipeY + 0.25, 0);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.012), M.meterCounter());
  face.position.set(0, pipeY + 0.25, 0.082);
  const cap = makeBeveledBox(0.2, 0.04, 0.12, 0.006, M.industrialBlue());
  cap.position.set(0, pipeY + 0.36, 0);
  g.add(waist, tube, f1, f2, counterHead, face, cap);

  addPort(g, 'in', -0.38, pipeY, 0, -1, 0, 0);
  addPort(g, 'out', 0.38, pipeY, 0, 1, 0, 0);
  return g;
}

function buildMembraneMeter() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(0.66, 0.08, 0.46));
  const body = makeBeveledBox(0.46, 0.52, 0.3, 0.024, M.castAluminum());
  body.position.y = 0.36;
  const belt = makeBeveledBox(0.48, 0.036, 0.32, 0.008, M.stainless());
  belt.position.y = 0.44;
  const badge = makeBeveledBox(0.32, 0.18, 0.02, 0.005, M.darkSteel());
  badge.position.set(0, 0.44, 0.155);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.012), M.meterCounter());
  counter.position.set(0, 0.44, 0.168);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.01), M.nameplate());
  plate.position.set(0, 0.25, 0.156);
  g.add(body, belt, badge, counter, plate);

  for (const sx of [-0.14, 0.14]) {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.14, 14), M.stainless());
    neck.position.set(sx, 0.67, 0);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.042, 6), M.stainless());
    nut.position.set(sx, 0.72, 0);
    g.add(neck, nut);
  }
  addPort(g, 'in', -0.14, 0.74, 0, 0, 1, 0);
  addPort(g, 'out', 0.14, 0.74, 0, 0, 1, 0);
  return g;
}

function buildCalibrationRig() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(2.36, 0.1, 1.18));
  const frame = makeBeveledBox(2.2, 0.08, 1.0, 0.01, M.castIron());
  frame.position.y = 0.14;
  const bench = makeBeveledBox(2.14, 0.05, 0.94, 0.008, M.stainless());
  bench.position.y = 0.84;
  g.add(frame, bench);

  for (const sx of [-0.98, 0.98]) {
    for (const sz of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.7, 0.065), M.castIron());
      leg.position.set(sx, 0.49, sz);
      g.add(leg);
    }
  }
  // 滞止压力容器稳压罐
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.64, 24), M.stainless());
  tank.position.set(-0.74, 1.18, -0.18);
  const topCap = new THREE.Mesh(makeEllipticalHead(0.2, 0.09), M.stainless());
  topCap.position.set(-0.74, 1.5, -0.18);
  g.add(tank, topCap);

  // 音速文丘里喷嘴组
  for (let i = 0; i < 4; i++) {
    const zPos = -0.26 + i * 0.18;
    const nPipe = makePipeSpan([-0.5, 1.08, zPos], [0.58, 1.08, zPos], 0.025, M.stainless());
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.03, 0.16, 16), M.industrialBlue());
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(0.04, 1.08, zPos);
    g.add(nPipe, nozzle);
  }
  const hmiBox = makeBeveledBox(0.46, 0.36, 0.2, 0.012, M.castIron());
  hmiBox.position.set(0.76, 1.24, 0);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.012), M.screen());
  scr.position.set(0.76, 1.24, 0.102);
  g.add(hmiBox, scr);

  addPort(g, 'in', -1.06, 1.06, 0, -1, 0, 0);
  addPort(g, 'out', 1.06, 1.06, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 16-19. 制造工艺线设备（统一沉稳深钢灰 + 304拉丝不锈钢 + 克制钴蓝）
// =====================================================================
function buildConveyorLine() {
  const g = new THREE.Group();
  const railH = 0.78;
  for (const sx of [-1.05, 0, 1.05]) {
    for (const sz of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, railH, 0.055), M.castIron());
      leg.position.set(sx, railH * 0.5, sz);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), M.stainless());
      pad.position.set(sx, 0.01, sz);
      g.add(leg, pad);
    }
  }
  for (const sz of [-0.32, 0.32]) {
    const beam = makeBeveledBox(2.4, 0.1, 0.045, 0.008, M.steelSlate());
    beam.position.set(0, railH, sz);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.028, 0.016), M.stainless());
    guard.position.set(0, railH + 0.09, sz > 0 ? 0.28 : -0.28);
    g.add(beam, guard);
  }
  const rollerGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.58, 12);
  const rMat = M.stainless();
  for (let i = -10; i <= 10; i++) {
    const roller = new THREE.Mesh(rollerGeo, rMat);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(i * 0.105, railH + 0.036, 0);
    g.add(roller);
  }
  const motor = makeIndustrialMotor({ radius: 0.085, length: 0.22, bodyMat: M.industrialBlue(), ribCount: 12 });
  motor.position.set(0.65, railH - 0.14, 0.42);
  g.add(motor);

  addPort(g, 'in', -1.2, railH + 0.04, 0, -1, 0, 0);
  addPort(g, 'out', 1.2, railH + 0.04, 0, 1, 0, 0);
  return g;
}

function buildRobotStation() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(1.12, 0.1, 1.12));
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.42, 20), M.castIron());
  pedestal.position.y = 0.31;
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 20), M.industrialBlue());
  turret.position.y = 0.62;
  const arm1 = makeBeveledBox(0.13, 0.56, 0.13, 0.014, M.stainless());
  arm1.position.set(-0.08, 0.96, 0);
  arm1.rotation.z = 0.32;
  const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 16), M.castIron());
  joint.rotation.x = Math.PI / 2;
  joint.position.set(-0.18, 1.22, 0);
  const arm2 = makeBeveledBox(0.46, 0.1, 0.1, 0.012, M.stainless());
  arm2.position.set(0.06, 1.28, 0);
  arm2.rotation.z = -0.25;
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.14, 14), M.industrialBlue());
  wrist.position.set(0.29, 1.18, 0);
  g.add(pedestal, turret, arm1, joint, arm2, wrist);

  addPort(g, 'in', -0.56, 0.5, 0, -1, 0, 0);
  addPort(g, 'out', 0.56, 0.5, 0, 1, 0, 0);
  return g;
}

function buildLeakTestBench() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(1.56, 0.09, 0.98));
  const frame = makeBeveledBox(1.42, 0.72, 0.84, 0.014, M.castIron());
  frame.position.y = 0.45;
  const top = makeBeveledBox(1.46, 0.05, 0.88, 0.008, M.stainless());
  top.position.y = 0.83;
  const chamber = makeBeveledBox(0.9, 0.44, 0.58, 0.012, M.stainless());
  chamber.position.set(-0.1, 1.07, 0);
  const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.32, 0.015), M.glass());
  windowMesh.position.set(-0.1, 1.08, 0.292);
  const ctrlBox = makeBeveledBox(0.32, 0.44, 0.46, 0.01, M.industrialBlue());
  ctrlBox.position.set(0.52, 1.07, 0);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.012), M.screen());
  scr.position.set(0.52, 1.12, 0.232);
  g.add(frame, top, chamber, windowMesh, ctrlBox, scr);

  addPort(g, 'in', -0.76, 0.72, 0, -1, 0, 0);
  addPort(g, 'out', 0.76, 0.72, 0, 1, 0, 0);
  return g;
}

function buildLaserMarker() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(1.24, 0.09, 1.04));
  const cabinet = makeBeveledBox(1.1, 0.72, 0.9, 0.014, M.castIron());
  cabinet.position.y = 0.45;
  const enclosure = makeBeveledBox(0.92, 0.58, 0.76, 0.012, M.stainless());
  enclosure.position.y = 1.1;
  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.015), M.glass());
  frontGlass.position.set(-0.08, 1.12, 0.382);
  const laserCol = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 14), M.industrialBlue());
  laserCol.position.set(-0.08, 1.16, 0);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.012), M.screen());
  scr.position.set(0.32, 1.16, 0.382);
  g.add(cabinet, enclosure, frontGlass, laserCol, scr);

  addPort(g, 'in', -0.58, 0.85, 0, -1, 0, 0);
  addPort(g, 'out', 0.58, 0.85, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 20-22. 报警监控与防爆（克制防爆灰/不锈钢+灯罩）
// =====================================================================
function buildGasDetector() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(0.36, 0.08, 0.36));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1.38, 14), M.stainless());
  pole.position.y = 0.77;
  const junctionBox = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 20), M.castIron());
  junctionBox.rotation.x = Math.PI / 2;
  junctionBox.position.set(0, 1.48, 0);
  const screen = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.126, 20), M.screen());
  screen.rotation.x = Math.PI / 2;
  screen.position.set(0, 1.48, 0);
  const sensorHead = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.15, 16), M.stainless());
  sensorHead.position.set(0.11, 1.38, 0);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.08, 14), M.lampAmber());
  beacon.position.set(0, 1.62, 0);
  g.add(pole, junctionBox, screen, sensorHead, beacon);

  addPort(g, 'in', -0.14, 1.48, 0, -1, 0, 0);
  addPort(g, 'out', 0.14, 1.48, 0, 1, 0, 0);
  return g;
}

function buildAlarmTower() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(0.42, 0.09, 0.42));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 1.56, 16), M.stainless());
  pole.position.y = 0.87;
  const hornBox = makeBeveledBox(0.16, 0.14, 0.12, 0.01, M.castIron());
  hornBox.position.set(0, 1.58, 0);
  const tierRed = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.11, 20), M.lampRed());
  tierRed.position.y = 1.96;
  const tierAmber = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.11, 20), M.lampAmber());
  tierAmber.position.y = 1.84;
  const tierGreen = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.11, 20), M.lampGreen());
  tierGreen.position.y = 1.72;
  g.add(pole, hornBox, tierGreen, tierAmber, tierRed);

  addPort(g, 'in', 0, 0.6, 0.06, 0, 0, 1);
  addPort(g, 'out', 0, 0.6, -0.06, 0, 0, -1);
  return g;
}

function buildExplosionPanel() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(0.84, 0.1, 0.54));
  const box = makeBeveledBox(0.7, 1.15, 0.36, 0.016, M.castIron());
  box.position.y = 0.675;
  const doorRim = makeBeveledBox(0.62, 1.02, 0.03, 0.008, M.steelSlate());
  doorRim.position.set(0, 0.675, 0.175);
  const blueBand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.012), M.industrialBlue());
  blueBand.position.set(0, 1.1, 0.194);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.012), M.screen());
  scr.position.set(0, 0.86, 0.194);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.01), M.nameplate());
  plate.position.set(0, 0.36, 0.194);
  g.add(box, doorRim, blueBand, scr, plate);

  addPort(g, 'in', -0.37, 0.5, 0, -1, 0, 0);
  addPort(g, 'out', 0.37, 0.5, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 23-26. 能源与配电设备全量升级：PCS / BESS / TRANSFORMER / DIST_ROOM
// =====================================================================
function buildPcs() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(1.64, 0.12, 1.16));
  const body = makeBeveledBox(1.48, 1.72, 0.96, 0.016, M.steelSlate());
  body.position.y = 0.98;
  const roof = makeBeveledBox(1.54, 0.07, 1.04, 0.01, M.castIron());
  roof.position.y = 1.87;
  const headerBand = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 0.015), M.industrialBlue());
  headerBand.position.set(0, 1.66, 0.482);
  const hmi = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.015), M.screen());
  hmi.position.set(-0.34, 1.32, 0.482);
  for (const lx of [0.22, 0.44]) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.64, 0.02), M.darkSteel());
    louver.position.set(lx, 0.72, 0.482);
    g.add(louver);
  }
  const nameplate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.012), M.nameplate());
  nameplate.position.set(-0.34, 0.92, 0.482);
  g.add(body, roof, headerBand, hmi, nameplate);

  addPort(g, 'in', -0.78, 0.42, 0, -1, 0, 0);
  addPort(g, 'out', 0.78, 0.42, 0, 1, 0, 0);
  return g;
}

function buildBess() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(2.36, 0.14, 1.24));
  const shell = makeBeveledBox(2.2, 1.82, 1.08, 0.018, M.stainless());
  shell.position.y = 1.05;
  const topHvac = makeBeveledBox(1.2, 0.22, 0.72, 0.014, M.castIron());
  topHvac.position.set(-0.3, 2.07, 0);
  const blueStripe = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.12, 0.015), M.industrialBlue());
  blueStripe.position.set(0, 1.72, 0.542);
  for (const dx of [-0.68, 0, 0.68]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.38, 0.015), M.steelSlate());
    seam.position.set(dx, 0.92, 0.542);
    g.add(seam);
  }
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.02), M.screen());
  scr.position.set(0.68, 1.22, 0.552);
  g.add(shell, topHvac, blueStripe, scr);

  addPort(g, 'in', -1.14, 0.45, 0, -1, 0, 0);
  addPort(g, 'out', 1.14, 0.45, 0, 1, 0, 0);
  return g;
}

function buildTransformer() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(1.66, 0.14, 1.28));
  const oilTank = makeBeveledBox(1.14, 1.16, 0.84, 0.018, M.castIron());
  oilTank.position.y = 0.72;
  // 两侧折叠散热片组
  for (const sx of [-0.66, 0.66]) {
    for (let i = -3; i <= 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.92, 0.024), M.steelSlate());
      fin.position.set(sx, 0.72, i * 0.11);
      g.add(fin);
    }
  }
  // 顶部储油枕
  const conservator = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 20), M.industrialBlue());
  conservator.rotation.z = Math.PI / 2;
  conservator.position.set(-0.08, 1.56, -0.22);
  // 3 根高压陶瓷绝缘子套管
  for (const bx of [-0.3, 0, 0.3]) {
    const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.052, 0.34, 16), M.stainless());
    bush.position.set(bx, 1.47, 0.2);
    g.add(bush);
  }
  const dial = makeDialGauge(0.062);
  dial.position.set(0.32, 0.92, 0.43);
  g.add(oilTank, conservator, dial);

  addPort(g, 'in', -0.8, 0.6, 0, -1, 0, 0);
  addPort(g, 'out', 0.8, 0.6, 0, 1, 0, 0);
  return g;
}

function buildDistRoom() {
  const g = new THREE.Group();
  g.add(makeConcretePlinth(3.36, 0.16, 2.16));
  const cabin = makeBeveledBox(3.18, 2.08, 1.96, 0.02, M.steelSlate());
  cabin.position.y = 1.2;
  const roof = makeBeveledBox(3.28, 0.12, 2.08, 0.015, M.castIron());
  roof.position.y = 2.3;
  const blueBand = new THREE.Mesh(new THREE.BoxGeometry(3.16, 0.14, 0.016), M.industrialBlue());
  blueBand.position.set(0, 2.02, 0.985);
  for (const dx of [-0.95, 0.95]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.66, 0.025), M.castIron());
    door.position.set(dx, 1.0, 0.985);
    g.add(door);
  }
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.02), M.screen());
  scr.position.set(0, 1.38, 0.988);
  const acUnit = makeBeveledBox(0.54, 0.62, 0.26, 0.012, M.stainless());
  acUnit.position.set(-0.2, 1.28, -1.08);
  g.add(cabin, roof, blueBand, scr, acUnit);

  addPort(g, 'in', -1.64, 0.6, 0, -1, 0, 0);
  addPort(g, 'out', 1.64, 0.6, 0, 1, 0, 0);
  return g;
}

// =====================================================================
// 27-31. 管件与可配置基建组件：PIPE / PIPE_ELBOW / FLANGE / FLOOR_SLAB / BASE_PAD / PLATFORM_RAIL
// =====================================================================
function buildPipeSegment() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.0, 22), M.stainless());
  pipe.rotation.z = Math.PI / 2;
  pipe.position.y = 0.4;
  const f1 = makeFlangeAssembly(0.145, 0.075, 8);
  f1.position.set(-0.5, 0.4, 0);
  const f2 = makeFlangeAssembly(0.145, 0.075, 8);
  f2.position.set(0.5, 0.4, 0);
  const support = makePipeStanchion(0, 0.4, 0, 0.075);
  g.add(pipe, f1, f2, support);

  addPort(g, 'in', -0.52, 0.4, 0, -1, 0, 0);
  addPort(g, 'out', 0.52, 0.4, 0, 1, 0, 0);
  return g;
}

function buildPipeElbow() {
  const g = new THREE.Group();
  const rPipe = 0.075;
  const bendR = 0.34;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(bendR, rPipe, 18, 28, Math.PI / 2), M.stainless());
  torus.rotation.x = Math.PI / 2;
  torus.position.set(-0.34, 0.4, -0.34);
  const f1 = makeFlangeAssembly(0.145, rPipe, 8);
  f1.position.set(-0.34, 0.4, 0);
  const f2 = makeFlangeAssembly(0.145, rPipe, 8);
  f2.rotation.y = Math.PI / 2;
  f2.position.set(0, 0.4, -0.34);
  g.add(torus, f1, f2);

  addPort(g, 'in', -0.36, 0.4, 0, -1, 0, 0);
  addPort(g, 'out', 0, 0.4, -0.36, 0, 0, -1);
  return g;
}

function buildFlangePart() {
  const g = new THREE.Group();
  const f = makeFlangeAssembly(0.18, 0.085, 12);
  f.position.y = 0.4;
  g.add(f);
  addPort(g, 'in', -0.04, 0.4, 0, -1, 0, 0);
  addPort(g, 'out', 0.04, 0.4, 0, 1, 0, 0);
  return g;
}

function buildSightGlass() {
  const g = new THREE.Group();
  const yCenter = 0.4;
  // 地面 U 型底座支架
  g.add(makePipeStanchion(0, yCenter, 0, 0.095));

  // 两端不锈钢 PN16 法兰连接颈
  for (const sx of [-0.34, 0.34]) {
    const fl = makeFlangeAssembly(0.165, 0.085, 8);
    fl.position.set(sx, yCenter, 0);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.08, 22), M.stainless());
    collar.rotation.z = Math.PI / 2;
    collar.position.set(sx * 0.85, yCenter, 0);
    g.add(fl, collar);
  }

  // 4 根防爆不锈钢保护拉杆与螺母
  const rodMat = M.stainless();
  const nutMat = M.darkSteel();
  const rodGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.72, 10);
  const nutGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.024, 6);
  for (const [ry, rz] of [
    [0.12, 0.085],
    [-0.12, 0.085],
    [0.12, -0.085],
    [-0.12, -0.085],
  ]) {
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, yCenter + ry, rz);
    g.add(rod);
    for (const nx of [-0.36, 0.36]) {
      const nut = new THREE.Mesh(nutGeo, nutMat);
      nut.rotation.z = Math.PI / 2;
      nut.position.set(nx, yCenter + ry, rz);
      g.add(nut);
    }
  }

  // 高透硼硅玻璃外观察腔
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.54, 24), M.glass());
  glass.rotation.z = Math.PI / 2;
  glass.position.y = yCenter;
  g.add(glass);

  addPort(g, 'in', -0.36, yCenter, 0, -1, 0, 0);
  addPort(g, 'out', 0.36, yCenter, 0, 1, 0, 0);
  return g;
}

function buildBasePad() {
  return makeConcretePlinth(2.4, 0.16, 1.8, [
    [-0.95, -0.68],
    [0.95, -0.68],
    [-0.95, 0.68],
    [0.95, 0.68],
  ]);
}

function buildFloorSlab() {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.016, 4.0), M.floorSlab());
  slab.position.y = -0.008;
  const trimMat = M.darkSteel();
  for (const sz of [-2.015, 2.015]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.06, 0.02, 0.03), trimMat);
    bar.position.set(0, -0.007, sz);
    g.add(bar);
  }
  for (const sx of [-2.015, 2.015]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 4.06), trimMat);
    bar.position.set(sx, -0.007, 0);
    g.add(bar);
  }
  g.add(slab);
  return g;
}

function buildPlatformRail() {
  const g = new THREE.Group();
  const deckH = 0.72;
  const deck = makeBeveledBox(2.2, 0.08, 1.3, 0.008, M.diamondPlate());
  deck.position.y = deckH;
  g.add(deck);
  const legMat = M.castIron();
  const railMat = M.stainless();

  for (const sx of [-1.02, 0, 1.02]) {
    for (const sz of [-0.58, 0.58]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, deckH, 0.06), legMat);
      leg.position.set(sx, deckH * 0.5, sz);
      g.add(leg);
      if (sz > 0 && sx === 0) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.02, 10), railMat);
      post.position.set(sx, deckH + 0.51, sz);
      g.add(post);
    }
  }
  for (const ry of [deckH + 0.52, deckH + 1.0]) {
    const backRail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.08, 10), railMat);
    backRail.rotation.z = Math.PI / 2;
    backRail.position.set(0, ry, -0.58);
    g.add(backRail);
    for (const sx of [-1.02, 1.02]) {
      const sideRail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.18, 10), railMat);
      sideRail.rotation.x = Math.PI / 2;
      sideRail.position.set(sx, ry, 0);
      g.add(sideRail);
    }
  }
  return g;
}

const BUILDERS = [
  ['HENG_GUANG_SKID', 'heng-guang-skid.glb', buildHengGuangSkid],
  ['TANK', 'tank.glb', buildTank],
  ['FS', 'fs.glb', buildFilterSeparator],
  ['WATER_PUMP', 'water-pump.glb', buildWaterPump],
  ['HEAT_EXCHANGER', 'heat-exchanger.glb', buildHeatExchanger],
  ['DOSING_TANK', 'dosing-tank.glb', buildDosingTank],
  ['MAG_METER', 'mag-meter.glb', buildMagMeter],
  ['METER_MEMBRANE', 'meter-membrane.glb', buildMembraneMeter],
  ['METER_ROOTS', 'meter-roots.glb', buildRootsMeter],
  ['UF', 'uf.glb', buildUltrasonicMeter],
  ['CALIBRATION_RIG', 'calibration-rig.glb', buildCalibrationRig],
  ['CONVEYOR_LINE', 'conveyor-line.glb', buildConveyorLine],
  ['ROBOT_STATION', 'robot-station.glb', buildRobotStation],
  ['LEAK_TEST_BENCH', 'leak-test-bench.glb', buildLeakTestBench],
  ['LASER_MARKER', 'laser-marker.glb', buildLaserMarker],
  ['GAS_DETECTOR', 'gas-detector.glb', buildGasDetector],
  ['ALARM_TOWER', 'alarm-tower.glb', buildAlarmTower],
  ['EXPLOSION_PANEL', 'explosion-panel.glb', buildExplosionPanel],
  ['HOV', 'hov.glb', buildValveHOV],
  ['MOV', 'mov.glb', buildValveMOV],
  ['SSV', 'ssv.glb', buildValveSSV],
  ['PCV', 'pcv.glb', buildValvePCV],
  ['PV', 'pv.glb', buildValvePV],
  ['INSTR', 'instr.glb', buildInstr],
  ['PCS', 'pcs.glb', buildPcs],
  ['BESS', 'bess.glb', buildBess],
  ['TRANSFORMER', 'transformer.glb', buildTransformer],
  ['DIST_ROOM', 'dist-room.glb', buildDistRoom],
  ['PIPE', 'pipe.glb', buildPipeSegment],
  ['PIPE_ELBOW', 'pipe-elbow.glb', buildPipeElbow],
  ['FLANGE', 'flange.glb', buildFlangePart],
  ['SIGHT_GLASS', 'sight-glass.glb', buildSightGlass],
  ['BASE_PAD', 'base-pad.glb', buildBasePad],
  ['FLOOR_SLAB', 'floor-slab.glb', buildFloorSlab],
  ['PLATFORM_RAIL', 'platform-rail.glb', buildPlatformRail],
];

const exporter = new GLTFExporter();
const manifest = {
  base: '/assets/studio',
  version: 4,
  files: {},
};

function exportGlb(object) {
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (res) => resolve(Buffer.from(res)),
      (err) => reject(err),
      { binary: true },
    );
  });
}

for (const [kind, filename, fn] of BUILDERS) {
  const root = fn();
  root.name = `studio:${kind}`;
  const buf = await exportGlb(root);
  writeFileSync(join(OUT_DIR, filename), buf);
  manifest.files[kind] = filename;
  console.log(`Generated ${filename} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
}

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Studio GLB v4 (${BUILDERS.length} models) generated successfully.`);
