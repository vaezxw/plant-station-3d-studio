import { del, get, keys, set } from 'idb-keyval';
import { create } from 'zustand';
import { getCatalogItem, type CatalogKind } from '../domain/catalog';
import { PROJECT_PRESETS } from '../domain/presets';
import { captureProjectCompositeSnapshot } from '../engine/CompositeThumbnail';
import {
  createDefaultDataSources,
  createDefaultGroundConfig,
  createDefaultPipeFlow,
  createWidgetsForTemplate,
  normalizeWidgetsTo24Cols,
  type CardElementSchema,
  type CardTemplateSchema,
  type DashboardTemplateId,
  type DashboardWidgetConfig,
  type DataSourceConfig,
  type GroundConfig,
  type PipeEdge,
  type ProjectSchema,
  type SceneNode,
  type Vec3,
} from '../domain/schema';

const MAX_HISTORY = 50;
const ACTIVE_PROJECT_IDB_KEY = 'plant-studio:active-project:v2';
const LIBRARY_PREFIX = 'plant-studio:lib:';

export type SavedProjectSummary = {
  id: string;
  name: string;
  industry: ProjectSchema['industry'];
  nodeCount: number;
  widgetCount: number;
  stationCode?: string;
  publishedSceneId?: string;
  thumbnailDataUrl?: string;
  updatedAt: number;
};

type ProjectState = {
  project: ProjectSchema;
  past: ProjectSchema[];
  future: ProjectSchema[];
  savedProjects: SavedProjectSummary[];
  hydrated: boolean;

  hydrateFromStorage: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  saveCurrentToLibrary: () => Promise<void>;
  loadFromLibrary: (id: string) => Promise<void>;
  deleteFromLibrary: (id: string) => Promise<void>;

  loadPreset: (presetId: string) => void;
  importProject: (schema: ProjectSchema) => void;
  /** 以只读运行态加载（例如独立预览链接加载已发布大屏），不覆盖用户工作台草稿缓存 */
  loadRuntimeProject: (schema: ProjectSchema) => void;
  updateProjectMeta: (
    patch: Partial<
      Pick<
        ProjectSchema,
        'name' | 'description' | 'themeId' | 'dashboardTemplate' | 'publishedSceneId' | 'stationCode' | 'thumbnailDataUrl'
      >
    >,
  ) => void;
  updateGroundConfig: (patch: Partial<GroundConfig>, recordHistory?: boolean) => void;

  addNodeFromCatalog: (kind: CatalogKind, position: Vec3) => SceneNode;
  addCustomGlbNode: (customGlbId: string, name: string, position: Vec3) => SceneNode;
  updateNode: (id: string, patch: Partial<SceneNode>, recordHistory?: boolean) => void;
  duplicateNode: (id: string) => SceneNode | null;
  removeNode: (id: string) => void;
  addPipe: (pipe: Omit<PipeEdge, 'id'>) => PipeEdge;
  updatePipe: (id: string, patch: Partial<PipeEdge>, recordHistory?: boolean) => void;
  removePipe: (id: string) => void;
  setDashboardTemplate: (tpl: DashboardTemplateId) => void;
  setDashboardWidgets: (widgets: DashboardWidgetConfig[]) => void;
  addCustomCardWidget: (
    title: string,
    elements: CardElementSchema[],
    opts?: {
      w?: number;
      h?: number;
      cardStyle?: DashboardWidgetConfig['cardStyle'];
      sceneBinding?: DashboardWidgetConfig['sceneBinding'];
    },
  ) => DashboardWidgetConfig;
  addWidgetFromTemplate: (
    tpl: CardTemplateSchema,
    targetNodeId?: string,
  ) => DashboardWidgetConfig;
  updateDashboardWidget: (
    id: string,
    patch: Partial<DashboardWidgetConfig>,
    recordHistory?: boolean,
  ) => void;
  duplicateDashboardWidget: (id: string) => DashboardWidgetConfig | null;
  removeDashboardWidget: (id: string) => void;
  addCardElement: (widgetId: string, element: CardElementSchema) => void;
  updateCardElement: (
    widgetId: string,
    elementId: string,
    patch: Partial<CardElementSchema>,
    recordHistory?: boolean,
  ) => void;
  reorderCardElements: (widgetId: string, orderedIds: string[]) => void;
  removeCardElement: (widgetId: string, elementId: string) => void;
  upsertDataSource: (ds: DataSourceConfig) => void;
  removeDataSource: (id: string) => void;
  setKindTemplateMapping: (kind: CatalogKind, templateId: string | undefined) => void;
  addBookmark: (name: string, position: Vec3, target: Vec3) => void;
  removeBookmark: (id: string) => void;

  undo: () => void;
  redo: () => void;
};

function nextTagForPrefix(nodes: SceneNode[], prefix: string): string {
  const fullPrefix = `${prefix}-`;
  let max = 0;
  for (const n of nodes) {
    if (!n.tag.startsWith(fullPrefix)) continue;
    const num = Number.parseInt(n.tag.slice(fullPrefix.length), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }
  return `${fullPrefix}${String(max + 1).padStart(3, '0')}`;
}

function cloneProject(p: ProjectSchema): ProjectSchema {
  return JSON.parse(JSON.stringify(p)) as ProjectSchema;
}

function persistActive(project: ProjectSchema) {
  void set(ACTIVE_PROJECT_IDB_KEY, project);
}

function getNormalizedWidgets(p: ProjectSchema): DashboardWidgetConfig[] {
  return normalizeWidgetsTo24Cols(
    p.dashboardWidgets ?? createWidgetsForTemplate(p.dashboardTemplate),
  );
}

function nextCardPlacementY(widgets: DashboardWidgetConfig[]): number {
  const occupiedMiddle = widgets.some((w) => w.visible && w.x < 16 && w.x + w.w > 7 && w.y < 10);
  return occupiedMiddle ? 10 : 1;
}

export const useProjectStore = create<ProjectState>((setState, getState) => ({
  project: PROJECT_PRESETS[0].create(),
  past: [],
  future: [],
  savedProjects: [],
  hydrated: false,

  hydrateFromStorage: async () => {
    if (getState().hydrated) {
      await getState().refreshLibrary();
      return;
    }
    try {
      const stored = await get<ProjectSchema>(ACTIVE_PROJECT_IDB_KEY);
      if (stored && stored.version === 2 && Array.isArray(stored.nodes)) {
        setState({ project: stored, hydrated: true });
      } else {
        setState({ hydrated: true });
      }
      await getState().refreshLibrary();
    } catch {
      setState({ hydrated: true });
    }
  },

  refreshLibrary: async () => {
    try {
      const allKeys = await keys();
      const libKeys = allKeys.filter(
        (k): k is string => typeof k === 'string' && k.startsWith(LIBRARY_PREFIX),
      );
      const list: SavedProjectSummary[] = [];
      for (const k of libKeys) {
        const proj = await get<ProjectSchema>(k);
        if (proj && proj.id) {
          list.push({
            id: proj.id,
            name: proj.name,
            industry: proj.industry,
            nodeCount: proj.nodes.length,
            widgetCount: (proj.dashboardWidgets ?? []).filter((w) => w.visible).length,
            stationCode: proj.stationCode,
            publishedSceneId: proj.publishedSceneId,
            thumbnailDataUrl: proj.thumbnailDataUrl,
            updatedAt: proj.updatedAt,
          });
        }
      }
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setState({ savedProjects: list });
    } catch {
      // ignore IndexedDB errors
    }
  },

  saveCurrentToLibrary: async () => {
    const cur = cloneProject(getState().project);
    cur.updatedAt = Date.now();
    if (!cur.id || cur.id.startsWith('preset-')) {
      cur.id = `proj-${Date.now()}`;
    }
    const shot = await captureProjectCompositeSnapshot(cur);
    if (shot) cur.thumbnailDataUrl = shot;
    await set(`${LIBRARY_PREFIX}${cur.id}`, cur);
    await set(ACTIVE_PROJECT_IDB_KEY, cur);
    setState({ project: cur });
    await getState().refreshLibrary();
  },

  loadFromLibrary: async (id) => {
    const proj = await get<ProjectSchema>(`${LIBRARY_PREFIX}${id}`);
    if (!proj) return;
    const prev = cloneProject(getState().project);
    const past = [...getState().past, prev].slice(-MAX_HISTORY);
    persistActive(proj);
    setState({ project: proj, past, future: [] });
  },

  deleteFromLibrary: async (id) => {
    await del(`${LIBRARY_PREFIX}${id}`);
    await getState().refreshLibrary();
  },

  loadPreset: (presetId) => {
    const preset = PROJECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const prev = cloneProject(getState().project);
    const next = preset.create();
    const past = [...getState().past, prev].slice(-MAX_HISTORY);
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  importProject: (schema) => {
    if (!schema || !Array.isArray(schema.nodes)) return;
    const prev = cloneProject(getState().project);
    const next: ProjectSchema = { ...cloneProject(schema), version: 2, updatedAt: Date.now() };
    const past = [...getState().past, prev].slice(-MAX_HISTORY);
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  loadRuntimeProject: (schema) => {
    if (!schema || !Array.isArray(schema.nodes)) return;
    const next: ProjectSchema = { ...cloneProject(schema), version: 2 };
    setState({ project: next, past: [], future: [] });
  },

  updateProjectMeta: (patch) => {
    const cur = getState().project;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next });
  },

  updateGroundConfig: (patch, recordHistory = true) => {
    const cur = getState().project;
    const baseGround = cur.ground ?? createDefaultGroundConfig();
    const next: ProjectSchema = {
      ...cur,
      ground: { ...baseGround, ...patch },
      updatedAt: Date.now(),
    };
    persistActive(next);
    if (recordHistory) {
      const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
      setState({ project: next, past, future: [] });
    } else {
      setState({ project: next });
    }
  },

  addNodeFromCatalog: (kind, position) => {
    const cur = getState().project;
    const item = getCatalogItem(kind);
    const tag = nextTagForPrefix(cur.nodes, item?.tagPrefix ?? 'EQ');
    const node: SceneNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tag,
      name: item?.labelZh ?? kind,
      section: item?.defaultSection ?? '工艺区',
      kind,
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      floorStyle: kind === 'FLOOR_SLAB' || kind === 'BASE_PAD' ? 'weathered-concrete' : undefined,
      pipeFlow:
        kind === 'PIPE' || kind === 'PIPE_ELBOW' || kind === 'SIGHT_GLASS'
          ? createDefaultPipeFlow()
          : undefined,
      visible: true,
      locked: false,
      pointIds: [],
      labelText: kind === 'TEXT' ? '工艺工段标识' : undefined,
    };
    const prev = cloneProject(cur);
    const next = { ...cur, nodes: [...cur.nodes, node], updatedAt: Date.now() };
    const past = [...getState().past, prev].slice(-MAX_HISTORY);
    persistActive(next);
    setState({ project: next, past, future: [] });
    return node;
  },

  addCustomGlbNode: (customGlbId, name, position) => {
    const cur = getState().project;
    const tag = nextTagForPrefix(cur.nodes, 'IMP');
    const node: SceneNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tag,
      name,
      section: '自定义模型',
      kind: 'CUSTOM_GLB',
      customGlbId,
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      pointIds: [],
    };
    const prev = cloneProject(cur);
    const next = { ...cur, nodes: [...cur.nodes, node], updatedAt: Date.now() };
    const past = [...getState().past, prev].slice(-MAX_HISTORY);
    persistActive(next);
    setState({ project: next, past, future: [] });
    return node;
  },

  updateNode: (id, patch, recordHistory = true) => {
    const cur = getState().project;
    const idx = cur.nodes.findIndex((n) => n.id === id);
    if (idx < 0) return;
    const nodes = cur.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    const next = { ...cur, nodes, updatedAt: Date.now() };
    persistActive(next);
    if (recordHistory) {
      const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
      setState({ project: next, past, future: [] });
    } else {
      setState({ project: next });
    }
  },

  duplicateNode: (id) => {
    const cur = getState().project;
    const src = cur.nodes.find((n) => n.id === id);
    if (!src) return null;
    const prefix = src.tag.split('-')[0] || 'EQ';
    const tag = nextTagForPrefix(cur.nodes, prefix);
    const copy: SceneNode = {
      ...cloneProject({ ...cur, nodes: [src] }).nodes[0],
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tag,
      name: `${src.name} 副本`,
      position: [src.position[0] + 0.75, src.position[1], src.position[2] + 0.75],
    };
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, nodes: [...cur.nodes, copy], updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
    return copy;
  },

  removeNode: (id) => {
    const cur = getState().project;
    if (!cur.nodes.some((n) => n.id === id)) return;
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = {
      ...cur,
      nodes: cur.nodes.filter((n) => n.id !== id),
      pipes: cur.pipes.filter((p) => p.fromNodeId !== id && p.toNodeId !== id),
      updatedAt: Date.now(),
    };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  addPipe: (pipe) => {
    const cur = getState().project;
    const created: PipeEdge = {
      ...pipe,
      flow: pipe.flow ?? createDefaultPipeFlow(),
      id: `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, pipes: [...cur.pipes, created], updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
    return created;
  },

  updatePipe: (id, patch, recordHistory = true) => {
    const cur = getState().project;
    if (!cur.pipes.some((p) => p.id === id)) return;
    const pipes = cur.pipes.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const next = { ...cur, pipes, updatedAt: Date.now() };
    persistActive(next);
    if (recordHistory) {
      const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
      setState({ project: next, past, future: [] });
    } else {
      setState({ project: next });
    }
  },

  removePipe: (id) => {
    const cur = getState().project;
    if (!cur.pipes.some((p) => p.id === id)) return;
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = {
      ...cur,
      pipes: cur.pipes.filter((p) => p.id !== id),
      updatedAt: Date.now(),
    };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  setDashboardTemplate: (dashboardTemplate) => {
    const cur = getState().project;
    const next = {
      ...cur,
      dashboardTemplate,
      dashboardWidgets: createWidgetsForTemplate(dashboardTemplate),
      updatedAt: Date.now(),
    };
    persistActive(next);
    setState({ project: next });
  },

  setDashboardWidgets: (dashboardWidgets) => {
    const cur = getState().project;
    const next = { ...cur, dashboardWidgets, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next });
  },

  addCustomCardWidget: (title, elements, opts) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    const w = Math.max(7, opts?.w ?? 9);
    const h = Math.max(7, opts?.h ?? 8);
    const created: DashboardWidgetConfig = {
      id: `w-custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: 'custom',
      title: title.trim() || '新建监视卡片',
      showHeader: true,
      x: 7,
      y: nextCardPlacementY(widgets),
      w,
      h,
      gridCols: 24,
      visible: true,
      cardStyle: opts?.cardStyle,
      elements,
      sceneBinding: opts?.sceneBinding,
    };
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dashboardWidgets: [...widgets, created], updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
    return created;
  },

  addWidgetFromTemplate: (tpl, targetNodeId) => {
    const clonedElements = (
      JSON.parse(JSON.stringify(tpl.elements)) as CardElementSchema[]
    ).map((el, i) => ({
      ...el,
      id: `el-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 5)}`,
    }));
    const targetNode = targetNodeId
      ? getState().project.nodes.find((n) => n.id === targetNodeId)
      : undefined;
    return getState().addCustomCardWidget(
      targetNode ? `${targetNode.tag} · ${tpl.name}` : tpl.name,
      clonedElements,
      {
        w: tpl.defaultSize.w,
        h: tpl.defaultSize.h,
        cardStyle: tpl.cardStyle,
        sceneBinding: {
          targetNodeId: targetNode?.id,
          targetCatalogKind: tpl.bindCatalogKind,
          followSelectedNode: !targetNode && !tpl.bindCatalogKind ? false : !targetNode,
        },
      },
    );
  },

  updateDashboardWidget: (id, patch, recordHistory = true) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    if (!widgets.some((w) => w.id === id)) return;
    const nextWidgets = widgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
    const next = { ...cur, dashboardWidgets: nextWidgets, updatedAt: Date.now() };
    persistActive(next);
    if (recordHistory) {
      const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
      setState({ project: next, past, future: [] });
    } else {
      setState({ project: next });
    }
  },

  duplicateDashboardWidget: (id) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    const src = widgets.find((w) => w.id === id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src)) as DashboardWidgetConfig;
    copy.id = `w-copy-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    copy.title = `${src.title} 副本`;
    copy.x = Math.min(24 - copy.w, src.x + 1);
    copy.y = src.y + 1;
    copy.visible = true;
    if (copy.elements) {
      copy.elements = copy.elements.map((el, i) => ({
        ...el,
        id: `el-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 5)}`,
      }));
    }
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dashboardWidgets: [...widgets, copy], updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
    return copy;
  },

  removeDashboardWidget: (id) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    if (!widgets.some((w) => w.id === id)) return;
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = {
      ...cur,
      dashboardWidgets: widgets.filter((w) => w.id !== id),
      updatedAt: Date.now(),
    };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  addCardElement: (widgetId, element) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId) return w;
      const nextElements = [...(w.elements ?? []), element];
      const hasCharts = nextElements.some((el) => el.type.startsWith('chart-'));
      const minH = hasCharts ? Math.min(16, 5 + nextElements.length * 2) : w.h;
      return {
        ...w,
        type: 'custom' as const,
        h: Math.max(w.h, minH),
        w: Math.max(w.w, hasCharts ? 9 : w.w),
        elements: nextElements,
      };
    });
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dashboardWidgets: nextWidgets, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  updateCardElement: (widgetId, elementId, patch, recordHistory = true) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId) return w;
      const elements = (w.elements ?? []).map((el) =>
        el.id === elementId ? { ...el, ...patch } : el,
      );
      return { ...w, elements };
    });
    const next = { ...cur, dashboardWidgets: nextWidgets, updatedAt: Date.now() };
    persistActive(next);
    if (recordHistory) {
      const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
      setState({ project: next, past, future: [] });
    } else {
      setState({ project: next });
    }
  },

  reorderCardElements: (widgetId, orderedIds) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId || !w.elements) return w;
      const byId = new Map(w.elements.map((el) => [el.id, el]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((x): x is CardElementSchema => Boolean(x));
      for (const el of w.elements) {
        if (!orderedIds.includes(el.id)) reordered.push(el);
      }
      return { ...w, elements: reordered };
    });
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dashboardWidgets: nextWidgets, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  removeCardElement: (widgetId, elementId) => {
    const cur = getState().project;
    const widgets = getNormalizedWidgets(cur);
    const nextWidgets = widgets.map((w) =>
      w.id === widgetId
        ? { ...w, elements: (w.elements ?? []).filter((el) => el.id !== elementId) }
        : w,
    );
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dashboardWidgets: nextWidgets, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  upsertDataSource: (ds) => {
    const cur = getState().project;
    const base = cur.dataSources ?? createDefaultDataSources();
    const exists = base.some((d) => d.id === ds.id);
    const nextSources = exists ? base.map((d) => (d.id === ds.id ? ds : d)) : [...base, ds];
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dataSources: nextSources, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  removeDataSource: (id) => {
    if (id === 'builtin-sim') return;
    const cur = getState().project;
    const base = cur.dataSources ?? createDefaultDataSources();
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, dataSources: base.filter((d) => d.id !== id), updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  setKindTemplateMapping: (kind, templateId) => {
    const cur = getState().project;
    const map = { ...(cur.kindTemplateMap ?? {}) };
    if (templateId) map[kind] = templateId;
    else delete map[kind];
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, kindTemplateMap: map, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
  },

  addBookmark: (name, position, target) => {
    const cur = getState().project;
    const bm = {
      id: `bm-${Date.now()}`,
      name: name.trim() || `视角 ${cur.bookmarks.length + 1}`,
      position,
      target,
    };
    const next = { ...cur, bookmarks: [...cur.bookmarks, bm], updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next });
  },

  removeBookmark: (id) => {
    const cur = getState().project;
    const next = {
      ...cur,
      bookmarks: cur.bookmarks.filter((b) => b.id !== id),
      updatedAt: Date.now(),
    };
    persistActive(next);
    setState({ project: next });
  },

  undo: () => {
    const { past, future, project } = getState();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const nextPast = past.slice(0, -1);
    persistActive(previous);
    setState({
      project: previous,
      past: nextPast,
      future: [cloneProject(project), ...future].slice(0, MAX_HISTORY),
    });
  },

  redo: () => {
    const { past, future, project } = getState();
    if (future.length === 0) return;
    const next = future[0];
    const nextFuture = future.slice(1);
    persistActive(next);
    setState({
      project: next,
      past: [...past, cloneProject(project)].slice(-MAX_HISTORY),
      future: nextFuture,
    });
  },
}));
