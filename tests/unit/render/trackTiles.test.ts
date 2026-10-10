import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { buildArcLengthTable } from '../../../src/domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../../../src/domain/world/TrackProfile.ts';
import { trackTilePlacements } from '../../../src/render/trackTiles.ts';

const { chunkWidthU, arcSampleSpacingU } = gameConfig.world;
const PARTS = ['track.tile-a', 'track.tile-b', 'track.tile-c'];
const table = (seed: number, k: number) =>
  buildArcLengthTable(
    generateTrackProfile(seed, k),
    k,
    chunkWidthU,
    arcSampleSpacingU,
  );

describe('trackTilePlacements (track art along the profile)', () => {
  it('lays a tile every step from the chunk start, on the rail top', () => {
    const t = table(123, 5);
    const tiles = trackTilePlacements(t, PARTS, 64);
    expect(tiles).toHaveLength(chunkWidthU / 64);
    tiles.forEach((tile, i) => {
      expect(tile.x).toBeCloseTo(i * 64, 9);
      const sample = (i * 64) / arcSampleSpacingU;
      expect(tile.y).toBeCloseTo(-(t.ys[sample] ?? Number.NaN), 9);
    });
  });

  it('turns each tile along its chord, so it ends on the next tile start', () => {
    for (const k of [0, 3, 9, 14]) {
      const tiles = trackTilePlacements(table(77, k), PARTS, 64);
      for (const [i, tile] of tiles.slice(0, -1).entries()) {
        const next = tiles[i + 1];
        if (!next) throw new Error('missing tile');
        const length = Math.hypot(next.x - tile.x, next.y - tile.y);
        expect(tile.x + length * Math.cos(tile.rotation)).toBeCloseTo(
          next.x,
          9,
        );
        expect(tile.y + length * Math.sin(tile.rotation)).toBeCloseTo(
          next.y,
          9,
        );
      }
    }
  });

  it('picks variants deterministically per chunk and mixes them', () => {
    const a = trackTilePlacements(table(1, 7), PARTS, 64).map((t) => t.part);
    const b = trackTilePlacements(table(1, 7), PARTS, 64).map((t) => t.part);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(PARTS.length);
    expect(a.every((part) => PARTS.includes(part))).toBe(true);
  });
});
