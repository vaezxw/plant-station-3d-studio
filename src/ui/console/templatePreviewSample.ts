import type { PointDef, PointValue } from '../../data/points';
import { getCatalogItem } from '../../domain/catalog';
import type { CardElementSchema, CardTemplateSchema, SceneNode, ThresholdRule } from '../../domain/schema';
import type { PointSample } from '../../store/useTelemetryStore';

export type PreviewCondition = 'normal' | 'warn' | 'alarm';

/**
 * 为脱离具体工程的模板预览构造虚拟 3D 样本设备节点（附带典型工艺测点）
 */
export function buildPreviewSampleNode(template: CardTemplateSchema): SceneNode {
  const kind = template.bindCatalogKind ?? 'WATER_PUMP';
  const catalogMeta = getCatalogItem(kind);
  const tagPrefix = catalogMeta?.tagPrefix ?? 'EQ';
  return {
    id: `sample-node-${template.id}`,
    tag: `${tagPrefix}-201`,
    name: catalogMeta?.labelZh ?? '通用工艺设备',
    section: catalogMeta?.defaultSection ?? '样本演示工段',
    kind,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    pointIds: ['HG-UF-101.pressure', 'HG-UF-101.flowWork', 'HG-UF-101.temperature'],
  };
}

/**
 * 解析元素实际指向的测点 key（支持 static / point / device-slot）
 */
export function resolveTemplateElementPointKey(
  el: CardElementSchema,
  sampleNode: SceneNode,
): string | null {
  const binding = el.binding;
  if (!binding || binding.mode === 'static') return null;
  if (binding.mode === 'point') return binding.pointKey ?? null;
  if (binding.mode === 'device-slot') {
    const slot = binding.deviceSlot;
    if (slot?.prop && slot.prop !== 'metric') return null;
    const idx = slot?.metricIndex ?? 0;
    const allPts = [...sampleNode.pointIds, ...(sampleNode.customPoints?.map((c) => c.key) ?? [])];
    return allPts[idx] ?? null;
  }
  return null;
}

function pickValueForCondition(
  baseVal: number,
  condition: PreviewCondition,
  thresholds: ThresholdRule[] | undefined,
  multiplier: number,
  offset: number,
): number {
  if (condition === 'normal' || !thresholds || thresholds.length === 0) {
    if (condition === 'warn') return Number((baseVal * 1.06).toFixed(2));
    if (condition === 'alarm') return Number((baseVal * 1.18).toFixed(2));
    return baseVal;
  }

  // 根据首个阈值倒推能够命中的原始测点值
  const firstRule = thresholds[0];
  const displayTarget =
    condition === 'alarm'
      ? firstRule.operator === '<' || firstRule.operator === '<='
        ? firstRule.value - Math.max(1, Math.abs(firstRule.value) * 0.12)
        : firstRule.value + Math.max(2, Math.abs(firstRule.value) * 0.08)
      : firstRule.operator === '<' || firstRule.operator === '<='
        ? firstRule.value + Math.max(1, Math.abs(firstRule.value) * 0.04)
        : firstRule.value * 0.94;

  const safeMult = Math.abs(multiplier) > 1e-6 ? multiplier : 1;
  return Number(((displayTarget - offset) / safeMult).toFixed(2));
}

/**
 * 构建详情预览空间用的覆盖点位值 + 历史曲线（支持正常/预警/告警工况切换与滑块微调）
 */
export function buildSampleTelemetryOverrides(
  template: CardTemplateSchema,
  sampleNode: SceneNode,
  condition: PreviewCondition,
  baseValueMap: Record<string, PointValue>,
  basePointHistory: Record<string, PointSample[]>,
  manualScalePct: number,
  pointDefs: readonly PointDef[],
): {
  valueOverrides: Record<string, PointValue>;
  historyOverrides: Record<string, PointSample[]>;
  defOverrides: Record<string, Pick<PointDef, 'id' | 'name' | 'unit'>>;
} {
  const valueOverrides: Record<string, PointValue> = {};
  const historyOverrides: Record<string, PointSample[]> = {};
  const defOverrides: Record<string, Pick<PointDef, 'id' | 'name' | 'unit'>> = {};
  const ts = new Date().toISOString();

  // 先建立兜底样本字典
  const defaultMap: Record<string, number> = {
    'HG-UF-101.pressure': 4620,
    'HG-UF-101.flowWork': 126.4,
    'HG-UF-101.temperature': 24.8,
  };

  for (const def of pointDefs) {
    defOverrides[def.id] = { id: def.id, name: def.name, unit: def.unit };
  }

  const collectPointKeys = new Set<string>(sampleNode.pointIds);
  for (const el of template.elements) {
    const k = resolveTemplateElementPointKey(el, sampleNode);
    if (k) collectPointKeys.add(k);
    for (const s of el.props.seriesPointIds ?? []) collectPointKeys.add(s);
  }

  // 对模板元素里引用的每个测点按阈值规则调谐
  for (const pid of collectPointKeys) {
    const basePv = baseValueMap[pid];
    const baseVal =
      basePv?.value !== null && basePv?.value !== undefined
        ? basePv.value
        : defaultMap[pid] ?? 68.5;

    const boundEl = template.elements.find((el) => resolveTemplateElementPointKey(el, sampleNode) === pid);
    const mult = boundEl?.binding?.format?.multiplier ?? 1;
    const off = boundEl?.binding?.format?.offset ?? 0;
    const conditioned = pickValueForCondition(
      baseVal,
      condition,
      boundEl?.binding?.thresholds,
      mult,
      off,
    );
    const finalVal = Number((conditioned * (1 + manualScalePct / 100)).toFixed(2));

    valueOverrides[pid] = {
      id: pid,
      value: finalVal,
      quality: 'GOOD',
      ts,
    };

    const rawHist = basePointHistory[pid] ?? [];
    if (rawHist.length > 0) {
      const last = rawHist[rawHist.length - 1]?.value || baseVal || 1;
      const ratio = last !== 0 ? finalVal / last : 1;
      historyOverrides[pid] = rawHist.map((pt, idx) => ({
        label: pt.label,
        value:
          idx === rawHist.length - 1
            ? finalVal
            : Number((pt.value * (0.4 + 0.6 * ratio)).toFixed(2)),
      }));
    } else {
      historyOverrides[pid] = Array.from({ length: 12 }, (_, idx) => ({
        label: `00:${String(idx * 5).padStart(2, '0')}`,
        value: Number((finalVal * (0.94 + Math.sin(idx * 0.7) * 0.05)).toFixed(2)),
      }));
    }
  }

  return { valueOverrides, historyOverrides, defOverrides };
}
