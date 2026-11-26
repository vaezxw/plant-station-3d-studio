import { create } from 'zustand';
import type { CatalogKind } from '../domain/catalog';
import type {
  CameraBookmark,
  PipeEdge,
  SceneActionConfig,
  StudioMode,
  TransformTool,
} from '../domain/schema';
import {
  applyThemeTokens,
  loadCustomThemes,
  resolveThemeById,
  saveCustomThemes,
  type StudioTheme,
} from '../domain/themes';

export type CameraPresetView = 'iso' | 'top' | 'front' | 'focus';
export type DashboardLeftTab = 'elements' | 'templates' | 'layers';
export type DashboardRightTab = 'style' | 'data' | 'chart' | 'scene';

type EditorState = {
  mode: StudioMode;
  tool: TransformTool;
  selectedNodeId: string | null;
  selectedPipeId: string | null;
  pipeMedium: PipeEdge['medium'];
  snapEnabled: boolean;
  snapStep: number;
  canvasLocked: boolean;
  showLabels: boolean;
  showGrid: boolean;
  leftTab: 'assets' | 'outline';
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  themeModalOpen: boolean;
  dataSourceModalOpen: boolean;
  publishModalOpen: boolean;
  runtimeLockedPreview: boolean;
  runtimeHideChrome: boolean;

  // 大屏低代码组态编辑态
  selectedWidgetId: string | null;
  selectedElementId: string | null;
  dashboardLeftTab: DashboardLeftTab;
  dashboardRightTab: DashboardRightTab;
  dashboardLeftOpen: boolean;
  dashboardRightOpen: boolean;
  dashboardSceneLock: boolean;
  highlightedSection: string | null;
  sceneActionCommand: { seq: number; action: SceneActionConfig } | null;

  themeId: string;
  customThemes: StudioTheme[];

  draggingCatalogKind: CatalogKind | null;
  cameraCommand: { seq: number; view?: CameraPresetView; bookmark?: CameraBookmark } | null;

  turbojetUi: {
    nodeId: string;
    spin: boolean;
    explode: boolean;
    cutaway: boolean;
    partLabel: string | null;
  } | null;

  setMode: (mode: StudioMode) => void;
  setTool: (tool: TransformTool) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedPipeId: (id: string | null) => void;
  setPipeMedium: (medium: PipeEdge['medium']) => void;
  toggleSnap: () => void;
  toggleCanvasLock: () => void;
  setCanvasLocked: (locked: boolean) => void;
  toggleLabels: () => void;
  toggleGrid: () => void;
  setLeftTab: (tab: 'assets' | 'outline') => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setThemeModalOpen: (open: boolean) => void;
  setDataSourceModalOpen: (open: boolean) => void;
  setPublishModalOpen: (open: boolean) => void;
  setRuntimePreviewFlags: (locked: boolean, hideChrome?: boolean) => void;
  setSelectedWidgetId: (id: string | null) => void;
  setSelectedElementId: (widgetId: string | null, elementId: string | null) => void;
  setDashboardLeftTab: (tab: DashboardLeftTab) => void;
  setDashboardRightTab: (tab: DashboardRightTab) => void;
  setDashboardLeftOpen: (open: boolean) => void;
  setDashboardRightOpen: (open: boolean) => void;
  toggleDashboardSceneLock: () => void;
  setHighlightedSection: (section: string | null) => void;
  dispatchSceneAction: (action: SceneActionConfig) => void;
  setThemeId: (id: string) => void;
  saveCustomTheme: (theme: StudioTheme) => void;
  deleteCustomTheme: (id: string) => void;
  setDraggingCatalogKind: (kind: CatalogKind | null) => void;
  triggerCameraView: (view: CameraPresetView) => void;
  triggerBookmark: (bookmark: CameraBookmark) => void;
  setTurbojetUi: (ui: EditorState['turbojetUi']) => void;
};

const ACTIVE_THEME_KEY = 'plant-studio.active-theme.v1';

function loadSavedThemeId(): string {
  try {
    return localStorage.getItem(ACTIVE_THEME_KEY) || 'industrial-dark';
  } catch {
    return 'industrial-dark';
  }
}

function saveActiveThemeId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_THEME_KEY, id);
  } catch {
    // ignore storage errors
  }
}

const initialCustomThemes = loadCustomThemes();
const initialTheme = resolveThemeById(loadSavedThemeId(), initialCustomThemes);
applyThemeTokens(initialTheme);

let camSeq = 1;
let actionSeq = 1;

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: 'studio',
  tool: 'select',
  selectedNodeId: null,
  selectedPipeId: null,
  pipeMedium: 'gas',
  snapEnabled: true,
  snapStep: 0.25,
  canvasLocked: false,
  showLabels: true,
  showGrid: true,
  leftTab: 'assets',
  leftPanelOpen: true,
  rightPanelOpen: true,
  themeModalOpen: false,
  dataSourceModalOpen: false,
  publishModalOpen: false,
  runtimeLockedPreview: false,
  runtimeHideChrome: false,

  selectedWidgetId: null,
  selectedElementId: null,
  dashboardLeftTab: 'elements',
  dashboardRightTab: 'style',
  dashboardLeftOpen: true,
  dashboardRightOpen: true,
  dashboardSceneLock: false,
  highlightedSection: null,
  sceneActionCommand: null,

  themeId: initialTheme.id,
  customThemes: initialCustomThemes,

  draggingCatalogKind: null,
  cameraCommand: null,
  turbojetUi: null,

  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId, selectedPipeId: null }),
  setSelectedPipeId: (selectedPipeId) => set({ selectedPipeId, selectedNodeId: null }),
  setPipeMedium: (pipeMedium) => set({ pipeMedium }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleCanvasLock: () => set((s) => ({ canvasLocked: !s.canvasLocked })),
  setCanvasLocked: (canvasLocked) => set({ canvasLocked }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setLeftTab: (leftTab) => set({ leftTab }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setThemeModalOpen: (themeModalOpen) => set({ themeModalOpen }),
  setDataSourceModalOpen: (dataSourceModalOpen) => set({ dataSourceModalOpen }),
  setPublishModalOpen: (publishModalOpen) => set({ publishModalOpen }),
  setRuntimePreviewFlags: (runtimeLockedPreview, runtimeHideChrome = false) =>
    set({ runtimeLockedPreview, runtimeHideChrome }),
  setSelectedWidgetId: (selectedWidgetId) => set({ selectedWidgetId, selectedElementId: null }),
  setSelectedElementId: (selectedWidgetId, selectedElementId) =>
    set({ selectedWidgetId, selectedElementId }),
  setDashboardLeftTab: (dashboardLeftTab) => set({ dashboardLeftTab }),
  setDashboardRightTab: (dashboardRightTab) => set({ dashboardRightTab }),
  setDashboardLeftOpen: (dashboardLeftOpen) => set({ dashboardLeftOpen }),
  setDashboardRightOpen: (dashboardRightOpen) => set({ dashboardRightOpen }),
  toggleDashboardSceneLock: () => set((s) => ({ dashboardSceneLock: !s.dashboardSceneLock })),
  setHighlightedSection: (highlightedSection) => set({ highlightedSection }),
  dispatchSceneAction: (action) => set({ sceneActionCommand: { seq: actionSeq++, action } }),

  setThemeId: (id) => {
    const theme = resolveThemeById(id, get().customThemes);
    applyThemeTokens(theme);
    saveActiveThemeId(theme.id);
    set({ themeId: theme.id });
  },

  saveCustomTheme: (theme) => {
    const nextCustom = [
      ...get().customThemes.filter((t) => t.id !== theme.id),
      { ...theme, isCustom: true },
    ];
    saveCustomThemes(nextCustom);
    applyThemeTokens(theme);
    saveActiveThemeId(theme.id);
    set({ customThemes: nextCustom, themeId: theme.id });
  },

  deleteCustomTheme: (id) => {
    const nextCustom = get().customThemes.filter((t) => t.id !== id);
    saveCustomThemes(nextCustom);
    const fallbackId = get().themeId === id ? 'industrial-dark' : get().themeId;
    const theme = resolveThemeById(fallbackId, nextCustom);
    applyThemeTokens(theme);
    saveActiveThemeId(theme.id);
    set({ customThemes: nextCustom, themeId: theme.id });
  },

  setDraggingCatalogKind: (draggingCatalogKind) => set({ draggingCatalogKind }),
  triggerCameraView: (view) => set({ cameraCommand: { seq: camSeq++, view } }),
  triggerBookmark: (bookmark) => set({ cameraCommand: { seq: camSeq++, bookmark } }),
  setTurbojetUi: (turbojetUi) => set({ turbojetUi }),
}));
