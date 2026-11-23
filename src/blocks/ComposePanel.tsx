import { useEffect, useMemo, useRef, useState, type CSSProperties, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clearDraftStorage,
  createEmptyDraft,
  downloadComposeJson,
  saveDraftToStorage,
  type ComposeLayoutFile,
} from '../data/composeLayout';
import {
  CATALOG_CATEGORIES,
  DEVICE_CATALOG,
  isPlaceableCatalogKind,
  type CatalogCategory,
  type CatalogKind,
} from '../scene/catalog';
import CatalogThumb from '../scene/catalog/CatalogThumb';
import {
  COMPOSE_PALETTE_POS_KEY,
  loadPalettePos,
  savePalettePos,
  startDragOrClick,
} from './floatPalettePos';

type Props = {
  selectedTag: string | null;
  draft: ComposeLayoutFile;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  onDraftChange: (next: ComposeLayoutFile) => void;
  onRebuild: () => void;
  onDeleteSelected: () => void;
  onCatalogDragStart: (kind: CatalogKind, e: ReactPointerEvent<HTMLButtonElement>) => void;
};

/**
 * 画布内可拖动浮动组件库（不是底栏停靠）。
 */
const ComposePanel: FC<Props> = ({
  selectedTag,
  draft,
  expanded,
  onExpandedChange,
  onDraftChange,
  onRebuild,
  onDeleteSelected,
  onCatalogDragStart,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [category, setCategory] = useState<CatalogCategory>('equipment');
  const [pos, setPos] = useState(() => loadPalettePos(COMPOSE_PALETTE_POS_KEY, { x: 12, y: 12 }));
  const [posSaved, setPosSaved] = useState(() => {
    try {
      return Boolean(localStorage.getItem(COMPOSE_PALETTE_POS_KEY));
    } catch {
      return false;
    }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (posSaved) return;
    const el = fabRef.current ?? panelRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!parent) return;
    setPos({ x: 12, y: Math.max(12, parent.clientHeight - 48) });
  }, [posSaved, expanded]);

  const selectedOverride = useMemo(
    () => draft.nodes.find((n) => n.tag === selectedTag),
    [draft, selectedTag],
  );

  const items = useMemo(
    () => DEVICE_CATALOG.filter((c) => c.category === category && c.placeable),
    [category],
  );

  const persist = (next: { x: number; y: number }) => {
    setPos(next);
    setPosSaved(true);
    savePalettePos(COMPOSE_PALETTE_POS_KEY, next);
  };

  const startFloatDrag = (e: ReactPointerEvent, el: HTMLElement | null, onClick?: () => void) => {
    const grabX = e.clientX - (el?.getBoundingClientRect().left ?? e.clientX);
    const grabY = e.clientY - (el?.getBoundingClientRect().top ?? e.clientY);
    startDragOrClick(e, {
      map: (cx, cy) => {
        const parent = el?.offsetParent as HTMLElement | null;
        const box = parent?.getBoundingClientRect();
        if (!box) return pos;
        return {
          x: Math.max(8, Math.min(box.width - 72, cx - box.left - grabX)),
          y: Math.max(8, Math.min(box.height - 36, cy - box.top - grabY)),
        };
      },
      onMove: setPos,
      onClick,
      onDragEnd: persist,
    });
  };

  if (!expanded) {
    return (
      <button
        ref={fabRef}
        type="button"
        draggable={false}
        title="拖动移动；单击展开组件库"
        style={{ ...fabStyle, left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }}
        onPointerDown={(e) => startFloatDrag(e, fabRef.current, () => onExpandedChange(true))}
      >
        组件库
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      data-scene-palette
      style={{ ...floatWrap, left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }}
    >
      <div style={railBar}>
        <div
          onPointerDown={(e) => startFloatDrag(e, panelRef.current)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'move',
            userSelect: 'none',
            marginBottom: 6,
          }}
          title="拖动移动组件库"
        >
          <strong style={{ color: '#67e8f9', fontSize: 12 }}>组件库</strong>
          <span style={{ opacity: 0.5, fontSize: 10 }}>浮动面板 · 拖按钮或标题移动</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {CATALOG_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              style={{
                ...miniBtn,
                background: category === c.id ? 'rgba(14,165,233,0.4)' : 'rgba(30,41,59,0.8)',
              }}
            >
              {c.labelZh}
            </button>
          ))}
        </div>
        <div style={chipRow}>
          {items.map((c) => (
            <button
              key={c.kind}
              type="button"
              title={`${c.labelZh}\n${c.silhouette}`}
              onPointerDown={(e) => {
                if (!isPlaceableCatalogKind(c.kind)) return;
                e.preventDefault();
                onCatalogDragStart(c.kind, e);
              }}
              style={thumbCard}
            >
              <CatalogThumb kind={c.kind} />
              <span style={{ fontSize: 10, opacity: 0.9 }}>{c.labelZh}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{
              ...miniBtn,
              border: '1px solid rgba(248,113,113,0.55)',
              background: selectedTag ? 'rgba(185,28,28,0.35)' : 'rgba(30,41,59,0.5)',
              opacity: selectedTag ? 1 : 0.45,
            }}
            disabled={!selectedTag}
            onClick={onDeleteSelected}
          >
            删除
          </button>
          <button type="button" style={miniBtn} onClick={() => setToolsOpen((v) => !v)}>
            {toolsOpen ? '收起工具' : '工具'}
          </button>
          <button type="button" style={miniBtn} onClick={() => onExpandedChange(false)}>
            隐藏
          </button>
        </div>
        {toolsOpen ? (
          <div style={toolsRow}>
            <span style={{ fontFamily: 'Consolas, monospace', fontSize: 11 }}>
              {selectedTag ?? '未选'}
              {selectedOverride?.kind ? ` · ${selectedOverride.kind}` : ''}
            </span>
            <button type="button" style={miniBtn} onClick={onRebuild}>
              重建
            </button>
            <button
              type="button"
              style={miniBtn}
              onClick={() => {
                saveDraftToStorage(draft);
                downloadComposeJson(draft);
              }}
            >
              保存下载
            </button>
            <button
              type="button"
              style={{ ...miniBtn, opacity: 0.75 }}
              onClick={() => {
                clearDraftStorage();
                onDraftChange(createEmptyDraft());
                onRebuild();
              }}
            >
              重置
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const floatWrap: CSSProperties = {
  position: 'absolute',
  zIndex: 4,
  width: 320,
  pointerEvents: 'auto',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
};

const railBar: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid rgba(56,189,248,0.4)',
  background: 'rgba(15,23,42,0.94)',
  color: '#e2e8f0',
  maxHeight: 360,
  overflow: 'hidden',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
};

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  maxHeight: 220,
  overflowY: 'auto',
};

const thumbCard: CSSProperties = {
  cursor: 'grab',
  flexShrink: 0,
  width: 84,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(30,41,59,0.95)',
  color: '#f8fafc',
  padding: '4px 4px 5px',
  borderRadius: 4,
  fontSize: 10,
  touchAction: 'none',
  userSelect: 'none',
};

const toolsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 8,
  paddingTop: 8,
  borderTop: '1px solid rgba(148,163,184,0.25)',
  color: '#cbd5e1',
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

const fabStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 4,
  pointerEvents: 'auto',
  cursor: 'grab',
  border: '1px solid rgba(56,189,248,0.5)',
  background: 'rgba(14,165,233,0.3)',
  color: '#e0f2fe',
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  touchAction: 'none',
  userSelect: 'none',
};

export default ComposePanel;
