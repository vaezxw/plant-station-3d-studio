/** 画布渲染模式：新增画布默认 blank，由用户自选 2D / 3D */
export type CanvasRenderMode = 'blank' | '2d' | '3d';

const STORAGE_PREFIX = 'hengguang.canvas-mode.v1:';

/** 首块演示页 `scene` 默认 3D；其余新增画布默认 blank */
export function defaultCanvasMode(slotId: string): CanvasRenderMode {
  return slotId === 'scene' ? '3d' : 'blank';
}

export function canvasModeStorageKey(slotId: string): string {
  return `${STORAGE_PREFIX}${slotId}`;
}

export function loadCanvasMode(slotId: string): CanvasRenderMode {
  try {
    const raw = localStorage.getItem(canvasModeStorageKey(slotId));
    if (raw === 'blank' || raw === '2d' || raw === '3d') return raw;
  } catch {
    /* ignore */
  }
  return defaultCanvasMode(slotId);
}

export function saveCanvasMode(slotId: string, mode: CanvasRenderMode): void {
  try {
    localStorage.setItem(canvasModeStorageKey(slotId), mode);
  } catch {
    /* ignore */
  }
}

export function clearCanvasMode(slotId: string): void {
  try {
    localStorage.removeItem(canvasModeStorageKey(slotId));
  } catch {
    /* ignore */
  }
}
