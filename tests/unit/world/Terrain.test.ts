import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { embankmentU } from '../../../src/domain/world/Terrain.ts';

const { latticeU, maxEmbankmentU } = gameConfig.world.terrain;
const width = gameConfig.world.chunkWidthU;

describe('embankmentU: the near meadow below the track bed (doc 14 §6)', () => {
  it('is the same for the same world and place, different between worlds', () => {
    const xs = Array.from({ length: 200 }, (_, i) => -40_000 + i * 397.5);
    expect(xs.map((x) => embankmentU(5, x))).toEqual(
      xs.map((x) => embankmentU(5, x)),
    );
    expect(xs.map((x) => embankmentU(5, x))).not.toEqual(
      xs.map((x) => embankmentU(6, x)),
    );
  });

  it('stays between flat ground and the highest embankment, with variety', () => {
    const heights: number[] = [];
    for (let x = -100 * width; x < 100 * width; x += 16)
      heights.push(embankmentU(123, x));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...heights)).toBeLessThanOrEqual(maxEmbankmentU);
    // Long stretches of low and of high banks both occur.
    expect(
      heights.filter((h) => h < 0.2 * maxEmbankmentU).length,
    ).toBeGreaterThan(heights.length * 0.1);
    expect(
      heights.filter((h) => h > 0.6 * maxEmbankmentU).length,
    ).toBeGreaterThan(heights.length * 0.1);
  });

  it('is continuous and gentle everywhere, also across chunks and lattice nodes', () => {
    // Smoothstep between nodes: slope at most 1.5 × max / lattice.
    const maxSlope = (1.5 * maxEmbankmentU) / latticeU;
    for (const seed of [1, 77, 123]) {
      for (let x = -20 * width; x < 20 * width; x += 7.25) {
        const step = embankmentU(seed, x + 0.5) - embankmentU(seed, x);
        expect(Math.abs(step) / 0.5, `seed ${seed} x ${x}`).toBeLessThanOrEqual(
          maxSlope + 1e-9,
        );
      }
      for (let k = -20; k <= 20; k++) {
        const edge = k * width;
        expect(embankmentU(seed, edge - 1e-6)).toBeCloseTo(
          embankmentU(seed, edge),
          6,
        );
      }
    }
  });
});
