import type { Quality } from '../data/points';
import type { DataSourceConfig, DataSourceParserConfig } from '../domain/schema';
import { useTelemetryStore } from '../store/useTelemetryStore';

export type ParsedTelemetryItem = {
  id: string;
  name?: string;
  unit?: string;
  value: number | null;
  quality: Quality;
  ts?: string;
};

function readByPath(obj: unknown, path?: string): unknown {
  if (!path || !path.trim()) return obj;
  let cur: unknown = obj;
  for (const seg of path.trim().split('.')) {
    if (cur && typeof cur === 'object' && seg in cur) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function normalizeQuality(raw: unknown): Quality {
  if (raw === 'GOOD' || raw === 'UNCERTAIN' || raw === 'STALE' || raw === 'BAD' || raw === 'NODATA') {
    return raw;
  }
  if (raw === true || raw === 1 || raw === 'OK' || raw === 'ok') return 'GOOD';
  if (raw === false || raw === 0) return 'BAD';
  return 'GOOD';
}

/** 通用 JSON 报文解析器：同时兼容数组点表与键值对字典格式 */
export function parsePayloadByConfig(
  raw: unknown,
  parser?: DataSourceParserConfig,
): ParsedTelemetryItem[] {
  const cfg: DataSourceParserConfig = parser ?? {
    mode: 'array',
    idField: 'id',
    valueField: 'value',
    qualityField: 'quality',
    tsField: 'ts',
  };
  const root = readByPath(raw, cfg.dataPath);
  const out: ParsedTelemetryItem[] = [];

  if (cfg.mode === 'key-value' && root && typeof root === 'object' && !Array.isArray(root)) {
    for (const [k, v] of Object.entries(root as Record<string, unknown>)) {
      const num = v === null || v === undefined ? null : Number(v);
      out.push({
        id: k,
        value: num !== null && Number.isFinite(num) ? num : null,
        quality: num !== null && Number.isFinite(num) ? 'GOOD' : 'NODATA',
      });
    }
    return out;
  }

  const arr = Array.isArray(root)
    ? root
    : root && typeof root === 'object' && !Array.isArray(root)
      ? Object.entries(root as Record<string, unknown>).map(([k, v]) => ({ id: k, value: v }))
      : [];

  const idKey = cfg.idField?.trim() || 'id';
  const valKey = cfg.valueField?.trim() || 'value';
  const qualKey = cfg.qualityField?.trim() || 'quality';
  const tsKey = cfg.tsField?.trim() || 'ts';

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawId = rec[idKey];
    if (typeof rawId !== 'string' && typeof rawId !== 'number') continue;
    const rawVal = rec[valKey];
    const num = rawVal === null || rawVal === undefined || rawVal === '' ? null : Number(rawVal);
    out.push({
      id: String(rawId),
      name: typeof rec.name === 'string' ? rec.name : undefined,
      unit: typeof rec.unit === 'string' ? rec.unit : undefined,
      value: num !== null && Number.isFinite(num) ? num : null,
      quality: normalizeQuality(rec[qualKey]),
      ts: typeof rec[tsKey] === 'string' ? (rec[tsKey] as string) : undefined,
    });
  }
  return out;
}

/** 测试单条数据源连接并预览清洗后的点位列表 */
export async function testDataSourceConnection(
  ds: DataSourceConfig,
): Promise<{ ok: boolean; items: ParsedTelemetryItem[]; error?: string }> {
  try {
    if (ds.type === 'static-json') {
      const parsed = JSON.parse(ds.staticJson || '{}');
      return { ok: true, items: parsePayloadByConfig(parsed, ds.parser) };
    }
    if (ds.type === 'http-rest') {
      if (!ds.http?.url) return { ok: false, items: [], error: '请填写 HTTP 接口 URL' };
      const res = await fetch(ds.http.url, {
        method: ds.http.method || 'GET',
        headers: ds.http.headers,
        body: ds.http.method === 'POST' ? ds.http.bodyJson : undefined,
      });
      if (!res.ok) return { ok: false, items: [], error: `HTTP ${res.status}` };
      const json = await res.json();
      return { ok: true, items: parsePayloadByConfig(json, ds.parser) };
    }
    if (ds.type === 'websocket') {
      if (!ds.realtime?.url) return { ok: false, items: [], error: '请填写 WebSocket 地址' };
      return await new Promise((resolve) => {
        const ws = new WebSocket(ds.realtime!.url);
        const timer = window.setTimeout(() => {
          ws.close();
          resolve({ ok: true, items: [], error: '已连接，5s 内尚未收到首条报文' });
        }, 5000);
        ws.onopen = () => {
          if (ds.realtime?.topics?.length) {
            ws.send(JSON.stringify({ action: 'subscribe', topics: ds.realtime.topics }));
          }
        };
        ws.onmessage = (ev) => {
          window.clearTimeout(timer);
          ws.close();
          try {
            const json = JSON.parse(String(ev.data));
            resolve({ ok: true, items: parsePayloadByConfig(json, ds.parser) });
          } catch {
            resolve({ ok: false, items: [], error: '收到非 JSON 报文' });
          }
        };
        ws.onerror = () => {
          window.clearTimeout(timer);
          resolve({ ok: false, items: [], error: 'WebSocket 握手失败' });
        };
      });
    }
    return { ok: true, items: [] };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : '连接/解析失败',
    };
  }
}

/** 运行时可插拔数据源管理器：自动维持项目配置的轮询 / 推送连接并喂入遥测总线 */
export class DataSourceManager {
  private cleanups: (() => void)[] = [];

  sync(sources: DataSourceConfig[]) {
    this.dispose();
    const store = useTelemetryStore.getState();

    for (const ds of sources) {
      if (ds.type === 'builtin-sim') {
        continue;
      }
      if (!ds.enabled) {
        store.setSourceStatus(ds.id, { status: 'idle', message: '已停用' });
        continue;
      }

      if (ds.type === 'static-json') {
        try {
          const parsed = JSON.parse(ds.staticJson || '{}');
          const items = parsePayloadByConfig(parsed, ds.parser);
          store.ingestExternalPoints(ds.id, items);
        } catch (err) {
          store.setSourceStatus(ds.id, {
            status: 'error',
            message: err instanceof Error ? err.message : 'JSON 解析失败',
          });
        }
        continue;
      }

      if (ds.type === 'http-rest' && ds.http?.url) {
        const poll = async () => {
          try {
            const res = await fetch(ds.http!.url, {
              method: ds.http!.method || 'GET',
              headers: ds.http!.headers,
              body: ds.http!.method === 'POST' ? ds.http!.bodyJson : undefined,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const items = parsePayloadByConfig(json, ds.parser);
            useTelemetryStore.getState().ingestExternalPoints(ds.id, items);
          } catch (err) {
            useTelemetryStore.getState().setSourceStatus(ds.id, {
              status: 'error',
              message: err instanceof Error ? err.message : 'HTTP 拉取失败',
            });
          }
        };
        store.setSourceStatus(ds.id, { status: 'connecting', message: '轮询中...' });
        void poll();
        const timer = window.setInterval(() => void poll(), Math.max(1000, ds.http.pollIntervalMs || 3000));
        this.cleanups.push(() => window.clearInterval(timer));
        continue;
      }

      if (ds.type === 'websocket' && ds.realtime?.url) {
        let closed = false;
        let ws: WebSocket | null = null;
        let reconnectTimer: number | null = null;

        const connect = () => {
          if (closed) return;
          useTelemetryStore.getState().setSourceStatus(ds.id, { status: 'connecting', message: '正在握手...' });
          try {
            ws = new WebSocket(ds.realtime!.url);
            ws.onopen = () => {
              useTelemetryStore.getState().setSourceStatus(ds.id, { status: 'active', message: '已连接推送流' });
              if (ds.realtime?.topics?.length) {
                ws?.send(JSON.stringify({ action: 'subscribe', topics: ds.realtime.topics }));
              }
            };
            ws.onmessage = (ev) => {
              try {
                const json = JSON.parse(String(ev.data));
                const items = parsePayloadByConfig(json, ds.parser);
                if (items.length > 0) {
                  useTelemetryStore.getState().ingestExternalPoints(ds.id, items);
                }
              } catch {
                // ignore malformed frames
              }
            };
            ws.onerror = () => {
              useTelemetryStore.getState().setSourceStatus(ds.id, { status: 'error', message: 'WebSocket 异常' });
            };
            ws.onclose = () => {
              if (closed) return;
              useTelemetryStore.getState().setSourceStatus(ds.id, { status: 'error', message: '已断开，准备重连' });
              reconnectTimer = window.setTimeout(connect, Math.max(1000, ds.realtime?.reconnectMs || 5000));
            };
          } catch (err) {
            useTelemetryStore.getState().setSourceStatus(ds.id, {
              status: 'error',
              message: err instanceof Error ? err.message : '连接异常',
            });
          }
        };
        connect();
        this.cleanups.push(() => {
          closed = true;
          if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
          ws?.close();
        });
      }
    }
  }

  dispose() {
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }
}
