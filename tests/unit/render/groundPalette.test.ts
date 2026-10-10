import { describe, expect, it } from 'vitest';
import {
  NEAR_PALETTE,
  blendNearPalette,
  type NearPalette,
} from '../../../src/render/groundPalette.ts';

/** Colour of a palette's meadow at an offset below the bank foot. */
function colourAt(palette: NearPalette, u: number): number {
  let colour = palette.bands[0]?.color ?? 0;
  for (const band of palette.bands) if (band.fromU <= u) colour = band.color;
  return colour;
}

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('near ground blend (soft style edges)', () => {
  const { meadow, forest } = NEAR_PALETTE;
  const offsets = [0, 10, 24, 30, 60, 100, 150, 200, 300];

  it('starts as the left palette and ends as the right one', () => {
    for (const u of offsets) {
      expect(colourAt(blendNearPalette(meadow, forest, 0), u)).toBe(
        colourAt(meadow, u),
      );
      expect(colourAt(blendNearPalette(meadow, forest, 1), u)).toBe(
        colourAt(forest, u),
      );
    }
    expect(blendNearPalette(meadow, forest, 1).bank).toBe(forest.bank);
  });

  it('colours each offset between the two palettes, cut at both band sets', () => {
    const half = blendNearPalette(NEAR_PALETTE.snow, forest, 0.5);
    for (const u of offsets) {
      const a = channels(colourAt(NEAR_PALETTE.snow, u));
      const b = channels(colourAt(forest, u));
      channels(colourAt(half, u)).forEach((value, i) =>
        expect(
          Math.abs(value - ((a[i] ?? 0) + (b[i] ?? 0)) / 2),
        ).toBeLessThanOrEqual(1),
      );
    }
    const cuts = half.bands.map((band) => band.fromU);
    expect(cuts).toEqual([...cuts].sort((x, y) => x - y));
    expect(new Set(cuts).size).toBe(cuts.length);
  });
});
