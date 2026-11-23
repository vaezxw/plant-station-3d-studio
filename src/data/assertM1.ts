/**
 * Pure M1 assertions: bad quality, units present, asymmetric topology, distinct story times.
 * Run via: npm run assert:m1
 */
import {
  ASYMMETRIC_ELSTER_TAIL_TAG,
  ASYMMETRIC_WEISI_TAIL_TAG,
  TOPOLOGY_BY_TAG,
  TOPOLOGY_NODES,
} from './topology';
import { POINT_DEFS, openingDrivesGeometry, type PointValue } from './points';
import { SNAPSHOTS, assertSnapshotsNotSameMoment } from './snapshots';

function fail(msg: string): never {
  throw new Error(`[assert:m1] ${msg}`);
}

function assertAsymmetry(): void {
  const weisiTail = TOPOLOGY_BY_TAG.get(ASYMMETRIC_WEISI_TAIL_TAG);
  const elsterTail = TOPOLOGY_BY_TAG.get(ASYMMETRIC_ELSTER_TAIL_TAG);
  if (!weisiTail) fail(`missing ${ASYMMETRIC_WEISI_TAIL_TAG}`);
  if (!elsterTail) fail(`missing ${ASYMMETRIC_ELSTER_TAIL_TAG}`);
  if (weisiTail.kind !== 'MOV') {
    fail(`${ASYMMETRIC_WEISI_TAIL_TAG} must stay MOV (got ${weisiTail.kind})`);
  }
  if (elsterTail.kind !== 'PV') {
    fail(`${ASYMMETRIC_ELSTER_TAIL_TAG} must stay PV (got ${elsterTail.kind})`);
  }

  const weisiKinds = TOPOLOGY_NODES.filter((n) => n.lane === 'weisi').map((n) => n.kind);
  const elsterKinds = TOPOLOGY_NODES.filter((n) => n.lane === 'elster').map((n) => n.kind);
  if (weisiKinds.join(',') === elsterKinds.join(',')) {
    fail('weisi/elster kind sequences must not be identical (do not symmetrize)');
  }
}

function assertPointUnits(): void {
  for (const def of POINT_DEFS) {
    if (def.kind === 'status') continue;
    if (def.unit === undefined) fail(`point ${def.id} missing unit field`);
    if (def.name.trim() === '') fail(`point ${def.id} missing name`);
  }
  const instant = POINT_DEFS.filter((d) => d.kind === 'instant');
  const cumulative = POINT_DEFS.filter((d) => d.kind === 'cumulative');
  if (instant.length === 0) fail('no instant points');
  if (cumulative.length === 0) fail('no cumulative points');
}

function assertCanvasBadPoints(): void {
  const byId = new Map(SNAPSHOTS.canvas.values.map((v) => [v.id, v]));
  const v7 = byId.get('valve.7.opening');
  const v8 = byId.get('valve.8.opening');
  if (!v7) fail('canvas missing valve.7.opening');
  if (!v8) fail('canvas missing valve.8.opening');
  if (v7.value !== -0.75) fail(`valve.7 expected -0.75, got ${v7.value}`);
  if (v7.quality !== 'BAD') fail(`valve.7 quality must be BAD, got ${v7.quality}`);
  if (v8.value !== null) fail('valve.8 value must be null, not a fake number');
  if (v8.quality !== 'NODATA') fail(`valve.8 quality must be NODATA, got ${v8.quality}`);
  if (openingDrivesGeometry(v7)) fail('BAD -0.75 must not drive geometry');
  if (openingDrivesGeometry(v8)) fail('NODATA must not drive geometry');
}

function assertValueShapes(values: PointValue[]): void {
  for (const v of values) {
    if (!POINT_DEFS.some((d) => d.id === v.id)) fail(`snapshot value unknown id ${v.id}`);
    if (!v.ts) fail(`value ${v.id} missing ts`);
    if (!v.quality) fail(`value ${v.id} missing quality`);
  }
}

export function runM1Assertions(): void {
  assertAsymmetry();
  assertPointUnits();
  assertSnapshotsNotSameMoment();
  assertCanvasBadPoints();
  assertValueShapes(SNAPSHOTS.canvas.values);
  assertValueShapes(SNAPSHOTS.runtime.values);

  const tags = new Set(TOPOLOGY_NODES.map((n) => n.tag));
  for (const required of [
    'HG-UF-101',
    'HG-UF-102',
    'HG-MOV10122',
    'HG-MOV10225',
    'HG-PV10215',
    'HG-HOV10312',
  ]) {
    if (!tags.has(required)) fail(`topology missing required tag ${required}`);
  }

  console.log('[assert:m1] ok', {
    nodes: TOPOLOGY_NODES.length,
    points: POINT_DEFS.length,
    canvasStory: SNAPSHOTS.canvas.storyTime,
    runtimeStory: SNAPSHOTS.runtime.storyTime,
  });
}

runM1Assertions();
