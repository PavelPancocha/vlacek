import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { biomeAt } from '../../../src/domain/world/Biomes.ts';
import {
  PORTAL_HILL_U,
  SECONDARY_CLEAR_DEPTH,
  SecondaryLine,
  secondaryClearRanges,
  secondarySite,
  secondarySiteOfChunk,
} from '../../../src/domain/world/SecondaryTrack.ts';
import {
  generateTrackProfile,
  profileHeightU,
} from '../../../src/domain/world/TrackProfile.ts';

const {
  chunkWidthU,
  chunksPerBiomeBlock,
  secondaryTrackOffsetU,
  forcedSecondaryBiomeBlock,
} = gameConfig.world;
const SEEDS = [1, 7, 123, 2026, 4242];

describe('second track (doc 04 §6–7)', () => {
  it('takes slots 4–6 of the forced block and about a third of the others, never the first', () => {
    let blocks = 0;
    let found = 0;
    for (const seed of SEEDS) {
      expect(secondarySite(seed, 0)).toBeUndefined();
      const forced = secondarySite(seed, forcedSecondaryBiomeBlock);
      expect(forced).toBeDefined();
      for (let b = 2; b < 62; b++) {
        blocks += 1;
        const site = secondarySite(seed, b);
        if (!site) continue;
        found += 1;
        expect(site.id).toBe(`g1:block:${b}:secondary:0`);
        const first = b * chunksPerBiomeBlock + 4;
        expect(site.fromX).toBe(first * chunkWidthU);
        expect(site.toX).toBe((first + 3) * chunkWidthU);
        expect(secondarySite(seed, b)).toEqual(site);
      }
    }
    expect(found / blocks).toBeGreaterThan(0.22);
    expect(found / blocks).toBeLessThan(0.45);
  });

  it('belongs to the chunks of its visible stretch only', () => {
    for (const seed of SEEDS)
      for (let k = 0; k < 160; k++) {
        const site = secondarySiteOfChunk(seed, k);
        const place = biomeAt(seed, k);
        if (!site) continue;
        expect([4, 5, 6]).toContain(place.slot);
        expect(site).toEqual(secondarySite(seed, place.block));
      }
  });

  it('runs parallel to the main track, 64 u deeper, with hidden ends beyond its visible stretch', () => {
    for (const seed of SEEDS) {
      const site = secondarySite(seed, forcedSecondaryBiomeBlock);
      if (!site) throw new Error('no forced site');
      const hidden = 1500;
      const line = new SecondaryLine(seed, site, hidden);
      expect(line.sAtX(site.fromX - hidden)).toBeCloseTo(line.startS, 6);
      expect(line.sAtX(site.toX + hidden)).toBeCloseTo(line.endS, 6);
      for (let s = line.startS; s <= line.endS; s += 37) {
        const point = line.sample(s);
        const k = Math.floor(point.x / chunkWidthU);
        const main = profileHeightU(
          generateTrackProfile(seed, k),
          point.x - k * chunkWidthU,
        );
        expect(Math.abs(point.y - main - secondaryTrackOffsetU)).toBeLessThan(
          0.5,
        );
      }
    }
  });

  it('keeps its band and both portal hills clear of near back scenery', () => {
    const seed = 123;
    const site = secondarySite(seed, forcedSecondaryBiomeBlock);
    if (!site) throw new Error('no forced site');
    const world: { fromX: number; toX: number }[] = [];
    const block = forcedSecondaryBiomeBlock * chunksPerBiomeBlock;
    for (let k = block; k < block + chunksPerBiomeBlock; k++)
      for (const range of secondaryClearRanges(seed, k))
        world.push({
          fromX: k * chunkWidthU + range.fromX,
          toX: k * chunkWidthU + range.toX,
        });
    // One stretch from the left hill to the right hill, split by chunks.
    expect(world[0]?.fromX).toBe(site.fromX - PORTAL_HILL_U);
    expect(world.at(-1)?.toX).toBe(site.toX + PORTAL_HILL_U);
    for (let i = 1; i < world.length; i++)
      expect(world[i]?.fromX).toBe(world[i - 1]?.toX);
    // The second track lies inside the clear band (64 u of 220 u).
    expect(SECONDARY_CLEAR_DEPTH).toBeGreaterThan(secondaryTrackOffsetU / 220);
    expect(PORTAL_HILL_U).toBeGreaterThan(220);
  });
});
