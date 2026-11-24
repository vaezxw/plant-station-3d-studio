import { create } from 'zustand';
import { POINT_DEFS, type PointDef, type PointValue } from '../data/points';
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

type TelemetryState = {
  simRunning: boolean;
  snapshotId: SnapshotId;
  tickCount: number;
  valueMap: Record<string, PointValue>;
  history: TrendSample[];
  alarms: AlarmRecord[];
  meterStats: {
    dailyOutput: number;
    passRate: number;
    leakTestOk: number;
    calibrating: number;
  };

  toggleSim: () => void;
  setSnapshot: (id: SnapshotId) => void;
  stepSimulation: () => void;
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

export const POINT_CATALOG: readonly PointDef[] = POINT_DEFS;

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  simRunning: true,
  snapshotId: 'runtime',
  tickCount: 0,
  valueMap: initialValues('runtime'),
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

  toggleSim: () => set((s) => ({ simRunning: !s.simRunning })),

  setSnapshot: (snapshotId) =>
    set({
      snapshotId,
      valueMap: initialValues(snapshotId),
      tickCount: 0,
    }),

  stepSimulation: () => {
    const { simRunning, tickCount, valueMap, history, meterStats } = get();
    if (!simRunning) return;
    const t = tickCount + 1;
    const next: Record<string, PointValue> = {};
    for (const [id, pv] of Object.entries(valueMap)) {
      if (pv.value == null || pv.quality !== 'GOOD') {
        next[id] = pv;
        continue;
      }
      const def = POINT_DEFS.find((d) => d.id === id);
      if (def?.kind === 'cumulative') {
        next[id] = { ...pv, value: Number((pv.value + 0.35).toFixed(2)) };
      } else if (def?.kind === 'instant') {
        const wave = Math.sin(t * 0.45 + id.length) * (pv.value * 0.008);
        next[id] = { ...pv, value: Number((pv.value + wave).toFixed(2)) };
      } else {
        next[id] = pv;
      }
    }

    const p = next['HG-UF-101.pressure']?.value ?? 4676;
    const f = next['HG-UF-101.flowWork']?.value ?? 124;
    const d = new Date();
    const label = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const nextHistory = [...history.slice(-19), { label, pressure: p, flow: f }];

    const bump = t % 3 === 0 ? 1 : 0;
    set({
      tickCount: t,
      valueMap: next,
      history: nextHistory,
      meterStats: {
        ...meterStats,
        dailyOutput: meterStats.dailyOutput + bump,
        leakTestOk: meterStats.leakTestOk + bump,
      },
    });
  },
}));
