import { del, get, keys, set } from 'idb-keyval';
import type {
  DataFeedMode,
  ProjectSchema,
  PublishEndpointSettings,
  PublishedSceneRecord,
  PublishedSceneSummary,
} from '../domain/schema';

const PUBLISH_IDB_PREFIX = 'plant-studio:pub:v1:';
const SETTINGS_STORAGE_KEY = 'plant-studio:publish-settings:v1';

export type PublishSceneInput = {
  sceneId?: string;
  stationCode?: string;
  title: string;
  shareToken: string;
  requireToken: boolean;
  embedDefaultDataMode: DataFeedMode;
  schema: ProjectSchema;
  thumbnailDataUrl?: string;
};

export class ScenePublishError extends Error {
  code: 'SCENE_NOT_FOUND' | 'INVALID_TOKEN' | 'NETWORK_ERROR' | 'SERVER_ERROR';

  constructor(
    code: 'SCENE_NOT_FOUND' | 'INVALID_TOKEN' | 'NETWORK_ERROR' | 'SERVER_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'ScenePublishError';
    this.code = code;
  }
}

export interface ScenePublishAdapter {
  readonly mode: PublishEndpointSettings['storageMode'];
  publishScene(input: PublishSceneInput): Promise<PublishedSceneRecord>;
  getPublishedScene(sceneId: string, token?: string): Promise<PublishedSceneRecord>;
  listPublishedScenes(): Promise<PublishedSceneSummary[]>;
  deletePublishedScene(sceneId: string): Promise<void>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

export function generateSceneId(stationCode?: string): string {
  const cleanCode = (stationCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
  return cleanCode ? `st-${cleanCode.slice(0, 18)}-${suffix}` : `sc-${suffix}`;
}

export function generateShareToken(): string {
  return `tk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getDefaultPublishSettings(): PublishEndpointSettings {
  const envBase = (import.meta.env.VITE_SCENE_API_BASE as string | undefined) ?? '';
  return {
    storageMode: envBase ? 'remote-api' : 'local-mock',
    apiBaseUrl: envBase || 'https://scada.maobaoinfo.com/hub/api/scene3d',
    authHeaderName: 'Authorization',
    authHeaderValue: '',
  };
}

export function loadPublishSettings(): PublishEndpointSettings {
  const fallback = getDefaultPublishSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PublishEndpointSettings>;
    return {
      storageMode: parsed.storageMode === 'remote-api' ? 'remote-api' : 'local-mock',
      apiBaseUrl: (parsed.apiBaseUrl ?? fallback.apiBaseUrl).trim(),
      authHeaderName: (parsed.authHeaderName ?? fallback.authHeaderName).trim() || 'Authorization',
      authHeaderValue: parsed.authHeaderValue ?? '',
    };
  } catch {
    return fallback;
  }
}

export function savePublishSettings(settings: PublishEndpointSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

function toSummary(record: PublishedSceneRecord): PublishedSceneSummary {
  const { schema: _omit, ...summary } = record;
  void _omit;
  return summary;
}

/** 选项 B 本地预留适配器：使用 IndexedDB 持久化，支持按 sceneId 覆写发布并自增 revision */
class LocalMockPublishAdapter implements ScenePublishAdapter {
  readonly mode = 'local-mock' as const;

  async publishScene(input: PublishSceneInput): Promise<PublishedSceneRecord> {
    const sceneId = (input.sceneId ?? '').trim() || generateSceneId(input.stationCode);
    const existing = await get<PublishedSceneRecord>(`${PUBLISH_IDB_PREFIX}${sceneId}`);
    const nowTs = Date.now();
    const nextSchema: ProjectSchema = JSON.parse(JSON.stringify(input.schema)) as ProjectSchema;
    nextSchema.publishedSceneId = sceneId;
    nextSchema.stationCode = input.stationCode?.trim() || nextSchema.stationCode;
    nextSchema.name = input.title.trim() || nextSchema.name;
    nextSchema.updatedAt = nowTs;

    const record: PublishedSceneRecord = {
      sceneId,
      revision: (existing?.revision ?? 0) + 1,
      stationCode: input.stationCode?.trim() || undefined,
      title: input.title.trim() || nextSchema.name,
      shareToken: input.shareToken.trim() || existing?.shareToken || generateShareToken(),
      requireToken: input.requireToken,
      embedDefaultDataMode: input.embedDefaultDataMode,
      nodeCount: nextSchema.nodes.length,
      widgetCount: (nextSchema.dashboardWidgets ?? []).filter((w) => w.visible).length,
      thumbnailDataUrl: input.thumbnailDataUrl ?? existing?.thumbnailDataUrl,
      publishedAt: existing?.publishedAt ?? nowTs,
      updatedAt: nowTs,
      schema: nextSchema,
    };

    await set(`${PUBLISH_IDB_PREFIX}${sceneId}`, record);
    return record;
  }

  async getPublishedScene(sceneId: string, token?: string): Promise<PublishedSceneRecord> {
    const cleanId = decodeURIComponent(sceneId).trim();
    const record = await get<PublishedSceneRecord>(`${PUBLISH_IDB_PREFIX}${cleanId}`);
    if (!record) {
      throw new ScenePublishError(
        'SCENE_NOT_FOUND',
        `未找到场景「${cleanId}」（若在无后端调试模式下，请确认发布和预览位于同一浏览器源下）。`,
      );
    }
    if (record.requireToken) {
      const passed = (token ?? '').trim();
      if (!passed || passed !== record.shareToken) {
        throw new ScenePublishError('INVALID_TOKEN', '预览访问令牌（token）缺失或校验未通过。');
      }
    }
    return record;
  }

  async listPublishedScenes(): Promise<PublishedSceneSummary[]> {
    const allKeys = await keys();
    const pubKeys = allKeys.filter(
      (k): k is string => typeof k === 'string' && k.startsWith(PUBLISH_IDB_PREFIX),
    );
    const items: PublishedSceneSummary[] = [];
    for (const k of pubKeys) {
      const rec = await get<PublishedSceneRecord>(k);
      if (rec && rec.sceneId) items.push(toSummary(rec));
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  }

  async deletePublishedScene(sceneId: string): Promise<void> {
    await del(`${PUBLISH_IDB_PREFIX}${sceneId}`);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const list = await this.listPublishedScenes();
    return {
      ok: true,
      message: `本地发布仓库 (IndexedDB) 就绪，当前已保存 ${list.length} 个已发布厂站大屏。`,
    };
  }
}

/** 兼容裸 JSON 以及 SCADA 现有 Furion/{ succeeded, data, errors } 或 { code, data, msg } 响应包装 */
function unwrapBackendResponse<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('succeeded' in obj) {
      if (obj.succeeded === false) {
        throw new ScenePublishError(
          'SERVER_ERROR',
          typeof obj.errors === 'string' && obj.errors ? obj.errors : '后端返回失败状态',
        );
      }
      if ('data' in obj) return obj.data as T;
    }
    if ('code' in obj && 'data' in obj && typeof obj.code === 'number') {
      if (obj.code !== 200 && obj.code !== 0) {
        throw new ScenePublishError(
          'SERVER_ERROR',
          typeof obj.msg === 'string' && obj.msg ? obj.msg : `业务状态码异常 (${obj.code})`,
        );
      }
      return obj.data as T;
    }
  }
  return raw as T;
}

/** 选项 B 远程后端 REST 客户端：预留给后端接口（POST /publish, GET /public/:sceneId, GET /list, DELETE /:sceneId） */
class RemoteApiPublishAdapter implements ScenePublishAdapter {
  readonly mode = 'remote-api' as const;
  private settings: PublishEndpointSettings;

  constructor(settings: PublishEndpointSettings) {
    this.settings = settings;
  }

  private baseUrl(): string {
    const url = this.settings.apiBaseUrl.trim().replace(/\/+$/, '');
    if (!url) throw new ScenePublishError('NETWORK_ERROR', '请先填写后端 3D 场景服务 Base URL');
    return url;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    const key = this.settings.authHeaderName.trim();
    const val = this.settings.authHeaderValue.trim();
    if (key && val) h[key] = val;
    return h;
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: this.headers(init?.headers as Record<string, string> | undefined),
      });
    } catch (err) {
      throw new ScenePublishError(
        'NETWORK_ERROR',
        `无法连接后端服务 (${url})：${err instanceof Error ? err.message : '网络不可达或跨域拦截'}`,
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new ScenePublishError('INVALID_TOKEN', `后端鉴权拒绝 (HTTP ${res.status})`);
    }
    if (res.status === 404) {
      throw new ScenePublishError('SCENE_NOT_FOUND', '后端未找到对应 3D 场景记录 (HTTP 404)');
    }
    if (!res.ok) {
      throw new ScenePublishError('SERVER_ERROR', `后端服务响应异常 (HTTP ${res.status})`);
    }
    const raw = (await res.json()) as unknown;
    return unwrapBackendResponse<T>(raw);
  }

  async publishScene(input: PublishSceneInput): Promise<PublishedSceneRecord> {
    return await this.requestJson<PublishedSceneRecord>('/publish', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getPublishedScene(sceneId: string, token?: string): Promise<PublishedSceneRecord> {
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    return await this.requestJson<PublishedSceneRecord>(
      `/public/${encodeURIComponent(sceneId)}${q}`,
      { method: 'GET' },
    );
  }

  async listPublishedScenes(): Promise<PublishedSceneSummary[]> {
    const res = await this.requestJson<PublishedSceneSummary[] | { items?: PublishedSceneSummary[] }>(
      '/list',
      { method: 'GET' },
    );
    return Array.isArray(res) ? res : (res?.items ?? []);
  }

  async deletePublishedScene(sceneId: string): Promise<void> {
    await this.requestJson<unknown>(`/${encodeURIComponent(sceneId)}`, { method: 'DELETE' });
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const list = await this.listPublishedScenes();
      return {
        ok: true,
        message: `后端接口连通正常，当前服务端共返回 ${list.length} 条场景记录。`,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : '连接测试失败',
      };
    }
  }
}

export function getPublishAdapter(settings?: PublishEndpointSettings): ScenePublishAdapter {
  const cfg = settings ?? loadPublishSettings();
  if (cfg.storageMode === 'remote-api') {
    return new RemoteApiPublishAdapter(cfg);
  }
  return new LocalMockPublishAdapter();
}
