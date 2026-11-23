import { useSyncExternalStore } from 'react';
import { POINT_DEFS, POINT_DEFS_BY_ID, type PointDef, type PointValue } from './points';
import {
  SNAPSHOT_ORDER,
  SNAPSHOTS,
  type SnapshotId,
  type SnapshotMeta,
} from './snapshots';
import { TOPOLOGY_BY_TAG, type TopologyNode } from './topology';

export type PlantCursorState = {
  index: number;
  snapshotId: SnapshotId;
  selectedTag: string | null;
};

type Listener = () => void;

let state: PlantCursorState = {
  index: 0,
  snapshotId: 'canvas',
  selectedTag: null,
};

const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getPlantCursor(): PlantCursorState {
  return state;
}

export function subscribePlantCursor(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSnapshotById(snapshotId: SnapshotId): void {
  const index = SNAPSHOT_ORDER.indexOf(snapshotId);
  if (index < 0) return;
  state = { ...state, index, snapshotId };
  emit();
}

export function setCursorIndex(index: number): void {
  const clamped = Math.max(0, Math.min(SNAPSHOT_ORDER.length - 1, index));
  state = {
    ...state,
    index: clamped,
    snapshotId: SNAPSHOT_ORDER[clamped],
  };
  emit();
}

export function setSelectedTag(tag: string | null): void {
  state = { ...state, selectedTag: tag };
  emit();
}

export function getActiveSnapshot(): SnapshotMeta {
  return SNAPSHOTS[state.snapshotId];
}

export function getActiveValues(): PointValue[] {
  return getActiveSnapshot().values;
}

export function getActiveValueMap(): Map<string, PointValue> {
  return new Map(getActiveValues().map((v) => [v.id, v]));
}

export function getPointDef(id: string): PointDef | undefined {
  return POINT_DEFS_BY_ID.get(id);
}

export function getAllPointDefs(): PointDef[] {
  return POINT_DEFS;
}

export function getNode(tag: string): TopologyNode | undefined {
  return TOPOLOGY_BY_TAG.get(tag);
}

export function usePlantCursor(): PlantCursorState {
  return useSyncExternalStore(subscribePlantCursor, getPlantCursor, getPlantCursor);
}

export function useActiveSnapshot(): SnapshotMeta {
  const cursor = usePlantCursor();
  return SNAPSHOTS[cursor.snapshotId];
}
