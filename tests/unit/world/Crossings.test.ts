import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { biomeAt } from '../../../src/domain/world/Biomes.ts';
import { chunkObjects } from '../../../src/domain/world/ChunkObjects.ts';
import {
  CROSSING_RESERVE_U,
  crossingSite,
} from '../../../src/domain/world/Crossings.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import {
  generateTrackProfile,
  profileGrade,
} from '../../../src/domain/world/TrackProfile.ts';

const { chunksPerBiomeBlock } = gameConfig.world;
const SEEDS = [1, 7, 123, 4242, 2026];
const BLOCKS = Array.from({ length: 24 }, (_, i) => i - 4);

describe('crossingSite: one level crossing per block (doc 04 §6, doc 05 §4)', () => {
  it('sits only in slot 3, at most once per block, with a stable id', () => {
    let blocks = 0;
    let found = 0;
    for (const seed of SEEDS)
      for (const b of BLOCKS) {
        blocks += 1;
        const sites = Array.from({ length: chunksPerBiomeBlock }, (_, s) =>
          crossingSite(seed, b * chunksPerBiomeBlock + s),
        ).filter((site) => site !== undefined);
        expect(sites.length).toBeLessThanOrEqual(1);
        for (const site of sites) {
          found += 1;
          expect(biomeAt(seed, site.chunkIndex).slot).toBe(3);
          expect(site.id).toBe(`g1:chunk:${site.chunkIndex}:crossing:0`);
          expect(crossingSite(seed, site.chunkIndex)).toEqual(site);
        }
      }
    // Straight stretches are common: most blocks get their crossing.
    expect(found / blocks).toBeGreaterThan(0.7);
  });

  it('crosses a straight piece of track, away from the interactive animal', () => {
    for (const seed of SEEDS)
      for (const b of BLOCKS) {
        const k = b * chunksPerBiomeBlock + 3;
        const site = crossingSite(seed, k);
        if (!site) continue;
        const profile = generateTrackProfile(seed, k);
        const grade = profileGrade(profile, site.localXU);
        for (let dx = -96; dx <= 96; dx += 16)
          expect(
            Math.abs(profileGrade(profile, site.localXU + dx) - grade),
          ).toBeLessThan(1e-12);
        const animal = chunkObjects(seed, k)[0]?.localXU ?? -1e9;
        expect(Math.abs(animal - site.localXU)).toBeGreaterThanOrEqual(120);
      }
  });

  it('keeps the road strip clear of water and scenery', () => {
    let checked = 0;
    for (const seed of SEEDS)
      for (const b of BLOCKS) {
        const k = b * chunksPerBiomeBlock + 3;
        const site = crossingSite(seed, k);
        if (!site) continue;
        const scenery = chunkScenery(seed, k);
        expect(scenery.crossing?.localXU).toBe(site.localXU);
        // Water splits around the road like a causeway.
        for (const basin of scenery.water)
          expect(
            basin.toX <= site.localXU - CROSSING_RESERVE_U ||
              basin.fromX >= site.localXU + CROSSING_RESERVE_U,
          ).toBe(true);
        for (const prop of scenery.props)
          expect(
            Math.abs(prop.xU - site.localXU),
            `${scenery.locality}: ${prop.kind}`,
          ).toBeGreaterThanOrEqual(CROSSING_RESERVE_U);
        checked += 1;
      }
    expect(checked).toBeGreaterThan(50);
  });
});
