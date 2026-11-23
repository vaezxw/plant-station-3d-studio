import type { FC } from 'react';
import {
  getBlockComponent,
  getRegisteredBlockIds,
  registerBlock,
  useDashboardStore,
  type BlockComponentProps,
  type ChartBlockConfig,
} from '@lius1314/visual-dashboard-scaffold';
import { saveCanvasMode } from './canvasMode';

/** 可挂到脚手架的工艺画布区块 ID（layout.i 必须唯一） */
export const SCENE_BLOCK_IDS = [
  'scene',
  'scene-2',
  'scene-3',
  'scene-4',
  'scene-5',
  'scene-6',
  'scene-7',
  'scene-8',
  '工艺三维',
] as const;

export type SceneBlockId = (typeof SCENE_BLOCK_IDS)[number];

export const SCENE_DISPLAY_NAME = '工艺三维';

export const SCENE_PALETTE_HINT = '编辑模式 → 组件库 → 拖入「空白画布」→ 选 2D/3D';

/** 调色板元数据（脚手架原生无 displayName；本工程自维护） */
export type ScenePaletteMeta = {
  id: SceneBlockId;
  displayName: string;
  description: string;
};

export const SCENE_PALETTE: readonly ScenePaletteMeta[] = SCENE_BLOCK_IDS.map((id) => ({
  id,
  displayName: SCENE_DISPLAY_NAME,
  description: id === 'scene' ? '默认工艺画布（可 2D/3D）' : `额外工艺画布（区块 ID=${id}）`,
}));

export function registerSceneBlocks(component: FC<BlockComponentProps>): void {
  component.displayName = SCENE_DISPLAY_NAME;
  for (const id of SCENE_BLOCK_IDS) {
    registerBlock(id, component);
  }
}

export function listFreeSceneSlots(usedLayoutIds: Iterable<string>): SceneBlockId[] {
  const used = new Set(usedLayoutIds);
  return SCENE_BLOCK_IDS.filter((id) => !used.has(id));
}

export function nextSceneSlot(usedLayoutIds: Iterable<string>): SceneBlockId | null {
  return listFreeSceneSlots(usedLayoutIds)[0] ?? null;
}

export type AddSceneBlockOpts = {
  x?: number;
  y?: number;
};

/**
 * 添加空白「工艺三维」画布（不强制 3D；mode=blank，用户自选 2D/3D）。
 */
export function addBoundSceneBlock(
  opts?: AddSceneBlockOpts,
): { ok: true; slot: SceneBlockId } | { ok: false; reason: string } {
  const state = useDashboardStore.getState();
  const pageId = state.activePageId;
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return { ok: false, reason: '无当前页' };

  const used = page.chartBlocks.map((b) => b.layout.i);
  const slot = nextSceneSlot(used);
  if (!slot) return { ok: false, reason: '工艺画布槽位已满（scene…scene-8）' };

  const beforeIds = new Set(page.chartBlocks.map((b) => b.id));
  state.addChartBlock(pageId);

  const page2 = useDashboardStore.getState().pages.find((p) => p.id === pageId);
  const added = page2?.chartBlocks.find((b) => !beforeIds.has(b.id));
  if (!added) return { ok: false, reason: '添加区块失败' };

  const w = Math.max(added.layout.w, 640);
  const h = Math.max(added.layout.h, 480);
  const patch: Partial<ChartBlockConfig> = {
    title: SCENE_DISPLAY_NAME,
    titleHeight: 36,
    titleBackground: 'transparent',
    contentBackground: 'transparent',
    blockBackground: 'transparent',
    layout: {
      ...added.layout,
      i: slot,
      x: typeof opts?.x === 'number' ? Math.max(0, Math.round(opts.x)) : added.layout.x,
      y: typeof opts?.y === 'number' ? Math.max(0, Math.round(opts.y)) : added.layout.y,
      w,
      h,
      minW: 480,
      minH: 320,
    },
  };
  useDashboardStore.getState().updateChartBlock(pageId, added.id, patch);
  // 新增画布一律空白，不强制三维
  saveCanvasMode(slot, 'blank');
  return { ok: true, slot };
}

/** 屏幕坐标 → 中间区自由布局坐标（兼容 autofit scale） */
export function clientToBoardLayout(
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const sample = document.querySelector('[data-block-id]');
  const board = sample?.parentElement;
  if (!board) return null;
  const rect = board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scaleX = rect.width / Math.max(1, board.clientWidth);
  const scaleY = rect.height / Math.max(1, board.clientHeight);
  return {
    x: (clientX - rect.left) / scaleX,
    y: (clientY - rect.top) / scaleY,
  };
}

type SceneDropHost = {
  __dropCatalogAt?: (clientX: number, clientY: number, kind: string) => boolean;
};

/** 落点下的画布宿主（跳过组件库浮层） */
export function findSceneDropHost(clientX: number, clientY: number): SceneDropHost | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    if (!(el instanceof Element)) continue;
    if (el.closest('[data-scene-palette]')) continue;
    let cur: Element | null = el;
    while (cur) {
      const host = cur as SceneDropHost;
      if (typeof host.__dropCatalogAt === 'function') return host;
      cur = cur.parentElement;
    }
  }
  return null;
}

/** 复制后 UUID 未绑定：若标题含「工艺三维」则自动改绑到空闲 scene-* */
export function rebindOrphanSceneBlocks(): number {
  const state = useDashboardStore.getState();
  let fixed = 0;
  for (const page of state.pages) {
    const used = new Set(page.chartBlocks.map((b) => b.layout.i));
    for (const block of page.chartBlocks) {
      const bound = getBlockComponent(block.layout.i) || getBlockComponent(block.id);
      if (bound) continue;
      const title = block.title ?? '';
      if (!title.includes(SCENE_DISPLAY_NAME) && !title.includes('scene')) continue;
      const slot = nextSceneSlot(used);
      if (!slot) continue;
      used.add(slot);
      state.updateChartBlock(page.id, block.id, {
        title: SCENE_DISPLAY_NAME,
        layout: { ...block.layout, i: slot },
      });
      saveCanvasMode(slot, 'blank');
      fixed += 1;
    }
  }
  return fixed;
}

export function debugRegisteredSceneIds(): string[] {
  return getRegisteredBlockIds().filter(
    (id) => id === 'scene' || id.startsWith('scene-') || id === SCENE_DISPLAY_NAME,
  );
}
