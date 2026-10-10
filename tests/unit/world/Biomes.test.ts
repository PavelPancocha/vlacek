import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { BIOMES, biomeAt } from '../../../src/domain/world/Biomes.ts';

const { chunksPerBiomeBlock, blocksPerRouteCycle } = gameConfig.world;

describe('biomeAt: the route grammar of doc 04 §5', () => {
  it('starts every cycle in the countryside and visits all six biomes', () => {
    for (const seed of [1, 7, 123, 99_999]) {
      for (let cycle = -3; cycle < 12; cycle++) {
        const first = cycle * blocksPerRouteCycle * chunksPerBiomeBlock;
        expect(biomeAt(seed, first).biome).toBe('countryside');
        const seen = new Set(
          Array.from(
            { length: blocksPerRouteCycle },
            (_, b) => biomeAt(seed, first + b * chunksPerBiomeBlock).biome,
          ),
        );
        expect([...seen].sort()).toEqual([...BIOMES].sort());
      }
    }
  });

  it('keeps one biome per block and names slot, block and the next biome', () => {
    for (let k = -100; k < 300; k++) {
      const place = biomeAt(5, k);
      const block = Math.floor(k / chunksPerBiomeBlock);
      expect(place.block).toBe(block);
      expect(place.slot).toBe(k - block * chunksPerBiomeBlock);
      expect(place.biome).toBe(biomeAt(5, block * chunksPerBiomeBlock).biome);
      expect(place.next).toBe(
        biomeAt(5, (block + 1) * chunksPerBiomeBlock).biome,
      );
    }
  });

  it('only follows a biome with one it blends into (no snow straight to beach)', () => {
    const neighbours: Record<string, readonly string[]> = {
      countryside: ['forest', 'lakes'],
      forest: ['foothills', 'lakes'],
      lakes: ['coast', 'forest', 'foothills', 'countryside'],
      foothills: ['mountains', 'lakes', 'countryside'],
      mountains: ['foothills'],
      coast: ['lakes'],
    };
    for (let k = -2000; k < 2000; k += chunksPerBiomeBlock) {
      const place = biomeAt(42, k);
      if (place.next === place.biome) continue;
      expect(
        neighbours[place.biome],
        `${place.biome} → ${place.next}`,
      ).toContain(place.next);
    }
  });

  it('chooses the itinerary per cycle from the seed', () => {
    const route = (seed: number, cycle: number) =>
      Array.from(
        { length: blocksPerRouteCycle },
        (_, b) =>
          biomeAt(seed, (cycle * blocksPerRouteCycle + b) * chunksPerBiomeBlock)
            .biome,
      ).join(' ');
    const routes = new Set<string>();
    for (let cycle = 0; cycle < 40; cycle++) routes.add(route(3, cycle));
    expect(routes.size).toBe(3);
    expect(route(3, 5)).toBe(route(3, 5));
  });
});
