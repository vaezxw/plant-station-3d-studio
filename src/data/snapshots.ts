import type { PointValue } from './points';
import canvasSnapshot from './snapshots/snapshot-canvas.json';
import runtimeSnapshot from './snapshots/snapshot-runtime.json';

export type SnapshotId = 'canvas' | 'runtime';

export type SnapshotMeta = {
  id: SnapshotId;
  label: string;
  storyTime: string;
  source: string;
  notSameMomentAs: SnapshotId;
  notes: string[];
  presentation: Record<string, unknown>;
  values: PointValue[];
};

export const SNAPSHOTS: Record<SnapshotId, SnapshotMeta> = {
  canvas: canvasSnapshot as SnapshotMeta,
  runtime: runtimeSnapshot as SnapshotMeta,
};

export const SNAPSHOT_ORDER: SnapshotId[] = ['canvas', 'runtime'];

export function getSnapshot(id: SnapshotId): SnapshotMeta {
  return SNAPSHOTS[id];
}

export function assertSnapshotsNotSameMoment(): void {
  const a = SNAPSHOTS.canvas.storyTime;
  const b = SNAPSHOTS.runtime.storyTime;
  if (a === b) {
    throw new Error(`canvas/runtime storyTime must differ, both=${a}`);
  }
  if (SNAPSHOTS.canvas.notSameMomentAs !== 'runtime') {
    throw new Error('canvas.notSameMomentAs must be runtime');
  }
  if (SNAPSHOTS.runtime.notSameMomentAs !== 'canvas') {
    throw new Error('runtime.notSameMomentAs must be canvas');
  }
}
