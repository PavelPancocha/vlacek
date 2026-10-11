import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { vehicleArtLayers } from '../../../src/content/artLayers.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { worstJourneyFixtures } from './journeyBudgetFixture.ts';
import { describe, expect, it } from 'vitest';
import { isBackdropPart, worldParts } from '../../../src/content/worldArt.ts';
import {
  ART_MAX_PX_PER_U,
  BACKDROP_MAX_PX_PER_U,
  ATLAS_PADDING_PX,
  FRAME_MARGIN_PX,
  MAX_ATLAS_EDGE_PX,
  artAtlasItems,
  artScaleFor,
  frameOrigin,
  framesWithMargin,
  packAtlas,
  journeyArtKeys,
} from '../../../src/render/atlasPacking.ts';

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

  for (const fixture of worstJourneyFixtures) {
    it(`fits ${fixture.name} and the separate world atlas at ART_MAX_PX_PER_U`, () => {
      expect(fixture.vehicles).toHaveLength(8);
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
      const world = Object.fromEntries(
        Object.entries(worldParts).filter(([key]) => !isBackdropPart(key)),
      );
      for (const parts of [world, fixture.parts]) {
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

  it('fits the backdrops and clouds into their own atlas at 1 px/u', () => {
    const backdrops = Object.fromEntries(
      Object.entries(worldParts).filter(([key]) => isBackdropPart(key)),
    );
    expect(Object.keys(backdrops).length).toBe(15);
    const items = artAtlasItems(backdrops, BACKDROP_MAX_PX_PER_U);
    expect(
      packAtlas(items, {
        maxSize: MAX_ATLAS_EDGE_PX,
        paddingPx: ATLAS_PADDING_PX,
      }).frames.size,
    ).toBe(15);
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
