import type { CSSProperties } from 'react';
import { useDashboardStore } from '@lius1314/visual-dashboard-scaffold';

/** 脚手架「区块设置 → 内容背景」；纯色 / 渐变 / 透明 / 图 */
export function contentBackgroundStyle(value: string | undefined | null): CSSProperties {
  const n = (value ?? '').trim();
  if (!n || n === 'transparent' || n === 'none') {
    return { background: 'transparent' };
  }
  if (n.startsWith('linear-gradient') || n.startsWith('radial-gradient') || n.startsWith('conic-gradient')) {
    return { backgroundImage: n };
  }
  if (n.startsWith('url(') || n.startsWith('/') || n.startsWith('data:')) {
    return {
      backgroundImage: n.startsWith('/') ? `url(${n})` : n,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return { background: n };
}

export function useBlockContentBackground(pageId: string | undefined, blockId: string | undefined) {
  return useDashboardStore((s) => {
    const page = s.pages.find((p) => p.id === (pageId ?? s.activePageId));
    const block = page?.chartBlocks.find((b) => b.layout.i === blockId || b.id === blockId);
    return block?.contentBackground;
  });
}
