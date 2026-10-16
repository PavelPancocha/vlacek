import { waterSectionU } from '../../../src/domain/world/SceneryGeometry.ts';
import { describe, expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import {
  validateChunkScenery,
  worldMotifCoverage,
  validateWorld,
} from '../../../src/domain/world/WorldValidation.ts';
import { WATER_MOUNTAIN_MOTIFS } from '../../../src/domain/world/WaterMountainComposition.ts';
const witnesses = [
  ['back.fishpond-sluice', 1, 285],
  ['near.fisherman', 1, 285],
  ['back.ferry', 1, 312],
  ['back.harbour-pier', 1, 312],
  ['back.harbour-quay', 1, 312],
  ['near.heather', 1, 364],
  ['near.young-pine', 1, 364],
  ['back.cutting-rock', 1, 215],
  ['back.quarry-wall', 2, 105],
  ['back.excavator', 1, 108],
  ['back.cableway-tower', 1, 100],
  ['back.water-footbridge', 1, 284],
] as const;
describe('SCN-LA/CO/DU/FH/MO water-mountains', () => {
  it.each(witnesses)(
    'positive witness %s seed=%i chunk=%i',
    (kind, seed, k) => {
      const sc = chunkScenery(seed, k, worldPlacementCatalog);
      expect(sc.props.some((p) => p.kind === kind)).toBe(true);
      expect(validateChunkScenery(seed, sc, worldPlacementCatalog)).toEqual([]);
    },
  );
  it.each(
    [1, 2, 3, 4].flatMap((seed) =>
      Array.from({ length: 60 }, (_, block) => [seed, block * 8] as const),
    ),
  )(
    'preserves all placement invariants seed=%i block=%i',
    (seed, fromChunk) => {
      const cases = Array.from({ length: 8 }, (_, i) => ({
        seed,
        scenery: chunkScenery(seed, fromChunk + i, worldPlacementCatalog),
      }));
      expect(
        validateWorld(cases, worldPlacementCatalog),
        `seed=${seed} generator=2 chunks=${fromChunk}..${fromChunk + 7}`,
      ).toEqual([]);
      for (const { scenery: sc } of cases)
        for (const water of sc.water) {
          const span = water.flowSpan;
          if (!span) continue;
          const seam = (sc.chunkIndex + 1) * 1024;
          if (span.toXU <= seam) continue;
          const context = `seed=${seed} generator=2 region=${sc.region.id} scene=${sc.scene.id} chunk=${sc.chunkIndex} seam=${seam}`;
          const next = cases
            .find((c) => c.scenery.chunkIndex === sc.chunkIndex + 1)
            ?.scenery.water.find((w) => w.id === water.id);
          expect(next, context).toBeDefined();
          if (!next) throw new Error(context);
          const section = waterSectionU(seed, sc.chunkIndex, water, 1024);
          expect(section, context).toEqual(
            waterSectionU(seed, sc.chunkIndex + 1, next, 0),
          );
          expect(section.bottomU - section.topU, context).toBeGreaterThan(0);
        }
    },
  );
  it('validator requires every motif even in an empty scan', () => {
    const counts = worldMotifCoverage([], worldPlacementCatalog);
    for (const motif of WATER_MOUNTAIN_MOTIFS) expect(counts[motif]).toBe(0);
    for (const motif of [
      'near.reed-clump',
      'tree.willow',
      'back.coast-rock',
      'near.coast-rock',
      'river-valley',
    ])
      expect(counts[motif], motif).toBe(0);
  });
});

it.each([
  ['near.fisherman', 1, 285],
  ['back.harbour-pier', 1, 312],
  ['back.excavator', 1, 108],
  ['back.ferry', 1, 312],
] as const)(
  'rejects %s after removal of its concrete support',
  (kind, seed, k) => {
    const sc = chunkScenery(seed, k, worldPlacementCatalog),
      p = sc.props.find((p) => p.kind === kind);
    if (!p) throw new Error('missing support witness');
    p.dependencies = [];
    expect(
      validateChunkScenery(seed, sc, worldPlacementCatalog).some((e) =>
        e.includes('dependency'),
      ),
    ).toBe(true);
  },
);

it.each([1, 2, 3, 4])(
  'LA01/02: each lakes region has a single three-shape dyke-separated pond group seed=%i',
  (seed) => {
    const groups = new Map<string, number[]>();
    for (let k = 0; k < 480; k++) {
      const sc = chunkScenery(seed, k, worldPlacementCatalog);
      if (sc.region.landscape !== 'lakes') continue;
      if (!groups.has(sc.region.id)) groups.set(sc.region.id, []);
      const widths = groups.get(sc.region.id);
      for (const w of sc.water.filter((w) => w.id.includes(':fishpond-group:')))
        widths?.push(w.toX - w.fromX);
    }
    expect(groups.size).toBeGreaterThan(0);
    for (const [id, widths] of groups) {
      expect(widths, id).toHaveLength(3);
      expect(new Set(widths).size, id).toBe(3);
    }
  },
);
it('LA06: rejects an enlarged ferry envelope and a fisherman moved into his pond', () => {
  const ferryScene = chunkScenery(1, 312, worldPlacementCatalog),
    ferry = ferryScene.props.find((p) => p.kind === 'back.ferry');
  if (!ferry) throw new Error('missing ferry witness');
  ferry.motion = { rangeU: 1500, speedUPerSec: 10 };
  expect(
    validateChunkScenery(1, ferryScene, worldPlacementCatalog).some((e) =>
      e.includes('ferry-envelope'),
    ),
  ).toBe(true);
  const bankScene = chunkScenery(1, 285, worldPlacementCatalog),
    fisherman = bankScene.props.find((p) => p.kind === 'near.fisherman');
  if (!fisherman) throw new Error('missing fisherman witness');
  fisherman.depth += 0.2;
  expect(
    validateChunkScenery(1, bankScene, worldPlacementCatalog).some((e) =>
      e.includes('fisherman-wet-bank'),
    ),
  ).toBe(true);
});
it('CO01 regression seed=0 chunk=326: the incoming continuous sea keeps its region-owned identity in a river scene', () => {
  const sc = chunkScenery(0, 326, worldPlacementCatalog);
  const sea = sc.water.find((w) => w.id.endsWith(':sea:0'));
  expect(sea?.kind).toBe('sea');
  expect(sc.features.find((f) => f.id === sea?.id)?.kind).toBe('sea');
});
it('LA04: the mill has a dry access path beside its own flowing race', () => {
  const sc = chunkScenery(1, 288, worldPlacementCatalog),
    mill = sc.props.find((p) => p.kind === 'back.watermill');
  if (!mill) throw new Error('missing mill witness');
  expect(sc.roads.some((r) => r.id === `${mill.id}:access`)).toBe(true);
});
it('LA02: the planned river valley continues across both chunks and carries the ferry away from the track bridge', () => {
  const first = chunkScenery(1, 292, worldPlacementCatalog),
    second = chunkScenery(1, 293, worldPlacementCatalog);
  const a = first.water.find((w) => w.kind === 'channel'),
    b = second.water.find((w) => w.kind === 'channel');
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  expect(a?.id).toBe(b?.id);
  if (!a || !b) throw new Error('missing river seam');
  expect(waterSectionU(1, 292, a, 1024)).toEqual(waterSectionU(1, 293, b, 0));
  expect(second.props.some((p) => p.kind === 'back.ferry')).toBe(true);
});
