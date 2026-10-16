import { expect, it } from 'vitest';
import { worldOverlayGeometry } from '../../../src/domain/world/WorldDebugGeometry.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
it('DEV-05: overlays expose actual reservations, footprints, boundaries and world road tangents without changing layout', () => {
  let k = 0;
  for (; k < 480; k++)
    if (chunkScenery(1, k, worldPlacementCatalog).roads.length > 0) break;
  const before = chunkScenery(1, k, worldPlacementCatalog);
  const overlay = worldOverlayGeometry(1, k, worldPlacementCatalog, {
    areas: true,
    boundaries: true,
    roads: true,
  });
  for (const kind of [
    'reservation',
    'footprint',
    'scene',
    'subzone',
    'road-tangent',
  ])
    expect(
      overlay.some((p) => p.kind === kind),
      kind,
    ).toBe(true);
  expect(
    overlay.every((p) =>
      p.points.every((v) => Number.isFinite(v.xU) && Number.isFinite(v.yU)),
    ),
  ).toBe(true);
  expect(chunkScenery(1, k, worldPlacementCatalog)).toEqual(before);
  expect(
    worldOverlayGeometry(1, k, worldPlacementCatalog, {
      areas: false,
      boundaries: false,
      roads: false,
    }),
  ).toEqual([]);
});
it('DEV-05: fence footprints and planned crossing tangents are included alongside village roads', () => {
  let k = 0;
  while (
    k < 480 &&
    chunkScenery(1, k, worldPlacementCatalog).fences.length === 0
  )
    k++;
  const fence = chunkScenery(1, k, worldPlacementCatalog).fences[0];
  expect(fence).toBeDefined();
  if (!fence) return;
  expect(
    worldOverlayGeometry(1, k, worldPlacementCatalog, {
      areas: true,
      boundaries: false,
      roads: false,
    }).some((p) => p.kind === 'footprint' && p.id === fence.id),
  ).toBe(true);
  const crossing = chunkScenery(1, 3, worldPlacementCatalog).crossing;
  expect(crossing).toBeDefined();
  if (!crossing) return;
  expect(
    worldOverlayGeometry(1, 3, worldPlacementCatalog, {
      areas: false,
      boundaries: false,
      roads: true,
    }).some((p) => p.id.startsWith(crossing.id)),
  ).toBe(true);
});
