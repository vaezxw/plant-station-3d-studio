import { create } from 'zustand';
import {
  getPublishAdapter,
  loadPublishSettings,
  savePublishSettings,
  type PublishSceneInput,
} from '../api/scenePublishClient';
import type {
  PublishEndpointSettings,
  PublishedSceneRecord,
  PublishedSceneSummary,
} from '../domain/schema';
import { useProjectStore } from './useProjectStore';

type PublishState = {
  settings: PublishEndpointSettings;
  publishedList: PublishedSceneSummary[];
  loading: boolean;
  publishing: boolean;
  error: string | null;
  lastPublished: PublishedSceneRecord | null;

  updateSettings: (patch: Partial<PublishEndpointSettings>) => void;
  refreshList: () => Promise<void>;
  publishCurrentProject: (input: Omit<PublishSceneInput, 'schema'>) => Promise<PublishedSceneRecord>;
  getPublishedScene: (sceneId: string, token?: string) => Promise<PublishedSceneRecord>;
  loadPublishedIntoStudio: (sceneId: string) => Promise<PublishedSceneRecord>;
  deletePublished: (sceneId: string) => Promise<void>;
  testRemoteConnection: () => Promise<{ ok: boolean; message: string }>;
};

export const usePublishStore = create<PublishState>((set, get) => ({
  settings: loadPublishSettings(),
  publishedList: [],
  loading: false,
  publishing: false,
  error: null,
  lastPublished: null,

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    savePublishSettings(next);
    set({ settings: next, error: null });
  },

  refreshList: async () => {
    set({ loading: true, error: null });
    try {
      const adapter = getPublishAdapter(get().settings);
      const publishedList = await adapter.listPublishedScenes();
      set({ publishedList, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : '加载已发布列表失败',
      });
    }
  },

  publishCurrentProject: async (input) => {
    set({ publishing: true, error: null });
    try {
      const adapter = getPublishAdapter(get().settings);
      const projStore = useProjectStore.getState();
      const record = await adapter.publishScene({
        ...input,
        sceneId: input.sceneId || projStore.project.publishedSceneId,
        schema: projStore.project,
      });

      projStore.updateProjectMeta({
        name: record.title,
        publishedSceneId: record.sceneId,
        stationCode: record.stationCode,
      });

      const list = await adapter.listPublishedScenes();
      set({ publishing: false, lastPublished: record, publishedList: list });
      return record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发布失败';
      set({ publishing: false, error: msg });
      throw err;
    }
  },

  getPublishedScene: async (sceneId, token) => {
    const adapter = getPublishAdapter(get().settings);
    return await adapter.getPublishedScene(sceneId, token);
  },

  loadPublishedIntoStudio: async (sceneId) => {
    const adapter = getPublishAdapter(get().settings);
    const existing = get().publishedList.find((x) => x.sceneId === sceneId);
    const rec = await adapter.getPublishedScene(sceneId, existing?.shareToken);
    useProjectStore.getState().importProject(rec.schema);
    set({ lastPublished: rec });
    return rec;
  },

  deletePublished: async (sceneId) => {
    const adapter = getPublishAdapter(get().settings);
    await adapter.deletePublishedScene(sceneId);
    await get().refreshList();
    if (get().lastPublished?.sceneId === sceneId) {
      set({ lastPublished: null });
    }
  },

  testRemoteConnection: async () => {
    const adapter = getPublishAdapter(get().settings);
    return await adapter.testConnection();
  },
}));
