import { describe, expect, it } from 'vitest';
import { regionAt } from '../../../src/domain/world/Regions.ts';

describe('GEN-13 region plans', () => {
  it('groups 3–7 complete blocks and supports negative random access', () => {
    for (const seed of [0, 1, 7, 123, 0xffffffff])
      for (const x of [-1000000, -1, 0, 8192, 1000000]) {
        const r = regionAt(seed, x);
        expect(r.fromXU).toBeLessThanOrEqual(x);
        expect(r.toXU).toBeGreaterThan(x);
        expect((r.toXU - r.fromXU) / 8192).toBeGreaterThanOrEqual(3);
        expect((r.toXU - r.fromXU) / 8192).toBeLessThanOrEqual(7);
        expect(regionAt(seed, r.toXU - 1).id).toBe(r.id);
      }
  });
  it('visits town and dry Czech dunes without losing the six landscapes', () => {
    const seen = new Set(
      Array.from({ length: 480 }, (_, k) => regionAt(7, k * 1024).landscape),
    );
    expect([...seen].sort()).toEqual([
      'coast',
      'countryside',
      'dunes',
      'foothills',
      'forest',
      'lakes',
      'mountains',
      'town',
    ]);
  });
});

it('GEN-13: both season and weather presets stay identical across each 2–3-region group', () => {
  for (const seed of [1, 7, 83, 4242]) {
    let region = regionAt(seed, 0);
    const seen = new Map<number, string>();
    for (let i = 0; i < 24; i++) {
      const index = region.index,
        period = Math.floor(index / 5),
        start = period * 5 + (index - period * 5 >= 2 ? 2 : 0);
      const preset = `${region.season}/${region.weather}`,
        previous = seen.get(start);
      if (previous !== undefined)
        expect(preset, `${seed}/${region.id}`).toBe(previous);
      seen.set(start, preset);
      region = regionAt(seed, region.toXU);
    }
  }
});
