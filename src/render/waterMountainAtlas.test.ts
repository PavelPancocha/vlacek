import { expect, it, vi } from 'vitest';
import { worldParts } from '../content/worldArt.ts';
import {
  worldAtlasGroup,
  worldAtlasKeys,
} from '../content/worldAtlasGroups.ts';
import { worldAtlasPackageGroups } from '../content/worldAtlasPackageGroups.ts';
import { chunkEmissions } from './chunkEmissions.test-helper.ts';
import { chunkScenery } from '../domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { buildArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../domain/world/TrackProfile.ts';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Vector2: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
    },
  },
}));

it('WM4 coast ferry body and arm are resident, without unrelated freshwater frames', () => {
  const keys = worldAtlasKeys(worldParts, [
    { landscape: 'coast', season: 'summer' },
  ]);
  expect(keys).toEqual(
    expect.arrayContaining(['back.ferry', 'back.ferryman-arm']),
  );
  expect(keys).not.toContain('back.fishpond-sluice');
});
it('WM4 foothills cutting has warm and winter hosts, without mountain backdrops', () => {
  for (const season of ['summer', 'winter'] as const) {
    const keys = worldAtlasKeys(worldParts, [
      { landscape: 'foothills', season },
    ]);
    expect(keys).toContain(
      `back.cutting-rock${season === 'winter' ? '-snow' : ''}`,
    );
    expect(keys).not.toContain('backdrop.mountains-ridges');
  }
});
it('WM4 water footbridge alias has an explicit lakes host and stays out of the common set', () => {
  expect(worldAtlasPackageGroups['back.water-footbridge']?.landscapes).toEqual([
    'lakes',
  ]);
  expect(
    worldAtlasGroup(
      'back.water-footbridge',
      worldParts['back.water-footbridge'],
    ),
  ).toEqual({ landscapes: ['lakes'] });
  expect(
    worldAtlasKeys(worldParts, [{ landscape: 'town', season: 'summer' }]),
  ).not.toContain('back.water-footbridge');
});
it('WM4 real compound children carry world-part on creation and animation', () => {
  const k = 312;
  const emitted = chunkEmissions({
    seed: 1,
    table: buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8),
    scenery: chunkScenery(1, k, worldPlacementCatalog),
  });
  expect(emitted.keys).toContain('back.ferryman-arm');
  expect(emitted.untagged).toEqual([]);
});

import { backdropFrames } from './backdropFrames.ts';
import { worldAtlasWindowKeys } from '../content/worldAtlasGroups.ts';
it('WM4 retains current and incoming far/mid mountain and Sahara bands through a seasonal transition', () => {
  const exists = (key: string) => key in worldParts;
  expect(backdropFrames('dunes', 'summer', exists)).toEqual({
    far: 'backdrop.dunes-ridge',
    mid: 'backdrop.dunes-pines',
  });
  const current = backdropFrames('mountains', 'summer', exists),
    incoming = backdropFrames('mountains', 'winter', exists);
  expect(current).toEqual({
    far: 'backdrop.mountains-ridges',
    mid: 'backdrop.mountains-slope',
  });
  expect(incoming).toEqual({
    far: 'backdrop.mountains-ridges-snow',
    mid: 'backdrop.mountains-slope-snow',
  });
  const keys = worldAtlasWindowKeys(worldParts, [
    { landscape: 'mountains', season: 'summer' },
    { landscape: 'mountains', season: 'winter' },
  ]);
  expect(keys).toEqual(
    expect.arrayContaining([
      ...Object.values(current),
      ...Object.values(incoming),
    ]),
  );
  for (const regions of [
    [
      { landscape: 'dunes', season: 'summer' },
      { landscape: 'mountains', season: 'winter' },
    ],
    [
      { landscape: 'mountains', season: 'winter' },
      { landscape: 'dunes', season: 'summer' },
    ],
  ] as const)
    expect(worldAtlasWindowKeys(worldParts, regions)).toEqual(
      expect.arrayContaining(
        regions.flatMap(({ landscape, season }) =>
          Object.values(backdropFrames(landscape, season, exists)),
        ),
      ),
    );
});
