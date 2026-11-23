import {
  useEffect,
  useState,
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useDashboardStore } from '@lius1314/visual-dashboard-scaffold';
import {
  CATALOG_CATEGORIES,
  DEVICE_CATALOG,
  isPlaceableCatalogKind,
  type CatalogCategory,
  type CatalogKind,
} from '../scene/catalog';
import CatalogThumb from '../scene/catalog/CatalogThumb';
import {
  SCENE_DISPLAY_NAME,
  SCENE_PALETTE_HINT,
  addBoundSceneBlock,
  clientToBoardLayout,
  findSceneDropHost,
  listFreeSceneSlots,
  rebindOrphanSceneBlocks,
} from './sceneRegistry';
import { TURBOJET_BLOCK_IDS, TURBOJET_DISPLAY_NAME } from './turbojetRegistry';
import {
  SCENE_PALETTE_POS_KEY,
  loadPalettePos,
  savePalettePos,
  startDragOrClick,
} from './floatPalettePos';

type DragGhost =
  | { type: 'canvas'; x: number; y: number }
  | { type: 'equip'; kind: CatalogKind; x: number; y: number };

/**
 * 编辑模式组件库：仅「空白画布」+「三维模型」分组；条目为实时旋转缩略图。
 */
const ScenePaletteHost: FC = () => {
  const editMode = useDashboardStore((s) => s.editMode);
  const pages = useDashboardStore((s) => s.pages);
  const activePageId = useDashboardStore((s) => s.activePageId);
  const [open, setOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [category, setCategory] = useState<CatalogCategory>('equipment');
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [pos, setPos] = useState(() =>
    loadPalettePos(SCENE_PALETTE_POS_KEY, {
      x: typeof window === 'undefined' ? 24 : Math.max(16, window.innerWidth - 356),
      y: 96,
    }),
  );

  const page = pages.find((p) => p.id === activePageId);
  const used = page?.chartBlocks.map((b) => b.layout.i) ?? [];
  const free = listFreeSceneSlots(used);
  const leftoverTurbo = used.some((id) =>
    (TURBOJET_BLOCK_IDS as readonly string[]).includes(id),
  );
  const equipItems = DEVICE_CATALOG.filter((c) => c.category === category && c.placeable);

  useEffect(() => {
    if (!editMode) return;
    const n = rebindOrphanSceneBlocks();
    if (n > 0) setMsg(`已自动绑定 ${n} 个空白画布副本`);
  }, [editMode, pages, activePageId]);

  const startCanvasDrag = (e: ReactPointerEvent) => {
    if (free.length === 0) {
      setMsg('空白画布槽位已满');
      return;
    }
    e.preventDefault();
    setGhost({ type: 'canvas', x: e.clientX, y: e.clientY });
    setMsg('拖到看板空白处松开 → 空白画布（再选 2D/3D）');

    const onMove = (ev: PointerEvent) => {
      setGhost({ type: 'canvas', x: ev.clientX, y: ev.clientY });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGhost(null);
      const overPalette = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .some((el) => el instanceof Element && el.closest('[data-scene-palette]'));
      if (overPalette) {
        setMsg('已取消（松在组件库上）');
        return;
      }
      const layout = clientToBoardLayout(ev.clientX, ev.clientY);
      const r = addBoundSceneBlock(layout ? { x: layout.x - 40, y: layout.y - 40 } : undefined);
      setMsg(
        r.ok
          ? `已添加空白画布（ID=${r.slot}），请在画布内选 2D 或 3D`
          : r.reason,
      );
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startEquipDrag = (kind: CatalogKind, e: ReactPointerEvent) => {
    if (!isPlaceableCatalogKind(kind)) return;
    e.preventDefault();
    setGhost({ type: 'equip', kind, x: e.clientX, y: e.clientY });
    setMsg('拖到已进入 2D/3D 的画布上松开');

    const onMove = (ev: PointerEvent) => {
      setGhost({ type: 'equip', kind, x: ev.clientX, y: ev.clientY });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGhost(null);
      const host = findSceneDropHost(ev.clientX, ev.clientY);
      const ok = host?.__dropCatalogAt?.(ev.clientX, ev.clientY, kind) ?? false;
      setMsg(ok ? `已放置 ${kind}` : '未放到画布（需先在画布选 2D/3D）');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const persistHostPos = (next: { x: number; y: number }) => {
    setPos(next);
    savePalettePos(SCENE_PALETTE_POS_KEY, next);
  };

  const startHostDrag = (e: ReactPointerEvent, onClick?: () => void) => {
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;
    startDragOrClick(e, {
      map: (cx, cy) => ({
        x: Math.max(0, cx - ox),
        y: Math.max(0, cy - oy),
      }),
      onMove: setPos,
      onClick,
      onDragEnd: persistHostPos,
    });
  };

  if (!editMode) return null;

  return (
    <div
      style={{ ...wrap, left: pos.x, top: pos.y, right: 'auto' }}
      data-editor-control
      data-scene-palette
    >
      <button
        type="button"
        draggable={false}
        style={toggleBtn}
        title="拖动移动；单击展开/收起"
        onPointerDown={(e) => startHostDrag(e, () => setOpen((v) => !v))}
      >
        {open ? '收起组件库' : '组件库'}
      </button>
      {open ? (
        <div style={panel}>
          <div
            onPointerDown={(e) => startHostDrag(e)}
            style={{ fontWeight: 700, color: '#67e8f9', marginBottom: 4, cursor: 'move', userSelect: 'none' }}
            title="拖动移动组件库"
          >
            组件库 · 空白画布 + 三维模型
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.45, marginBottom: 8 }}>
            {SCENE_PALETTE_HINT}
            <br />
            3D 开局为空。阀门 / PCS / 橇装 / 涡喷都拖进同一块画布。
          </div>

          <div
            role="button"
            tabIndex={0}
            style={{
              ...dragCard,
              opacity: free.length ? 1 : 0.45,
              cursor: free.length ? 'grab' : 'not-allowed',
            }}
            onPointerDown={startCanvasDrag}
            title="按住拖到看板"
          >
            <span style={{ ...glyph, background: '#0ea5e9' }}>画</span>
            <div>
              <div style={{ fontWeight: 600 }}>空白画布</div>
              <div style={{ fontSize: 10, opacity: 0.65 }}>沿用 {SCENE_DISPLAY_NAME} 槽位 · 2D/3D</div>
            </div>
          </div>

          <button
            type="button"
            style={{ ...primaryBtn, marginTop: 6 }}
            disabled={free.length === 0}
            onClick={() => {
              const r = addBoundSceneBlock();
              setMsg(
                r.ok
                  ? `已添加空白画布（ID=${r.slot}），请选 2D/3D`
                  : r.reason,
              );
            }}
          >
            或点击添加空白画布
          </button>
          <div style={{ marginTop: 6, fontSize: 10, opacity: 0.65 }}>
            可用槽位：{free.length ? free.join(', ') : '已满'}
          </div>

          {leftoverTurbo ? (
            <div style={warnBox}>
              检测到旧「{TURBOJET_DISPLAY_NAME}」独立卡片（已停用）。请删除该卡，或用看板
              <strong> 重置 </strong>
              后，从下方「涡喷」拖入空白 3D 画布。
            </div>
          ) : null}

          <div style={{ marginTop: 12, fontWeight: 600, fontSize: 12, color: '#a5f3fc' }}>
            三维模型
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
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
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {equipItems.map((c) => (
              <button
                key={c.kind}
                type="button"
                style={thumb}
                title={`拖放 ${c.labelZh}（${c.silhouette}）`}
                onPointerDown={(e) => startEquipDrag(c.kind, e)}
              >
                <CatalogThumb kind={c.kind} />
                <span style={{ fontSize: 10 }}>{c.labelZh}</span>
              </button>
            ))}
          </div>

          {msg ? (
            <div style={{ marginTop: 8, fontSize: 11, color: '#fde68a' }}>{msg}</div>
          ) : null}
        </div>
      ) : null}

      {ghost ? (
        <div
          style={{
            position: 'fixed',
            left: ghost.x + 14,
            top: ghost.y + 14,
            zIndex: 10000,
            pointerEvents: 'none',
            padding: '5px 12px',
            borderRadius: 4,
            border: '1px solid #67e8f9',
            background: 'rgba(14,165,233,0.9)',
            color: '#f8fafc',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          }}
        >
          {ghost.type === 'canvas' ? '空白画布' : ghost.kind}
        </div>
      ) : null}
    </div>
  );
};

const wrap: CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  pointerEvents: 'auto',
};

const toggleBtn: CSSProperties = {
  cursor: 'grab',
  border: '1px solid rgba(56,189,248,0.55)',
  background: 'rgba(14,165,233,0.35)',
  color: '#e0f2fe',
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 12,
  touchAction: 'none',
  userSelect: 'none',
};

const panel: CSSProperties = {
  marginTop: 6,
  width: 320,
  padding: 10,
  borderRadius: 6,
  border: '1px solid rgba(56,189,248,0.45)',
  background: 'rgba(15,23,42,0.94)',
  color: '#e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
};

const dragCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid rgba(56,189,248,0.5)',
  background: 'rgba(14,165,233,0.2)',
  touchAction: 'none',
  userSelect: 'none',
};

const glyph: CSSProperties = {
  width: 36,
  height: 28,
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  flexShrink: 0,
};

const primaryBtn: CSSProperties = {
  cursor: 'pointer',
  width: '100%',
  border: '1px solid rgba(56,189,248,0.45)',
  background: 'rgba(30,41,59,0.85)',
  color: '#e0f2fe',
  padding: '6px 10px',
  borderRadius: 4,
  fontSize: 11,
};

const miniBtn: CSSProperties = {
  cursor: 'pointer',
  border: '1px solid rgba(56,189,248,0.4)',
  color: '#e0f2fe',
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 10,
};

const thumb: CSSProperties = {
  cursor: 'grab',
  width: 84,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(30,41,59,0.95)',
  color: '#f8fafc',
  padding: '4px',
  borderRadius: 4,
  touchAction: 'none',
};

const warnBox: CSSProperties = {
  marginTop: 10,
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid rgba(251,191,36,0.55)',
  background: 'rgba(120,53,15,0.45)',
  color: '#fde68a',
  fontSize: 11,
  lineHeight: 1.45,
};

export default ScenePaletteHost;
