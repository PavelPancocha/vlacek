import { expect, it } from 'vitest';
import {
  buildArcLengthTable,
  sampleArcLengthTable,
} from '../../../src/domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../../../src/domain/world/TrackProfile.ts';
import {
  TEST_SCENES,
  locateTestScene,
} from '../../../src/domain/world/TestScenes.ts';
import { contextAt } from '../../../src/domain/world/WorldPlan.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it('DEV-02: test scenes resolve within a bounded search of seeds with suitable spans', () => {
  for (const kind of TEST_SCENES)
    for (const seed of [1, 7, 123, 1226]) {
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
      const cursorApproxXU =
        found.head.chunkIndex * 1024 + found.head.arcOffsetU;
      if (kind === 'halt' || kind === 'large-station' || kind === 'big-station')
        expect(cursorApproxXU).toBe(found.worldXU);
      else if (kind === 'highway') {
        const k = found.head.chunkIndex;
        const table = buildArcLengthTable(
          generateTrackProfile(seed, k),
          k,
          1024,
          8,
        );
        expect(
          sampleArcLengthTable(table, found.head.arcOffsetU).x,
        ).toBeCloseTo(found.worldXU + 140, 8);
      } else expect(cursorApproxXU).toBeLessThan(found.worldXU);
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

it('SCN-RD08/DEV-02: highway locator uses the unowned approach after the guaranteed village', () => {
  const highway = locateTestScene(1, 'highway', worldPlacementCatalog);
  expect(highway?.worldXU).toBe(16896);
  expect(highway?.head.chunkIndex).toBe(16);
  expect(locateTestScene(123, 'highway', worldPlacementCatalog)).toBeDefined();
});
