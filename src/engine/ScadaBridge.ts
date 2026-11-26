import type { Quality } from '../data/points';
import type { DataFeedMode, ProjectSchema, SceneNode } from '../domain/schema';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import {
  useTelemetryStore,
  type AlarmRecord,
  type BridgeCatalogItem,
} from '../store/useTelemetryStore';

export const PLANT_3D_BRIDGE_CHANNEL = 'PLANT_3D_BRIDGE' as const;
export const PLANT_3D_BRIDGE_VERSION = '1.0' as const;

/** 宿主(SCADA) -> 3D 预览页的标准点位数据项 */
export type BridgeTelemetryInput = {
  id: string;
  name?: string;
  unit?: string;
  value: number | null;
  quality?: Quality;
  ts?: string;
};

/** 兼容 SCADA 现有 MQTT 原始报文结构 */
export type ScadaRawMqttTelemetry = {
  PointId: string | number;
  PointName?: string;
  UnitName?: string;
  IsAlarm?: boolean;
  AlarmContent?: string;
  RealtimeData?: {
    Value?: number | string | null;
    CollectTime?: string;
  };
};

export type HostToStudioMessage =
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'PING';
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'TELEMETRY_PUSH';
      payload: {
        items?: BridgeTelemetryInput[];
        rawMqttFrames?: ScadaRawMqttTelemetry[];
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'ALARM_PUSH';
      payload: {
        replaceAll?: boolean;
        alarms?: (AlarmRecord & { pointId?: string; active?: boolean })[];
        alarm?: AlarmRecord & { pointId?: string; active?: boolean };
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'FOCUS_TARGET';
      payload: {
        nodeId?: string;
        tag?: string;
        pointId?: string;
        bookmarkId?: string;
        view?: 'iso' | 'top' | 'front';
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'POINT_CATALOG_SYNC';
      payload: {
        points: BridgeCatalogItem[];
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'LOAD_SCHEMA';
      payload: {
        schema: ProjectSchema;
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version?: string;
      requestId?: string;
      type: 'SET_THEME';
      payload: {
        themeId: string;
      };
    };

export type StudioToHostMessage =
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version: typeof PLANT_3D_BRIDGE_VERSION;
      type: 'READY';
      payload: {
        sceneId: string | null;
        stationCode?: string;
        title: string;
        dataMode: DataFeedMode;
        nodeCount: number;
        nodeTags: string[];
        boundPointKeys: string[];
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version: typeof PLANT_3D_BRIDGE_VERSION;
      type: 'NODE_CLICK';
      payload: {
        nodeId: string;
        tag: string;
        name: string;
        section: string;
        boundPointIds: string[];
        partLabel?: string | null;
      };
    }
  | {
      channel: typeof PLANT_3D_BRIDGE_CHANNEL;
      version: typeof PLANT_3D_BRIDGE_VERSION;
      type: 'BRIDGE_ACK';
      requestId?: string;
      payload: {
        ackType: string;
        ok: boolean;
        detail?: string;
      };
    };

let activeAllowedParentOrigin = '*';

function postToHost(msg: StudioToHostMessage) {
  if (typeof window === 'undefined' || window.parent === window) return;
  try {
    const target = activeAllowedParentOrigin === '*' ? '*' : activeAllowedParentOrigin;
    window.parent.postMessage(msg, target);
  } catch {
    // ignore cross-origin postMessage restrictions
  }
}

export function collectProjectBoundPointKeys(project: ProjectSchema): string[] {
  const keys = new Set<string>();
  for (const n of project.nodes) {
    for (const pid of n.pointIds) keys.add(pid);
    for (const cp of n.customPoints ?? []) keys.add(cp.key);
  }
  for (const p of project.pipes) {
    if (p.flow?.bindPointId) keys.add(p.flow.bindPointId);
  }
  for (const w of project.dashboardWidgets ?? []) {
    for (const el of w.elements ?? []) {
      if (el.binding?.pointKey) keys.add(el.binding.pointKey);
      for (const sid of el.props.seriesPointIds ?? []) keys.add(sid);
    }
  }
  return [...keys];
}

export function emitBridgeReady(opts: {
  sceneId: string | null;
  dataMode: DataFeedMode;
}): void {
  const project = useProjectStore.getState().project;
  postToHost({
    channel: PLANT_3D_BRIDGE_CHANNEL,
    version: PLANT_3D_BRIDGE_VERSION,
    type: 'READY',
    payload: {
      sceneId: opts.sceneId ?? project.publishedSceneId ?? null,
      stationCode: project.stationCode,
      title: project.name,
      dataMode: opts.dataMode,
      nodeCount: project.nodes.length,
      nodeTags: project.nodes.map((n) => n.tag),
      boundPointKeys: collectProjectBoundPointKeys(project),
    },
  });
}

export function emitBridgeNodeClick(node: SceneNode, partLabel?: string | null): void {
  const boundPointIds = [
    ...node.pointIds,
    ...(node.customPoints ?? []).map((cp) => cp.key),
  ];
  postToHost({
    channel: PLANT_3D_BRIDGE_CHANNEL,
    version: PLANT_3D_BRIDGE_VERSION,
    type: 'NODE_CLICK',
    payload: {
      nodeId: node.id,
      tag: node.tag,
      name: node.name,
      section: node.section,
      boundPointIds,
      partLabel,
    },
  });
}

function normalizeMqttFrames(frames: ScadaRawMqttTelemetry[]): {
  points: BridgeTelemetryInput[];
  alarms: (AlarmRecord & { pointId?: string; active?: boolean })[];
} {
  const points: BridgeTelemetryInput[] = [];
  const alarms: (AlarmRecord & { pointId?: string; active?: boolean })[] = [];

  for (const raw of frames) {
    const pid = String(raw.PointId);
    const valRaw = raw.RealtimeData?.Value;
    const num = valRaw === null || valRaw === undefined || valRaw === '' ? null : Number(valRaw);
    const isAlarm = Boolean(raw.IsAlarm);
    points.push({
      id: pid,
      name: raw.PointName,
      unit: raw.UnitName,
      value: num !== null && Number.isFinite(num) ? num : null,
      quality: isAlarm ? 'BAD' : num !== null && Number.isFinite(num) ? 'GOOD' : 'NODATA',
      ts: raw.RealtimeData?.CollectTime,
    });

    const matchedNode = useProjectStore
      .getState()
      .project.nodes.find(
        (n) =>
          n.pointIds.includes(pid) ||
          (n.customPoints ?? []).some((cp) => cp.key === pid),
      );

    alarms.push({
      id: `scada-pt-${pid}`,
      pointId: pid,
      level: 'critical',
      tag: matchedNode?.tag ?? pid,
      message: raw.AlarmContent || `${raw.PointName ?? pid} 触发告警 (${num ?? '--'})`,
      time: new Date().toTimeString().slice(0, 8),
      active: isAlarm,
    });
  }
  return { points, alarms };
}

function resolveFocusTarget(payload: Extract<HostToStudioMessage, { type: 'FOCUS_TARGET' }>['payload']) {
  const editor = useEditorStore.getState();
  const project = useProjectStore.getState().project;

  if (payload.view) {
    editor.triggerCameraView(payload.view);
    return true;
  }
  if (payload.bookmarkId) {
    const bm = project.bookmarks.find((b) => b.id === payload.bookmarkId);
    if (bm) {
      editor.dispatchSceneAction({ type: 'fly-bookmark', bookmarkId: bm.id });
      return true;
    }
  }

  let hitNode: SceneNode | undefined;
  if (payload.nodeId) {
    hitNode = project.nodes.find((n) => n.id === payload.nodeId);
  }
  if (!hitNode && payload.tag) {
    hitNode = project.nodes.find((n) => n.tag === payload.tag);
  }
  if (!hitNode && payload.pointId) {
    hitNode = project.nodes.find(
      (n) =>
        n.pointIds.includes(payload.pointId!) ||
        (n.customPoints ?? []).some((cp) => cp.key === payload.pointId),
    );
  }
  if (hitNode) {
    editor.dispatchSceneAction({ type: 'focus-node', nodeId: hitNode.id });
    return true;
  }
  return false;
}

export function startScadaBridge(opts: {
  sceneId: string | null;
  dataMode: DataFeedMode;
  allowedParentOrigin?: string;
}): () => void {
  activeAllowedParentOrigin = (opts.allowedParentOrigin ?? '*').trim() || '*';

  const onMessage = (ev: MessageEvent<unknown>) => {
    if (activeAllowedParentOrigin !== '*' && ev.origin !== activeAllowedParentOrigin) {
      return;
    }
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    const msg = data as Partial<HostToStudioMessage>;
    if (msg.channel !== PLANT_3D_BRIDGE_CHANNEL || !msg.type) return;

    const tel = useTelemetryStore.getState();
    const reqId = msg.requestId;

    switch (msg.type) {
      case 'PING': {
        tel.markBridgeHandshake(ev.origin);
        postToHost({
          channel: PLANT_3D_BRIDGE_CHANNEL,
          version: PLANT_3D_BRIDGE_VERSION,
          type: 'BRIDGE_ACK',
          requestId: reqId,
          payload: { ackType: 'PING', ok: true },
        });
        break;
      }

      case 'TELEMETRY_PUSH': {
        const items: BridgeTelemetryInput[] = [...(msg.payload?.items ?? [])];
        const rawMqtt = msg.payload?.rawMqttFrames ?? [];
        if (rawMqtt.length > 0) {
          const parsed = normalizeMqttFrames(rawMqtt);
          items.push(...parsed.points);
          for (const alm of parsed.alarms) {
            tel.applyBridgeAlarm(alm);
          }
        }
        if (items.length > 0) {
          tel.ingestExternalPoints('scada-bridge', items);
        }
        postToHost({
          channel: PLANT_3D_BRIDGE_CHANNEL,
          version: PLANT_3D_BRIDGE_VERSION,
          type: 'BRIDGE_ACK',
          requestId: reqId,
          payload: { ackType: 'TELEMETRY_PUSH', ok: true, detail: `已写入 ${items.length} 点` },
        });
        break;
      }

      case 'ALARM_PUSH': {
        const p = msg.payload;
        if (p?.replaceAll && Array.isArray(p.alarms)) {
          tel.syncBridgeAlarms(p.alarms);
        } else {
          if (p?.alarm) tel.applyBridgeAlarm(p.alarm);
          if (Array.isArray(p?.alarms)) {
            for (const item of p.alarms) tel.applyBridgeAlarm(item);
          }
        }
        postToHost({
          channel: PLANT_3D_BRIDGE_CHANNEL,
          version: PLANT_3D_BRIDGE_VERSION,
          type: 'BRIDGE_ACK',
          requestId: reqId,
          payload: { ackType: 'ALARM_PUSH', ok: true },
        });
        break;
      }

      case 'FOCUS_TARGET': {
        const ok = resolveFocusTarget(msg.payload ?? {});
        postToHost({
          channel: PLANT_3D_BRIDGE_CHANNEL,
          version: PLANT_3D_BRIDGE_VERSION,
          type: 'BRIDGE_ACK',
          requestId: reqId,
          payload: {
            ackType: 'FOCUS_TARGET',
            ok,
            detail: ok ? '已定位设备' : '未匹配到目标设备/视角',
          },
        });
        break;
      }

      case 'POINT_CATALOG_SYNC': {
        if (Array.isArray(msg.payload?.points)) {
          tel.setBridgeCatalog(msg.payload.points);
        }
        break;
      }

      case 'LOAD_SCHEMA': {
        if (msg.payload?.schema) {
          useProjectStore.getState().loadRuntimeProject(msg.payload.schema);
        }
        break;
      }

      case 'SET_THEME': {
        if (msg.payload?.themeId) {
          useEditorStore.getState().setThemeId(msg.payload.themeId);
        }
        break;
      }
    }
  };

  window.addEventListener('message', onMessage);
  emitBridgeReady({ sceneId: opts.sceneId, dataMode: opts.dataMode });

  return () => {
    window.removeEventListener('message', onMessage);
    activeAllowedParentOrigin = '*';
  };
}
