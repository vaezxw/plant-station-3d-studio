import { del, get, keys, set } from 'idb-keyval';
import { create } from 'zustand';
import { getCatalogItem, type CatalogKind } from '../domain/catalog';
import { PROJECT_PRESETS } from '../domain/presets';
import {
  createWidgetsForTemplate,
  type DashboardTemplateId,
  type DashboardWidgetConfig,
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
  updateProjectMeta: (patch: Partial<Pick<ProjectSchema, 'name' | 'description' | 'themeId' | 'dashboardTemplate'>>) => void;

  addNodeFromCatalog: (kind: CatalogKind, position: Vec3) => SceneNode;
  addCustomGlbNode: (customGlbId: string, name: string, position: Vec3) => SceneNode;
  updateNode: (id: string, patch: Partial<SceneNode>, recordHistory?: boolean) => void;
  duplicateNode: (id: string) => SceneNode | null;
  removeNode: (id: string) => void;
  addPipe: (pipe: Omit<PipeEdge, 'id'>) => PipeEdge;
  removePipe: (id: string) => void;
  setDashboardTemplate: (tpl: DashboardTemplateId) => void;
  setDashboardWidgets: (widgets: DashboardWidgetConfig[]) => void;
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

export const useProjectStore = create<ProjectState>((setState, getState) => ({
  project: PROJECT_PRESETS[0].create(),
  past: [],
  future: [],
  savedProjects: [],
  hydrated: false,

  hydrateFromStorage: async () => {
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

  updateProjectMeta: (patch) => {
    const cur = getState().project;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next });
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
      id: `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const past = [...getState().past, cloneProject(cur)].slice(-MAX_HISTORY);
    const next = { ...cur, pipes: [...cur.pipes, created], updatedAt: Date.now() };
    persistActive(next);
    setState({ project: next, past, future: [] });
    return created;
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
