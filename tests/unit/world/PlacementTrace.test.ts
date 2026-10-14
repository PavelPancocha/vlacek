import { expect, it } from 'vitest';
import { traceChunkPlacement } from '../../../src/domain/world/PlacementTrace.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it('DEV-04: on-demand trace explains candidates/admissible kinds/rejections and consumes no layout RNG', () => {
  const before = chunkScenery(83, 19, worldPlacementCatalog);
  const trace = traceChunkPlacement(83, 19, worldPlacementCatalog);
  expect(trace.length).toBeGreaterThan(0);
  expect(
    trace.some(
      (t) =>
        t.rejectionCode === 'collision' &&
        t.conflictingReservation !== undefined,
    ),
  ).toBe(true);
  expect(
    trace.every((t) =>
      t.candidate.kind === undefined
        ? t.rejectionCode !== 'accepted'
        : t.admissible.includes(t.candidate.kind),
    ),
  ).toBe(true);
  expect(chunkScenery(83, 19, worldPlacementCatalog)).toEqual(before);
  const survivor = before.props[0];
  if (!survivor) throw new Error('empty trace fixture');
  expect(
    traceChunkPlacement(83, 19, worldPlacementCatalog, survivor.id).some(
      (t) => t.rejectionCode === 'accepted',
    ),
  ).toBe(true);
  expect(
    traceChunkPlacement(83, 19, worldPlacementCatalog, 19 * 1024 + 512).every(
      (t) => Math.abs(t.candidate.worldXU - (19 * 1024 + 512)) <= 128,
    ),
  ).toBe(true);
});
it('DEV-04: missing water dependency is visible without constructing an orphan boat', () => {
  let trace = traceChunkPlacement(1, 0, worldPlacementCatalog);
  for (
    let k = 1;
    k < 480 && !trace.some((t) => t.rejectionCode === 'missing-dependency');
    k++
  )
    trace = traceChunkPlacement(1, k, worldPlacementCatalog);
  expect(trace.some((t) => t.rejectionCode === 'missing-dependency')).toBe(
    true,
  );
});
it('DEV-04: station children also expose their placement trace by exact id', () => {
  const sc = chunkScenery(1, 1, worldPlacementCatalog),
    station = sc.props.find((p) => p.kind === 'back.station');
  expect(station).toBeDefined();
  if (!station) return;
  expect(
    traceChunkPlacement(1, 1, worldPlacementCatalog, station.id).some(
      (t) => t.rejectionCode === 'accepted',
    ),
  ).toBe(true);
});
import { placementQuery } from '../../../src/domain/world/PlacementTrace.ts';
it('DEV-04: untrusted place/id query is bounded before rebuilding a chunk', () => {
  expect(placementQuery('', 512)).toEqual({ chunkIndex: 0, query: 512 });
  expect(placementQuery('-512', 0)).toEqual({ chunkIndex: -1, query: -512 });
  expect(
    placementQuery('g2:chunk:19:prop:rule:1:candidate:0', 0)?.chunkIndex,
  ).toBe(19);
  for (const input of [
    'Infinity',
    'NaN',
    '1e100',
    'not-an-id',
    'g2:chunk:999999999999999999999:prop:1',
    `g2:chunk:${Number.MAX_SAFE_INTEGER}:prop:1`,
  ])
    expect(placementQuery(input, 512)).toBeUndefined();
});
it('DEV-04: rejected spacing and protected-animal candidates remain visible in the trace', () => {
  const trace = traceChunkPlacement(83, 19, worldPlacementCatalog);
  expect(
    trace.some(
      (t) =>
        t.rejectionCode === 'spacing' || t.rejectionCode === 'animal-clearance',
    ),
  ).toBe(true);
});
it('DEV-04: a collision does not report an already satisfied dependency as missing', () => {
  const trace = traceChunkPlacement(1, 30, worldPlacementCatalog);
  const collisions = trace.filter((t) => t.rejectionCode === 'collision');
  expect(collisions.length).toBeGreaterThan(0);
  expect(collisions.every((t) => t.missingDependency === undefined)).toBe(true);
});
