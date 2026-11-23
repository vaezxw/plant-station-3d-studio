import { useMemo, type CSSProperties, type FC } from 'react';
import {
  useEventBus,
  type BlockComponentProps,
} from '@lius1314/visual-dashboard-scaffold';
import {
  getNode,
  setSelectedTag,
  useActiveSnapshot,
  usePlantCursor,
} from '../data/cursor';
import { POINT_DEFS, type Quality } from '../data/points';
import { M2_PRIMARY_TAG, PLANT_TAG_SELECTED, type TagSelectedPayload } from '../plant/events';

const QUALITY_COLOR: Record<Quality, string> = {
  GOOD: '#4ade80',
  BAD: '#f87171',
  STALE: '#fbbf24',
  UNCERTAIN: '#fb923c',
  NODATA: '#94a3b8',
};

const DETAIL_ORDER = [
  'pressure',
  'temperature',
  'cumStd',
  'cumWork',
  'flowWork',
  'dp2',
] as const;

const wrap: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  overflow: 'auto',
  color: '#e2e8f0',
  background: 'linear-gradient(160deg, rgba(15,23,42,0.94), rgba(30,41,59,0.88))',
  border: '1px solid rgba(56,189,248,0.3)',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  fontSize: 13,
};

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '无数据';
  const unitSuffix = unit ? ` ${unit}` : '';
  return `${value}${unitSuffix}`;
}

/** M2：当前选中设备详情（压力/温度/累积/瞬时 + 单位 + 质量） */
const DetailBlock: FC<BlockComponentProps> = ({ width, height, pageId }) => {
  const cursor = usePlantCursor();
  const snapshot = useActiveSnapshot();
  const scope = pageId ? `page:${pageId}` : undefined;

  useEventBus<TagSelectedPayload>(
    PLANT_TAG_SELECTED,
    (payload) => {
      if (payload?.tag) setSelectedTag(payload.tag);
    },
    { scope },
  );

  const tag = cursor.selectedTag;
  const node = tag ? getNode(tag) : undefined;
  const valueMap = useMemo(
    () => new Map(snapshot.values.map((v) => [v.id, v])),
    [snapshot.values],
  );

  const rows = useMemo(() => {
    if (!tag) return [];
    const defs = POINT_DEFS.filter((d) => d.tag === tag);
    // HG-UF-101：按验收顺序排；其它位号按定义顺序
    if (tag === M2_PRIMARY_TAG) {
      return DETAIL_ORDER.map((suffix) => {
        const id = `${tag}.${suffix}`;
        return defs.find((d) => d.id === id);
      }).filter((d): d is NonNullable<typeof d> => Boolean(d));
    }
    return defs;
  }, [tag]);

  return (
    <div style={{ ...wrap, width: width ?? '100%', height: height ?? '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 16, letterSpacing: 2, color: '#38bdf8' }}>设备详情 · detail</strong>
        <span style={{ opacity: 0.65 }}>监视-only · 无写阀</span>
      </div>

      {!tag ? (
        <div style={{ opacity: 0.7, lineHeight: 1.6 }}>
          尚未选中设备。请在场景点击任一 <code>HG-*</code> 模型或标签（例如{' '}
          <code>{M2_PRIMARY_TAG}</code>），或从 summary 触发。
        </div>
      ) : (
        <>
          <div
            style={{
              padding: 12,
              borderRadius: 6,
              border: '1px solid rgba(56,189,248,0.45)',
              background: 'rgba(14,165,233,0.12)',
            }}
          >
            <div style={{ fontFamily: 'Consolas, monospace', fontSize: 20, color: '#67e8f9' }}>
              {tag}
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              {node ? (
                <>
                  kind={node.kind} · lane={node.lane}
                  {node.reviewNote ? (
                    <span style={{ color: '#fb923c' }}> · review</span>
                  ) : null}
                </>
              ) : (
                <span style={{ color: '#f87171' }}>拓扑中无此位号</span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
              快照 {snapshot.id} · {snapshot.storyTime}
            </div>
          </div>

          {rows.length === 0 ? (
            <div style={{ opacity: 0.7 }}>该位号在当前点表无测点（仅几何可选）。</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                  <th style={{ padding: '6px 4px' }}>测点</th>
                  <th style={{ padding: '6px 4px' }}>值（单位）</th>
                  <th style={{ padding: '6px 4px' }}>kind</th>
                  <th style={{ padding: '6px 4px' }}>质量</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((def) => {
                  const pv = valueMap.get(def.id);
                  const quality = (pv?.quality ?? 'NODATA') as Quality;
                  return (
                    <tr
                      key={def.id}
                      style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}
                    >
                      <td style={{ padding: '8px 4px' }}>{def.name}</td>
                      <td style={{ padding: '8px 4px', fontFamily: 'Consolas, monospace' }}>
                        {formatValue(pv?.value ?? null, def.unit)}
                      </td>
                      <td style={{ padding: '8px 4px' }}>{def.kind}</td>
                      <td
                        style={{
                          padding: '8px 4px',
                          color: QUALITY_COLOR[quality],
                          fontWeight: 600,
                        }}
                      >
                        {quality}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default DetailBlock;
