import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { artParts } from '../../../src/content/artManifest.ts';
import {
  TRACK_TILE_STEP_U,
  trackTileParts,
  worldParts,
} from '../../../src/content/worldArt.ts';
import {
  validateWorldArt,
  type WorldValidationInput,
} from '../../../src/content/worldValidation.ts';

const ASSETS = resolve(import.meta.dirname, '../../../assets/world');
const files = new Map(
  readdirSync(ASSETS)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => [file, readFileSync(resolve(ASSETS, file), 'utf8')]),
);
const shipped: WorldValidationInput = {
  parts: worldParts,
  files,
  usedKeys: trackTileParts,
};

describe('world art manifest (D-011)', () => {
  it('validates as shipped', () => {
    expect(validateWorldArt(shipped)).toEqual([]);
  });

  it('lays track tiles that overlap, with the rail top on the pivot', () => {
    expect(trackTileParts.length).toBeGreaterThanOrEqual(3);
    for (const key of trackTileParts) {
      const tile = worldParts[key];
      expect(tile.widthU).toBeGreaterThanOrEqual(TRACK_TILE_STEP_U + 1);
      expect(tile.pivotU.x).toBe(0);
    }
    expect(gameConfig.world.chunkWidthU % TRACK_TILE_STEP_U).toBe(0);
  });

  it('keeps world and vehicle frames apart in the shared atlas', () => {
    const vehicleKeys = new Set(Object.keys(artParts));
    expect(
      Object.keys(worldParts).filter((key) => vehicleKeys.has(key)),
    ).toEqual([]);
  });

  it('reports missing, mis-sized, stray and unused files', () => {
    const broken = new Map(files);
    broken.delete('track.tile-b.svg');
    broken.set(
      'track.tile-c.svg',
      (files.get('track.tile-c.svg') ?? '').replace(
        'viewBox="0 0 66 24"',
        'viewBox="0 0 64 24"',
      ),
    );
    broken.set('stray.svg', '<svg/>');
    expect(
      validateWorldArt({
        ...shipped,
        files: broken,
        usedKeys: ['track.tile-a', 'track.tile-b'],
      }),
    ).toEqual([
      'track.tile-b: track.tile-b.svg missing',
      'track.tile-c: track.tile-c.svg is not 66 × 24 u',
      'stray.svg: not in the manifest',
      'track.tile-c: not used',
    ]);
  });
});
