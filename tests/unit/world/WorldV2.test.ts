import { regionAt, transitionAt } from '../../../src/domain/world/Regions.ts';
import { sceneAt, templateById } from '../../../src/domain/world/WorldPlan.ts';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import { describe, expect, it } from 'vitest';
import { biomeAt } from '../../../src/domain/world/Biomes.ts';
import { chunkObjects } from '../../../src/domain/world/ChunkObjects.ts';
import { crossingSite } from '../../../src/domain/world/Crossings.ts';
import {
  chunkScenery,
  nearDepthScale,
  stationFlat,
  stationSlot,
} from '../../../src/domain/world/Scenery.ts';
import {
  generateTrackProfile,
  profileHeightU,
  profileGrade,
} from '../../../src/domain/world/TrackProfile.ts';
import { worldParts } from '../../../src/content/worldArt.ts';

function bounds(
  seed: number,
  k: number,
  prop: ReturnType<typeof chunkScenery>['props'][number],
) {
  const parts: Readonly<
    Record<
      string,
      { widthU: number; heightU: number; pivotU: { x: number; y: number } }
    >
  > = worldParts;
  const art = parts[prop.kind];
  if (!art) throw new Error(prop.kind);
  const scale =
    prop.scale *
    (prop.layer === 'back'
      ? 1 - 0.35 * prop.depth
      : nearDepthScale(prop.depth));
  const pivot = prop.flip ? art.widthU - art.pivotU.x : art.pivotU.x;
  const reach = (prop.motion?.rangeU ?? 0) / 2;
  const rail = -profileHeightU(generateTrackProfile(seed, k), prop.xU);
  return {
    left: prop.xU - pivot * scale - reach,
    right: prop.xU + (art.widthU - pivot) * scale + reach,
    foot: rail - prop.depth * 220 + (art.heightU - art.pivotU.y) * scale,
  };
}

describe('world v2 audit regressions', () => {
  it('R3: seed 1226 reserves crossing before the animal', () => {
    const site = crossingSite(1226, 3);
    expect(site).toBeDefined();
    expect(
      Math.abs((site?.localXU ?? 0) - (chunkObjects(1226, 3)[0]?.localXU ?? 0)),
    ).toBeGreaterThanOrEqual(120);
  });
  it('R3: first station always has 448 u usable flat in slot 1', () => {
    for (let seed = 0; seed < 2000; seed++) {
      expect(stationSlot(seed, 0), `seed ${seed}`).toBe(1);
      const flat = stationFlat(seed, 1);
      expect(flat).toBeDefined();
      const midpoint = ((flat?.[0] ?? 0) + (flat?.[1] ?? 0)) / 2;
      const profile = generateTrackProfile(seed, 1);
      for (let dx = -224; dx <= 224; dx += 16)
        expect(profileGrade(profile, midpoint + dx)).toBe(0);
    }
  });
  it.each([
    [83, 19],
    [110, 59],
    [238, 59],
    [1, 19],
  ])('footprints stay off crossing asphalt: %i/%i', (seed, k) => {
    const sc = chunkScenery(seed, k, worldPlacementCatalog);
    const x = sc.crossing?.localXU;
    if (x === undefined) throw new Error('audit crossing missing');
    for (const p of sc.props) {
      const b = bounds(seed, k, p);
      expect(b.right <= x - 64 || b.left >= x + 64, p.id).toBe(true);
    }
  });
  it.each([
    [2, 31],
    [3, 47],
    [4, 15],
  ])('no inland pond footprint on beach: %i/%i', (seed, k) => {
    const sc = chunkScenery(seed, k, worldPlacementCatalog);
    for (const p of sc.props.filter((p) => p.kind === 'near.pond')) {
      const b = bounds(seed, k, p);
      expect(
        sc.near.some(
          (s) => s.style !== 'sand' && b.left >= s.fromX && b.right <= s.toX,
        ),
      ).toBe(true);
    }
  });
  it('v2 mills refer to their flowing channel (historical red 1/22)', () => {
    const sc = witness('back.watermill');
    const mills = sc.props.filter((p) => p.kind === 'back.watermill');
    expect(mills.length).toBeGreaterThan(0);
    for (const p of mills)
      expect(
        sc.water.some(
          (w) => w.kind === 'channel' && p.dependencies?.includes(w.id),
        ),
        p.id,
      ).toBe(true);
  });
  it.each(['back.rowboat', 'back.sailboat', 'back.fishing-boat'])(
    'v2 %s has a nonzero actual-water witness (historical reds 10/27, 14/28, 18/20)',
    (kind) => {
      const sc = witness(kind),
        boats = sc.props.filter((p) => p.kind === kind);
      expect(boats.length).toBeGreaterThan(0);
      expect(validateChunkScenery(0, sc, worldPlacementCatalog)).toEqual([]);
      for (const p of boats)
        expect(sc.water.some((w) => p.dependencies?.includes(w.id))).toBe(true);
    },
  );
  it('v2 ducks have a nonzero foreground pond witness', () => {
    let sc;
    for (let k = 0; k < 480; k++)
      if (
        templateById(sceneAt(0, k * 1024).templateId).animals.includes('duck')
      ) {
        const candidate = chunkScenery(0, k, worldPlacementCatalog);
        if (candidate.animal.kind === 'duck') {
          sc = candidate;
          break;
        }
      }
    expect(sc).toBeDefined();
    if (!sc) throw new Error('duck witness missing');
    expect(sc.props.some((p) => p.kind === 'near.pond')).toBe(true);
  });
  it.each(Array.from({ length: 20 }, (_, i) => i))(
    'flowers never extend across snowy ground: seed %i',
    (seed) => {
      for (let k = 0; k < 64; k++) {
        const sc = chunkScenery(seed, k, worldPlacementCatalog);
        for (const p of sc.props.filter((p) => p.kind.includes('flower'))) {
          const b = bounds(seed, k, p);
          expect(
            sc.near.every(
              (s) =>
                s.style !== 'snow' || b.right <= s.fromX || b.left >= s.toX,
            ),
            `${seed}/${k}/${p.id}`,
          ).toBe(true);
        }
      }
    },
  );
  it.each([
    [1, 0],
    [1, 5],
    [226, 3],
    [252, 3],
  ])(
    'fences are complete paths, never the uncapped sprite: %i/%i',
    (seed, k) => {
      expect(
        chunkScenery(seed, k, worldPlacementCatalog).props.some(
          (p) => p.kind === 'back.fence' || p.kind === 'near.picket-fence',
        ),
      ).toBe(false);
    },
  );
  it('landscape spans at least three geometry blocks', () => {
    for (let k = 1; k < 24; k++)
      expect(biomeAt(1, k).biome).toBe(biomeAt(1, 0).biome);
  });
  it('coastal water is continuous across v2 neighbours including a station', () => {
    let coastalStation;
    for (let k = 0; k < 480 && !coastalStation; k++)
      if (
        regionAt(0, k * 1024).landscape === 'coast' &&
        stationSlot(0, Math.floor(k / 8)) === k % 8
      )
        coastalStation = k;
    expect(coastalStation).toBeDefined();
    if (coastalStation === undefined)
      throw new Error('coastal station witness missing');
    const coast = regionAt(0, coastalStation * 1024);
    expect(coast.landscape).toBe('coast');
    let neighbours = 0,
      stations = 0;
    for (let k = coast.fromXU / 1024; k < coast.toXU / 1024; k++) {
      const sc = chunkScenery(0, k, worldPlacementCatalog);
      expect(
        sc.water.some((w) => w.kind === 'sea' && w.fromX <= 0 && w.toX >= 1024),
        `0/${k}`,
      ).toBe(true);
      expect(sc.props.some((p) => p.kind === 'near.pond')).toBe(false);
      if (k + 1 < coast.toXU / 1024) neighbours++;
      if (sc.locality === 'station') stations++;
    }
    expect(neighbours).toBeGreaterThan(0);
    expect(stations).toBeGreaterThan(0);
  });
});

import {
  projectedBounds,
  boundsHitPolygon,
  waterPolygon,
} from '../../../src/domain/world/SceneryGeometry.ts';
it('SCN-CO02: a v2 harbour has fishing boats and a pier in geometric contact with its sea', () => {
  const sc = chunkScenery(0, 332, worldPlacementCatalog);
  expect(sc.scene.templateId).toBe('harbour');
  expect(
    sc.props.filter((p) => p.kind === 'back.fishing-boat').length,
  ).toBeGreaterThan(0);
  const piers = sc.props.filter((p) => p.kind === 'back.pier');
  expect(piers.length).toBeGreaterThan(0);
  for (const p of piers) {
    const w = sc.water.find((w) => p.dependencies?.includes(w.id));
    expect(w).toBeDefined();
    if (!w) throw new Error('pier water missing');
    const part = worldPlacementCatalog[p.kind];
    if (!part) throw new Error('pier catalog missing');
    expect(
      boundsHitPolygon(
        projectedBounds(0, 332, p, part),
        waterPolygon(0, 332, w),
      ),
    ).toBe(true);
  }
});

function witness(kind: string) {
  for (let k = 0; k < 480; k++) {
    if (
      !templateById(sceneAt(0, k * 1024).templateId).rules.some((r) =>
        r.kinds.includes(kind),
      )
    )
      continue;
    const sc = chunkScenery(0, k, worldPlacementCatalog);
    if (sc.props.some((p) => p.kind === kind)) return sc;
  }
  throw new Error(`zero v2 witnesses for ${kind}; seed=0, chunks=0..479`);
}
it('SCN-CO02: harbour boats and connected piers also survive an outgoing coastal transition', () => {
  let found;
  for (let seed = 0; seed < 64 && !found; seed++)
    for (let k = 0; k < 480 && !found; k++) {
      if (
        sceneAt(seed, k * 1024).templateId !== 'harbour' ||
        transitionAt(seed, k * 1024 + 512).progress === 0
      )
        continue;
      const sc = chunkScenery(seed, k, worldPlacementCatalog);
      if (
        sc.props.some((p) => p.kind === 'back.fishing-boat') &&
        sc.props.some((p) => p.kind === 'back.pier')
      )
        found = { seed, sc };
    }
  expect(found).toBeDefined();
  if (!found) throw new Error('zero transition harbour coverage');
  expect(
    validateChunkScenery(found.seed, found.sc, worldPlacementCatalog),
  ).toEqual([]);
});

it('SCN-CO02: a harbour pier has geometric water contact, not only an x dependency', () => {
  const sc = chunkScenery(0, 332, worldPlacementCatalog),
    piers = sc.props.filter((p) => p.kind === 'back.pier');
  expect(piers.length).toBeGreaterThan(0);
  for (const p of piers) {
    const part = worldPlacementCatalog[p.kind],
      water = sc.water.find((w) => p.dependencies?.includes(w.id));
    if (!part || !water) throw new Error('pier support missing');
    expect(
      boundsHitPolygon(
        projectedBounds(0, 332, p, part),
        waterPolygon(0, 332, water),
      ),
    ).toBe(true);
  }
});
