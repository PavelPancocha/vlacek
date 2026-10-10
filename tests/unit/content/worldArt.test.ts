import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { artParts } from '../../../src/content/artManifest.ts';
import {
  TRACK_TILE_STEP_U,
  animalParts,
  trackTileSets,
  worldParts,
} from '../../../src/content/worldArt.ts';
import { worldUsedKeys } from '../../../src/content/worldArtUsage.ts';
import {
  ANIMAL_HOP_U,
  ANIMAL_SCALE,
  DEFAULT_ANIMAL_DEPTH,
  NEAR_DEPTH_RANGE_U,
  NEAR_PROP_MAX_HEIGHT_U,
  nearDepthScale,
  STATION_KINDS,
} from '../../../src/domain/world/Scenery.ts';
import { LOCALITIES } from '../../../src/domain/world/sceneryTemplates.ts';
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
  usedKeys: worldUsedKeys(),
};
const parts: Record<string, { heightU: number } | undefined> = worldParts;

describe('world art manifest (D-011)', () => {
  it('validates as shipped', () => {
    expect(validateWorldArt(shipped)).toEqual([]);
  });

  it('lays track tiles that overlap, with the rail top on the pivot', () => {
    for (const tiles of Object.values(trackTileSets))
      expect(tiles.length).toBeGreaterThanOrEqual(2);
    for (const key of Object.values(trackTileSets).flat()) {
      const tile = worldParts[key];
      expect(tile.widthU).toBeGreaterThanOrEqual(TRACK_TILE_STEP_U + 1);
      expect(tile.pivotU.x).toBe(0);
    }
    expect(gameConfig.world.chunkWidthU % TRACK_TILE_STEP_U).toBe(0);
  });

  it('has art for every kind the world generator places', () => {
    const kinds = new Set([
      ...LOCALITIES.flatMap((t) => t.rules.flatMap((rule) => rule.kinds)),
      ...STATION_KINDS,
    ]);
    expect([...kinds].filter((kind) => parts[kind] === undefined)).toEqual([]);
  });

  it('keeps near-meadow props low enough never to hide the train (doc 14 §5)', () => {
    for (const rule of LOCALITIES.flatMap((t) => t.rules)) {
      if (rule.layer !== 'near') continue;
      // Height and allowance are both linear in depth: check both ends.
      for (const depth of rule.depth) {
        const allowed = NEAR_PROP_MAX_HEIGHT_U + depth * NEAR_DEPTH_RANGE_U;
        for (const kind of rule.kinds)
          expect(
            (parts[kind]?.heightU ?? Infinity) *
              (rule.scale?.[1] ?? 1.08) *
              nearDepthScale(depth),
            `${kind} at depth ${depth}`,
          ).toBeLessThanOrEqual(allowed);
      }
    }
  });

  it('keeps the interactive animals, drawn large and hopping, below the train', () => {
    for (const locality of LOCALITIES) {
      for (const depth of locality.animalDepth ?? DEFAULT_ANIMAL_DEPTH) {
        const allowed = NEAR_PROP_MAX_HEIGHT_U + depth * NEAR_DEPTH_RANGE_U;
        for (const kind of locality.animals)
          expect(
            worldParts[animalParts[kind]].heightU *
              ANIMAL_SCALE *
              nearDepthScale(depth) +
              ANIMAL_HOP_U,
            `${locality.id}: ${kind} at depth ${depth}`,
          ).toBeLessThanOrEqual(allowed);
      }
    }
  });

  it('floats the pond animal on the water of its pond', () => {
    const pondRule = LOCALITIES.flatMap((t) =>
      t.rules.filter((rule) => rule.kinds.includes('near.pond')),
    );
    expect(pondRule.length).toBeGreaterThan(0);
    for (const locality of LOCALITIES) {
      const rule = locality.rules.find((r) => r.kinds.includes('near.pond'));
      if (!rule) continue;
      const pondDepth = rule.depth[0];
      const scale = (rule.scale?.[0] ?? 1) * nearDepthScale(pondDepth);
      const height = worldParts['near.pond'].heightU * scale;
      for (const depth of locality.animalDepth ?? DEFAULT_ANIMAL_DEPTH) {
        // How far above the pond's foot the animal's foot stands (u).
        const above = (pondDepth - depth) * NEAR_DEPTH_RANGE_U;
        expect(above, locality.id).toBeGreaterThan(height * 0.25);
        expect(above, locality.id).toBeLessThan(height * 0.75);
      }
    }
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
        usedKeys: worldUsedKeys().filter((key) => key !== 'track.tile-c'),
      }),
    ).toEqual([
      'track.tile-b: track.tile-b.svg missing',
      'track.tile-c: track.tile-c.svg is not 66 × 24 u',
      'stray.svg: not in the manifest',
      'track.tile-c: not used',
    ]);
  });
});
