import type { NodeKind } from '../../data/topology';

/** 可编排组件类型（工艺装置 + 能源站 + 涡喷 + 管件 + 电气 + 标注 + 线） */
export type CatalogKind =
  | NodeKind
  | 'PIPE'
  | 'PIPE_ELBOW'
  | 'FLANGE'
  | 'INSTR'
  | 'TANK'
  | 'ELEC_CB'
  | 'ELEC_M'
  | 'ELEC_GND'
  | 'TEXT'
  | 'LINE_SOLID'
  | 'LINE_DASHED'
  | 'PCS'
  | 'TRANSFORMER'
  | 'BESS'
  | 'LOAD'
  | 'DIST_ROOM'
  | 'TURBOJET'
  | 'HENG_GUANG_SKID';

export type CatalogCategory =
  | 'equipment'
  | 'energy'
  | 'turbojet'
  | 'pipe'
  | 'electrical'
  | 'annotation';

export type DeviceCatalogEntry = {
  kind: CatalogKind;
  category: CatalogCategory;
  labelZh: string;
  silhouette: string;
  /** 调色板色块回退（WebGL 缩略图未就绪时） */
  thumb: { bg: string; glyph: string };
  placeable: boolean;
};

export const CATALOG_CATEGORIES: { id: CatalogCategory; labelZh: string }[] = [
  { id: 'equipment', labelZh: '工艺装置' },
  { id: 'energy', labelZh: '能源站' },
  { id: 'turbojet', labelZh: '涡喷' },
  { id: 'pipe', labelZh: '管段管件' },
  { id: 'electrical', labelZh: '电气符号' },
  { id: 'annotation', labelZh: '标注与线' },
];

export const DEVICE_CATALOG: readonly DeviceCatalogEntry[] = [
  // 工艺装置
  {
    kind: 'HENG_GUANG_SKID',
    category: 'equipment',
    labelZh: '恒光橇装',
    silhouette: 'PFD 两路环路装配',
    thumb: { bg: '#0ea5e9', glyph: '橇' },
    placeable: true,
  },
  { kind: 'UF', category: 'equipment', labelZh: '超声波流量计', silhouette: '卧式筒 + 法兰 + 换能器', thumb: { bg: '#0ea5e9', glyph: 'UF' }, placeable: true },
  { kind: 'FS', category: 'equipment', labelZh: '过滤器', silhouette: '立式圆筒 + 锥顶', thumb: { bg: '#94a3b8', glyph: 'FS' }, placeable: true },
  { kind: 'HOV', category: 'equipment', labelZh: '手动球阀', silhouette: '球体 + T 柄', thumb: { bg: '#fbbf24', glyph: 'HOV' }, placeable: true },
  { kind: 'MOV', category: 'equipment', labelZh: '电动阀', silhouette: '阀体 + 方盒执行器', thumb: { bg: '#f59e0b', glyph: 'MOV' }, placeable: true },
  { kind: 'SSV', category: 'equipment', labelZh: '安全切断阀', silhouette: '高柱弹簧罩', thumb: { bg: '#fb923c', glyph: 'SSV' }, placeable: true },
  { kind: 'PCV', category: 'equipment', labelZh: '调压阀', silhouette: '膜片圆顶', thumb: { bg: '#22d3ee', glyph: 'PCV' }, placeable: true },
  { kind: 'PV', category: 'equipment', labelZh: '放散阀', silhouette: '球体 + 放散柱', thumb: { bg: '#f87171', glyph: 'PV' }, placeable: true },
  { kind: 'INSTR', category: 'equipment', labelZh: '就地仪表', silhouette: '表头圆盘 + 短管', thumb: { bg: '#a78bfa', glyph: 'PI' }, placeable: true },
  { kind: 'TANK', category: 'equipment', labelZh: '小罐/容器', silhouette: '立式罐体', thumb: { bg: '#64748b', glyph: 'TK' }, placeable: true },
  // 能源站柜体（GLB：public/assets/plant/*.glb）
  { kind: 'PCS', category: 'energy', labelZh: 'PCS', silhouette: '户外 PCS 柜', thumb: { bg: '#38bdf8', glyph: 'PCS' }, placeable: true },
  { kind: 'TRANSFORMER', category: 'energy', labelZh: '变压器', silhouette: '油浸变 + 散热器', thumb: { bg: '#4ade80', glyph: '变' }, placeable: true },
  { kind: 'BESS', category: 'energy', labelZh: '储能柜', silhouette: '液冷储能柜', thumb: { bg: '#64748b', glyph: '储' }, placeable: true },
  { kind: 'LOAD', category: 'energy', labelZh: '负荷', silhouette: '厂房 + MCC', thumb: { bg: '#f97316', glyph: '荷' }, placeable: true },
  { kind: 'DIST_ROOM', category: 'energy', labelZh: '配电房', silhouette: '配电房建筑', thumb: { bg: '#94a3b8', glyph: '配' }, placeable: true },
  // 涡喷整机
  {
    kind: 'TURBOJET',
    category: 'turbojet',
    labelZh: '涡喷整机',
    silhouette: '小型轴流涡喷装配',
    thumb: { bg: '#b45309', glyph: 'TJ' },
    placeable: true,
  },
  // 管段
  { kind: 'PIPE', category: 'pipe', labelZh: '直管段', silhouette: '圆管 + 端法兰', thumb: { bg: '#eab308', glyph: '──' }, placeable: true },
  { kind: 'PIPE_ELBOW', category: 'pipe', labelZh: '弯头', silhouette: '90° 弯管', thumb: { bg: '#ca8a04', glyph: '⌞' }, placeable: true },
  { kind: 'FLANGE', category: 'pipe', labelZh: '法兰盘', silhouette: '对开法兰', thumb: { bg: '#cbd5e1', glyph: '◎' }, placeable: true },
  // 电气
  { kind: 'ELEC_CB', category: 'electrical', labelZh: '断路器', silhouette: '方框开关符号', thumb: { bg: '#334155', glyph: 'QF' }, placeable: true },
  { kind: 'ELEC_M', category: 'electrical', labelZh: '电机', silhouette: '圆内 M', thumb: { bg: '#1e3a5f', glyph: 'M' }, placeable: true },
  { kind: 'ELEC_GND', category: 'electrical', labelZh: '接地', silhouette: '接地折线', thumb: { bg: '#166534', glyph: '⊥' }, placeable: true },
  // 标注
  { kind: 'TEXT', category: 'annotation', labelZh: '文字标签', silhouette: '平面铭牌文字', thumb: { bg: '#0f172a', glyph: 'Aa' }, placeable: true },
  { kind: 'LINE_SOLID', category: 'annotation', labelZh: '实线', silhouette: '短实线段', thumb: { bg: '#e2e8f0', glyph: '━' }, placeable: true },
  { kind: 'LINE_DASHED', category: 'annotation', labelZh: '虚线', silhouette: '短虚线段', thumb: { bg: '#94a3b8', glyph: '┈' }, placeable: true },
] as const;

export function isNodeKind(kind: string): kind is NodeKind {
  return (
    kind === 'UF' ||
    kind === 'FS' ||
    kind === 'HOV' ||
    kind === 'MOV' ||
    kind === 'SSV' ||
    kind === 'PCV' ||
    kind === 'PV'
  );
}

export function isCatalogKind(kind: string): kind is CatalogKind {
  return DEVICE_CATALOG.some((e) => e.kind === kind);
}

export function isPlaceableCatalogKind(kind: string): kind is CatalogKind {
  const e = DEVICE_CATALOG.find((x) => x.kind === kind);
  return Boolean(e?.placeable);
}

export function catalogEntry(kind: CatalogKind): DeviceCatalogEntry | undefined {
  return DEVICE_CATALOG.find((e) => e.kind === kind);
}

export function isTurbojetKind(kind: string | undefined | null): boolean {
  return kind === 'TURBOJET';
}

/** 落地件原点在底面，画布置 y=0；在线件管廊高度 y=1。 */
const FLOOR_PLACE = new Set<CatalogKind>(['TANK', 'FS', 'HENG_GUANG_SKID']);

export function catalogPlaceY(kind: CatalogKind): number {
  return FLOOR_PLACE.has(kind) ? 0 : 1;
}

/** 工艺 / 管件 / 电气 / 铭牌：1 m 世界比例，加载器不 fit-to-0.9 */
export const INDUSTRIAL_GLB_KINDS: readonly CatalogKind[] = [
  'PIPE',
  'PIPE_ELBOW',
  'FLANGE',
  'HENG_GUANG_SKID',
  'UF',
  'FS',
  'HOV',
  'MOV',
  'SSV',
  'PCV',
  'PV',
  'INSTR',
  'TANK',
  'ELEC_CB',
  'ELEC_M',
  'ELEC_GND',
  'TEXT',
];
