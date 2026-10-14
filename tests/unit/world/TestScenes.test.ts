import { expect, it } from 'vitest';
import {
  TEST_SCENES,
  locateTestScene,
} from '../../../src/domain/world/TestScenes.ts';
import { contextAt } from '../../../src/domain/world/WorldPlan.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it('DEV-02: all test scenes resolve within a bounded seeded search', () => {
  for (const seed of [1, 7, 123, 1226])
    for (const kind of TEST_SCENES) {
      const found = locateTestScene(seed, kind, worldPlacementCatalog);
      expect(found, `${seed}/${kind}`).toBeDefined();
      if (!found) continue;
      const context = contextAt(seed, found.worldXU);
      if (['coast', 'dunes', 'mountains', 'town'].includes(kind))
        expect(context.region.landscape).toBe(kind);
      if (kind === 'autumn' || kind === 'winter')
        expect(context.season).toBe(kind);
      if (kind === 'fishponds') expect(context.scene.templateId).toBe('pond');
      if (kind === 'forest-work')
        expect(
          chunkScenery(
            seed,
            Math.floor(found.worldXU / 1024),
            worldPlacementCatalog,
          ).props.some(
            (p) => p.layer === 'near' && p.kind === 'back.harvester',
          ),
        ).toBe(true);
      expect(found.head.chunkIndex * 1024 + found.head.arcOffsetU).toBeLessThan(
        found.worldXU,
      );
      expect(locateTestScene(seed, kind, worldPlacementCatalog)).toEqual(found);
    }
});
it('DEV-02: an exhausted or invalid bound returns without generating an unbounded route', () => {
  expect(locateTestScene(1, 'town', worldPlacementCatalog, 1)).toBeUndefined();
  expect(
    locateTestScene(1, 'tunnel', worldPlacementCatalog, 0),
  ).toBeUndefined();
});
it('DEV-02: station/pond test scenes point to actual drawn supports rather than incidental flat or hidden station overlay', () => {
  for (const seed of [1, 7, 123])
    for (const kind of ['station', 'fishponds'] as const) {
      const found = locateTestScene(seed, kind, worldPlacementCatalog);
      expect(found).toBeDefined();
      if (!found) return;
      const sc = chunkScenery(
        seed,
        Math.floor(found.worldXU / 1024),
        worldPlacementCatalog,
      );
      if (kind === 'station') expect(sc.locality).toBe('station');
      else
        expect(
          sc.props.some((p) => p.kind === 'near.pond') ||
            sc.water.some((w) => w.kind === 'pond'),
        ).toBe(true);
    }
});
