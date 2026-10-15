import { expect, it } from 'vitest';
import { backdropFrames } from '../../../src/render/backdropFrames.ts';
it('far/mid art uses supplied landscape seasons, including farm-forest dense bands', () => {
  expect(
    backdropFrames('forest', 'winter', (k) => k.includes('forest-dense')),
  ).toEqual({
    far: 'backdrop.forest-dense-far-winter',
    mid: 'backdrop.forest-dense-mid-winter',
  });
  expect(
    backdropFrames('countryside', 'autumn', () => true, 'village'),
  ).toEqual({
    far: 'backdrop.village-far-autumn',
    mid: 'backdrop.village-mid-autumn',
  });
  expect(backdropFrames('foothills', 'winter', () => true).mid).toBe(
    'backdrop.foothills-mid-winter',
  );
  expect(backdropFrames('coast', 'winter', () => true).mid).toBe(
    'backdrop.coast-mid',
  );
  expect(backdropFrames('dunes', 'winter', () => true).mid).toBe(
    'backdrop.forest-mid',
  );
});
import { backdropWindowFrames } from '../../../src/render/backdropFrames.ts';
import { worldParts } from '../../../src/content/worldArt.ts';
import {
  artAtlasItems,
  packAtlas,
  ATLAS_PADDING_PX,
  MAX_ATLAS_EDGE_PX,
} from '../../../src/render/atlasPacking.ts';
it('only the actual outgoing/incoming bands plus clouds reside in a 2048 backdrop page', () => {
  for (const x of [5000, 493968, 1232896]) {
    const keys = backdropWindowFrames(x === 493968 ? 2 : 1, x);
    expect(keys.length).toBeLessThanOrEqual(7);
    const selected = Object.fromEntries(
      Object.entries(worldParts).filter(([k]) => keys.includes(k)),
    );
    expect(
      packAtlas(artAtlasItems(selected, 1), {
        maxSize: MAX_ATLAS_EDGE_PX,
        paddingPx: ATLAS_PADDING_PX,
      }).frames.size,
    ).toBe(keys.length);
  }
});

it('departing particle frames have every season resident, independent of births', () => {
  const parts: Readonly<Record<string, ArtPart>> = worldParts;
  for (const key of PARTICLE_FRAMES) {
    const seasons = parts[key]?.atlasGroup?.seasons;
    if (seasons)
      expect(seasons).toEqual(['spring', 'summer', 'autumn', 'winter']);
  }
});
import { PARTICLE_FRAMES } from '../../../src/render/particles/particleKinds.ts';

import type { ArtPart } from '../../../src/content/artManifest.ts';

it('landscape aliases inherit the seasonal bands of their existing base art', () => {
  expect(
    backdropFrames('town', 'winter', (k) =>
      k.startsWith('backdrop.countryside-'),
    ),
  ).toEqual({
    far: 'backdrop.countryside-far-winter',
    mid: 'backdrop.countryside-mid-winter',
  });
});

import { backdropTileStepU } from '../../../src/render/backdropFrames.ts';
it.each(['spring', 'summer', 'autumn', 'winter'] as const)(
  'D-025 integration: %s dense far/mid bands retain their overlapping 480u grid',
  (season) => {
    const frames = backdropFrames('forest', season, (key) => key in worldParts);
    const parts: Readonly<Record<string, ArtPart>> = worldParts;
    for (const key of [frames.far, frames.mid]) {
      const width = parts[key]?.widthU;
      if (width === undefined) throw new Error(`missing ${key}`);
      expect(width).toBe(512);
      expect(backdropTileStepU(key, width)).toBe(480);
    }
    expect(backdropTileStepU('backdrop.town-dense', 1020)).toBe(1020);
  },
);
