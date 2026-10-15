import { expect, it } from 'vitest';
import { seasonalFrame } from '../../../src/render/seasonalArt.ts';
import { worldParts } from '../../../src/content/worldArt.ts';
import {
  spatialNearPalette,
  NEAR_PALETTE,
} from '../../../src/render/groundPalette.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
it('SEA-01: real tree variants preserve pivots and conifers keep their autumn art', () => {
  for (const tree of ['oak', 'birch', 'linden', 'apple', 'plum', 'willow']) {
    const key = `tree.${tree}`;
    for (const season of ['spring', 'autumn', 'winter'] as const) {
      const frame = seasonalFrame(key, season, true, (k) => k in worldParts);
      expect(frame).toBe(
        `${key}-${season === 'winter' ? 'winter-snow' : season}`,
      );
      const parts: Readonly<
        Record<string, { pivotU: { x: number; y: number } }>
      > = worldParts;
      expect(parts[frame]?.pivotU).toEqual(parts[key]?.pivotU);
    }
  }
  expect(
    seasonalFrame('tree.pine', 'autumn', false, (k) => k in worldParts),
  ).toBe('tree.pine');
});
it('SEA-02: autumn terrain is warm rather than summer green', () => {
  let witness: { seed: number; x: number } | undefined;
  for (let seed = 1; seed < 20 && !witness; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 30; i++) {
      if (r.season === 'autumn') {
        witness = { seed, x: r.fromXU + 3000 };
        break;
      }
      r = regionAt(seed, r.toXU);
    }
  }
  if (!witness) throw new Error('missing autumn');
  expect(spatialNearPalette(witness.seed, witness.x, 'meadow')).not.toEqual(
    NEAR_PALETTE.meadow,
  );
});

it('wheel snow matches the palette on real scenery throughout incoming winter', () => {
  let witness: { seed: number; end: number } | undefined;
  for (let seed = 1; seed < 10 && !witness; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 40; i++) {
      const next = regionAt(seed, r.toXU);
      if (r.season !== 'winter' && next.season === 'winter') {
        witness = { seed, end: r.toXU };
        break;
      }
      r = next;
    }
  }
  if (!witness) throw new Error('winter transition missing');
  for (const progress of [0.1, 0.5, 0.9]) {
    const x = witness.end - 8192 + 8192 * progress;
    const k = Math.floor(x / 1024);
    const sc = chunkScenery(witness.seed, k, worldPlacementCatalog);
    const span = sc.near.find(
      (s) => x - k * 1024 >= s.fromX && x - k * 1024 < s.toX,
    );
    if (!span) throw new Error('near surface missing');
    expect(spatialNearPalette(witness.seed, x, span.style).bank).not.toBe(
      NEAR_PALETTE.meadow.bank,
    );
    expect(spatialSnowCoverage(witness.seed, x, span.style)).toBeCloseTo(
      progress,
    );
  }
  expect(spatialSnowCoverage(witness.seed, witness.end - 100, 'sand')).toBe(0);
});
import { spatialSnowCoverage } from '../../../src/render/groundPalette.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';

it('real snowy bridge approaches are snowy right up to the actual dry deck boundary', () => {
  let witness:
    { seed: number; sc: ReturnType<typeof chunkScenery> } | undefined;
  for (let seed = 1; seed < 4 && !witness; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 30 && !witness; i++) {
      if (r.season === 'winter')
        for (
          let k = Math.ceil((r.fromXU + 3000) / 1024);
          k < Math.min(r.toXU / 1024 - 10, r.fromXU / 1024 + 60);
          k++
        ) {
          const sc = chunkScenery(seed, k, worldPlacementCatalog);
          if (sc.bridge) {
            witness = { seed, sc };
            break;
          }
        }
      r = regionAt(seed, r.toXU);
    }
  }
  if (!witness?.sc.bridge) throw new Error('winter bridge missing');
  const x = witness.sc.chunkIndex * 1024 + witness.sc.bridge.localXU;
  expect(scenerySnowCoverage(witness.seed, x, witness.sc)).toBe(0);
  expect(
    scenerySnowCoverage(witness.seed, x + BRIDGE_HALF_U + 8, witness.sc),
  ).toBe(1);
});
import { scenerySnowCoverage } from '../../../src/render/groundPalette.ts';
import { BRIDGE_HALF_U } from '../../../src/domain/world/Structures.ts';
