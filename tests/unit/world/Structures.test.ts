import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { biomeAt } from '../../../src/domain/world/Biomes.ts';
import { chunkObjects } from '../../../src/domain/world/ChunkObjects.ts';
import { secondarySite } from '../../../src/domain/world/SecondaryTrack.ts';
import {
  BRIDGE_RESERVE_U,
  RIVER_HALF_U,
  bridgeSite,
  tunnelSite,
  valleyDepthU,
} from '../../../src/domain/world/Structures.ts';

const { chunkWidthU, chunksPerBiomeBlock } = gameConfig.world;
const SEEDS = [1, 7, 123, 2026, 4242];
const BLOCKS = 48;

describe('bridges and tunnels (doc 04 §6, doc 03 §8)', () => {
  it('bridges a stream in slot 4 of every block without a second track, away from the animal', () => {
    for (const seed of SEEDS)
      for (let b = 0; b < BLOCKS; b++) {
        const k = b * chunksPerBiomeBlock + 4;
        for (let s = 0; s < chunksPerBiomeBlock; s++)
          if (s !== 4)
            expect(
              bridgeSite(seed, b * chunksPerBiomeBlock + s),
            ).toBeUndefined();
        const site = bridgeSite(seed, k);
        if (secondarySite(seed, b)) {
          expect(site).toBeUndefined();
          continue;
        }
        if (b === 0) expect(site).toBeDefined();
        if (!site) continue;
        expect(site.id).toBe(`g1:chunk:${k}:bridge:0`);
        expect(bridgeSite(seed, k)).toEqual(site);
        expect(site.localXU - BRIDGE_RESERVE_U).toBeGreaterThan(0);
        expect(site.localXU + BRIDGE_RESERVE_U).toBeLessThan(chunkWidthU);
        const animal = chunkObjects(seed, k)[0]?.localXU;
        if (animal !== undefined)
          expect(Math.abs(animal - site.localXU)).toBeGreaterThan(
            BRIDGE_RESERVE_U + 64,
          );
      }
  });

  it('digs the stream a flat valley under the bridge that eases out to the side', () => {
    for (const seed of SEEDS) {
      const site = bridgeSite(seed, 4);
      if (!site) throw new Error('block 0 has a bridge');
      const x = 4 * chunkWidthU + site.localXU;
      const deepest = valleyDepthU(seed, x);
      expect(deepest).toBeGreaterThan(40);
      // Flat under the whole bridge, so its abutments stand level.
      for (let dx = -RIVER_HALF_U - 40; dx <= RIVER_HALF_U + 40; dx += 8)
        expect(valleyDepthU(seed, x + dx)).toBe(deepest);
      // Eases out, and nothing far away.
      expect(valleyDepthU(seed, x + 400)).toBe(0);
      let previous = deepest;
      for (let dx = RIVER_HALF_U + 40; dx <= 400; dx += 4) {
        const depth = valleyDepthU(seed, x + dx);
        expect(depth).toBeLessThanOrEqual(previous + 1e-9);
        expect(previous - depth).toBeLessThan(2.5);
        previous = depth;
      }
    }
  });

  it('runs a short tunnel in slot 6 of the first block and of hilly blocks more often', () => {
    const share = (biomes: readonly string[]) => {
      let blocks = 0;
      let tunnels = 0;
      for (const seed of SEEDS)
        for (let b = 1; b < BLOCKS; b++) {
          const k = b * chunksPerBiomeBlock + 6;
          if (
            secondarySite(seed, b) ||
            !biomes.includes(biomeAt(seed, k).biome)
          )
            continue;
          blocks += 1;
          if (tunnelSite(seed, k)) tunnels += 1;
        }
      return tunnels / Math.max(1, blocks);
    };
    for (const seed of SEEDS) {
      const first = tunnelSite(seed, 6);
      expect(first).toBeDefined();
      if (!first) continue;
      expect(first.id).toBe('g1:chunk:6:tunnel:0');
      expect(first.toX - first.fromX).toBeGreaterThanOrEqual(384);
      expect(first.fromX).toBeGreaterThan(64);
      expect(first.toX).toBeLessThan(chunkWidthU - 64);
      for (let s = 0; s < chunksPerBiomeBlock; s++)
        if (s !== 6) expect(tunnelSite(seed, s)).toBeUndefined();
    }
    expect(share(['mountains', 'foothills'])).toBeGreaterThan(
      share(['countryside', 'lakes', 'coast']) + 0.2,
    );
  });
});
