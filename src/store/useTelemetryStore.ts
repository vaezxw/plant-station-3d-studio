import { create } from 'zustand';
import { POINT_DEFS, type PointDef, type PointValue, type Quality } from '../data/points';
import { SNAPSHOTS, type SnapshotId } from '../data/snapshots';

export type AlarmRecord = {
  id: string;
  level: 'warn' | 'critical';
  tag: string;
  message: string;
  time: string;
};

export type TrendSample = {
  label: string;
  pressure: number;
  flow: number;
};

export type PointSample = {
  label: string;
  value: number;
};

export type ExternalPointDef = {
  id: string;
  name: string;
  unit: string;
  dataSourceId: string;
};

export type DataSourceRuntimeStatus = {
  status: 'active' | 'connecting' | 'error' | 'idle';
  message?: string;
  count?: number;
  lastAt?: number;
};

export type BridgeStatus = {
  connected: boolean;
  lastPacketAt?: number;
  packetCount: number;
  parentOrigin?: string;
  lastSummary?: string;
};

export type BridgeCatalogItem = {
  id: string;
  name: string;
  unit: string;
  tag?: string;
};

type TelemetryState = {
  dataFeedMode: 'sim' | 'direct' | 'bridge';
  simRunning: boolean;
  snapshotId: SnapshotId;
  tickCount: number;
  valueMap: Record<string, PointValue>;
  pointHistory: Record<string, PointSample[]>;
  externalDefs: Record<string, ExternalPointDef>;
  sourceStatuses: Record<string, DataSourceRuntimeStatus>;
  bridgeStatus: BridgeStatus;
  bridgeCatalog: BridgeCatalogItem[];
  history: TrendSample[];
  alarms: AlarmRecord[];
  meterStats: {
    dailyOutput: number;
    passRate: number;
    leakTestOk: number;
    calibrating: number;
  };

  setDataFeedMode: (mode: 'sim' | 'direct' | 'bridge') => void;
  toggleSim: () => void;
  setSnapshot: (id: SnapshotId) => void;
  stepSimulation: () => void;
  ingestExternalPoints: (
    sourceId: string,
    points: { id: string; name?: string; unit?: string; value: number | null; quality?: Quality; ts?: string }[],
  ) => void;
  setSourceStatus: (sourceId: string, status: DataSourceRuntimeStatus) => void;
  setBridgeCatalog: (items: BridgeCatalogItem[]) => void;
  applyBridgeAlarm: (alarm: AlarmRecord & { pointId?: string; active?: boolean }) => void;
  syncBridgeAlarms: (alarms: AlarmRecord[]) => void;
  markBridgeHandshake: (parentOrigin?: string) => void;
  prepareForBridgeMode: () => void;
};

function initialValues(id: SnapshotId): Record<string, PointValue> {
  const map: Record<string, PointValue> = {};
  for (const pv of SNAPSHOTS[id].values) {
    map[pv.id] = { ...pv };
  }
  return map;
}

function seedHistory(): TrendSample[] {
  const arr: TrendSample[] = [];
  for (let i = 15; i >= 0; i--) {
    arr.push({
      label: `${String(16).padStart(2, '0')}:${String(20 + (15 - i)).padStart(2, '0')}`,
      pressure: Number((4675 + Math.sin(i * 0.6) * 28).toFixed(1)),
      flow: Number((122 + Math.cos(i * 0.5) * 9).toFixed(1)),
    });
  }
  return arr;
}

function seedPointHistory(values: Record<string, PointValue>): Record<string, PointSample[]> {
  const out: Record<string, PointSample[]> = {};
  for (const [id, pv] of Object.entries(values)) {
    if (pv.value === null) continue;
    const def = POINT_DEFS.find((d) => d.id === id);
    const list: PointSample[] = [];
    for (let i = 15; i >= 0; i--) {
      const label = `${String(16).padStart(2, '0')}:${String(20 + (15 - i)).padStart(2, '0')}`;
      const val =
        def?.kind === 'instant'
          ? Number((pv.value + Math.sin(i * 0.55 + id.length) * (pv.value * 0.012)).toFixed(2))
          : pv.value;
      list.push({ label, value: val });
    }
    out[id] = list;
  }
  return out;
}

export const POINT_CATALOG: readonly PointDef[] = POINT_DEFS;

const initVal = initialValues('runtime');

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  dataFeedMode: 'sim',
  simRunning: true,
  snapshotId: 'runtime',
  tickCount: 0,
  valueMap: initVal,
  pointHistory: seedPointHistory(initVal),
  externalDefs: {},
  sourceStatuses: {
    'builtin-sim': { status: 'active', message: '内置仿真运行中', count: POINT_DEFS.length, lastAt: Date.now() },
  },
  bridgeStatus: {
    connected: false,
    packetCount: 0,
  },
  bridgeCatalog: [],
  history: seedHistory(),
  alarms: [
    {
      id: 'alm-1',
      level: 'warn',
      tag: 'GD-001',
      message: '校验工位尾气微排浓度 4.2% LEL（正常阈值 < 20%）',
      time: '16:10:22',
    },
    {
      id: 'alm-2',
      level: 'warn',
      tag: 'HG-UF-101',
      message: 'A 路超声波表工况瞬时流量接近额定上限 85%',
      time: '16:08:05',
    },
  ],
  meterStats: {
    dailyOutput: 1248,
    passRate: 99.4,
    leakTestOk: 1256,
    calibrating: 18,
  },

  setDataFeedMode: (dataFeedMode) =>
    set((s) => ({
      dataFeedMode,
      simRunning: dataFeedMode === 'sim' ? s.simRunning : false,
    })),

  toggleSim: () =>
    set((s) => ({
      simRunning: !s.simRunning,
      dataFeedMode: !s.simRunning ? 'sim' : s.dataFeedMode,
    })),

  setSnapshot: (snapshotId) => {
    const vals = initialValues(snapshotId);
    set({
      snapshotId,
      valueMap: vals,
      pointHistory: seedPointHistory(vals),
      tickCount: 0,
    });
  },

  stepSimulation: () => {
    const { dataFeedMode, simRunning, tickCount, valueMap, pointHistory, history, meterStats, sourceStatuses } = get();
    if (dataFeedMode !== 'sim' || !simRunning) return;
    const t = tickCount + 1;
    const d = new Date();
    const label = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const tsIso = d.toISOString();

    const next: Record<string, PointValue> = { ...valueMap };
    const nextPointHistory: Record<string, PointSample[]> = { ...pointHistory };

    for (const def of POINT_DEFS) {
      const pv = valueMap[def.id];
      if (!pv || pv.value == null || pv.quality !== 'GOOD') continue;
      let nextVal = pv.value;
      if (def.kind === 'cumulative') {
        nextVal = Number((pv.value + 0.35).toFixed(2));
      } else if (def.kind === 'instant') {
        const wave = Math.sin(t * 0.45 + def.id.length) * (pv.value * 0.008);
        nextVal = Number((pv.value + wave).toFixed(2));
      }
      next[def.id] = { ...pv, value: nextVal, ts: tsIso };
      const prevList = nextPointHistory[def.id] ?? [];
      nextPointHistory[def.id] = [...prevList.slice(-19), { label, value: nextVal }];
    }

    const p = next['HG-UF-101.pressure']?.value ?? 4676;
    const f = next['HG-UF-101.flowWork']?.value ?? 124;
    const nextHistory = [...history.slice(-19), { label, pressure: p, flow: f }];

    const bump = t % 3 === 0 ? 1 : 0;
    set({
      tickCount: t,
      valueMap: next,
      pointHistory: nextPointHistory,
      history: nextHistory,
      sourceStatuses: {
        ...sourceStatuses,
        'builtin-sim': { status: 'active', message: '内置仿真运行中', count: POINT_DEFS.length, lastAt: Date.now() },
      },
      meterStats: {
        ...meterStats,
        dailyOutput: meterStats.dailyOutput + bump,
        leakTestOk: meterStats.leakTestOk + bump,
      },
    });
  },

  ingestExternalPoints: (sourceId, points) => {
    const { valueMap, pointHistory, externalDefs, sourceStatuses } = get();
    const d = new Date();
    const label = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const tsIso = d.toISOString();

    const nextValues = { ...valueMap };
    const nextHistory = { ...pointHistory };
    const nextDefs = { ...externalDefs };

    for (const pt of points) {
      const quality: Quality = pt.quality ?? 'GOOD';
      nextValues[pt.id] = {
        id: pt.id,
        value: pt.value,
        quality,
        ts: pt.ts ?? tsIso,
      };
      nextDefs[pt.id] = {
        id: pt.id,
        name: pt.name ?? pt.id,
        unit: pt.unit ?? '',
        dataSourceId: sourceId,
      };
      if (pt.value !== null && Number.isFinite(pt.value)) {
        const prevList = nextHistory[pt.id] ?? [];
        nextHistory[pt.id] = [...prevList.slice(-19), { label, value: pt.value }];
      }
    }

    set((s) => {
      const nextBridge =
        sourceId === 'scada-bridge'
          ? {
              ...s.bridgeStatus,
              connected: true,
              lastPacketAt: Date.now(),
              packetCount: s.bridgeStatus.packetCount + 1,
              lastSummary: `最新同步 ${points.length} 点`,
            }
          : s.bridgeStatus;

      return {
        tickCount: s.tickCount + 1,
        valueMap: nextValues,
        pointHistory: nextHistory,
        externalDefs: nextDefs,
        bridgeStatus: nextBridge,
        sourceStatuses: {
          ...sourceStatuses,
          [sourceId]: {
            status: 'active',
            message: `已同步 ${points.length} 个测点`,
            count: points.length,
            lastAt: Date.now(),
          },
        },
      };
    });
  },

  setSourceStatus: (sourceId, status) =>
    set((s) => ({
      sourceStatuses: {
        ...s.sourceStatuses,
        [sourceId]: status,
      },
    })),

  setBridgeCatalog: (items) =>
    set((s) => {
      const nextDefs = { ...s.externalDefs };
      for (const it of items) {
        nextDefs[it.id] = {
          id: it.id,
          name: it.name,
          unit: it.unit,
          dataSourceId: 'scada-bridge',
        };
      }
      return {
        bridgeCatalog: items,
        externalDefs: nextDefs,
        bridgeStatus: { ...s.bridgeStatus, connected: true, lastPacketAt: Date.now() },
      };
    }),

  applyBridgeAlarm: (alarm) =>
    set((s) => {
      const active = alarm.active !== false;
      const filtered = s.alarms.filter((a) => a.id !== alarm.id);
      const nextAlarms = active ? [alarm, ...filtered].slice(0, 50) : filtered;
      const nextValues = { ...s.valueMap };
      if (alarm.pointId) {
        const cur = nextValues[alarm.pointId];
        nextValues[alarm.pointId] = {
          id: alarm.pointId,
          value: cur?.value ?? null,
          quality: active ? 'BAD' : 'GOOD',
          ts: new Date().toISOString(),
        };
      }
      return {
        tickCount: s.tickCount + 1,
        alarms: nextAlarms,
        valueMap: nextValues,
        bridgeStatus: {
          ...s.bridgeStatus,
          connected: true,
          lastPacketAt: Date.now(),
          packetCount: s.bridgeStatus.packetCount + 1,
        },
      };
    }),

  syncBridgeAlarms: (alarms) =>
    set((s) => ({
      tickCount: s.tickCount + 1,
      alarms,
      bridgeStatus: {
        ...s.bridgeStatus,
        connected: true,
        lastPacketAt: Date.now(),
        packetCount: s.bridgeStatus.packetCount + 1,
      },
    })),

  markBridgeHandshake: (parentOrigin) =>
    set((s) => ({
      bridgeStatus: {
        ...s.bridgeStatus,
        connected: true,
        lastPacketAt: Date.now(),
        parentOrigin: parentOrigin ?? s.bridgeStatus.parentOrigin,
      },
    })),

  prepareForBridgeMode: () =>
    set({
      dataFeedMode: 'bridge',
      simRunning: false,
      alarms: [],
      sourceStatuses: {
        'scada-bridge': {
          status: 'connecting',
          message: '等待 SCADA 宿主推送实时数据...',
          count: 0,
          lastAt: Date.now(),
        },
      },
      bridgeStatus: {
        connected: false,
        packetCount: 0,
      },
    }),
}));
