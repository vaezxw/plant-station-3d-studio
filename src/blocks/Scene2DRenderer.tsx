import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { BlockComponentProps } from '@lius1314/visual-dashboard-scaffold';
import {
  CATALOG_CATEGORIES,
  DEVICE_CATALOG,
  catalogEntry,
  isPlaceableCatalogKind,
  type CatalogCategory,
  type CatalogKind,
} from '../scene/catalog';

type Place2D = {
  id: string;
  kind: CatalogKind;
  x: number;
  y: number;
};

type HostApi = HTMLDivElement & {
  __dropCatalogAt?: (clientX: number, clientY: number, kind: CatalogKind) => boolean;
};

const STORAGE_PREFIX = 'hengguang.canvas-2d.v1:';

function loadPlaces(slotId: string): Place2D[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + slotId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Place2D[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlaces(slotId: string, places: Place2D[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + slotId, JSON.stringify(places));
  } catch {
    /* ignore */
  }
}

let serial = 1;

/** 2D 工艺画布：平面放置目录组件，自行配置流程；不加载 Three。 */
const Scene2DRenderer: FC<BlockComponentProps & { slotId: string }> = ({
  width,
  height,
  slotId,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [places, setPlaces] = useState<Place2D[]>(() => loadPlaces(slotId));
  const [category, setCategory] = useState<CatalogCategory>('equipment');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ kind: CatalogKind; x: number; y: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const items = useMemo(
    () => DEVICE_CATALOG.filter((c) => c.category === category && c.placeable),
    [category],
  );

  useEffect(() => {
    savePlaces(slotId, places);
  }, [slotId, places]);

  const dropAt = useCallback(
    (clientX: number, clientY: number, kind: CatalogKind) => {
      const board = boardRef.current;
      if (!board || !isPlaceableCatalogKind(kind)) return false;
      const rect = board.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return false;
      }
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      const id = `P2D-${String(serial).padStart(3, '0')}`;
      serial += 1;
      setPlaces((prev) => [...prev, { id, kind, x, y }]);
      setSelectedId(id);
      setHint(`已放置 ${kind}`);
      return true;
    },
    [],
  );

  useEffect(() => {
    const board = boardRef.current as HostApi | null;
    if (!board) return;
    board.__dropCatalogAt = dropAt;
    return () => {
      delete board.__dropCatalogAt;
    };
  }, [dropAt]);

  const onPaletteDragStart = (kind: CatalogKind, e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setGhost({ kind, x: e.clientX, y: e.clientY });
    const onMove = (ev: PointerEvent) => setGhost({ kind, x: ev.clientX, y: ev.clientY });
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGhost(null);
      if (!dropAt(ev.clientX, ev.clientY, kind)) setHint('未放到 2D 画布上');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const moveSelected = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const board = boardRef.current;
    if (!board) return;
    const onMove = (ev: PointerEvent) => {
      const rect = board.getBoundingClientRect();
      const x = Math.min(98, Math.max(2, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(98, Math.max(2, ((ev.clientY - rect.top) / rect.height) * 100));
      setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div style={{ ...wrap, width: width ?? '100%', height: height ?? '100%' }}>
      <div style={toolbar}>
        <strong style={{ color: '#67e8f9' }}>2D 画布</strong>
        <span style={{ opacity: 0.6, fontSize: 11 }}>拖目录到平面 · 自行配置流程</span>
        {hint ? <span style={{ color: '#fde68a', fontSize: 11 }}>{hint}</span> : null}
        <button
          type="button"
          style={miniBtn}
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            setPlaces((prev) => prev.filter((p) => p.id !== selectedId));
            setSelectedId(null);
          }}
        >
          删除选中
        </button>
      </div>

      <div ref={boardRef} style={board} onClick={() => setSelectedId(null)}>
        <div style={gridHint}>空白 2D 流程面 · 从下方拖入组件</div>
        {places.map((p) => {
          const entry = catalogEntry(p.kind);
          return (
            <button
              key={p.id}
              type="button"
              onPointerDown={(e) => moveSelected(e, p.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(p.id);
              }}
              style={{
                ...chip,
                left: `${p.x}%`,
                top: `${p.y}%`,
                borderColor: selectedId === p.id ? '#67e8f9' : 'rgba(148,163,184,0.45)',
                background: entry?.thumb.bg ?? '#334155',
              }}
              title={entry?.labelZh ?? p.kind}
            >
              {entry?.thumb.glyph ?? p.kind}
            </button>
          );
        })}
      </div>

      <div style={rail}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          {CATALOG_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              style={{
                ...miniBtn,
                background: category === c.id ? 'rgba(14,165,233,0.4)' : 'rgba(30,41,59,0.8)',
              }}
              onClick={() => setCategory(c.id)}
            >
              {c.labelZh}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {items.map((c) => (
            <button
              key={c.kind}
              type="button"
              style={thumb}
              title={`拖放 ${c.labelZh}`}
              onPointerDown={(e) => onPaletteDragStart(c.kind, e)}
            >
              <span style={{ ...glyph, background: c.thumb.bg }}>{c.thumb.glyph}</span>
              <span style={{ fontSize: 10 }}>{c.labelZh}</span>
            </button>
          ))}
        </div>
      </div>

      {ghost ? (
        <div
          style={{
            position: 'fixed',
            left: ghost.x + 12,
            top: ghost.y + 12,
            zIndex: 30,
            pointerEvents: 'none',
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #67e8f9',
            background: 'rgba(14,165,233,0.85)',
            color: '#fff',
            fontSize: 12,
          }}
        >
          {ghost.kind}
        </div>
      ) : null}
    </div>
  );
};

const wrap: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #0b1220 100%)',
  border: '1px solid rgba(56,189,248,0.28)',
  boxSizing: 'border-box',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  color: '#e2e8f0',
};

const toolbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  padding: '8px 10px',
  fontSize: 13,
  borderBottom: '1px solid rgba(56,189,248,0.2)',
};

const board: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 120,
  margin: 8,
  borderRadius: 6,
  border: '1px dashed rgba(148,163,184,0.35)',
  background:
    'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0) 0 0 / 24px 24px',
};

const gridHint: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.35,
  fontSize: 13,
  pointerEvents: 'none',
};

const chip: CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  cursor: 'grab',
  border: '2px solid',
  color: '#fff',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'Consolas, monospace',
  touchAction: 'none',
  userSelect: 'none',
};

const rail: CSSProperties = {
  padding: '6px 8px 8px',
  borderTop: '1px solid rgba(56,189,248,0.25)',
  background: 'rgba(15,23,42,0.92)',
};

const thumb: CSSProperties = {
  cursor: 'grab',
  flexShrink: 0,
  width: 64,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(30,41,59,0.95)',
  color: '#f8fafc',
  padding: '4px',
  borderRadius: 4,
  touchAction: 'none',
};

const glyph: CSSProperties = {
  width: 48,
  height: 28,
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
};

const miniBtn: CSSProperties = {
  cursor: 'pointer',
  border: '1px solid rgba(56,189,248,0.45)',
  background: 'rgba(14,165,233,0.18)',
  color: '#e0f2fe',
  padding: '3px 8px',
  borderRadius: 3,
  fontSize: 11,
};

export default Scene2DRenderer;
