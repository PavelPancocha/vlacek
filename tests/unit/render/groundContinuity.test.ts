import { expect, it } from 'vitest';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import {
  nearGroundStrips,
  nearGroundRuns,
  nearGroundTailStrips,
} from '../../../src/render/groundLayout.ts';
import { spatialNearPalette } from '../../../src/render/groundPalette.ts';
it('GEN-23: upper ground and deep tail use identical fine samples across chunk seams', () => {
  let r = regionAt(1, 0);
  while (regionAt(1, r.toXU).landscape !== 'forest') r = regionAt(1, r.toXU);
  const start = r.toXU - 8192;
  const strips = [
    ...nearGroundStrips(1, start + 3072, start + 4096, 'meadow'),
    ...nearGroundStrips(1, start + 4096, start + 5120, 'meadow'),
  ];
  expect(strips.length).toBeGreaterThanOrEqual(128);
  const tails = nearGroundTailStrips(1, start + 3072, start + 5120, 'meadow');
  expect(tails.length).toBeLessThan(strips.length / 4);
  expect(tails[0]?.fromXU).toBe(start + 3072);
  expect(tails.at(-1)?.toXU).toBe(start + 5120);
  for (let i = 1; i < tails.length; i++)
    expect(tails[i - 1]?.toXU).toBe(tails[i]?.fromXU);
  for (const sample of strips) {
    const x = (sample.fromXU + sample.toXU) / 2;
    expect(tails.find((t) => t.fromXU <= x && x < t.toXU)?.color).toBe(
      sample.palette.bands.at(-1)?.color,
    );
  }
  for (let i = 0; i < strips.length; i++) {
    const s = strips[i];
    if (!s) throw new Error('missing strip');
    expect(s.toXU - s.fromXU).toBeLessThanOrEqual(16);
    expect(s.palette).toEqual(
      spatialNearPalette(1, (s.fromXU + s.toXU) / 2, 'meadow'),
    );
    const next = strips[i + 1];
    if (!next) continue;
    expect(s.toXU).toBe(next.fromXU);
    const a = s.palette.bands.at(-1)?.color ?? 0,
      b = next.palette.bands.at(-1)?.color ?? 0;
    for (const shift of [0, 8, 16])
      expect(
        Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)),
      ).toBeLessThanOrEqual(1);
  }
});

it('GEN-23: merging ground paths preserves every original spatial sample', () => {
  for (const start of [0, 49152, 53248, 56320, 57344]) {
    const runs = nearGroundRuns(1, start, start + 1024, 'meadow');
    for (const s of nearGroundStrips(1, start, start + 1024, 'meadow')) {
      const x = (s.fromXU + s.toXU) / 2;
      expect(runs.find((r) => r.fromXU <= x && x < r.toXU)?.palette).toEqual(
        s.palette,
      );
    }
    expect(runs[0]?.fromXU).toBe(start);
    expect(runs.at(-1)?.toXU).toBe(start + 1024);
    for (let i = 1; i < runs.length; i++)
      expect(runs[i - 1]?.toXU).toBe(runs[i]?.fromXU);
  }
  expect(nearGroundRuns(1, 0, 1024, 'meadow')).toHaveLength(1);
});
