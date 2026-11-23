import type { CSSProperties, FC } from 'react';
import {
  useEventBus,
  type BlockComponentProps,
} from '@lius1314/visual-dashboard-scaffold';
import {
  setSelectedTag,
  setSnapshotById,
  useActiveSnapshot,
  usePlantCursor,
} from '../data/cursor';
import { POINT_DEFS_BY_ID, type Quality } from '../data/points';
import { SNAPSHOT_ORDER, type SnapshotId } from '../data/snapshots';
import { M2_PRIMARY_TAG, PLANT_TAG_SELECTED, type TagSelectedPayload } from '../plant/events';
import { selectPlantTag } from '../plant/selectTag';

const QUALITY_COLOR: Record<Quality, string> = {
  GOOD: '#4ade80',
  BAD: '#f87171',
  STALE: '#fbbf24',
  UNCERTAIN: '#fb923c',
  NODATA: '#94a3b8',
};

const wrap: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  overflow: 'auto',
  color: '#e2e8f0',
  background: 'linear-gradient(160deg, rgba(15,23,42,0.94), rgba(30,41,59,0.88))',
  border: '1px solid rgba(56,189,248,0.3)',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  fontSize: 13,
};

type InletRow = {
  tag: string;
  lane: string;
  ids: string[];
};

const INLETS: InletRow[] = [
  {
    tag: 'HG-UF-101',
    lane: '埃尔斯特',
    ids: [
      'HG-UF-101.pressure',
      'HG-UF-101.temperature',
      'HG-UF-101.flowWork',
      'HG-UF-101.cumStd',
    ],
  },
  {
    tag: 'HG-UF-102',
    lane: '中核维思',
    ids: [
      'HG-UF-102.pressure',
      'HG-UF-102.temperature',
      'HG-UF-102.flowWork',
      'HG-UF-102.flowStd',
    ],
  },
];

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '无数据';
  return unit ? `${value} ${unit}` : String(value);
}

/** M2：入口侧摘要；点击行发出 plant:tagSelected */
const SummaryBlock: FC<BlockComponentProps> = ({ width, height, pageId, emit }) => {
  const cursor = usePlantCursor();
  const snapshot = useActiveSnapshot();
  const valueMap = new Map(snapshot.values.map((v) => [v.id, v]));
  const scope = pageId ? `page:${pageId}` : undefined;

  useEventBus<TagSelectedPayload>(
    PLANT_TAG_SELECTED,
    (payload) => {
      if (payload?.tag) setSelectedTag(payload.tag);
    },
    { scope },
  );

  return (
    <div style={{ ...wrap, width: width ?? '100%', height: height ?? '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15, letterSpacing: 2, color: '#38bdf8' }}>总览 · summary</strong>
        <span style={{ opacity: 0.65 }}>
          {snapshot.id} · {snapshot.storyTime}
        </span>
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
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {id}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {INLETS.map((inlet) => {
          const selected = cursor.selectedTag === inlet.tag;
          return (
            <button
              key={inlet.tag}
              type="button"
              onClick={() => selectPlantTag(inlet.tag, 'summary', emit)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: selected ? '1px solid #67e8f9' : '1px solid rgba(148,163,184,0.3)',
                background: selected ? 'rgba(14,165,233,0.18)' : 'rgba(15,23,42,0.55)',
                color: '#e2e8f0',
                padding: 10,
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Consolas, monospace', color: '#67e8f9' }}>
                  {inlet.tag}
                </span>
                <span style={{ opacity: 0.6, fontSize: 12 }}>{inlet.lane}</span>
              </div>
              {inlet.ids.map((id) => {
                const def = POINT_DEFS_BY_ID.get(id);
                const pv = valueMap.get(id);
                const quality = (pv?.quality ?? 'NODATA') as Quality;
                if (!def) return null;
                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    <span style={{ opacity: 0.75 }}>{def.name}</span>
                    <span style={{ fontFamily: 'Consolas, monospace' }}>
                      {formatValue(pv?.value ?? null, def.unit)}{' '}
                      <span style={{ color: QUALITY_COLOR[quality] }}>{quality}</span>
                    </span>
                  </div>
                );
              })}
              {inlet.tag === M2_PRIMARY_TAG ? (
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.55 }}>
                  点击选中 → detail/scene
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SummaryBlock;
