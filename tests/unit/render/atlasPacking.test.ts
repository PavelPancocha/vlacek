import { backdropWindowFrames } from '../../../src/render/backdropFrames.ts';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { vehicleArtLayers } from '../../../src/content/artLayers.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { describe, expect, it, vi } from 'vitest';
import { worldParts } from '../../../src/content/worldArt.ts';
import {
  ART_MAX_PX_PER_U,
  BACKDROP_MAX_PX_PER_U,
  ATLAS_PADDING_PX,
  FRAME_MARGIN_PX,
  MAX_ATLAS_EDGE_PX,
  artAtlasItems,
  artScaleFor,
  profileArtScale,
  profileBackdropScale,
  frameOrigin,
  framesWithMargin,
  packAtlas,
  packWorldPages,
  journeyArtKeys,
} from '../../../src/render/atlasPacking.ts';

// Budget cases use only shipped manifest frames, including shared parts once.
const budgetVehicles = [...locomotives, ...wagons].map((v) => {
  if (!vehicleArt[v.id]) throw new Error(`${v.id}: missing budget art`);
  return {
    id: v.id,
    lengthU: v.lengthU,
    kind: v.kind === 'locomotive' ? v.power : v.group,
    keys: journeyArtKeys([v], { locomotives: [], wagons: [] }),
  };
});
const area = (v: (typeof budgetVehicles)[number]) =>
  v.keys.reduce((sum, key) => {
    const part = artParts[key];
    if (!part) throw new Error(`Missing budget part ${key}`);
    return sum + part.widthU * part.heightU;
  }, 0);
const ranked = [...budgetVehicles].sort(
  (a, b) => area(b) - area(a) || a.id.localeCompare(b.id),
);
const isLocomotive = (v: (typeof budgetVehicles)[number]) =>
  ['steam', 'diesel', 'electric', 'fantasy'].includes(v.kind);
const roadmap = ranked.slice(0, 8);
const legal = ranked.filter(isLocomotive).slice(0, 1);
let lengthU = legal.reduce((sum, v) => sum + v.lengthU, 0);
for (const v of ranked.filter((v) => !isLocomotive(v))) {
  const nextU = lengthU + gameConfig.train.couplerGapU + v.lengthU;
  if (nextU > gameConfig.train.maxConsistLengthU) continue;
  legal.push(v);
  lengthU = nextU;
}
const worstJourneyCases = [
  { name: 'roadmap eight largest distinct vehicles', vehicles: roadmap },
  { name: 'legal playable consist (contract C.3)', vehicles: legal },
].map(({ name, vehicles }) => {
  const available = ranked.filter(
    (v) => !vehicles.some((chosen) => chosen.id === v.id),
  );
  const fleet = [
    ...available
      .filter((v) => v.kind === 'steam' || v.kind === 'diesel')
      .slice(0, 2),
    ...available.filter((v) => !isLocomotive(v)).slice(0, 6),
  ];
  const keys = [...new Set([...vehicles, ...fleet].flatMap((v) => v.keys))];
  return {
    name,
    vehicles,
    fleet,
    parts: Object.fromEntries(
      keys.map((key) => {
        const part = artParts[key];
        if (!part) throw new Error(`Missing budget part ${key}`);
        return [key, part];
      }),
    ),
  };
});

const sizes = (count: number, seed = 1) =>
  Array.from({ length: count }, (_, i) => ({
    key: `frame-${i}`,
    width: 20 + ((i * 37 + seed * 13) % 180),
    height: 10 + ((i * 53 + seed * 7) % 120),
  }));

describe('packAtlas (one texture for all vehicle parts, doc 07 §4/§10)', () => {
  it('places every frame inside the atlas without overlaps, padding included', () => {
    const items = sizes(60);
    const atlas = packAtlas(items, { maxSize: 2048, paddingPx: 2 });
    expect(atlas.width).toBeLessThanOrEqual(2048);
    expect(atlas.height).toBeLessThanOrEqual(2048);
    const placed = items.map((item) => {
      const at = atlas.frames.get(item.key);
      if (!at) throw new Error(`${item.key} not placed`);
      expect(at.x).toBeGreaterThanOrEqual(2);
      expect(at.y).toBeGreaterThanOrEqual(2);
      expect(at.x + item.width + 2).toBeLessThanOrEqual(atlas.width);
      expect(at.y + item.height + 2).toBeLessThanOrEqual(atlas.height);
      return { ...item, ...at };
    });
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        const apart =
          a.x + a.width + 2 <= b.x ||
          b.x + b.width + 2 <= a.x ||
          a.y + a.height + 2 <= b.y ||
          b.y + b.height + 2 <= a.y;
        expect(apart, `${a.key} / ${b.key}`).toBe(true);
      }
    }
  });

  it('is deterministic for the same input', () => {
    const items = sizes(30, 3);
    const a = packAtlas(items, { maxSize: 2048, paddingPx: 2 });
    const b = packAtlas(items, { maxSize: 2048, paddingPx: 2 });
    expect([...a.frames]).toEqual([...b.frames]);
  });

  it('refuses frames that cannot fit instead of clipping them', () => {
    expect(() =>
      packAtlas([{ key: 'huge', width: 3000, height: 10 }], {
        maxSize: 2048,
        paddingPx: 2,
      }),
    ).toThrow(/huge/);
    expect(() =>
      packAtlas(
        Array.from({ length: 200 }, (_, i) => ({
          key: `big-${i}`,
          width: 500,
          height: 500,
        })),
        { maxSize: 2048, paddingPx: 2 },
      ),
    ).toThrow(/2048/);
  });
});

describe('vehicle art atlas', () => {
  it('D-028: a conservative envelope of every legal distinct journey plus NPC fits at maximum scale', () => {
    // The shortest locomotive and shortest distinct wagons bound the count.
    let lengthU = Math.min(...locomotives.map((v) => v.lengthU));
    let distinctWagons = 0;
    for (const wagon of [...wagons].sort((a, b) => a.lengthU - b.lengthU)) {
      lengthU += wagon.lengthU + gameConfig.train.couplerGapU;
      if (lengthU > gameConfig.train.maxConsistLengthU) break;
      distinctWagons++;
    }
    expect(distinctWagons).toBe(11);
    // Each ranked-height slot dominates its real frame in both dimensions.
    // Includes every auxiliary part, even those no single ride could need.
    const partsByKey: Readonly<
      Record<string, { widthU: number; heightU: number }>
    > = artParts;
    const envelope: Record<string, { widthU: number; heightU: number }> = {};
    for (const [catalog, count] of [
      [locomotives, 3],
      [wagons, distinctWagons + 6],
    ] as const) {
      const heights = catalog
        .map((v) => {
          const body = partsByKey[`${v.id}.body`];
          if (!body) throw new Error(v.id);
          return body.heightU;
        })
        .sort((a, b) => b - a);
      const widthU = Math.max(
        ...locomotives.map((v) => v.lengthU),
        ...wagons.map((v) => v.lengthU),
      );
      for (let i = 0; i < count; i++) {
        const heightU = heights[i];
        if (heightU === undefined) throw new Error('missing envelope slot');
        for (const layer of ['body', 'overlay'])
          envelope[`${catalog === wagons ? 'wagon' : 'loco'}-${i}.${layer}`] = {
            widthU,
            heightU,
          };
      }
      for (const v of catalog) {
        const body = partsByKey[`${v.id}.body`];
        const overlay = partsByKey[`${v.id}.overlay`];
        expect(overlay?.widthU).toBe(body?.widthU);
        expect(overlay?.heightU).toBe(body?.heightU);
        expect(body?.widthU).toBeLessThanOrEqual(widthU);
      }
    }
    for (const [key, part] of Object.entries(artParts))
      if (!key.endsWith('.body') && !key.endsWith('.overlay'))
        envelope[key] = part;
    const atlas = packAtlas(artAtlasItems(envelope, ART_MAX_PX_PER_U), {
      maxSize: MAX_ATLAS_EDGE_PX,
      paddingPx: ATLAS_PADDING_PX,
    });
    expect(atlas.width).toBeLessThanOrEqual(2048);
    expect(atlas.height).toBeLessThanOrEqual(2048);
  });

  it('rasterises at the next scale step at or above the camera zoom', () => {
    // 1280 px wide window: zoom 0.576 → 0.75; 1920: 0.864 → 1.
    expect(artScaleFor(0.576)).toBe(0.75);
    expect(artScaleFor(0.864)).toBe(1);
    expect(artScaleFor(1)).toBe(1);
    expect(artScaleFor(1.73)).toBe(1.75);
    // Clamped: tiny windows stay legible, huge ones stay within the atlas.
    expect(artScaleFor(0.1)).toBe(0.5);
    expect(artScaleFor(9)).toBe(ART_MAX_PX_PER_U);
    // Backdrops are distant: never rasterised finer than 1 px/u.
    expect(artScaleFor(1.73, BACKDROP_MAX_PX_PER_U)).toBe(1);
    expect(artScaleFor(0.576, BACKDROP_MAX_PX_PER_U)).toBe(0.75);
  });

  for (const fixture of worstJourneyCases) {
    it(`fits ${fixture.name} in one journey atlas at ART_MAX_PX_PER_U`, () => {
      expect(fixture.vehicles).toHaveLength(
        fixture.name.startsWith('legal') ? 10 : 8,
      );
      expect(
        fixture.fleet.filter((v) => v.kind === 'steam' || v.kind === 'diesel'),
      ).toHaveLength(2);
      expect(fixture.fleet).toHaveLength(8);
      if (fixture.name.startsWith('legal')) {
        expect(
          fixture.vehicles.filter((v) =>
            ['steam', 'diesel', 'electric', 'fantasy'].includes(v.kind),
          ),
        ).toHaveLength(1);
        const lengthU =
          fixture.vehicles.reduce((sum, v) => sum + v.lengthU, 0) +
          (fixture.vehicles.length - 1) * gameConfig.train.couplerGapU;
        expect(lengthU).toBeLessThanOrEqual(gameConfig.train.maxConsistLengthU);
      }
      // The integrated world catalogue no longer fits one page: D-030 packs
      // region/season windows into at most two (tests/unit/render/atlasBound.*).
      for (const parts of [fixture.parts]) {
        const items = artAtlasItems(parts, ART_MAX_PX_PER_U);
        const atlas = packAtlas(items, {
          maxSize: MAX_ATLAS_EDGE_PX,
          paddingPx: ATLAS_PADDING_PX,
        });
        expect(atlas.frames.size).toBe(items.length);
        expect(atlas.width).toBeLessThanOrEqual(MAX_ATLAS_EDGE_PX);
        expect(atlas.height).toBeLessThanOrEqual(MAX_ATLAS_EDGE_PX);
      }
    });
  }

  it('fits each active backdrop window into its own atlas at 1 px/u', () => {
    for (const seed of [1, 2, 3, 4])
      for (const x of [5000, 117136, 493968, 1232896]) {
        const keys = backdropWindowFrames(seed, x);
        const backdrops = Object.fromEntries(
          Object.entries(worldParts).filter(([key]) => keys.includes(key)),
        );
        const items = artAtlasItems(backdrops, BACKDROP_MAX_PX_PER_U);
        expect(
          packAtlas(items, {
            maxSize: MAX_ATLAS_EDGE_PX,
            paddingPx: ATLAS_PADDING_PX,
          }).frames.size,
        ).toBe(keys.length);
      }
  });

  it('gives every frame a transparent margin for smooth edges without MSAA (D-013)', () => {
    const items = sizes(40, 3);
    const atlas = packAtlas(items, {
      maxSize: 2048,
      paddingPx: ATLAS_PADDING_PX,
    });
    const frames = framesWithMargin(atlas, items);
    expect(FRAME_MARGIN_PX).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      const frame = frames.get(item.key);
      const at = atlas.frames.get(item.key);
      if (!frame || !at) throw new Error(item.key);
      expect(frame).toEqual({
        x: at.x - FRAME_MARGIN_PX,
        y: at.y - FRAME_MARGIN_PX,
        width: item.width + 2 * FRAME_MARGIN_PX,
        height: item.height + 2 * FRAME_MARGIN_PX,
      });
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(atlas.width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(atlas.height);
      // A frame's margin never reaches another part's pixels.
      for (const other of items) {
        if (other === item) continue;
        const o = atlas.frames.get(other.key);
        if (!o) throw new Error(other.key);
        const apart =
          frame.x + frame.width <= o.x ||
          o.x + other.width <= frame.x ||
          frame.y + frame.height <= o.y ||
          o.y + other.height <= frame.y;
        expect(apart, `${item.key} / ${other.key}`).toBe(true);
      }
    }
  });

  it('puts the pivot origin inside the margin-grown frame', () => {
    // Part 30 × 10 u, pivot at its bottom middle, rasterised at 2 px/u.
    const frame = {
      width: 60 + 2 * FRAME_MARGIN_PX,
      height: 20 + 2 * FRAME_MARGIN_PX,
    };
    const origin = frameOrigin({ x: 15, y: 10 }, 2, frame);
    expect(origin.x * frame.width).toBeCloseTo(30 + FRAME_MARGIN_PX, 9);
    expect(origin.y * frame.height).toBeCloseTo(20 + FRAME_MARGIN_PX, 9);
  });
});

describe('journeyArtKeys (H0, D-019)', () => {
  it('includes bodies, overlays, wheels, steam rods and pantographs of player and fleet, once each', () => {
    const vehicles = [...locomotives, ...wagons].filter((v) =>
      ['steam_local', 'electric_retro', 'cargo_box'].includes(v.id),
    );
    const fleet = {
      locomotives: locomotives.filter(
        (v) => v.id === 'diesel_mainline' || v.id === 'steam_local',
      ),
      wagons: wagons.filter(
        (v) => v.id === 'cargo_box' || v.id === 'fun_balloons',
      ),
    };
    const keys = journeyArtKeys([...vehicles, ...vehicles], fleet);
    const expected = new Set(
      [...vehicles, ...fleet.locomotives, ...fleet.wagons].flatMap((v) => {
        const art = vehicleArt[v.id];
        if (!art) throw new Error(v.id);
        return vehicleArtLayers(art, v.lengthU, 0).map((layer) => layer.part);
      }),
    );
    expect(new Set(keys)).toEqual(expected);
    expect(keys).toHaveLength(expected.size);
    expect(keys).toEqual(
      expect.arrayContaining([
        'steam_local.coupling-rod',
        'steam_local.connecting-rod',
        'steam_local.crosshead',
        'electric_retro.pantograph',
        'electric_retro.pantograph-head',
        'wheel.diesel',
      ]),
    );
    expect(keys).not.toContain('magic_stars.body');
    for (const key of keys) expect(artParts[key]).toBeDefined();
  });
  it('has no keys for vehicles without art or an empty journey', () => {
    expect(
      journeyArtKeys([{ id: 'not-drawn-yet', lengthU: 164 }], {
        locomotives: [],
        wagons: [],
      }),
    ).toEqual([]);
  });
});
it('bounds low-profile residency even beyond 4096 CSS px while retaining the standard scale', () => {
  expect(profileArtScale(1.23, 'low')).toBe(1.25);
  expect(profileArtScale(1.54, 'low')).toBe(1.25);
  expect(profileArtScale(4, 'low')).toBe(1.25);
  expect(profileArtScale(1.54, 'standard')).toBe(1.75);
  expect(profileArtScale(4, 'standard')).toBe(2);
  expect(profileArtScale(0.576, 'low')).toBe(0.75);
});

it('caps the low-profile backdrop raster at 0.75 px/u and keeps 1 px/u on standard', () => {
  // D-028 zoom = 0.6 × CSS width / 2000 u at DPR 1 (low): 1140, 1920 and 4096 CSS px.
  expect(profileBackdropScale(0.342, 'low')).toBe(0.5);
  expect(profileBackdropScale(0.576, 'low')).toBe(0.75);
  expect(profileBackdropScale(1.23, 'low')).toBe(0.75);
  expect(profileBackdropScale(1.23, 'standard')).toBe(1);
  expect(profileBackdropScale(0.576, 'standard')).toBe(0.75);
});

it('packs world pages identically under Czech and English collation', () => {
  // Equal sizes leave the order to the key tie-break; Czech sorts "ch" after "h".
  const items = ['back.hra', 'back.cha', 'back.chb', 'back.ib'].map((key) => ({
    key,
    width: 900,
    height: 300,
  }));
  const packUnder = (locale: string) => {
    const collation = vi
      .spyOn(String.prototype, 'localeCompare')
      .mockImplementation(function (this: string, that: string) {
        return new Intl.Collator(locale).compare(this, that);
      });
    try {
      return packWorldPages(items).map((page) => [...page.plan.frames]);
    } finally {
      collation.mockRestore();
    }
  };
  expect(packUnder('cs')).toEqual(packUnder('en'));
  // Plain UTF-16 code-unit order: "back.cha" < "back.chb" < "back.hra" < "back.ib".
  expect(packUnder('cs')[0]?.map(([key]) => key)).toEqual([
    'back.cha',
    'back.chb',
    'back.hra',
    'back.ib',
  ]);
});
