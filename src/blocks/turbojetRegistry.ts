import type { FC } from 'react';
import {
  getBlockComponent,
  registerBlock,
  useDashboardStore,
  type BlockComponentProps,
  type ChartBlockConfig,
} from '@lius1314/visual-dashboard-scaffold';

export const TURBOJET_BLOCK_IDS = ['turbojet', '涡喷发动机'] as const;
export type TurbojetBlockId = (typeof TURBOJET_BLOCK_IDS)[number];

export const TURBOJET_DISPLAY_NAME = '涡喷发动机';
export const TURBOJET_PALETTE_HINT = '编辑模式 → 组件库 → 添加「涡喷发动机」';

export function registerTurbojetBlock(component: FC<BlockComponentProps>): void {
  component.displayName = TURBOJET_DISPLAY_NAME;
  for (const id of TURBOJET_BLOCK_IDS) {
    registerBlock(id, component);
  }
}

export function listFreeTurbojetSlots(usedLayoutIds: Iterable<string>): TurbojetBlockId[] {
  const used = new Set(usedLayoutIds);
  return TURBOJET_BLOCK_IDS.filter((id) => !used.has(id));
}

export function addBoundTurbojetBlock(opts?: {
  x?: number;
  y?: number;
}): { ok: true; slot: TurbojetBlockId } | { ok: false; reason: string } {
  const state = useDashboardStore.getState();
  const pageId = state.activePageId;
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return { ok: false, reason: '无当前页' };

  const used = page.chartBlocks.map((b) => b.layout.i);
  const slot = listFreeTurbojetSlots(used)[0];
  if (!slot) return { ok: false, reason: '涡喷画布槽位已满（turbojet / 涡喷发动机）' };

  const beforeIds = new Set(page.chartBlocks.map((b) => b.id));
  state.addChartBlock(pageId);

  const page2 = useDashboardStore.getState().pages.find((p) => p.id === pageId);
  const added = page2?.chartBlocks.find((b) => !beforeIds.has(b.id));
  if (!added) return { ok: false, reason: '添加区块失败' };

  const w = Math.max(added.layout.w, 720);
  const h = Math.max(added.layout.h, 480);
  const patch: Partial<ChartBlockConfig> = {
    title: TURBOJET_DISPLAY_NAME,
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
  return { ok: true, slot };
}

export function rebindOrphanTurbojetBlocks(): number {
  const state = useDashboardStore.getState();
  let fixed = 0;
  for (const page of state.pages) {
    const used = new Set(page.chartBlocks.map((b) => b.layout.i));
    for (const block of page.chartBlocks) {
      const bound = getBlockComponent(block.layout.i) || getBlockComponent(block.id);
      if (bound) continue;
      const title = block.title ?? '';
      if (!title.includes(TURBOJET_DISPLAY_NAME) && !title.includes('turbojet')) continue;
      const slot = listFreeTurbojetSlots(used)[0];
      if (!slot) continue;
      used.add(slot);
      state.updateChartBlock(page.id, block.id, {
        title: TURBOJET_DISPLAY_NAME,
        layout: { ...block.layout, i: slot },
      });
      fixed += 1;
    }
  }
  return fixed;
}
