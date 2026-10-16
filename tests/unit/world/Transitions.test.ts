import { describe, expect, it } from 'vitest';
import { regionAt, transitionAt } from '../../../src/domain/world/Regions.ts';
import { spatialNearPalette } from '../../../src/render/groundPalette.ts';

describe('GEN-18 spatial world transition', () => {
  it('ground and backdrop share progress over the final 8192 u of a region', () => {
    let region = regionAt(1, 0);
    while (regionAt(1, region.toXU).landscape !== 'forest')
      region = regionAt(1, region.toXU);
    const from = region.toXU - 8192;
    expect(transitionAt(1, from).progress).toBe(0);
    expect(transitionAt(1, from + 4096).progress).toBe(0.5);
    const start = spatialNearPalette(1, from, 'meadow');
    const mid = spatialNearPalette(1, from + 4096, 'meadow');
    const end = spatialNearPalette(1, region.toXU - 1, 'meadow');
    expect(mid).not.toEqual(start);
    expect(end).not.toEqual(mid);
    expect(spatialNearPalette(1, from + 4096, 'meadow')).toEqual(mid);
  });
});

import { contextAt } from '../../../src/domain/world/WorldPlan.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it('GEN-15/18: a coast transition establishes its connected sea before the region boundary', () => {
  let coast = regionAt(1, 0);
  while (coast.landscape !== 'coast') coast = regionAt(1, coast.toXU);
  const x = coast.fromXU - 1024;
  expect(contextAt(1, x).surface).toBe('sand');
  expect(
    chunkScenery(1, x / 1024, worldPlacementCatalog).water.some(
      (w) => w.kind === 'sea',
    ),
  ).toBe(true);
});

it('GEN-15: authored clearing ground remains a local glade inside its forest scene', () => {
  let k = 0;
  while (
    k < 480 &&
    chunkScenery(1, k, worldPlacementCatalog).locality !== 'clearing'
  )
    k++;
  const sc = chunkScenery(1, k, worldPlacementCatalog);
  expect(sc.region.season).not.toBe('winter');
  expect(
    sc.back.some(
      (span) =>
        span.style === 'glade' && span.fromX === 250 && span.toX === 770,
    ),
  ).toBe(true);
});

it('GEN-15: the incoming climate owns point admissibility after the transition midpoint', () => {
  let from = regionAt(1, 0),
    to = regionAt(1, from.toXU);
  while (from.season === to.season) {
    from = to;
    to = regionAt(1, from.toXU);
  }
  const place = contextAt(1, from.toXU - 1024);
  expect(place.season).toBe(to.season);
  expect(place.weather).toBe(to.weather);
});
it('GEN-23: near palette is continuous at every chunk border and incoming climate midpoint', () => {
  const errors: string[] = [];
  for (const seed of [1, 7, 123])
    for (let k = 0; k < 480; k++) {
      const x = (k + 1) * 1024;
      const surface = (x: number) => {
        const p = contextAt(seed, x).surface;
        return p === 'forest'
          ? 'forest'
          : p === 'sand'
            ? 'sand'
            : p === 'snow'
              ? 'snow'
              : 'meadow';
      };
      const a = surface(x - 1e-6),
        b = surface(x + 1e-6);
      const pa = spatialNearPalette(seed, x - 1e-6, a),
        pb = spatialNearPalette(seed, x + 1e-6, b);
      const colors = (p: typeof pa) => [
        p.bank,
        p.bankShade,
        p.bands.at(-1)?.color ?? 0,
      ];
      colors(pa).forEach((c, i) => {
        for (const shift of [0, 8, 16])
          if (
            Math.abs(
              ((c >> shift) & 255) - (((colors(pb)[i] ?? 0) >> shift) & 255),
            ) > 1
          )
            errors.push(`${seed}/${k}/${shift}`);
      });
    }
  expect(errors.slice(0, 10)).toEqual([]);
});

import {
  BACK_PALETTE,
  spatialBackPalette,
} from '../../../src/render/groundPalette.ts';
it.each(['wheat', 'crops', 'glade'] as const)(
  'GEN-23: authored %s background stays continuous at transition start',
  (base) => {
    const x = 49152;
    expect(transitionAt(1, x).progress).toBe(0);
    const a = spatialBackPalette(1, x, base),
      b = spatialBackPalette(1, x + 0.001, base);
    expect(a).toEqual(BACK_PALETTE[base]);
    expect(b).toEqual(a);
  },
);

it('GEN-23: a projected background overhang uses the incoming surface after the half-open border', () => {
  const x = 57344 + 8;
  expect(contextAt(1, x, 'back').surface).toBe('forest');
  expect(spatialBackPalette(1, x, 'wheat', 55 * 1024)).toEqual(
    BACK_PALETTE.forest,
  );
});
