import { tunnelSite, bridgeSite } from '../domain/world/Structures.ts';
import {
  chunkEmissions,
  chunkPivotDrift,
} from './chunkEmissions.test-helper.ts';
import { buildArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../domain/world/TrackProfile.ts';
import { expect, it, vi } from 'vitest';
import { assertEmittedAtlasKeys } from '../../tests/helpers/emittedAtlasKeys.ts';
import { worldParts } from '../content/worldArt.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { worldAtlasWindowKeys } from '../content/worldAtlasGroups.ts';
import { worldAtlasRegions } from './worldAtlasWindow.ts';
import { chunkScenery } from '../domain/world/Scenery.ts';
import { TRACK_GENERATOR_VERSION } from '../domain/world/TrackProfile.ts';

it.each(['parent', 'attachment', 'nested', 'animation'])(
  'reports an absent %s frame, including nested composed art',
  (missing) => {
    const emitted = [
      {
        key: 'parent',
        attachments: [
          {
            key: 'attachment',
            attachments: [{ key: 'nested' }],
            animationFrames: ['animation'],
          },
        ],
      },
    ];
    expect(() =>
      assertEmittedAtlasKeys(
        { seed: 1, generatorVersion: TRACK_GENERATOR_VERSION, chunkIndex: 1 },
        emitted,
        ['parent', 'attachment', 'nested', 'animation'].filter(
          (k) => k !== missing,
        ),
      ),
    ).toThrow(missing);
    assertEmittedAtlasKeys(
      { seed: 1, generatorVersion: TRACK_GENERATOR_VERSION, chunkIndex: 1 },
      emitted,
      ['parent', 'attachment', 'nested', 'animation'],
    );
  },
);

// Phaser itself needs a browser; ChunkView only constructs Vector2 from it.
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

// Rendered emissions: the real ChunkView draws each chunk and runs its animations.
it.each(
  [1, 7, 123].flatMap((seed) =>
    [0, 100, 200, 300, 700, 800, 900].map((from) => ({ seed, from })),
  ),
)(
  'covers every frame ChunkView draws or animates in seed $seed from chunk $from (100 chunks)',
  ({ seed, from }) => {
    for (let chunkIndex = from; chunkIndex < from + 100; chunkIndex++) {
      const selected = worldAtlasWindowKeys(
        worldParts,
        worldAtlasRegions(seed, chunkIndex * 1024, (chunkIndex + 1) * 1024),
      );
      const chunk = {
        seed,
        table: buildArcLengthTable(
          generateTrackProfile(seed, chunkIndex),
          chunkIndex,
          1024,
          8,
        ),
        scenery: chunkScenery(seed, chunkIndex, worldPlacementCatalog),
      };
      const emitted = chunkEmissions(chunk);
      const reproduction = {
        seed,
        chunkIndex,
        generatorVersion: TRACK_GENERATOR_VERSION,
      };
      assertEmittedAtlasKeys(
        reproduction,
        emitted.keys.map((key) => ({ key })),
        selected,
      );
      // Untagged world images would keep a released page after a swap.
      expect(emitted.untagged, JSON.stringify(reproduction)).toEqual([]);
      // A visible chunk bakes its clipped compositions from the window's pages.
      expect(emitted.compositionFrames, JSON.stringify(reproduction)).toEqual(
        expect.arrayContaining([
          ...new Set(
            chunk.scenery.props.filter((p) => p.clip).map((p) => p.kind),
          ),
        ]),
      );
      // A late page publication keeps every image's authored pivot.
      expect(chunkPivotDrift(chunk), JSON.stringify(reproduction)).toEqual([]);
    }
  },
);

it('the rendered 1200-chunk sweep includes long rock tunnels and both large bridge variants', () => {
  const covered = new Set<string>();
  for (const seed of [1, 7, 123])
    for (let k = 0; k < 400; k++) {
      if (tunnelSite(seed, k)?.rock) covered.add('rock');
      const bridge = bridgeSite(seed, k);
      if (bridge?.variant) covered.add(bridge.variant);
    }
  expect([...covered].sort()).toEqual(['rock', 'steel', 'viaduct']);
});

it.each([1, 7, 123])(
  'WM4 rendered sweep contains every water/mountain motif in seed %i',
  (seed) => {
    const required = [
      'water',
      'ferry',
      'mill',
      'cableway',
      'Sahara-pines',
      'cutting',
      'footbridge',
    ];
    const seen = new Set<string>();
    for (let chunkIndex = 0; chunkIndex < 400; chunkIndex++) {
      const scenery = chunkScenery(seed, chunkIndex, worldPlacementCatalog);
      const kinds = scenery.props.map((p) => p.kind);
      const motifs = [
        ...(scenery.water.some((w) => w.kind === 'pond' || w.flowSpan)
          ? ['water']
          : []),
        ...(kinds.includes('back.ferry') ? ['ferry'] : []),
        ...(kinds.includes('back.watermill') ? ['mill'] : []),
        ...(kinds.includes('back.cableway-tower') ? ['cableway'] : []),
        ...(scenery.region.landscape === 'dunes' &&
        kinds.some((k) => k.startsWith('tree.sahara-pine-'))
          ? ['Sahara-pines']
          : []),
        ...(kinds.some((k) => k.startsWith('back.cutting-rock'))
          ? ['cutting']
          : []),
        ...(kinds.includes('back.water-footbridge') ? ['footbridge'] : []),
      ];
      if (motifs.every((m) => seen.has(m))) continue;
      const selected = worldAtlasWindowKeys(
        worldParts,
        worldAtlasRegions(seed, chunkIndex * 1024, (chunkIndex + 1) * 1024),
      );
      const emitted = chunkEmissions({
        seed,
        scenery,
        table: buildArcLengthTable(
          generateTrackProfile(seed, chunkIndex),
          chunkIndex,
          1024,
          8,
        ),
      });
      const context = {
        seed,
        chunkIndex,
        generatorVersion: TRACK_GENERATOR_VERSION,
      };
      assertEmittedAtlasKeys(
        context,
        emitted.keys.map((key) => ({ key })),
        selected,
      );
      expect(emitted.untagged, JSON.stringify(context)).toEqual([]);
      for (const motif of motifs) seen.add(motif);
    }
    expect([...seen].sort(), `seed=${seed} generator=2`).toEqual(
      [...required].sort(),
    );
  },
);
