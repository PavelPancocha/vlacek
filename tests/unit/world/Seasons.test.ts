import { expect, it } from 'vitest';
import { effectiveClimateAt } from '../../../src/domain/world/Seasons.ts';
import {
  regionAt,
  REGION_TRANSITION_U,
} from '../../../src/domain/world/Regions.ts';

it('SEA-02: winter-to-autumn uses the exact continuous world-core progress', () => {
  let witnesses = 0;
  for (let seed = 1; seed < 40; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 36; i++) {
      const next = regionAt(seed, r.toXU);
      if (r.season === 'winter' && next.season === 'autumn') {
        for (const p of [0, 0.25, 0.5, 0.75, 0.999]) {
          const x = r.toXU - REGION_TRANSITION_U * (1 - p);
          const c = effectiveClimateAt(seed, x);
          expect(c.winter).toBeCloseTo(1 - p);
          expect(c.autumn).toBeCloseTo(p);
          expect(effectiveClimateAt(seed, x)).toEqual(c);
        }
        witnesses++;
      }
      r = next;
    }
  }
  expect(witnesses).toBeGreaterThan(0);
});

it('SEA-01: every inland landscape witnesses all seasons; coast and dunes stay summer', () => {
  const found = new Set<string>();
  for (let seed = 1; seed < 30; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 60; i++) {
      const c = effectiveClimateAt(seed, r.fromXU + 1024);
      found.add(`${r.landscape}/${c.season}`);
      if (r.landscape === 'coast' || r.landscape === 'dunes')
        expect(c.season).toBe('summer');
      expect(c.spring + c.summer + c.autumn + c.winter).toBeCloseTo(1);
      r = regionAt(seed, r.toXU);
    }
  }
  for (const landscape of ['forest', 'countryside', 'town'])
    for (const season of ['spring', 'summer', 'autumn', 'winter'])
      expect(found.has(`${landscape}/${season}`)).toBe(true);
});
