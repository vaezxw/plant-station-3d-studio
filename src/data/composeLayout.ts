import composeFile from './compose-layout.json';
import { isCatalogKind, isNodeKind, type CatalogKind } from '../scene/catalog';
import { TOPOLOGY_BY_TAG, type NodeKind } from './topology';

export type ComposeNodeOverride = {
  tag: string;
  /** 工艺 NodeKind 或扩展 CatalogKind */
  kind?: CatalogKind;
  x?: number;
  y?: number;
  z?: number;
  /** TEXT 组件可选文案 */
  labelText?: string;
};

export type ComposeLayoutFile = {
  version: number;
  notes: string[];
  nodes: ComposeNodeOverride[];
};

/** 仓库内默认编排文件（构建期导入） */
export const COMPOSE_LAYOUT_FILE = composeFile as ComposeLayoutFile;

export const COMPOSE_STORAGE_KEY = 'hengguang.compose-layout.v1';

export function composeStorageKey(slotId = 'scene'): string {
  return `hengguang.compose-layout.v2:${slotId}`;
}

export function composeOverrideMap(
  file: ComposeLayoutFile = COMPOSE_LAYOUT_FILE,
): Map<string, ComposeNodeOverride> {
  return new Map(file.nodes.map((n) => [n.tag, n]));
}

export function resolveComposeKind(
  tag: string,
  overrides: Map<string, ComposeNodeOverride> = composeOverrideMap(),
): NodeKind | undefined {
  const o = overrides.get(tag);
  if (o?.kind && isNodeKind(o.kind)) return o.kind;
  return TOPOLOGY_BY_TAG.get(tag)?.kind;
}

export function resolveComposeCatalogKind(
  tag: string,
  overrides: Map<string, ComposeNodeOverride> = composeOverrideMap(),
): CatalogKind | undefined {
  const o = overrides.get(tag);
  if (o?.kind && isCatalogKind(o.kind)) return o.kind;
  return resolveComposeKind(tag, overrides);
}

export function resolveComposePosition(
  tag: string,
  fallback: { x: number; y: number; z: number },
  overrides: Map<string, ComposeNodeOverride> = composeOverrideMap(),
): { x: number; y: number; z: number } {
  const o = overrides.get(tag);
  return {
    x: o?.x ?? fallback.x,
    y: o?.y ?? fallback.y,
    z: o?.z ?? fallback.z,
  };
}

/** 空白画布草稿（不再默认铺恒光环路；环路请拖「恒光橇装」） */
export function createEmptyDraft(base: ComposeLayoutFile = COMPOSE_LAYOUT_FILE): ComposeLayoutFile {
  return {
    version: base.version,
    notes: [
      '空白 3D 画布：从组件库拖入阀门 / PCS / 恒光橇装 / 涡喷。',
      '恒光 PFD 拓扑仍在 topology.ts；橇装是一件可拖装配。',
    ],
    nodes: [],
  };
}

function parseDraft(raw: string | null): ComposeLayoutFile | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as ComposeLayoutFile;
  if (!parsed || !Array.isArray(parsed.nodes)) return null;
  return parsed;
}

export function loadDraftFromStorage(slotId = 'scene'): ComposeLayoutFile | null {
  try {
    const keyed = parseDraft(localStorage.getItem(composeStorageKey(slotId)));
    if (keyed) return keyed;
    if (slotId === 'scene') {
      return parseDraft(localStorage.getItem(COMPOSE_STORAGE_KEY));
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDraftToStorage(draft: ComposeLayoutFile, slotId = 'scene'): void {
  try {
    localStorage.setItem(composeStorageKey(slotId), JSON.stringify(draft));
  } catch {
    // 忽略配额/隐私模式
  }
}

export function clearDraftStorage(slotId = 'scene'): void {
  try {
    localStorage.removeItem(composeStorageKey(slotId));
    if (slotId === 'scene') {
      localStorage.removeItem(COMPOSE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** 启动时：localStorage 里已放的 UF/能源站等保留；冻结拓扑位号改由「恒光橇装」拖入 */
export function createInitialDraft(slotId = 'scene'): ComposeLayoutFile {
  const stored = loadDraftFromStorage(slotId);
  if (!stored) return createEmptyDraft();
  return {
    version: stored.version ?? 1,
    notes: stored.notes?.length ? stored.notes : createEmptyDraft().notes,
    nodes: stored.nodes.filter((n) => !isFrozenProcessTag(n.tag)),
  };
}

/** 根据已有实例编号计算下一个不冲突的递增位号 */
export function nextPlaceTag(existingTags: Iterable<string>, prefix = 'HG-PLACE-'): string {
  let maxSerial = 0;
  for (const tag of existingTags) {
    if (!tag.startsWith(prefix)) continue;
    const num = Number.parseInt(tag.slice(prefix.length), 10);
    if (Number.isFinite(num) && num > maxSerial) {
      maxSerial = num;
    }
  }
  return `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;
}

export function upsertComposeNode(
  draft: ComposeLayoutFile,
  node: ComposeNodeOverride,
): ComposeLayoutFile {
  const nodes = [...draft.nodes];
  const idx = nodes.findIndex((n) => n.tag === node.tag);
  if (idx >= 0) nodes[idx] = { ...nodes[idx], ...node };
  else nodes.push(node);
  return { ...draft, nodes };
}

/** 目录拖放生成的预览位号 */
export function isCatalogPlacedTag(tag: string): boolean {
  return tag.startsWith('HG-PLACE-');
}

/** 冻结工艺拓扑位号（topology.ts），不可静默删掉 */
export function isFrozenProcessTag(tag: string): boolean {
  return TOPOLOGY_BY_TAG.has(tag);
}

export function removeComposeNode(
  draft: ComposeLayoutFile,
  tag: string,
): ComposeLayoutFile {
  return {
    ...draft,
    nodes: draft.nodes.filter((n) => n.tag !== tag),
  };
}

export function downloadComposeJson(draft: ComposeLayoutFile, filename = 'compose-layout.json') {
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function snapCoord(v: number, step = 0.25): number {
  return Math.round(v / step) * step;
}
