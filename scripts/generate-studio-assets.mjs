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

const M = {
  stainless: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:stainless', color: 0xbcc7d4, metalness: 0.86, roughness: 0.26 }),
  darkSteel: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:darkSteel', color: 0x1e293b, metalness: 0.68, roughness: 0.44 }),
  steelSlate: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:steelSlate', color: 0x334155, metalness: 0.6, roughness: 0.42 }),
  diamondPlate: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:diamondPlate', color: 0x475569, metalness: 0.72, roughness: 0.45 }),
  hazardStripe: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:hazardStripe', color: 0xfacc15, metalness: 0.2, roughness: 0.55 }),
  castAluminum: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:castAluminum', color: 0xd0d9e4, metalness: 0.55, roughness: 0.44 }),
  brass: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:brass', color: 0xc8964e, metalness: 0.85, roughness: 0.26 }),
  paintBlue: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:paintBlue', color: 0x0284c7, metalness: 0.38, roughness: 0.36 }),
  paintCyan: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:paintCyan', color: 0x0891b2, metalness: 0.38, roughness: 0.36 }),
  paintAmber: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:paintAmber', color: 0xd97706, metalness: 0.35, roughness: 0.4 }),
  paintYellow: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:paintYellow', color: 0xeab308, metalness: 0.32, roughness: 0.42 }),
  paintRed: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:paintRed', color: 0xb91c1c, metalness: 0.35, roughness: 0.4 }),
  paintGreen: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:paintGreen', color: 0x059669, metalness: 0.3, roughness: 0.44 }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({
      name: 'mat:glass',
      color: 0xcffafe,
      transparent: true,
      opacity: 0.34,
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
    new THREE.MeshStandardMaterial({ name: 'mat:meterCounter', color: 0xe2e8f0, roughness: 0.35, metalness: 0.1 }),
  nameplate: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:nameplate', color: 0xcbd5e1, roughness: 0.35, metalness: 0.7 }),
  dial: () =>
    new THREE.MeshStandardMaterial({ name: 'mat:dial', color: 0xf8fafc, roughness: 0.35, metalness: 0.05 }),
  lampGreen: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:lampGreen',
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    }),
  lampAmber: () =>
    new THREE.MeshStandardMaterial({
      name: 'mat:lampAmber',
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
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

function makeFlangeAssembly(radius = 0.16, pipeR = 0.09, bolts = 8, mat = M.stainless()) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.036, 24), mat);
  disc.rotation.z = Math.PI / 2;
  g.add(disc);
  const raisedFace = new THREE.Mesh(
    new THREE.CylinderGeometry(pipeR * 1.28, pipeR * 1.28, 0.044, 24),
    M.stainless(),
  );
  raisedFace.rotation.z = Math.PI / 2;
  g.add(raisedFace);
  const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.058, 6);
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

function makeHandwheel(radius = 0.14, mat = M.paintRed()) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 10, 24), mat);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, radius * 2, 8), mat);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = (i * Math.PI) / 3;
    g.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.04, 12), M.stainless());
  g.add(hub);
  return g;
}

function makeDialGauge(radius = 0.075) {
  const g = new THREE.Group();
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.042, 24), M.stainless());
  casing.rotation.x = Math.PI / 2;
  g.add(casing);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.045, 24), M.dial());
  face.rotation.x = Math.PI / 2;
  face.name = 'dial-face';
  g.add(face);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, 0.049, 24), M.glass());
  glass.rotation.x = Math.PI / 2;
  g.add(glass);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 10), M.brass());
  stem.position.y = -radius - 0.025;
  g.add(stem);
  return g;
}

function makeEllipticalHead(radius, height) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(t) * radius, Math.sin(t) * height));
  }
  return new THREE.LatheGeometry(pts, 28);
}

function makeBeveledBox(w, h, d, bevel = 0.018, material = M.darkSteel()) {
  const hw = w / 2 - bevel;
  const hh = h / 2 - bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.center();
  return new THREE.Mesh(geo, material);
}

function makePipeSpan(p1, p2, radius = 0.06, mat = M.paintYellow()) {
  const v1 = new THREE.Vector3(...p1);
  const v2 = new THREE.Vector3(...p2);
  const dir = new THREE.Vector3().subVectors(v2, v1);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 18), mat);
  mesh.position.addVectors(v1, v2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// 1. 工业级双路燃气调压计量撬（替换旧简化框）
function buildHengGuangSkid() {
  const g = new THREE.Group();

  // 槽钢公共底撬 + 防滑花纹钢板 + 黄黑警示边条 + 吊耳
  const frame = makeBeveledBox(3.4, 0.14, 1.85, 0.015, M.darkSteel());
  frame.position.y = 0.07;
  g.add(frame);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.03, 1.72), M.diamondPlate());
  deck.position.y = 0.145;
  g.add(deck);

  for (const sz of [-0.93, 0.93]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.06, 0.02), M.hazardStripe());
    stripe.position.set(0, 0.07, sz);
    g.add(stripe);
  }
  for (const sx of [-1.62, 1.62]) {
    for (const sz of [-0.86, 0.86]) {
      const lug = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16), M.paintYellow());
      lug.position.set(sx, 0.17, sz);
      g.add(lug);
    }
  }

  // 后侧及两侧安全防护栏杆
  const railMat = M.paintYellow();
  for (const sx of [-1.6, -0.55, 0.55, 1.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.92, 10), railMat);
    post.position.set(sx, 0.6, -0.86);
    g.add(post);
  }
  for (const sy of [0.62, 1.04]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.24, 10), railMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, sy, -0.86);
    g.add(bar);
  }

  // 进出端 DN150 汇总集气总管（左进 -1.7，右出 +1.7）
  for (const [dir, sx, portId] of [[-1, -1.48, 'in'], [1, 1.48, 'out']]) {
    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.18, 22), M.paintAmber());
    header.rotation.x = Math.PI / 2;
    header.position.set(sx, 0.64, 0);
    g.add(header);

    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.28, 20), M.paintAmber());
    branch.rotation.z = Math.PI / 2;
    branch.position.set(sx + dir * 0.14, 0.64, 0);
    g.add(branch);

    const flange = makeFlangeAssembly(0.175, 0.095, 8);
    flange.position.set(sx + dir * 0.28, 0.64, 0);
    g.add(flange);
    addPort(g, portId, sx + dir * 0.3, 0.64, 0, dir, 0, 0);

    // 总管两端支撑立柱
    for (const sz of [-0.46, 0.46]) {
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.48, 12), M.steelSlate());
      sup.position.set(sx, 0.38, sz);
      g.add(sup);
    }
  }

  // A / B 双路并联过滤调压计量支路
  for (const [idx, sz] of [-0.42, 0.42].entries()) {
    // 支路管道底通
    g.add(makePipeSpan([-1.48, 0.64, sz], [1.48, 0.64, sz], 0.068, idx === 0 ? M.paintYellow() : M.paintAmber()));

    // 进口球阀
    const vIn = buildValveHOV();
    vIn.scale.setScalar(0.75);
    vIn.position.set(-1.12, 0.64, sz);
    g.add(vIn);

    // 旋风过滤分离筒
    const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.56, 20), M.stainless());
    filter.position.set(-0.66, 0.66, sz);
    g.add(filter);
    const fCap = new THREE.Mesh(makeEllipticalHead(0.14, 0.08), M.stainless());
    fCap.position.set(-0.66, 0.94, sz);
    g.add(fCap);
    const fDrain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 10), M.brass());
    fDrain.position.set(-0.66, 0.28, sz);
    g.add(fDrain);

    // 安全切断阀 SSV + 调压阀 PCV
    const ssv = buildValveSSV();
    ssv.scale.setScalar(0.68);
    ssv.position.set(-0.18, 0.64, sz);
    g.add(ssv);

    const pcv = buildValvePCV();
    pcv.scale.setScalar(0.68);
    pcv.position.set(0.32, 0.64, sz);
    g.add(pcv);

    // 超声波计量直管段 + 积算表头
    const meterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.45, 20), M.paintBlue());
    meterBody.rotation.z = Math.PI / 2;
    meterBody.position.set(0.84, 0.64, sz);
    g.add(meterBody);
    const meterHead = makeBeveledBox(0.18, 0.14, 0.12, 0.01, M.darkSteel());
    meterHead.position.set(0.84, 0.82, sz);
    g.add(meterHead);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.01), M.screen());
    scr.position.set(0.84, 0.82, sz + 0.062);
    g.add(scr);

    // 压力表
    const gauge = makeDialGauge(0.06);
    gauge.position.set(0.55, 0.88, sz);
    g.add(gauge);

    // 出口球阀
    const vOut = buildValveHOV();
    vOut.scale.setScalar(0.75);
    vOut.position.set(1.22, 0.64, sz);
    g.add(vOut);
  }

  // 安全放散立管 + 防雨帽 + 就地防爆接线箱 + 铭牌
  const ventPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.38, 14), M.paintRed());
  ventPipe.position.set(0.15, 1.32, -0.68);
  g.add(ventPipe);
  const rainCap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.08, 16), M.stainless());
  rainCap.position.set(0.15, 2.04, -0.68);
  g.add(rainCap);

  const jbox = makeBeveledBox(0.36, 0.44, 0.2, 0.015, M.castAluminum());
  jbox.position.set(-0.95, 0.82, 0.78);
  g.add(jbox);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.015), M.nameplate());
  plate.position.set(0, 0.1, 0.93);
  g.add(plate);

  return g;
}

// 2. 高细节立式缓冲储罐
function buildTank() {
  const g = new THREE.Group();
  const radius = 0.48;

  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.15, 32), M.castAluminum());
  cyl.position.y = 0.96;
  g.add(cyl);

  const topHead = new THREE.Mesh(makeEllipticalHead(radius, 0.24), M.castAluminum());
  topHead.position.y = 1.535;
  g.add(topHead);

  const botHead = new THREE.Mesh(makeEllipticalHead(radius, 0.22), M.castAluminum());
  botHead.rotation.x = Math.PI;
  botHead.position.y = 0.385;
  g.add(botHead);

  // 三根槽钢裙座支腿 + 地脚固定板
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 0.4;
    const z = Math.sin(a) * 0.4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.09), M.darkSteel());
    leg.position.set(x, 0.31, z);
    g.add(leg);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), M.steelSlate());
    pad.position.set(x, 0.015, z);
    g.add(pad);
  }

  // 带 10 颗螺栓的人孔盲板法兰
  const manNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 20), M.steelSlate());
  manNeck.rotation.x = Math.PI / 2;
  manNeck.position.set(0, 0.68, 0.48);
  g.add(manNeck);
  const manCover = makeFlangeAssembly(0.22, 0.15, 10, M.steelSlate());
  manCover.rotation.y = -Math.PI / 2;
  manCover.position.set(0, 0.68, 0.54);
  g.add(manCover);

  // 磁翻板液位计（红白液柱指示）
  const lvlTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.85, 12), M.stainless());
  lvlTube.position.set(0.32, 0.98, 0.38);
  g.add(lvlTube);
  const lvlRed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.02), M.paintRed());
  lvlRed.position.set(0.32, 0.78, 0.415);
  g.add(lvlRed);
  const lvlWhite = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.02), M.dial());
  lvlWhite.position.set(0.32, 1.18, 0.415);
  g.add(lvlWhite);

  // 顶部安全阀与压力表 + 铭牌
  const safety = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 14), M.paintRed());
  safety.position.set(0, 1.88, 0);
  g.add(safety);
  const gauge = makeDialGauge(0.07);
  gauge.position.set(0.18, 1.82, 0.18);
  g.add(gauge);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.015), M.nameplate());
  plate.position.set(0, 1.15, 0.485);
  g.add(plate);

  // 左右进出口法兰接管
  for (const [dir, id, y] of [[-1, 'in', 1.18], [1, 'out', 0.68]]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 18), M.stainless());
    stub.rotation.z = Math.PI / 2;
    stub.position.set(dir * 0.55, y, 0);
    g.add(stub);
    const fl = makeFlangeAssembly(0.16, 0.085, 8);
    fl.position.set(dir * 0.66, y, 0);
    g.add(fl);
    addPort(g, id, dir * 0.68, y, 0, dir, 0, 0);
  }

  return g;
}

// 3. 高细节旋风除尘分离过滤器
function buildFilterSeparator() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.92, 26), M.paintBlue());
  body.position.y = 0.84;
  g.add(body);
  const topHead = new THREE.Mesh(makeEllipticalHead(0.26, 0.12), M.paintBlue());
  topHead.position.y = 1.3;
  g.add(topHead);
  const botCone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 26), M.paintBlue());
  botCone.rotation.x = Math.PI;
  botCone.position.y = 0.26;
  g.add(botCone);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.54, 12), M.darkSteel());
    leg.position.set(Math.cos(a) * 0.22, 0.27, Math.sin(a) * 0.22);
    g.add(leg);
  }

  // 快开盲板顶盖 + 锁紧手轮
  const blind = makeFlangeAssembly(0.24, 0.16, 10, M.stainless());
  blind.rotation.z = Math.PI / 2;
  blind.position.y = 1.44;
  g.add(blind);
  const wheel = makeHandwheel(0.11, M.paintRed());
  wheel.position.set(0, 1.5, 0);
  g.add(wheel);

  const gauge = makeDialGauge(0.065);
  gauge.position.set(0, 1.18, 0.29);
  g.add(gauge);

  for (const [dir, id, y] of [[-1, 'in', 0.95], [1, 'out', 0.65]]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16), M.stainless());
    stub.rotation.z = Math.PI / 2;
    stub.position.set(dir * 0.34, y, 0);
    g.add(stub);
    const fl = makeFlangeAssembly(0.15, 0.08, 8);
    fl.position.set(dir * 0.44, y, 0);
    g.add(fl);
    addPort(g, id, dir * 0.46, y, 0, dir, 0, 0);
  }
  return g;
}

// 4. 膜式燃气表（增加压铸合模法兰边、周圈螺钉、字轮窗口、铅封、通信天线盒）
function buildMembraneMeter() {
  const g = new THREE.Group();
  const topHalf = makeBeveledBox(0.46, 0.24, 0.3, 0.022, M.castAluminum());
  topHalf.position.y = 0.44;
  g.add(topHalf);
  const botHalf = makeBeveledBox(0.45, 0.32, 0.29, 0.022, M.castAluminum());
  botHalf.position.y = 0.17;
  g.add(botHalf);

  // 合模腰线法兰与 12 颗铆钉
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.036, 0.34), M.stainless());
  waist.position.y = 0.32;
  g.add(waist);
  for (const sx of [-0.21, -0.07, 0.07, 0.21]) {
    for (const sz of [-0.155, 0.155]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.048, 6), M.darkSteel());
      screw.position.set(sx, 0.32, sz);
      g.add(screw);
    }
  }

  // 侧面 NB-IoT / IC 通信模块盒
  const commBox = makeBeveledBox(0.06, 0.22, 0.18, 0.01, M.paintBlue());
  commBox.position.set(0.25, 0.36, 0);
  g.add(commBox);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 10), M.darkSteel());
  antenna.position.set(0.26, 0.52, -0.04);
  g.add(antenna);

  // 顶部双管接头 + 波纹密封垫 + 六角锁母
  for (const [idx, sx] of [-0.14, 0.14].entries()) {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 16), M.brass());
    neck.position.set(sx, 0.64, 0);
    g.add(neck);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.048, 6), M.stainless());
    nut.position.set(sx, 0.68, 0);
    g.add(nut);
    addPort(g, idx === 0 ? 'in' : 'out', sx, 0.72, 0, 0, 1, 0);
  }

  // 专属机械字轮+液晶双显读数窗口
  const bezel = makeBeveledBox(0.32, 0.19, 0.05, 0.01, M.darkSteel());
  bezel.position.set(0, 0.42, 0.155);
  g.add(bezel);
  const counterFace = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.012), M.meterCounter());
  counterFace.position.set(0, 0.42, 0.182);
  g.add(counterFace);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.14, 0.01), M.glass());
  glass.position.set(0, 0.42, 0.19);
  g.add(glass);

  // 防拆红色铅封卡扣
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.025, 10), M.paintRed());
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0.18, 0.25, 0.15);
  g.add(seal);

  return g;
}

// 5. 罗茨腰轮燃气表（八字双腔 + 油位窗 + 散热肋片 + 温压修正仪）
function buildRootsMeter() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.82, 24), M.steelSlate());
  pipe.rotation.z = Math.PI / 2;
  pipe.position.y = 0.25;
  g.add(pipe);

  const f1 = makeFlangeAssembly(0.185, 0.105, 8);
  f1.position.set(-0.41, 0.25, 0);
  const f2 = makeFlangeAssembly(0.185, 0.105, 8);
  f2.position.set(0.41, 0.25, 0);
  g.add(f1, f2);
  addPort(g, 'in', -0.43, 0.25, 0, -1, 0, 0);
  addPort(g, 'out', 0.43, 0.25, 0, 1, 0, 0);

  for (const sz of [-0.08, 0.08]) {
    const lobe = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.148, 0.4, 24), M.darkSteel());
    lobe.rotation.x = Math.PI / 2;
    lobe.position.set(0, 0.25, sz);
    g.add(lobe);
  }
  const frontCover = makeBeveledBox(0.34, 0.28, 0.06, 0.015, M.castAluminum());
  frontCover.position.set(0, 0.25, 0.21);
  g.add(frontCover);

  // 油位观察窗 + 注油嘴
  const oilRing = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.025, 16), M.brass());
  oilRing.rotation.x = Math.PI / 2;
  oilRing.position.set(-0.08, 0.22, 0.242);
  g.add(oilRing);
  const oilRed = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), M.lampRed());
  oilRed.rotation.x = Math.PI / 2;
  oilRed.position.set(-0.08, 0.22, 0.245);
  g.add(oilRed);

  // 散热颈 + 倾斜防爆温压修正积算仪
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.015, 14), M.stainless());
    fin.position.set(0, 0.39 + i * 0.038, 0);
    g.add(fin);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.18, 14), M.stainless());
  neck.position.set(0, 0.45, 0);
  g.add(neck);
  const head = makeBeveledBox(0.28, 0.21, 0.17, 0.015, M.paintBlue());
  head.position.set(0, 0.6, 0);
  head.rotation.x = -0.25;
  g.add(head);
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.015), M.screen());
  lcd.position.set(0, 0.61, 0.082);
  lcd.rotation.x = -0.25;
  g.add(lcd);
  return g;
}

// 6. 超声波燃气表
function buildUltrasonicMeter() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.94, 24), M.paintBlue());
  pipe.rotation.z = Math.PI / 2;
  pipe.position.y = 0.25;
  g.add(pipe);

  const f1 = makeFlangeAssembly(0.185, 0.11, 8);
  f1.position.set(-0.47, 0.25, 0);
  const f2 = makeFlangeAssembly(0.185, 0.11, 8);
  f2.position.set(0.47, 0.25, 0);
  g.add(f1, f2);
  addPort(g, 'in', -0.49, 0.25, 0, -1, 0, 0);
  addPort(g, 'out', 0.49, 0.25, 0, 1, 0, 0);

  for (const sx of [-0.19, 0.19]) {
    for (const sz of [-0.11, 0.11]) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.15, 14), M.brass());
      boss.rotation.x = sz > 0 ? 0.85 : -0.85;
      boss.position.set(sx, 0.28, sz * 1.15);
      g.add(boss);
    }
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 14), M.stainless());
  neck.position.set(0, 0.41, 0);
  g.add(neck);
  const head = makeBeveledBox(0.3, 0.23, 0.17, 0.015, M.darkSteel());
  head.position.set(0, 0.57, 0);
  g.add(head);
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.012), M.screen());
  lcd.position.set(0, 0.57, 0.087);
  g.add(lcd);
  const gauge = makeDialGauge(0.055);
  gauge.position.set(0.3, 0.42, 0);
  g.add(gauge);
  return g;
}

// 7. 音速喷嘴标定台（带3只待检表样品 + 气动夹紧器 + 6路喷嘴 + 触摸屏）
function buildCalibrationRig() {
  const g = new THREE.Group();
  const desk = makeBeveledBox(2.35, 0.86, 1.16, 0.02, M.darkSteel());
  desk.position.y = 0.43;
  g.add(desk);
  const benchTop = makeBeveledBox(2.42, 0.06, 1.24, 0.015, M.diamondPlate());
  benchTop.position.y = 0.89;
  g.add(benchTop);

  // 上置卧式椭圆封头真空稳压罐
  const tankCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.38, 28), M.paintBlue());
  tankCyl.rotation.z = Math.PI / 2;
  tankCyl.position.set(-0.22, 1.48, -0.28);
  g.add(tankCyl);
  for (const [dir, sx] of [[-1, -0.91], [1, 0.47]]) {
    const head = new THREE.Mesh(makeEllipticalHead(0.24, 0.14), M.paintBlue());
    head.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    head.position.set(sx, 1.48, -0.28);
    g.add(head);
  }
  const tankGauge = makeDialGauge(0.065);
  tankGauge.position.set(-0.22, 1.8, -0.28);
  g.add(tankGauge);

  // 6 路并联拉瓦尔音速喷嘴 + 先导电磁阀
  for (let i = 0; i < 6; i++) {
    const x = -0.84 + i * 0.25;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.46, 14), M.stainless());
    pipe.position.set(x, 1.14, 0.04);
    g.add(pipe);
    const coil = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.08, 0.068), M.paintAmber());
    coil.position.set(x, 1.1, 0.1);
    g.add(coil);
  }

  // 3 表位气动夹具台 + 正在检定的燃气表样品
  const clampBar = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.07, 0.14), M.steelSlate());
  clampBar.position.set(-0.22, 0.96, 0.36);
  g.add(clampBar);
  for (let i = 0; i < 3; i++) {
    const mx = -0.7 + i * 0.48;
    const sampleMeter = makeBeveledBox(0.24, 0.28, 0.16, 0.012, M.castAluminum());
    sampleMeter.position.set(mx, 1.12, 0.36);
    g.add(sampleMeter);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.01), M.meterCounter());
    face.position.set(mx, 1.15, 0.442);
    g.add(face);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 12), M.stainless());
    cyl.position.set(mx, 1.38, 0.36);
    g.add(cyl);
  }

  // 右侧触摸屏 + 三色警示柱
  const hmi = makeBeveledBox(0.48, 0.36, 0.07, 0.015, M.darkSteel());
  hmi.position.set(0.84, 1.24, 0.24);
  hmi.rotation.x = -0.35;
  g.add(hmi);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.27, 0.012), M.screen());
  scr.position.set(0.84, 1.25, 0.272);
  scr.rotation.x = -0.35;
  g.add(scr);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.54, 10), M.stainless());
  pole.position.set(1.02, 1.18, -0.36);
  g.add(pole);
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.1, 14), M.lampGreen());
  led.position.set(1.02, 1.48, -0.36);
  g.add(led);

  addPort(g, 'in', -1.2, 0.45, -0.28, -1, 0, 0);
  addPort(g, 'out', 1.2, 0.45, -0.28, 1, 0, 0);
  return g;
}

// 8. 滚筒装配线（含托盘、精细表体、光电龙门传感器与调速控制箱）
function buildConveyorLine() {
  const g = new THREE.Group();
  for (const sz of [-0.36, 0.36]) {
    const beam = makeBeveledBox(2.2, 0.12, 0.06, 0.01, M.steelSlate());
    beam.position.set(0, 0.72, sz);
    g.add(beam);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.048, 0.022), M.hazardStripe());
    guard.position.set(0, 0.82, sz * 1.08);
    g.add(guard);
    for (const sx of [-0.95, 0, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.7, 0.065), M.darkSteel());
      leg.position.set(sx, 0.35, sz);
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14), M.stainless());
      foot.position.set(sx, 0.015, sz);
      g.add(foot);
    }
  }
  for (let i = -9; i <= 9; i++) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.66, 14), M.stainless());
    roller.rotation.x = Math.PI / 2;
    roller.position.set(i * 0.11, 0.73, 0);
    g.add(roller);
  }
  // 光电定位龙门支架
  for (const sz of [-0.38, 0.38]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), M.stainless());
    p.position.set(0.28, 1.0, sz);
    g.add(p);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), M.darkSteel());
  gate.position.set(0.28, 1.24, 0);
  g.add(gate);
  const sensorLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), M.lampGreen());
  sensorLed.position.set(0.28, 1.28, 0);
  g.add(sensorLed);

  // 驱动电机与变频盒
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 16), M.paintBlue());
  motor.rotation.x = Math.PI / 2;
  motor.position.set(-0.75, 0.56, 0.48);
  g.add(motor);
  const estopBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.08), M.paintYellow());
  estopBox.position.set(0.65, 0.72, 0.42);
  g.add(estopBox);
  const estopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12), M.lampRed());
  estopBtn.rotation.x = Math.PI / 2;
  estopBtn.position.set(0.65, 0.72, 0.47);
  g.add(estopBtn);

  // 托盘 + 精细燃气表装配半成品
  for (const sx of [-0.62, 0, 0.62]) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.32), M.darkSteel());
    pallet.position.set(sx, 0.775, 0);
    g.add(pallet);
    const unit = makeBeveledBox(0.26, 0.3, 0.2, 0.015, M.castAluminum());
    unit.position.set(sx, 0.94, 0);
    g.add(unit);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.01), M.meterCounter());
    face.position.set(sx, 0.98, 0.102);
    g.add(face);
  }
  return g;
}

// 9. 自动装配机械臂（增配谐波减速机关节凸鼓 + 安全防护围栏窗）
function buildRobotStation() {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.34, 22), M.darkSteel());
  plinth.position.y = 0.17;
  g.add(plinth);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.28, 22), M.paintAmber());
  turret.position.y = 0.48;
  g.add(turret);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 18), M.darkSteel());
  shoulder.rotation.z = Math.PI / 2;
  shoulder.position.set(0, 0.62, 0);
  g.add(shoulder);
  const arm1 = makeBeveledBox(0.14, 0.72, 0.15, 0.015, M.paintAmber());
  arm1.position.set(0, 0.94, -0.08);
  arm1.rotation.x = 0.26;
  g.add(arm1);
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 18), M.darkSteel());
  elbow.rotation.z = Math.PI / 2;
  elbow.position.set(0, 1.26, -0.18);
  g.add(elbow);
  const arm2 = makeBeveledBox(0.11, 0.12, 0.68, 0.012, M.castAluminum());
  arm2.position.set(0, 1.24, 0.16);
  arm2.rotation.x = 0.22;
  g.add(arm2);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), M.darkSteel());
  wrist.position.set(0, 1.13, 0.46);
  g.add(wrist);
  const servoTool = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.022, 0.2, 14), M.stainless());
  servoTool.position.set(0, 1.0, 0.46);
  g.add(servoTool);

  for (const sx of [-0.72, 0.72]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.05, 0.055), M.paintYellow());
    post.position.set(sx, 0.525, -0.58);
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.05, 0.045), M.paintYellow());
  rail.position.set(0, 1.02, -0.58);
  g.add(rail);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.75, 0.02), M.glass());
  shield.position.set(0, 0.62, -0.58);
  g.add(shield);
  return g;
}

// 10. 气密性检漏台（铝型材框 + 测试表样品 + 差压表 + 工控屏）
function buildLeakTestBench() {
  const g = new THREE.Group();
  const cab = makeBeveledBox(1.48, 0.86, 0.94, 0.02, M.darkSteel());
  cab.position.y = 0.43;
  g.add(cab);
  const deck = makeBeveledBox(1.54, 0.05, 1.0, 0.01, M.stainless());
  deck.position.y = 0.885;
  g.add(deck);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.64, 0.64), M.glass());
  hood.position.set(-0.14, 1.22, 0);
  g.add(hood);
  for (const sx of [-0.6, 0.32]) {
    for (const sz of [-0.31, 0.31]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.82, 0.035), M.stainless());
      col.position.set(sx, 1.3, sz);
      g.add(col);
    }
  }
  const topBeam = makeBeveledBox(1.02, 0.08, 0.68, 0.01, M.steelSlate());
  topBeam.position.set(-0.14, 1.72, 0);
  g.add(topBeam);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 16), M.stainless());
  cyl.position.set(-0.14, 1.88, 0);
  g.add(cyl);

  // 测试罩内部摆放待检燃气表样品
  const sample = makeBeveledBox(0.32, 0.38, 0.22, 0.015, M.castAluminum());
  sample.position.set(-0.14, 1.12, 0);
  g.add(sample);

  const ctrl = makeBeveledBox(0.34, 0.58, 0.5, 0.015, M.steelSlate());
  ctrl.position.set(0.55, 1.19, 0);
  g.add(ctrl);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.012), M.screen());
  scr.position.set(0.55, 1.26, 0.252);
  g.add(scr);
  const gauge = makeDialGauge(0.065);
  gauge.position.set(0.55, 1.04, 0.25);
  g.add(gauge);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.1, 14), M.lampGreen());
  lamp.position.set(0.55, 1.53, 0);
  g.add(lamp);
  return g;
}

function buildLaserMarker() {
  const g = new THREE.Group();
  const base = makeBeveledBox(1.12, 0.85, 0.98, 0.02, M.darkSteel());
  base.position.y = 0.425;
  g.add(base);
  const cabin = makeBeveledBox(0.94, 0.86, 0.84, 0.02, M.steelSlate());
  cabin.position.y = 1.28;
  g.add(cabin);
  const safeGlass = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.02), M.lampGreen());
  safeGlass.position.set(0, 1.32, 0.422);
  g.add(safeGlass);
  const galvo = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.26, 16), M.paintBlue());
  galvo.position.set(0, 1.82, 0);
  g.add(galvo);
  return g;
}

// 11. 可燃气体探测器（增加不锈钢防雨罩 + 数显小屏 + 格栅探头）
function buildGasDetector() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.07, 18), M.steelSlate());
  base.position.y = 0.035;
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 1.4, 14), M.stainless());
  pole.position.y = 0.74;
  g.add(pole);
  const box = makeBeveledBox(0.25, 0.28, 0.19, 0.015, M.paintAmber());
  box.position.set(0, 1.36, 0.06);
  g.add(box);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.01), M.screen());
  scr.position.set(0, 1.37, 0.158);
  g.add(scr);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.15, 16), M.stainless());
  sensor.position.set(0, 1.15, 0.06);
  g.add(sensor);
  const rainShield = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.07, 18), M.stainless());
  rainShield.position.set(0, 1.24, 0.06);
  g.add(rainShield);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), M.lampAmber());
  beacon.position.set(0, 1.54, 0.06);
  g.add(beacon);
  return g;
}

// 12. 防爆声光报警灯柱（加装防爆接线盒与保护格栅）
function buildAlarmTower() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 18), M.hazardStripe());
  base.position.y = 0.06;
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.58, 16), M.darkSteel());
  pole.position.y = 0.88;
  g.add(pole);
  const jbox = makeBeveledBox(0.18, 0.22, 0.14, 0.012, M.castAluminum());
  jbox.position.set(0, 1.05, 0.08);
  g.add(jbox);
  const layers = [M.lampGreen(), M.lampAmber(), M.lampRed()];
  layers.forEach((mat, i) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.14, 18), mat);
    seg.position.y = 1.66 + i * 0.15;
    g.add(seg);
  });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 18), M.darkSteel());
  cap.position.y = 2.05;
  g.add(cap);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 18), M.stainless());
  horn.rotation.z = Math.PI / 2;
  horn.position.set(0.14, 2.15, 0);
  g.add(horn);
  return g;
}

function buildExplosionPanel() {
  const g = new THREE.Group();
  const stand = makeBeveledBox(0.68, 0.36, 0.4, 0.015, M.darkSteel());
  stand.position.y = 0.18;
  g.add(stand);
  const body = makeBeveledBox(0.76, 1.08, 0.44, 0.025, M.steelSlate());
  body.position.y = 0.9;
  g.add(body);
  const door = makeBeveledBox(0.64, 0.94, 0.05, 0.012, M.castAluminum());
  door.position.set(0, 0.9, 0.22);
  g.add(door);
  for (const sy of [0.55, 0.9, 1.25]) {
    for (const sx of [-0.28, 0.28]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6), M.stainless());
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(sx, sy, 0.25);
      g.add(bolt);
    }
  }
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.015), M.screen());
  scr.position.set(0, 1.12, 0.248);
  g.add(scr);
  const stopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16), M.lampRed());
  stopBtn.rotation.x = Math.PI / 2;
  stopBtn.position.set(0.16, 0.82, 0.26);
  g.add(stopBtn);
  return g;
}

function buildWaterPump() {
  const g = new THREE.Group();
  const skid = makeBeveledBox(1.42, 0.12, 0.68, 0.012, M.darkSteel());
  skid.position.y = 0.06;
  g.add(skid);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.54, 20), M.paintBlue());
  motor.rotation.z = Math.PI / 2;
  motor.position.set(-0.32, 0.36, 0);
  g.add(motor);
  for (let i = -4; i <= 4; i++) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.016, 20), M.paintBlue());
    fin.rotation.z = Math.PI / 2;
    fin.position.set(-0.32 + i * 0.048, 0.36, 0);
    g.add(fin);
  }
  const motorBox = makeBeveledBox(0.14, 0.1, 0.14, 0.01, M.steelSlate());
  motorBox.position.set(-0.32, 0.58, 0);
  g.add(motorBox);
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 16), M.paintAmber());
  guard.rotation.z = Math.PI / 2;
  guard.position.set(0.06, 0.36, 0);
  g.add(guard);
  const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 24), M.paintCyan());
  volute.rotation.z = Math.PI / 2;
  volute.position.set(0.32, 0.38, 0);
  g.add(volute);
  const inPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 18), M.stainless());
  inPipe.rotation.z = Math.PI / 2;
  inPipe.position.set(0.52, 0.38, 0);
  g.add(inPipe);
  const fIn = makeFlangeAssembly(0.16, 0.09, 8);
  fIn.position.set(0.64, 0.38, 0);
  g.add(fIn);
  const outPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 18), M.stainless());
  outPipe.position.set(0.32, 0.68, 0);
  g.add(outPipe);
  const fOut = makeFlangeAssembly(0.15, 0.085, 8);
  fOut.rotation.z = Math.PI / 2;
  fOut.position.set(0.32, 0.86, 0);
  g.add(fOut);
  addPort(g, 'in', 0.66, 0.38, 0, 1, 0, 0);
  addPort(g, 'out', 0.32, 0.88, 0, 0, 1, 0);
  return g;
}

function buildDosingTank() {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 28), M.paintGreen());
  cyl.position.y = 0.62;
  g.add(cyl);
  const head = new THREE.Mesh(makeEllipticalHead(0.42, 0.18), M.paintGreen());
  head.position.y = 1.17;
  g.add(head);
  const mixer = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.32, 16), M.steelSlate());
  mixer.position.y = 1.48;
  g.add(mixer);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.86, 12), M.glass());
  gauge.position.set(0, 0.62, 0.44);
  g.add(gauge);
  addPort(g, 'in', -0.45, 0.95, 0, -1, 0, 0);
  addPort(g, 'out', 0.45, 0.25, 0, 1, 0, 0);
  return g;
}

function buildMagMeter() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.58, 22), M.steelSlate());
  tube.rotation.z = Math.PI / 2;
  tube.position.y = 0.2;
  g.add(tube);
  const f1 = makeFlangeAssembly(0.185, 0.11, 8);
  f1.position.set(-0.29, 0.2, 0);
  const f2 = makeFlangeAssembly(0.185, 0.11, 8);
  f2.position.set(0.29, 0.2, 0);
  g.add(f1, f2);
  addPort(g, 'in', -0.31, 0.2, 0, -1, 0, 0);
  addPort(g, 'out', 0.31, 0.2, 0, 1, 0, 0);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.22, 14), M.stainless());
  stem.position.set(0, 0.38, 0);
  g.add(stem);
  const head = makeBeveledBox(0.24, 0.2, 0.16, 0.015, M.paintCyan());
  head.position.set(0, 0.55, 0);
  g.add(head);
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.012), M.screen());
  lcd.position.set(0, 0.55, 0.082);
  g.add(lcd);
  return g;
}

function buildValveHOV() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.62, 20), M.paintYellow());
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), M.paintYellow());
  g.add(sphere);
  const f1 = makeFlangeAssembly(0.17, 0.095, 8);
  f1.position.x = -0.31;
  const f2 = makeFlangeAssembly(0.17, 0.095, 8);
  f2.position.x = 0.31;
  g.add(f1, f2);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 14), M.stainless());
  stem.position.y = 0.18;
  g.add(stem);
  const lever = makeBeveledBox(0.32, 0.035, 0.045, 0.008, M.paintRed());
  lever.position.set(0.12, 0.28, 0);
  g.add(lever);
  addPort(g, 'in', -0.33, 0, 0, -1, 0, 0);
  addPort(g, 'out', 0.33, 0, 0, 1, 0, 0);
  return g;
}

function buildValveMOV() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.66, 20), M.paintAmber());
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), M.paintAmber());
  g.add(body);
  const f1 = makeFlangeAssembly(0.17, 0.095, 8);
  f1.position.x = -0.33;
  const f2 = makeFlangeAssembly(0.17, 0.095, 8);
  f2.position.x = 0.33;
  g.add(f1, f2);
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.24, 14), M.stainless());
  yoke.position.y = 0.2;
  g.add(yoke);
  const actuator = makeBeveledBox(0.28, 0.24, 0.22, 0.015, M.paintBlue());
  actuator.position.y = 0.4;
  g.add(actuator);
  const wheel = makeHandwheel(0.12, M.paintRed());
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(-0.18, 0.4, 0);
  g.add(wheel);
  addPort(g, 'in', -0.35, 0, 0, -1, 0, 0);
  addPort(g, 'out', 0.35, 0, 0, 1, 0, 0);
  return g;
}

function buildValveSSV() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.66, 20), M.paintRed());
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const f1 = makeFlangeAssembly(0.17, 0.095, 8);
  f1.position.x = -0.33;
  const f2 = makeFlangeAssembly(0.17, 0.095, 8);
  f2.position.x = 0.33;
  g.add(f1, f2);
  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.46, 20), M.paintRed());
  bonnet.position.y = 0.32;
  g.add(bonnet);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20), M.darkSteel());
  cap.position.y = 0.56;
  g.add(cap);
  const switchBox = makeBeveledBox(0.16, 0.14, 0.14, 0.01, M.paintAmber());
  switchBox.position.set(0.14, 0.4, 0);
  g.add(switchBox);
  addPort(g, 'in', -0.35, 0, 0, -1, 0, 0);
  addPort(g, 'out', 0.35, 0, 0, 1, 0, 0);
  return g;
}

function buildValvePCV() {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.66, 20), M.paintCyan());
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const f1 = makeFlangeAssembly(0.17, 0.095, 8);
  f1.position.x = -0.33;
  const f2 = makeFlangeAssembly(0.17, 0.095, 8);
  f2.position.x = 0.33;
  g.add(f1, f2);
  const diaphragm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 24), M.paintCyan());
  diaphragm.position.y = 0.26;
  g.add(diaphragm);
  const springTower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.26, 18), M.stainless());
  springTower.position.y = 0.44;
  g.add(springTower);
  const pilot = makeBeveledBox(0.12, 0.16, 0.12, 0.01, M.brass());
  pilot.position.set(0.16, 0.38, 0.12);
  g.add(pilot);
  addPort(g, 'in', -0.35, 0, 0, -1, 0, 0);
  addPort(g, 'out', 0.35, 0, 0, 1, 0, 0);
  return g;
}

const BUILDERS = [
  ['HENG_GUANG_SKID', 'heng-guang-skid.glb', buildHengGuangSkid],
  ['TANK', 'tank.glb', buildTank],
  ['FS', 'fs.glb', buildFilterSeparator],
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
  ['WATER_PUMP', 'water-pump.glb', buildWaterPump],
  ['DOSING_TANK', 'dosing-tank.glb', buildDosingTank],
  ['MAG_METER', 'mag-meter.glb', buildMagMeter],
  ['HOV', 'hov.glb', buildValveHOV],
  ['MOV', 'mov.glb', buildValveMOV],
  ['SSV', 'ssv.glb', buildValveSSV],
  ['PCV', 'pcv.glb', buildValvePCV],
];

const exporter = new GLTFExporter();
const manifest = {
  base: '/assets/studio',
  version: 3,
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
console.log('Studio GLB v3 asset library generated successfully.');
