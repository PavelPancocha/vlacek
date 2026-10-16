import { readdirSync } from 'node:fs';
import {
  groundPixelEnvelope,
  vehiclePixelEnvelope,
  journeyPixels,
  resizeVehicleIds,
  catalogueGaps,
  integratedCatalogue,
  lifetimeModel,
  profileScales,
  windowPairs,
  windowResidency,
  ATLAS_BOUND,
  BUDGET_BYTES,
} from '../../helpers/atlasResidency.ts';
import { catalogueSnapshot } from '../../fixtures/world-catalogue-snapshot.ts';
import { STATION_KINDS } from '../../../src/domain/world/Scenery.ts';
import { FENCE_PARTS } from '../../../src/domain/world/Fences.ts';
import { snowField } from '../../../src/domain/world/scenes/rules.ts';
import {
  worldAtlasRegions,
  WORLD_ATLAS_PREFETCH_U,
} from '../../../src/render/worldAtlasWindow.ts';
import {
  regionAt,
  REGION_TRANSITION_U,
} from '../../../src/domain/world/Regions.ts';
import { describe, expect, it } from 'vitest';
import {
  worldAtlasKeys,
  worldAtlasWindowKeys,
  worldAtlasGroup,
  type GroupedWorldPart,
} from '../../../src/content/worldAtlasGroups.ts';
import { worldParts, isBackdropPart } from '../../../src/content/worldArt.ts';
import { additionalPartKeys } from '../../../src/content/worldRegistry.generated.ts';
import { backdropFrames } from '../../../src/render/backdropFrames.ts';
import { atlasPackages } from '../../fixtures/world-atlas-packages.ts';
import { ALLOWED_PRESETS } from '../../../src/domain/world/Regions.ts';
import { BIOMES } from '../../../src/domain/world/Biomes.ts';
import { artAtlasItems, packAtlas } from '../../../src/render/atlasPacking.ts';
import { gameConfig } from '../../../src/config/gameConfig.ts';

describe('D-030 region/season atlas selection', () => {
  it('selects base and matching region variants, never an inactive season', () => {
    const parts = {
      base: { widthU: 1, heightU: 1, atlasGroup: {} },
      summer: {
        widthU: 1,
        heightU: 1,
        atlasGroup: {
          landscapes: ['forest'] as const,
          seasons: ['summer'] as const,
        },
      },
      winter: {
        widthU: 1,
        heightU: 1,
        atlasGroup: {
          landscapes: ['forest'] as const,
          seasons: ['winter'] as const,
        },
      },
      coast: {
        widthU: 1,
        heightU: 1,
        atlasGroup: { landscapes: ['coast'] as const },
      },
    };
    expect(
      worldAtlasKeys(parts, [{ landscape: 'forest', season: 'summer' }]),
    ).toEqual(['base', 'summer']);
    expect(
      worldAtlasKeys(parts, [
        { landscape: 'forest', season: 'winter' },
        { landscape: 'coast', season: 'summer' },
      ]),
    ).toEqual(['base', 'winter', 'coast']);
    expect(() => worldAtlasGroup('unknown', { widthU: 1, heightU: 1 })).toThrow(
      'unmapped',
    );
  });
});

describe('D-030 real metadata and distance window', () => {
  it('keeps shared station parts available in a forest station', () => {
    const stationKeys = [
      'back.bus-shelter',
      'back.bus',
      'back.bus-wheel',
      'back.passenger-a',
      'back.passenger-b',
      'back.dispatcher-wave',
    ];
    const parts = Object.fromEntries(
      stationKeys.map((key) => [key, { widthU: 1, heightU: 1 }]),
    );
    expect(
      worldAtlasKeys(parts, [{ landscape: 'forest', season: 'summer' }]),
    ).toEqual(stationKeys);
  });
  it('includes generator-owned stations, both fence styles and the common winter foreground in every landscape', () => {
    for (const landscape of BIOMES) {
      const summer = worldAtlasKeys(worldParts, [
        { landscape, season: 'summer' },
      ]);
      const winter = worldAtlasKeys(worldParts, [
        { landscape, season: 'winter' },
      ]);
      expect(summer).toEqual(
        expect.arrayContaining([
          ...STATION_KINDS,
          ...Object.values(FENCE_PARTS).flatMap((style) =>
            Object.values(style),
          ),
        ]),
      );
      expect(winter).toEqual(
        expect.arrayContaining(snowField.flatMap((rule) => rule.kinds)),
      );
    }
  });
  it('keeps shared weather and leaf effects available beyond their example scene references', () => {
    const parts = {
      'fx.snow-mid': atlasPackages[3].parts['fx.snow-mid'],
      'fx.leaf-willow-ochre': atlasPackages[3].parts['fx.leaf-willow-ochre'],
    };
    expect(
      worldAtlasKeys(parts, [{ landscape: 'foothills', season: 'winter' }]),
    ).toEqual(['fx.snow-mid', 'fx.leaf-willow-ochre']);
    expect(
      worldAtlasKeys(parts, [{ landscape: 'lakes', season: 'autumn' }]),
    ).toEqual(['fx.snow-mid', 'fx.leaf-willow-ochre']);
  });
  it('preserves source budget totals and package pack dimensions', () => {
    const [farm, village, water, seasons] = atlasPackages;
    const area = (
      parts: Readonly<Record<string, { widthU: number; heightU: number }>>,
    ) => Object.values(parts).reduce((sum, p) => sum + p.widthU * p.heightU, 0);
    expect(area(farm.parts)).toBe(farm.budget.area1px);
    expect(area(water.parts)).toBe(
      (water.budget.plans.find(
        (p) => p.set === 'package' && p.group === 'world',
      )?.area ?? 0) /
        4 +
        (water.budget.plans.find(
          (p) => p.set === 'package' && p.group === 'backdrop',
        )?.area ?? 0),
    );
    expect(area(seasons.parts) * 4).toBe(
      seasons.budget.package.find((p) => p.pxPerU === 2)?.area,
    );
    const subset = Object.fromEntries(
      Object.entries(village.parts).filter(([key]) => !isBackdropPart(key)),
    );
    const plan = packAtlas(artAtlasItems(subset, 2), {
      maxSize: 2048,
      paddingPx: 2,
    });
    const budget = village.budget.find(
      (p) => p.setName === 'new' && p.atlas === 'world' && p.scale === 2,
    );
    expect({ width: plan.width, height: plan.height }).toEqual({
      width: budget?.width,
      height: budget?.height,
    });
    expect(Object.keys(farm.parts).length).toBe(farm.budget.count);
  });
  it('prepares the next region before its spatial transition, keeps the previous while visible, then evicts it', () => {
    const first = regionAt(1, 10000),
      next = regionAt(1, first.toXU);
    const rightXU = first.toXU - REGION_TRANSITION_U - WORLD_ATLAS_PREFETCH_U;
    expect(
      worldAtlasRegions(1, rightXU - 2400, rightXU).map((r) => r.id),
    ).toContain(next.id);
    expect(
      worldAtlasRegions(1, first.toXU - 100, first.toXU + 2400).map(
        (r) => r.id,
      ),
    ).toContain(first.id);
    expect(
      worldAtlasRegions(1, first.toXU + 4096, first.toXU + 6500).map(
        (r) => r.id,
      ),
    ).not.toContain(first.id);
  });
});

it('excludes the six package summer mountain variants in winter while keeping shared rock structure', () => {
  const parts = atlasPackages[2].parts;
  const summerOnly = [
    'backdrop.mountains-ridges',
    'backdrop.mountains-slope',
    'back.cutting-rock',
    'tunnel.rock-portal',
    'tunnel.rock-cover',
    'tunnel.rock-cap',
  ];
  const winter = worldAtlasKeys(parts, [
    { landscape: 'mountains', season: 'winter' },
  ]);
  const summer = worldAtlasKeys(parts, [
    { landscape: 'mountains', season: 'summer' },
  ]);
  expect(winter.filter((key) => summerOnly.includes(key))).toEqual([]);
  expect(summer).toEqual(expect.arrayContaining(summerOnly));
  expect(winter).toEqual(
    expect.arrayContaining([
      'bridge.viaduct-arch',
      'bridge.viaduct-pier',
      'tunnel.rock-left',
      'tunnel.rock-right',
      'tunnel.rock-crown',
    ]),
  );
});

it('merges partial group overrides field by field', () => {
  expect(
    worldAtlasGroup('near.crop-rows-spring', {
      widthU: 128,
      heightU: 22,
      atlasGroup: { seasons: ['autumn'] },
    }),
  ).toEqual({ landscapes: ['countryside'], seasons: ['autumn'] });
  expect(
    worldAtlasGroup('near.crop-rows-spring', {
      widthU: 128,
      heightU: 22,
      atlasGroup: { landscapes: ['forest'] },
    }),
  ).toEqual({ landscapes: ['forest'], seasons: ['spring'] });
});

it('includes shared station parts and every particle frame in every window', () => {
  const keys = [
    'back.platform-start',
    'back.platform-middle',
    'back.platform-end',
    'back.station-bench',
    'fx.petal-pink',
    'fx.snow-mid',
    'fx.gull-up',
    'fx.leaf-oak-amber',
  ];
  const parts = Object.fromEntries(
    keys.map((key) => [key, { widthU: 1, heightU: 1 }]),
  );
  for (const landscape of BIOMES)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const)
      expect(worldAtlasKeys(parts, [{ landscape, season }])).toEqual(keys);
});

it('selects seasonal attachments and tree variants for all their host landscapes', () => {
  const hosts = [
    ['tree.birch-spring', 'mountains', 'spring'],
    ['tree.birch-autumn', 'mountains', 'autumn'],
    ['tree.birch-winter', 'mountains', 'winter'],
    ['tree.birch-winter-snow', 'mountains', 'winter'],
    ...['forest', 'lakes', 'foothills', 'mountains'].map((l) => [
      'snow.roof-64',
      l,
      'winter',
    ]),
    ...['foothills', 'lakes', 'mountains'].map((l) => [
      'near.leaf-litter',
      l,
      'autumn',
    ]),
    ...['tree.pine-snow', 'tree.spruce-snow'].flatMap((k) =>
      ['forest', 'foothills'].map((l) => [k, l, 'winter']),
    ),
    ['wheel.farm-large', 'forest', 'summer'],
    ['wheel.farm-small', 'forest', 'summer'],
    ['back.plough', 'foothills', 'autumn'],
    ['backdrop.countryside-far-winter', 'town', 'winter'],
    ['backdrop.village-mid-autumn', 'town', 'autumn'],
  ];
  for (const [key, landscape, season] of hosts) {
    if (!key || !landscape || !season) throw new Error('missing host fixture');
    const group = worldAtlasGroup(key, { widthU: 1, heightU: 1 });
    expect(group.landscapes ?? BIOMES, key).toContain(landscape);
    expect(
      group.seasons ?? ['spring', 'summer', 'autumn', 'winter'],
      key,
    ).toContain(season);
  }
});

// Historical counterexample stays fixed at the reviewed raster steps even though D-028 changed the camera.
it('accounts for the exact seed-1 1544-u journey plus NPC replacement that disproved 26 MiB', () => {
  const old = journeyPixels(resizeVehicleIds, 1, 1.75);
  const next = journeyPixels(resizeVehicleIds, 1, 2);
  expect([old.width, old.height, next.width, next.height]).toEqual([
    2022, 890, 2008, 1196,
  ]);
  expect(
    old.bytes + 2 * next.bytes + groundPixelEnvelope().bytes,
  ).toBeGreaterThan(26 * 1048576);
  for (const scale of [0.5, 0.75, 1, 1.25, 1.75, 2])
    expect(journeyPixels(resizeVehicleIds, 1, scale).bytes).toBeLessThanOrEqual(
      vehiclePixelEnvelope(scale).bytes,
    );
});

describe('D-030 integrated catalogue snapshot', () => {
  const registered: Readonly<Record<string, GroupedWorldPart>> = worldParts;
  /** Parts per declaring module as registered in this repository. */
  async function registeredModules() {
    const directory = new URL(
      '../../../src/content/world-modules/',
      import.meta.url,
    );
    const modules: Record<string, Record<string, GroupedWorldPart>> = {};
    const lookup = (key: string): [string, GroupedWorldPart] => {
      const part = registered[key];
      if (!part) throw new Error(`${key} is declared but not registered`);
      return [key, part];
    };
    for (const file of readdirSync(directory).filter((name) =>
      name.endsWith('.art.ts'),
    )) {
      const loaded: unknown = await import(new URL(file, directory).href);
      const parts: unknown =
        typeof loaded === 'object' && loaded !== null
          ? Reflect.get(loaded, 'parts')
          : undefined;
      if (typeof parts !== 'object' || parts === null)
        throw new Error(`${file} exports no parts`);
      modules[file.replace(/\.art\.ts$/, '')] = Object.fromEntries(
        Object.keys(parts).map(lookup),
      );
    }
    const additional = new Set(additionalPartKeys);
    modules.base = Object.fromEntries(
      Object.keys(registered)
        .filter((key) => !additional.has(key))
        .map(lookup),
    );
    return modules;
  }

  it('keeps the pending-module snapshot consistent with the registered catalogue', async () => {
    const modules = await registeredModules();
    expect(Object.keys(modules)).toEqual(
      expect.arrayContaining([
        'base',
        'farm-forest',
        'settlements',
        'seasons-life',
      ]),
    );
    expect(catalogueGaps(modules)).toEqual([]);
  });

  it('fails when a pending module lands or a registered part changes size', () => {
    const declared = catalogueSnapshot['tree.sahara-pine-a'];
    expect(declared?.module).toBe('water-mountains');
    expect(
      catalogueGaps(
        {
          'water-mountains': {
            'tree.sahara-pine-a': { widthU: 60, heightU: 120 },
          },
          base: { 'near.stones': { widthU: 21, heightU: 10 } },
        },
        {
          'tree.sahara-pine-a': {
            module: 'water-mountains',
            widthU: 60,
            heightU: 120,
            group: {},
          },
          'near.stones': {
            module: 'base',
            widthU: 20,
            heightU: 10,
            group: {},
          },
        },
      ),
    ).toEqual([
      'water-mountains has landed: refresh the snapshot from the registry',
      'base: near.stones is 21×10 u, snapshot 20×10 u',
    ]);
  });

  it('bounds the reviewed town/spring + foothills/winter union with the twelve real seasonal backdrops', () => {
    const parts = integratedCatalogue(worldParts);
    expect(
      Object.keys(parts).filter((key) =>
        /^backdrop\.(countryside|village)-(far|mid)-(spring|autumn|winter)$/.test(
          key,
        ),
      ),
    ).toHaveLength(12);
    const keys = worldAtlasWindowKeys(parts, [
      { landscape: 'town', season: 'spring' },
      { landscape: 'foothills', season: 'winter' },
    ]);
    for (const quality of ['low', 'standard'] as const)
      for (const scale of profileScales(quality)) {
        const world = windowResidency(parts, keys, false, scale.world);
        const backdrop = windowResidency(parts, keys, true, scale.backdrop);
        const label = `${quality} ${scale.world}/${scale.backdrop} px/u`;
        expect
          .soft(backdrop.bytes, label)
          .toBeLessThanOrEqual(ATLAS_BOUND[quality].oldBackdropBytes);
        for (const gpu of [false, true])
          for (const old of [
            undefined,
            // The same window displayed while its successor prepares.
            { world: world.bytes, backdrop: backdrop.bytes },
          ]) {
            const model = lifetimeModel(quality, world, backdrop, gpu, old);
            expect
              .soft(
                model.peakBytes,
                `${label} ${gpu ? 'WebGL' : 'Canvas'} MiB=${model.peakBytes / 1048576}`,
              )
              .toBeLessThan(BUDGET_BYTES[quality]);
          }
      }
    // Base bands yield to the displayed seasonal variants; town keeps its own and village bands.
    expect(keys.filter(isBackdropPart).sort()).toEqual([
      'backdrop.countryside-far-spring',
      'backdrop.countryside-mid-spring',
      'backdrop.foothills-far-winter',
      'backdrop.foothills-mid-winter',
      'backdrop.forest-dense-far-winter',
      'backdrop.forest-dense-mid-winter',
      'backdrop.town-dense',
      'backdrop.town-sparse',
      'backdrop.village-far-spring',
      'backdrop.village-mid-spring',
      'cloud.a',
      'cloud.b',
      'cloud.c',
    ]);
  });
});

it('holds at most two regions per distance window, always a pair the bound matrix covers', () => {
  // Widest view: the longest consist at the D-028 camera, plus the 64 u margins.
  const viewU =
    gameConfig.train.maxConsistLengthU / gameConfig.camera.trainWidthFraction +
    128;
  const pairs = new Set(windowPairs().map((pair) => pair.label));
  const starts = new Set(
    windowPairs().map(
      (pair) => `${pair.regions[0]?.landscape}/${pair.regions[0]?.season}`,
    ),
  );
  let windows = 0;
  for (const seed of [1, 7, 123, 2026])
    for (let x = 0; x < 3 * 60 * 8192; x += 512) {
      const regions = worldAtlasRegions(seed, x, x + viewU);
      const [first, next] = regions;
      if (!first) throw new Error(`empty window at ${seed}/${x}`);
      expect(regions.length, `${seed}/${x}`).toBeLessThanOrEqual(2);
      const label = `${first.landscape}/${first.season}`;
      if (next)
        expect(pairs, `${seed}/${x}`).toContain(
          `${label}->${next.landscape}/${next.season}`,
        );
      else expect(starts, `${seed}/${x}`).toContain(label);
      windows++;
    }
  expect(windows).toBe(4 * 2880);
});

describe('D-030 seasonal backdrop bands', () => {
  it('selects a base band only in seasons without its registered variant, except on coast and dunes', () => {
    const parts = {
      'backdrop.countryside-far': {
        widthU: 1,
        heightU: 1,
        atlasGroup: { landscapes: ['countryside'] as const },
      },
      'backdrop.countryside-far-winter': {
        widthU: 1,
        heightU: 1,
        atlasGroup: {
          landscapes: ['countryside'] as const,
          seasons: ['winter'] as const,
        },
      },
      'backdrop.coast-far': {
        widthU: 1,
        heightU: 1,
        atlasGroup: { landscapes: ['coast'] as const },
      },
      'backdrop.coast-far-winter': {
        widthU: 1,
        heightU: 1,
        atlasGroup: {
          landscapes: ['coast'] as const,
          seasons: ['winter'] as const,
        },
      },
    };
    expect(
      worldAtlasKeys(parts, [{ landscape: 'countryside', season: 'winter' }]),
    ).toEqual(['backdrop.countryside-far-winter']);
    expect(
      worldAtlasKeys(parts, [{ landscape: 'countryside', season: 'summer' }]),
    ).toEqual(['backdrop.countryside-far']);
    expect(
      worldAtlasKeys(parts, [
        { landscape: 'countryside', season: 'winter' },
        { landscape: 'countryside', season: 'summer' },
      ]),
    ).toEqual(['backdrop.countryside-far', 'backdrop.countryside-far-winter']);
    expect(
      worldAtlasKeys(parts, [{ landscape: 'coast', season: 'winter' }]),
    ).toEqual(['backdrop.coast-far', 'backdrop.coast-far-winter']);
  });

  it('keeps every backdrop band the renderer draws for each registered landscape, season and subzone', () => {
    const exists = (key: string) => key in worldParts;
    for (const landscape of BIOMES)
      for (const season of new Set(
        ALLOWED_PRESETS[landscape].map((preset) => preset.season),
      ))
        for (const subzone of ['', 'village']) {
          const keys = worldAtlasKeys(worldParts, [{ landscape, season }]);
          const bands = backdropFrames(landscape, season, exists, subzone);
          for (const band of ['far', 'mid'] as const)
            expect(keys, `${landscape}/${season}/${subzone}`).toContain(
              bands[band],
            );
        }
  });
});

describe('D-030 groups of generator-placed kinds and seasonal variants', () => {
  const group = (key: string) => {
    const part = (worldParts as Readonly<Record<string, GroupedWorldPart>>)[
      key
    ];
    if (!part) throw new Error(`unregistered ${key}`);
    return worldAtlasGroup(key, part);
  };
  it('selects station service, road-stretch and settlement kinds where their generators place them', () => {
    // Long-station service paths and road stretches run through any landscape.
    expect(group('near.stones').landscapes).toBeUndefined();
    expect(group('back.car').landscapes).toBeUndefined();
    // Settlements: villages in the countryside, the town itself.
    expect(group('back.house-a').landscapes).toEqual(
      expect.arrayContaining(['countryside', 'town']),
    );
  });
  it('gives a seasonal variant the landscapes of the kind it replaces', () => {
    expect(group('backdrop.town-sparse-winter')).toEqual({
      landscapes: ['town'],
      seasons: ['winter'],
    });
    expect(group('near.bush-winter').landscapes).toEqual(
      group('near.bush').landscapes,
    );
    expect(group('back.house-a-winter').landscapes).toEqual(
      expect.arrayContaining([...(group('back.house-a').landscapes ?? [])]),
    );
    // Town skylines yield to their autumn/winter variants like other bands.
    expect(
      worldAtlasKeys(worldParts, [{ landscape: 'town', season: 'winter' }]),
    ).not.toContain('backdrop.town-sparse');
  });
});

it('selects the next season for props in a transition block but keeps backdrops per region', () => {
  // Seed 1 chunk 91: a forest/summer transition into foothills/winter draws winter bushes.
  expect(
    worldAtlasWindowKeys(worldParts, [
      { landscape: 'forest', season: 'summer' },
      { landscape: 'foothills', season: 'winter' },
    ]),
  ).toContain('back.bush-b-winter');
  // The countryside backdrop keeps its own season during the crossfade.
  const keys = worldAtlasWindowKeys(worldParts, [
    { landscape: 'countryside', season: 'summer' },
    { landscape: 'forest', season: 'winter' },
  ]);
  expect(keys).toContain('back.bush-b-winter');
  expect(keys).not.toContain('backdrop.countryside-far-winter');
});
