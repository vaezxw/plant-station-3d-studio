import type { DataFeedMode } from './schema';

export type EmbedHostType = 'none' | 'scada';

export type RuntimeEntryParams = {
  /** 是否进入独立发布预览态（隐藏全部搭建菜单，仅渲染 3D + 悬浮大屏） */
  isPreviewEntry: boolean;
  /** 已发布场景 ID */
  sceneId: string | null;
  /** 分享校验令牌 */
  token: string;
  /** 宿主嵌入标识 */
  embed: EmbedHostType;
  /** 数据驱动模式 */
  dataMode: DataFeedMode;
  /** 允许通信的宿主 Origin（用于 postMessage 白名单校验） */
  parentOrigin: string;
  /** 是否隐藏底部视角控制条等 Chrome（可选 ?chrome=0） */
  hideChrome: boolean;
};

function normalizeDataMode(raw: string | null): DataFeedMode {
  if (raw === 'bridge' || raw === 'direct' || raw === 'sim' || raw === 'auto') return raw;
  return 'auto';
}

/**
 * 统一解析独立预览链接参数：
 * 1) 推荐 Hash 路由：#/preview/{sceneId}?token=xxx&embed=scada&dataMode=bridge
 * 2) 兼容 Query 参数：?mode=preview&sceneId={sceneId}&token=xxx&embed=scada&dataMode=bridge
 */
export function parseRuntimeEntry(
  loc: Pick<Location, 'hash' | 'search'> = window.location,
): RuntimeEntryParams {
  const rawHash = loc.hash || '';
  const hashClean = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const [hashPathRaw, hashQueryRaw = ''] = hashClean.split('?');
  const hashPath = hashPathRaw.trim();

  const searchParams = new URLSearchParams(loc.search || '');
  const hashParams = new URLSearchParams(hashQueryRaw);

  const pick = (key: string): string | null => hashParams.get(key) ?? searchParams.get(key);

  let isPreviewEntry = false;
  let sceneId: string | null = null;

  const previewMatch = hashPath.match(/^\/?preview\/([^/?#]+)\/?$/i);
  if (previewMatch) {
    isPreviewEntry = true;
    sceneId = decodeURIComponent(previewMatch[1]);
  } else if (pick('mode') === 'preview' && pick('sceneId')) {
    isPreviewEntry = true;
    sceneId = pick('sceneId');
  }

  const embed: EmbedHostType = pick('embed') === 'scada' ? 'scada' : 'none';
  const dataMode = normalizeDataMode(pick('dataMode'));
  const token = (pick('token') ?? '').trim();
  const parentOrigin = (pick('parentOrigin') ?? '*').trim() || '*';
  const hideChrome = pick('chrome') === '0';

  return {
    isPreviewEntry,
    sceneId,
    token,
    embed,
    dataMode,
    parentOrigin,
    hideChrome,
  };
}

/** 结合当前部署上下文生成标准独立预览 URL 与 SCADA 嵌入式 URL */
export function buildPreviewUrls(opts: {
  sceneId: string;
  token?: string;
  requireToken?: boolean;
  standaloneDataMode?: DataFeedMode;
  parentOriginHint?: string;
}): {
  standaloneUrl: string;
  scadaEmbedUrl: string;
  relativeStandaloneHash: string;
  relativeScadaHash: string;
} {
  const basePath = `${window.location.origin}${window.location.pathname}`;
  const encodedId = encodeURIComponent(opts.sceneId);

  const qStandalone = new URLSearchParams();
  if (opts.requireToken !== false && opts.token) {
    qStandalone.set('token', opts.token);
  }
  if (opts.standaloneDataMode && opts.standaloneDataMode !== 'auto') {
    qStandalone.set('dataMode', opts.standaloneDataMode);
  }

  const qScada = new URLSearchParams();
  if (opts.requireToken !== false && opts.token) {
    qScada.set('token', opts.token);
  }
  qScada.set('embed', 'scada');
  qScada.set('dataMode', 'bridge');
  if (opts.parentOriginHint && opts.parentOriginHint.trim() && opts.parentOriginHint.trim() !== '*') {
    qScada.set('parentOrigin', opts.parentOriginHint.trim());
  }

  const sQuery = qStandalone.toString();
  const relativeStandaloneHash = `#/preview/${encodedId}${sQuery ? `?${sQuery}` : ''}`;
  const relativeScadaHash = `#/preview/${encodedId}?${qScada.toString()}`;

  return {
    standaloneUrl: `${basePath}${relativeStandaloneHash}`,
    scadaEmbedUrl: `${basePath}${relativeScadaHash}`,
    relativeStandaloneHash,
    relativeScadaHash,
  };
}

/** 退出独立预览回到平台工作台首页 */
export function navigateToWorkbenchUrl(): void {
  window.location.hash = '#/console/home';
}
