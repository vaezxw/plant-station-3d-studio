import type { CSSProperties, FC } from 'react';
import type { BlockComponentProps } from '@lius1314/visual-dashboard-scaffold';
import {
  setSnapshotById,
  useActiveSnapshot,
  usePlantCursor,
} from '../data/cursor';
import { POINT_DEFS, type Quality } from '../data/points';
import { SNAPSHOT_ORDER, type SnapshotId } from '../data/snapshots';
import { listReviewNodes } from '../data/topology';
import { selectPlantTag } from '../plant/selectTag';

const QUALITY_COLOR: Record<Quality, string> = {
  GOOD: '#4ade80',
  BAD: '#f87171',
  STALE: '#fbbf24',
  UNCERTAIN: '#fb923c',
  NODATA: '#94a3b8',
};

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '无数据';
  const unitSuffix = unit ? ` ${unit}` : '';
  return `${value}${unitSuffix}`;
}

const wrap: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  overflow: 'auto',
  color: '#e2e8f0',
  background: 'linear-gradient(160deg, rgba(15,23,42,0.94), rgba(30,41,59,0.88))',
  border: '1px solid rgba(56,189,248,0.3)',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  fontSize: 13,
};

/** M1 可选点表面板：读 thin store/cursor，切快照、看质量；选中时发 EventBus。 */
const PointsPanel: FC<BlockComponentProps> = ({ width, height, emit }) => {
  const cursor = usePlantCursor();
  const snapshot = useActiveSnapshot();
  const valueMap = new Map(snapshot.values.map((v) => [v.id, v]));
  const reviewCount = listReviewNodes().length + POINT_DEFS.filter((d) => d.reviewNote).length;

  return (
    <div style={{ ...wrap, width: width ?? '100%', height: height ?? '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16, letterSpacing: 2, color: '#38bdf8' }}>M1 点表 / 快照</strong>
        <span style={{ opacity: 0.7 }}>
          storyTime={snapshot.storyTime} · 非同时刻={snapshot.notSameMomentAs}
        </span>
        <span style={{ opacity: 0.55 }}>待复核标记 {reviewCount} 项</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SNAPSHOT_ORDER.map((id: SnapshotId) => {
          const active = cursor.snapshotId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSnapshotById(id)}
              style={{
                cursor: 'pointer',
                border: active ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.35)',
                background: active ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.6)',
                color: '#e2e8f0',
                padding: '6px 12px',
                borderRadius: 4,
              }}
            >
              {id}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            selectPlantTag(
              cursor.selectedTag === 'HG-UF-101' ? null : 'HG-UF-101',
              'summary',
              emit,
            )
          }
          style={{
            cursor: 'pointer',
            border: '1px solid rgba(148,163,184,0.35)',
            background: 'rgba(15,23,42,0.6)',
            color: '#e2e8f0',
            padding: '6px 12px',
            borderRadius: 4,
          }}
        >
          选中 {cursor.selectedTag ?? '无'}（点 HG-UF-101）
        </button>
      </div>

      <div style={{ opacity: 0.75, lineHeight: 1.5 }}>
        {snapshot.label} · {snapshot.source}
        <br />
        {snapshot.notes[0]}
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
        }}
      >
        <thead>
          <tr style={{ textAlign: 'left', opacity: 0.7 }}>
            <th style={{ padding: '6px 4px' }}>点位</th>
            <th style={{ padding: '6px 4px' }}>位号</th>
            <th style={{ padding: '6px 4px' }}>值</th>
            <th style={{ padding: '6px 4px' }}>kind</th>
            <th style={{ padding: '6px 4px' }}>质量</th>
          </tr>
        </thead>
        <tbody>
          {POINT_DEFS.map((def) => {
            const pv = valueMap.get(def.id);
            const quality = (pv?.quality ?? 'NODATA') as Quality;
            const highlighted =
              cursor.selectedTag != null &&
              (def.tag === cursor.selectedTag || def.id.startsWith(cursor.selectedTag));
            return (
              <tr
                key={def.id}
                style={{
                  background: highlighted ? 'rgba(56,189,248,0.12)' : 'transparent',
                  borderTop: '1px solid rgba(148,163,184,0.15)',
                }}
              >
                <td style={{ padding: '6px 4px' }}>
                  {def.name}
                  {def.reviewNote ? (
                    <span style={{ marginLeft: 6, color: '#fb923c' }}>review</span>
                  ) : null}
                </td>
                <td style={{ padding: '6px 4px', fontFamily: 'Consolas, monospace' }}>{def.tag}</td>
                <td style={{ padding: '6px 4px', fontFamily: 'Consolas, monospace' }}>
                  {formatValue(pv?.value ?? null, def.unit)}
                </td>
                <td style={{ padding: '6px 4px' }}>{def.kind}</td>
                <td style={{ padding: '6px 4px', color: QUALITY_COLOR[quality], fontWeight: 600 }}>
                  {quality}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PointsPanel;
