import { create } from 'zustand';
import type { CatalogKind } from '../domain/catalog';
import type { CameraBookmark, PipeEdge, StudioMode, TransformTool } from '../domain/schema';
import {
  applyThemeTokens,
  loadCustomThemes,
  resolveThemeById,
  saveCustomThemes,
  type StudioTheme,
} from '../domain/themes';

export type CameraPresetView = 'iso' | 'top' | 'front' | 'focus';

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
  setThemeId: (id: string) => void;
  saveCustomTheme: (theme: StudioTheme) => void;
  deleteCustomTheme: (id: string) => void;
  setDraggingCatalogKind: (kind: CatalogKind | null) => void;
  triggerCameraView: (view: CameraPresetView) => void;
  triggerBookmark: (bookmark: CameraBookmark) => void;
  setTurbojetUi: (ui: EditorState['turbojetUi']) => void;
};

const initialCustomThemes = loadCustomThemes();
const initialTheme = resolveThemeById('industrial-dark', initialCustomThemes);
applyThemeTokens(initialTheme);

let camSeq = 1;

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

  setThemeId: (id) => {
    const theme = resolveThemeById(id, get().customThemes);
    applyThemeTokens(theme);
    set({ themeId: theme.id });
  },

  saveCustomTheme: (theme) => {
    const nextCustom = [
      ...get().customThemes.filter((t) => t.id !== theme.id),
      { ...theme, isCustom: true },
    ];
    saveCustomThemes(nextCustom);
    applyThemeTokens(theme);
    set({ customThemes: nextCustom, themeId: theme.id });
  },

  deleteCustomTheme: (id) => {
    const nextCustom = get().customThemes.filter((t) => t.id !== id);
    saveCustomThemes(nextCustom);
    const fallbackId = get().themeId === id ? 'industrial-dark' : get().themeId;
    const theme = resolveThemeById(fallbackId, nextCustom);
    applyThemeTokens(theme);
    set({ customThemes: nextCustom, themeId: theme.id });
  },

  setDraggingCatalogKind: (draggingCatalogKind) => set({ draggingCatalogKind }),
  triggerCameraView: (view) => set({ cameraCommand: { seq: camSeq++, view } }),
  triggerBookmark: (bookmark) => set({ cameraCommand: { seq: camSeq++, bookmark } }),
  setTurbojetUi: (turbojetUi) => set({ turbojetUi }),
}));
