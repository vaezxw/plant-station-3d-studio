import type { PointerEvent as ReactPointerEvent } from 'react';

export type PalettePos = { x: number; y: number };

const THRESHOLD_PX = 5;

export const COMPOSE_PALETTE_POS_KEY = 'hengguang.compose-palette-pos.v1';
export const SCENE_PALETTE_POS_KEY = 'hengguang.scene-palette-pos.v1';

export function loadPalettePos(key: string, fallback: PalettePos): PalettePos {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as PalettePos;
    if (typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)) {
      return { x: p.x, y: p.y };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function savePalettePos(key: string, pos: PalettePos): void {
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

/**
 * pointerdown + move ≥ 5px → drag；无移动松手 → click。
 * 不要再绑 onClick，否则拖完会误开面板。
 */
export function startDragOrClick(
  e: ReactPointerEvent,
  opts: {
    map: (clientX: number, clientY: number) => PalettePos;
    onMove: (pos: PalettePos) => void;
    onClick?: () => void;
    onDragEnd?: (pos: PalettePos) => void;
  },
): void {
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget as HTMLElement;
  const prevCursor = target.style.cursor;
  try {
    target.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  const start = { x: e.clientX, y: e.clientY };
  let dragged = false;
  let last = opts.map(e.clientX, e.clientY);

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    if (!dragged && dx * dx + dy * dy < THRESHOLD_PX * THRESHOLD_PX) return;
    dragged = true;
    target.style.cursor = 'grabbing';
    last = opts.map(ev.clientX, ev.clientY);
    opts.onMove(last);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    target.style.cursor = prevCursor;
    try {
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (dragged) opts.onDragEnd?.(last);
    else opts.onClick?.();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
