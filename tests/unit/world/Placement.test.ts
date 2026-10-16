import { describe, expect, it } from 'vitest';
import {
  worldPlacementCatalog as catalog,
  placementCatalog,
} from '../../../src/content/worldPlacementCatalog.ts';
import { placementConflict } from '../../../src/domain/world/Placement.ts';
import {
  villageRoad,
  projectedBounds,
  propFootU,
  propScale,
  waterSectionU,
} from '../../../src/domain/world/SceneryGeometry.ts';
import { roadReservation } from '../../../src/domain/world/Reservations.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { fencesInChunk } from '../../../src/domain/world/Fences.ts';
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';

// Released v1 audit reproduction: house foot lies on the right-hand road bend.
const car = {
  kind: 'back.car',
  layer: 'back' as const,
  xU: 594.4792540967464,
  depth: 0.20812504755798727,
  scale: 1.0369250679761173,
  flip: false,
  motion: { rangeU: 400 },
};
const house = {
  kind: 'back.house-a',
  layer: 'back' as const,
  xU: 874.4913248941302,
  depth: 0.5266466375207528,
  scale: 0.9623584553599358,
  flip: false,
};

describe('GEN-14 footprints, dependencies and fence ownership', () => {
  it('rejects the audited house on the village road bend: 1/1 prop:2', () => {
    const reservation = roadReservation(villageRoad(1, 1, car, 'audit-car'));
    expect(placementConflict(1, 1, house, catalog, [reservation])).toBe(
      reservation.id,
    );
  });
  it('mirrors asymmetric pivots and rotates envelopes around the shared foot', () => {
    const part = {
      widthU: 100,
      heightU: 50,
      pivotU: { xU: 20, yU: 50 },
      contactWidth: 1,
    };
    const p = {
      kind: 'fixture',
      layer: 'back' as const,
      xU: 500,
      depth: 0,
      scale: 1,
      flip: false,
    };
    const forward = projectedBounds(1, 0, p, part),
      mirror = projectedBounds(1, 0, { ...p, flip: true }, part);
    expect(forward.rightU - forward.leftU).toBe(100);
    expect(mirror.leftU).toBe(420);
    expect(forward.leftU).toBe(480);
    const rotated = projectedBounds(
      1,
      0,
      { ...p, rotationRad: Math.PI / 2 },
      part,
    );
    expect(rotated.rightU - rotated.leftU).toBeCloseTo(50, 8);
    expect(propFootU(p, 500, 10, 0)).toEqual({ xU: 500, yU: -10 });
  });
  it('validates art numbers at the content boundary', () => {
    expect(() =>
      placementCatalog({
        bad: { widthU: NaN, heightU: 10, pivotU: { x: 0, y: 0 } },
      }),
    ).toThrow('invalid placement art');
  });
  it('shares the entire fence over a seam, with one actual start and end', () => {
    let seam = 0;
    for (let k = 0; k < 100; k++)
      if (fencesInChunk(1, k).length) {
        seam = k;
        break;
      }
    const first = fencesInChunk(1, seam)[0];
    expect(first).toBeDefined();
    if (!first) return;
    const second = fencesInChunk(1, seam + 1)[0];
    expect(second).toEqual(first);
    expect(first.posts[0]?.xU).toBe(first.fromXU);
    expect(first.posts.at(-1)?.xU).toBe(first.toXU);
    expect(new Set(first.posts.map((p) => p.xU)).size).toBe(first.posts.length);
    expect(sceneAt(1, first.fromXU).id).toBe(first.ownerId);
  });
  it('rejection never renumbers surviving candidate identities', () => {
    const normal = chunkScenery(1, 5, catalog);
    const part = catalog['tree.oak'];
    if (!part) throw new Error('missing oak');
    const altered = chunkScenery(1, 5, {
      ...catalog,
      'tree.oak': { ...part, widthU: 10000 },
    });
    const ids = new Set(normal.props.map((p) => p.id));
    for (const p of altered.props) expect(ids.has(p.id), p.id).toBe(true);
  });
  it('mills have their wheel on the referenced flowing race', () => {
    let mills = 0;
    for (let k = 0; k < 480; k++) {
      const sc = chunkScenery(7, k, catalog);
      for (const p of sc.props.filter((p) => p.kind === 'back.watermill')) {
        mills++;
        const w = sc.water.find(
          (w) => w.kind === 'channel' && p.dependencies?.includes(w.id),
        );
        expect(w).toBeDefined();
        if (!w) continue;
        const part = catalog[p.kind];
        if (!part) throw new Error('missing mill');
        const foot = projectedBounds(7, k, p, part, true).bottomU;
        const section = waterSectionU(7, k, w, p.xU + 33 * propScale(p));
        expect(foot - 8 * propScale(p)).toBeGreaterThanOrEqual(section.topU);
        expect(foot - 8 * propScale(p)).toBeLessThanOrEqual(section.bottomU);
      }
    }
    expect(mills).toBeGreaterThan(0);
  });
});

it('GEN-17: neighbouring houses avoid the last two facades across a chunk seam', () => {
  // Content selection v2: seed 1 has a populated village seam at 32/33.
  const houses = [32, 33]
    .flatMap((k) =>
      chunkScenery(1, k, catalog)
        .props.filter((p) => p.kind.startsWith('back.house-'))
        .map((p) => ({ ...p, worldXU: k * 1024 + p.xU })),
    )
    .sort((a, b) => a.worldXU - b.worldXU);
  expect(houses.length).toBeGreaterThan(2);
  for (const [i, p] of houses.entries())
    expect(
      houses.slice(Math.max(0, i - 2), i).map((p) => p.kind),
    ).not.toContain(p.kind);
});

it('GEN-16: a graded fence has no almost coincident regular and end posts', () => {
  const fences = new Map(
    Array.from({ length: 100 }, (_, k) => fencesInChunk(1, k))
      .flat()
      .map((f) => [f.id, f]),
  );
  expect(fences.size).toBeGreaterThan(0);
  for (const fence of fences.values())
    for (let i = 1; i < fence.posts.length; i++) {
      const a = fence.posts[i - 1],
        b = fence.posts[i];
      if (!a || !b) throw new Error('missing post');
      expect(
        Math.hypot(b.xU - a.xU, b.yU - a.yU),
        `${fence.id}/${i}`,
      ).toBeGreaterThan(8);
    }
});

it('GEN-17: nearby houses retain recent facades across distinct scene boundaries', () => {
  const houses = Array.from({ length: 64 }, (_, k) =>
    chunkScenery(1, k, catalog)
      .props.filter((p) => p.kind.startsWith('back.house-'))
      .map((p) => ({ ...p, worldXU: k * 1024 + p.xU })),
  )
    .flat()
    .sort((a, b) => a.worldXU - b.worldXU);
  for (const [i, p] of houses.entries()) {
    const recent = houses
      .slice(Math.max(0, i - 2), i)
      .filter((prior) => p.worldXU - prior.worldXU < 1024);
    expect(
      recent.map((prior) => prior.kind),
      p.id,
    ).not.toContain(p.kind);
  }
});
