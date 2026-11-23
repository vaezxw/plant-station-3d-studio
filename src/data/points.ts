/**
 * 测点定义（M1）。单位写在点上；瞬时与累积分离；坏值走 quality。
 */

export type Quality = 'GOOD' | 'BAD' | 'STALE' | 'UNCERTAIN' | 'NODATA';

export type PointKind = 'instant' | 'cumulative' | 'status' | 'opening';

export type PointDef = {
  id: string;
  tag: string;
  name: string;
  unit: string;
  kind: PointKind;
  /** 未绑定位号 / 单位未决等人工复核标记 */
  reviewNote?: string;
};

export type PointValue = {
  id: string;
  value: number | null;
  quality: Quality;
  ts: string;
};

function p(
  id: string,
  tag: string,
  name: string,
  unit: string,
  kind: PointKind,
  reviewNote?: string,
): PointDef {
  return { id, tag, name, unit, kind, ...(reviewNote ? { reviewNote } : {}) };
}

/**
 * 画布「7 号 / 8 号」阀开度尚未对应到具体 HG-*。
 * 用占位 tag `REVIEW-VALVE-7` / `REVIEW-VALVE-8`，禁止驱动几何。
 */
export const REVIEW_VALVE_TAGS = ['REVIEW-VALVE-7', 'REVIEW-VALVE-8'] as const;

export const POINT_DEFS: PointDef[] = [
  p('HG-UF-101.pressure', 'HG-UF-101', '入口压力', 'kPa', 'instant'),
  p('HG-UF-101.temperature', 'HG-UF-101', '温度', '°C', 'instant'),
  p('HG-UF-101.cumStd', 'HG-UF-101', '标况累积量', 'm³', 'cumulative'),
  p('HG-UF-101.cumWork', 'HG-UF-101', '工况累积量', 'm³', 'cumulative'),
  p('HG-UF-101.flowWork', 'HG-UF-101', '工况瞬时量', 'm³/h', 'instant'),
  p('HG-UF-101.dp2', 'HG-UF-101', '差压2', 'kPa', 'instant'),

  p('HG-UF-102.pressure', 'HG-UF-102', '入口压力', 'kPa', 'instant'),
  p('HG-UF-102.temperature', 'HG-UF-102', '温度', '°C', 'instant'),
  p('HG-UF-102.velocity', 'HG-UF-102', '流速', 'm/s', 'instant'),
  p('HG-UF-102.flowWork', 'HG-UF-102', '工况体积流量', 'm³/h', 'instant'),
  p('HG-UF-102.flowStd', 'HG-UF-102', '标况体积流量', 'm³/h', 'instant'),
  p('HG-UF-102.dp1', 'HG-UF-102', '差压1', 'kPa', 'instant'),

  p('elster.afterReg.temperature', 'HG-PV10215', '调压后温度(上路)', '°C', 'instant'),
  p(
    'elster.afterReg.pressure',
    'HG-PV10215',
    '调压后压力(上路)',
    '?',
    'instant',
    '图一调压后压力无单位；禁止默认写成 MPa。待人工冻结。',
  ),
  p('weisi.afterReg.temperature', 'HG-MOV10225', '调压后温度(下路)', '°C', 'instant'),
  p(
    'weisi.afterReg.pressure',
    'HG-MOV10225',
    '调压后压力(下路)',
    '?',
    'instant',
    '图一调压后压力无单位；禁止默认写成 MPa。待人工冻结。',
  ),

  p('outlet.temperature', 'HG-HOV10312', '出口温度', '°C', 'instant'),
  p(
    'outlet.pressure',
    'HG-HOV10312',
    '出口压力',
    '?',
    'instant',
    '图一出口压力无单位；禁止默认写成 MPa。待人工冻结。',
  ),

  p(
    'valve.7.opening',
    'REVIEW-VALVE-7',
    '7号阀开度',
    '%',
    'opening',
    '画布仅写「7号」；未对应 HG-*。BAD 开度不得驱动阀几何。',
  ),
  p(
    'valve.8.opening',
    'REVIEW-VALVE-8',
    '8号阀开度',
    '%',
    'opening',
    '画布仅写「8号」；未对应 HG-*。NODATA 不得驱动阀几何。',
  ),

  p('HG-PCV10213.valveColor', 'HG-PCV10213', '阀色态', '', 'status'),
  p('HG-PCV10223.valveColor', 'HG-PCV10223', '阀色态', '', 'status'),
];

export const POINT_DEFS_BY_ID: ReadonlyMap<string, PointDef> = new Map(
  POINT_DEFS.map((def) => [def.id, def]),
);

export function listReviewPoints(): PointDef[] {
  return POINT_DEFS.filter((def) => Boolean(def.reviewNote));
}

/** 开度是否允许驱动几何：仅 GOOD 且数值在 [0,100] */
export function openingDrivesGeometry(value: PointValue): boolean {
  if (value.quality !== 'GOOD') return false;
  if (value.value == null) return false;
  return value.value >= 0 && value.value <= 100;
}
