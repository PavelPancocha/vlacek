import { expect, it } from 'vitest';
import {
  chunkScenery,
  stationSite,
} from '../../../src/domain/world/Scenery.ts';
import {
  settlementScenery,
  settlementStreetPlan,
} from '../../../src/domain/world/SettlementScenery.ts';
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import {
  boundsHitPolygon,
  clipPolygonX,
  projectedBounds,
  rectPolygon,
  roadPolygon,
  roadSide,
  polygonsHit,
  pointInside,
} from '../../../src/domain/world/SceneryGeometry.ts';
import type { RoadPath } from '../../../src/domain/world/SceneryGeometry.ts';
import {
  validateChunkScenery,
  validateFootpathJoin,
  validateInfrastructureSurfaces,
  validateOwnership,
  worldMotifCoverage,
} from '../../../src/domain/world/WorldValidation.ts';

const houses = (k: number) =>
  chunkScenery(1, k, catalog).props.filter((p) => p.kind.includes('house'));
it('review 5: station reservations have priority over an overlapping work yard (seed 0 / 49)', () => {
  const sc = chunkScenery(0, 49, catalog);
  expect(sc.features.some((f) => f.kind === 'station')).toBe(true);
  expect(validateChunkScenery(0, sc, catalog)).toEqual([]);
});
it('review 3: a shared foreground path keeps one logical owner and extent across both scene chunks', () => {
  const chunks = [8, 9].map((chunkIndex) => {
    const sc = chunkScenery(1, chunkIndex, catalog);
    return {
      chunkIndex,
      features: sc.features,
      propIds: sc.props.map((p) => p.id),
    };
  });
  expect(validateOwnership(chunks)).toEqual([]);
});
it('review 1/4: optional garden fencing cannot claim the chapel parcel (seed 0 / 10)', () => {
  const sc = chunkScenery(0, 10, catalog);
  expect(sc.props.some((p) => p.kind === 'back.chapel')).toBe(true);
  expect(validateChunkScenery(0, sc, catalog)).toEqual([]);
});
it('review 1: house gardens share a geometric parcel behind the railway; allotment gates reach their own low path', () => {
  const sc = chunkScenery(1, 8, catalog);
  const gardenFeatures = sc.features.filter((f) => f.kind === 'house-garden');
  expect(gardenFeatures.length).toBeGreaterThan(0);
  for (const f of gardenFeatures) {
    const house = sc.props.find((p) => p.id === f.ownerId),
      garden = sc.props.find((p) => p.dependencies?.includes(f.id));
    expect(house).toBeDefined();
    expect(garden).toBeDefined();
    if (!house || !garden) continue;
    expect(garden.layer).toBe('back');
    const h = catalog[house.kind],
      g = catalog[garden.kind];
    if (!h || !g) throw Error('missing art');
    const hb = projectedBounds(1, 8, house, h, true),
      gb = projectedBounds(1, 8, garden, g, true);
    expect(
      sc.reservations.some(
        (r) =>
          r.purpose === 'parcel' &&
          r.ownerId === house.id &&
          rectPolygon(gb).every((v) => pointInside(v, r.polygon)),
      ),
    ).toBe(true);
    expect(
      Math.abs((hb.leftU + hb.rightU - gb.leftU - gb.rightU) / 2),
    ).toBeLessThan(170);
    expect(Math.abs(hb.bottomU - gb.bottomU)).toBeLessThan(40);
  }
  const front = sc.props.filter(
    (p) => p.kind.startsWith('near.garden-') && p.layer === 'near',
  );
  expect(front.length).toBeGreaterThan(0);
  for (const f of sc.fences.filter((f) => f.layer === 'near')) {
    const a = f.posts[f.gatePanel ?? -1],
      b = f.posts[(f.gatePanel ?? -1) + 1];
    expect(a && b).toBeTruthy();
    if (!a || !b) continue;
    const gate = { xU: (a.xU + b.xU) / 2, yU: (a.yU + b.yU) / 2 };
    expect(
      sc.roads.some(
        (r) =>
          'layer' in r &&
          r.layer === 'near' &&
          pointInside(gate, roadPolygon(r, 2)),
      ),
    ).toBe(true);
  }
});
it('review 2 / VI02: one irregular scene-wide green with more accepted houses than either edge', () => {
  const centre = [10, 11].map((k) => chunkScenery(1, k, catalog));
  const greens = centre.flatMap((sc) =>
    sc.reservations.filter((r) => r.purpose === 'village-green'),
  );
  expect(new Set(greens.map((r) => r.id)).size).toBe(1);
  expect(greens[0]?.polygon).toEqual(greens[1]?.polygon);
  expect(new Set(greens[0]?.polygon.map((p) => p.yU)).size).toBeGreaterThan(3);
  const density = centre.reduce(
    (n, sc) => n + sc.props.filter((p) => p.kind.includes('house')).length,
    0,
  );
  expect(density).toBeGreaterThan(houses(8).length + houses(9).length);
  expect(density).toBeGreaterThan(houses(12).length + houses(13).length);
  expect(
    centre.flatMap((sc) => sc.props).filter((p) => p.kind === 'tree.linden'),
  ).toHaveLength(1);
  expect(
    centre.flatMap((sc) => sc.props).filter((p) => p.kind === 'back.bench'),
  ).toHaveLength(1);
  const green = greens[0];
  if (!green) throw Error('missing green');
  for (const sc of centre)
    for (const h of sc.props.filter((p) => p.kind.includes('house'))) {
      const part = catalog[h.kind];
      if (!part) throw Error('missing house');
      expect(
        boundsHitPolygon(
          projectedBounds(1, sc.chunkIndex, h, part, true),
          green.polygon,
        ),
      ).toBe(false);
      expect(sc.roads.some((r) => h.dependencies?.includes(r.id))).toBe(true);
    }
});
it('review 3: town pedestrian path and station service route are continuous and stay outside the train band', () => {
  const town = Array.from({ length: 480 }, (_, k) => k).find(
    (k) => sceneAt(1, k * 1024).templateId === 'settlements-street',
  );
  if (town === undefined) throw Error('no town');
  for (const k of [town, town + 1, 9, 217]) {
    const sc = chunkScenery(1, k, catalog),
      paths = sc.roads.filter((r) => 'layer' in r && r.layer === 'near');
    expect(paths.length, `chunk ${k}`).toBeGreaterThan(0);
    expect(
      sc.props.some(
        (p) =>
          p.layer === 'near' &&
          p.dependencies?.some((id) => paths.some((r) => r.id === id)),
      ),
    ).toBe(true);
    for (const path of paths)
      for (const r of sc.reservations.filter((r) => r.purpose === 'track'))
        expect(polygonsHit(roadPolygon(path), r.polygon)).toBe(false);
  }
  const a = chunkScenery(1, town, catalog).roads.find((r) =>
    r.id.includes('pedestrian'),
  );
  const b = chunkScenery(1, town + 1, catalog).roads.find(
    (r) => r.id === a?.id,
  );
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  expect(a?.points.at(-1)).toEqual(b?.points[0]);
  expect(
    chunkScenery(1, 9, catalog).reservations.some((r) =>
      r.id.includes('forecourt'),
    ),
  ).toBe(true);
});
it('review 4 / VI03: seed 1 chunk 13 parcels and access corridors do not overlap other buildings', () => {
  const sc = chunkScenery(1, 13, catalog);
  const built = sc.props.filter((p) =>
    /house|barn|farmstead|playground|shelter/.test(p.kind),
  );
  expect(built.some((p) => p.kind === 'back.playground')).toBe(true);
  for (const a of built) {
    const part = catalog[a.kind];
    if (!part) throw Error('missing art');
    const body = projectedBounds(1, 13, a, part);
    for (const b of built.filter((b) => b.id !== a.id)) {
      const other = catalog[b.kind];
      if (!other) throw Error('missing art');
      expect(
        boundsHitPolygon(body, rectPolygon(projectedBounds(1, 13, b, other))),
        `${a.kind}/${b.kind}`,
      ).toBe(false);
    }
    for (const path of sc.roads.filter(
      (r) => r.id.endsWith(':access') && r.ownerId !== a.id,
    ))
      expect(
        boundsHitPolygon(body, roadPolygon(path)),
        `${a.kind}/${path.id}`,
      ).toBe(false);
  }
});
it('review 4: an access crossing an accepted building is rejected rather than drawn through it', () => {
  const k = 218,
    x = k * 1024;
  const base = settlementScenery(
    1,
    k,
    sceneAt(1, x),
    regionAt(1, x),
    catalog,
    [],
    0,
  );
  const middle = base.props
    .filter((p) => p.kind.includes('house'))
    .sort((a, b) => a.xU - b.xU)[1];
  if (!middle) throw Error('missing middle house');
  const expanded = {
    ...catalog,
    [middle.kind]: {
      ...catalog[middle.kind],
      widthU: 960,
      heightU: 180,
      pivotU: { xU: 480, yU: 180 },
      contactWidth: 1,
    },
  };
  const sc = settlementScenery(
    1,
    k,
    sceneAt(1, x),
    regionAt(1, x),
    expanded,
    [],
    0,
  );
  for (const a of sc.props.filter((p) => p.kind.includes('house'))) {
    const part = expanded[a.kind];
    if (!part) throw Error('missing art');
    for (const path of sc.roads.filter(
      (r) => r.ownerId !== a.id && r.id.endsWith(':access'),
    ))
      expect(
        boundsHitPolygon(projectedBounds(1, k, a, part), roadPolygon(path)),
      ).toBe(false);
  }
  expect(
    sc.props.filter((p) => p.kind.includes('house')).length,
  ).toBeGreaterThan(0);
});
it('review 5: the first town station street is reserved before houses (seed 1 / slot 2)', () => {
  const k = Array.from({ length: 480 }, (_, k) => k).find(
    (k) => regionAt(1, k * 1024).landscape === 'town',
  );
  if (k === undefined) throw Error('no town');
  const sc = chunkScenery(1, k + 2, catalog);
  const street = sc.roads.find((r) => r.id.endsWith(':street'));
  expect(street).toBeDefined();
  if (!street) return;
  expect(
    sc.reservations.some(
      (r) =>
        r.ownerId === street.ownerId &&
        polygonsHit(r.polygon, roadPolygon(street)),
    ),
  ).toBe(true);
  for (const house of sc.props.filter((p) => p.kind.includes('house'))) {
    const part = catalog[house.kind];
    if (!part) throw Error('missing art');
    expect(
      boundsHitPolygon(
        projectedBounds(1, k + 2, house, part, true),
        roadPolygon(street),
      ),
    ).toBe(false);
  }
});
it('review 5: a coastal halt has dry reserved access and the validator catches a road moved into the sea', () => {
  const k = Array.from({ length: 480 }, (_, k) => k).find(
    (k) => regionAt(1, k * 1024).landscape === 'coast' && stationSite(1, k),
  );
  if (k === undefined) throw Error('no coastal halt');
  const sc = chunkScenery(1, k, catalog);
  for (const road of sc.roads)
    for (const water of sc.reservations.filter((r) => r.purpose === 'water'))
      expect(polygonsHit(roadPolygon(road), water.polygon)).toBe(false);
  const street = sc.roads.find((r) => r.id.endsWith(':street'));
  if (!street) throw Error('missing street');
  sc.roads = sc.roads.map((r) =>
    r === street
      ? { ...r, points: r.points.map((p) => ({ ...p, yU: p.yU - 50 })) }
      : r,
  );
  expect(
    validateInfrastructureSurfaces(1, sc).some((e) => e.includes('road-water')),
  ).toBe(true);
});
it('review 7: a rejected main street degrades to fewer houses with valid access, never an empty settlement', () => {
  const x = 8192;
  const blocked = {
    id: 'roads:parallel',
    ownerId: 'roads',
    purpose: 'village-road' as const,
    layer: 'back' as const,
    polygon: rectPolygon({
      leftU: x,
      rightU: x + 1024,
      topU: -155,
      bottomU: -125,
    }),
  };
  const sc = settlementScenery(
    1,
    8,
    sceneAt(1, x),
    regionAt(1, x),
    catalog,
    [blocked],
    0,
  );
  expect(sc.props.some((p) => p.kind.includes('house'))).toBe(true);
  const span = settlementStreetPlan(1, x);
  const street = sc.roads.find((r) => r.id.includes(':street:'));
  const next = chunkScenery(1, 9, catalog).roads.find((r) =>
    r.id.includes(':street:'),
  );
  if (!span || !street || !next) throw Error('missing connected street');
  expect(street.fromXU).toBe(x);
  expect(street.toXU).toBe(x + 1024);
  expect(street.points[0]).toMatchObject(span.endpoints[0] ?? {});
  expect(street.points.at(-1)).toEqual(next.points[0]);
  const canonical = chunkScenery(1, 8, catalog).roads.find((r) =>
    r.id.includes(':street:'),
  );
  if (!canonical) throw Error('missing canonical street');
  // Preserve the sampled endpoint tangents too, so the road edges join as well as its centre.
  expect(street.points[1]).toEqual(canonical.points[1]);
  expect(street.points.at(-2)).toEqual(canonical.points.at(-2));
  for (const side of [-1, 1]) {
    expect(roadSide(street, side)[0]).toEqual(roadSide(canonical, side)[0]);
    expect(roadSide(street, side).at(-1)).toEqual(
      roadSide(canonical, side).at(-1),
    );
  }
  // Check the swept surface, including the returning detour shoulders.
  expect(polygonsHit(roadPolygon(street, 4), blocked.polygon)).toBe(false);
  for (const road of sc.roads)
    if (!('layer' in road && road.layer === 'near'))
      expect(polygonsHit(roadPolygon(road), blocked.polygon)).toBe(false);
});
it('review 7: the owned street joins continuously across station and green chunks, with exported endpoints', () => {
  const span = settlementStreetPlan(1, 8192);
  expect(span).toBeDefined();
  if (!span) return;
  expect(settlementStreetPlan(1, 0)).toEqual(span);
  const streets = Array.from({ length: 6 }, (_, i) =>
    chunkScenery(1, 8 + i, catalog).roads.find((r) =>
      r.id.includes(':street:'),
    ),
  );
  expect(streets[0]?.points[0]).toMatchObject(span.endpoints[0] ?? {});
  expect(streets[5]?.points.at(-1)).toMatchObject(span.endpoints[1] ?? {});
  for (let i = 1; i < streets.length; i++) {
    const before = streets[i - 1],
      after = streets[i];
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    if (!before || !after) continue;
    if (before.toXU === after.fromXU)
      expect(before.points.at(-1)).toEqual(after.points[0]);
    else {
      // A portal can occlude the street, but an arbitrary geometry seam cannot.
      const gap = rectPolygon({
        leftU: before.toXU,
        rightU: after.fromXU,
        topU: -1000,
        bottomU: 0,
      });
      expect(
        chunkScenery(1, 8 + i, catalog).reservations.some(
          (r) => r.purpose === 'secondary-hill' && polygonsHit(gap, r.polygon),
        ),
      ).toBe(true);
    }
  }
});
it('review 8: negative town streets retain all facades and avoid adjacent repetition', () => {
  for (const from of [-480, -1_000_000_000]) {
    const k = Array.from({ length: 480 }, (_, i) => from + i).find(
      (k) => sceneAt(1, k * 1024).templateId === 'settlements-street',
    );
    if (k === undefined) throw Error('no negative town street');
    const sc = chunkScenery(1, k, catalog),
      hs = sc.props
        .filter((p) => /row-house|apartment-house|panel-house/.test(p.kind))
        .sort((a, b) => a.xU - b.xU);
    expect(hs.length, `chunk ${k}`).toBeGreaterThanOrEqual(3);
    expect(new Set(hs.map((p) => p.kind)).size).toBe(3);
    for (let i = 1; i < hs.length; i++)
      expect(hs[i]?.kind).not.toBe(hs[i - 1]?.kind);
  }
});
it('review 10 / TO05: accepted warehouse, sawmill and materials are contained in their working yard', () => {
  const k = Array.from({ length: 480 }, (_, k) => k).find(
    (k) => sceneAt(1, k * 1024).templateId === 'settlements-yard',
  );
  if (k === undefined) throw Error('no yard');
  const sc = chunkScenery(1, k, catalog),
    yard = sc.reservations.find((r) => r.id.includes(':working-yard'));
  expect(yard).toBeDefined();
  if (!yard) return;
  const goods = sc.props.filter((p) =>
    /warehouse|sawmill|logs|crates/.test(p.kind),
  );
  expect(goods.length).toBeGreaterThanOrEqual(4);
  for (const p of goods) {
    const part = catalog[p.kind];
    if (!part) throw Error('missing art');
    expect(
      rectPolygon(projectedBounds(1, k, p, part)).every((v) =>
        pointInside(v, yard.polygon),
      ),
    ).toBe(true);
  }
  expect(validateChunkScenery(1, sc, catalog)).toEqual([]);
});

it('review 2 / TO01: a complete ordinary suburb has 6–10 safely spaced accepted houses (seed 6 / 78–79)', () => {
  const chunks = [78, 79].map((k) => chunkScenery(6, k, catalog));
  for (const sc of chunks) {
    expect(sc.scene.templateId).toBe('settlements-suburb');
    expect(sc.features.some((f) => f.kind === 'station')).toBe(false);
    expect(sc.crossing).toBeUndefined();
    expect(sc.tunnel).toBeUndefined();
    const street = sc.roads.filter((r) => r.id.includes(':street:'));
    expect(street).toHaveLength(1);
    expect(street[0]?.fromXU).toBe(sc.chunkIndex * 1024);
    expect(street[0]?.toXU).toBe((sc.chunkIndex + 1) * 1024);
    expect(validateChunkScenery(6, sc, catalog)).toEqual([]);
    const parcels = sc.reservations.filter((r) => r.purpose === 'parcel');
    for (let i = 0; i < parcels.length; i++)
      for (const other of parcels.slice(i + 1)) {
        const parcel = parcels[i];
        if (parcel)
          expect(polygonsHit(parcel.polygon, other.polygon)).toBe(false);
      }
  }
  const accepted = chunks.flatMap((sc) =>
    sc.props.filter((p) => p.kind.includes('house')),
  );
  expect(accepted.length).toBeGreaterThanOrEqual(6);
  expect(accepted.length).toBeLessThanOrEqual(10);
  expect(accepted.some((p) => p.kind === 'back.row-house')).toBe(true);
  expect(accepted.some((p) => p.kind.startsWith('back.house-'))).toBe(true);
});

it('VI01 / TO01: foreground beds share one enclosed allotment with a connected gate and internal paths', () => {
  const sc = chunkScenery(1, 8, catalog);
  const beds = sc.props.filter(
    (p) => p.kind.startsWith('near.garden-') && p.layer === 'near',
  );
  expect(beds).toHaveLength(4);
  const boundary = sc.fences.filter((f) => f.layer === 'near');
  expect(boundary).toHaveLength(1);
  const fence = boundary[0];
  if (!fence) throw Error('missing allotment boundary');
  const group = sc.features.find((f) => f.kind === 'allotments');
  expect(fence.ownerId).toBe(group?.id);
  expect(fence.closed).toBe(true);
  expect(new Set(fence.posts.map((p) => `${p.xU}/${p.yU}`)).size).toBe(
    fence.posts.length,
  );
  expect(
    chunkScenery(1, 9, catalog).fences.filter((f) => f.layer === 'near'),
  ).toHaveLength(0);
  expect(fence.toXU - fence.fromXU).toBeGreaterThan(500);
  const internal = sc.roads.filter((r) => r.ownerId === group?.id);
  expect(internal.length).toBeGreaterThanOrEqual(2);
  const gateA = fence.posts[fence.gatePanel ?? -1];
  const gateB = fence.posts[(fence.gatePanel ?? -1) + 1];
  if (!gateA || !gateB) throw Error('missing gate');
  const gate = { xU: (gateA.xU + gateB.xU) / 2, yU: (gateA.yU + gateB.yU) / 2 };
  expect(internal.some((r) => pointInside(gate, roadPolygon(r)))).toBe(true);
  const publicPath = sc.roads.find((r) => group?.dependencies.includes(r.id));
  if (!publicPath) throw Error('missing public access');
  expect(
    internal.some((r) => polygonsHit(roadPolygon(r), roadPolygon(publicPath))),
  ).toBe(true);
  for (const bed of beds) {
    const part = catalog[bed.kind];
    if (!part) throw Error('missing bed art');
    expect([part.widthU, part.heightU]).toEqual([100, 20]);
    const body = projectedBounds(1, 8, bed, part);
    expect(rectPolygon(body).every((v) => pointInside(v, fence.posts))).toBe(
      true,
    );
    expect(bed.dependencies).toContain(group?.id);
    const access = internal.find((r) => bed.dependencies?.includes(r.id));
    expect(access).toBeDefined();
    if (!access) continue;
    // The short spur reaches the bed edge, without crossing another bed.
    expect(
      boundsHitPolygon(
        { ...body, bottomU: body.bottomU + 4 },
        roadPolygon(access),
      ),
    ).toBe(true);
    for (const other of beds.filter((p) => p !== bed)) {
      const art = catalog[other.kind];
      if (!art) throw Error('missing art');
      expect(
        boundsHitPolygon(
          projectedBounds(1, 8, other, art),
          roadPolygon(access),
        ),
      ).toBe(false);
    }
  }
  expect(validateChunkScenery(1, sc, catalog)).toEqual([]);
});

it('VI01: validator requires a shared boundary and contained beds, with positive allotment coverage', () => {
  const sc = chunkScenery(1, 8, catalog);
  expect(
    worldMotifCoverage([{ seed: 1, scenery: sc }], catalog)[
      'settlements-allotments'
    ],
  ).toBeGreaterThan(0);
  expect(worldMotifCoverage([], catalog)['settlements-allotments']).toBe(0);
  const bed = sc.props.find(
    (p) => p.kind.startsWith('near.garden-') && p.layer === 'near',
  );
  if (!bed) throw Error('missing allotment bed');
  const moved = {
    ...sc,
    props: sc.props.map((p) => (p === bed ? { ...p, depth: 0.8 } : p)),
  };
  expect(
    validateChunkScenery(1, moved, catalog).some((e) =>
      e.includes('allotment-envelope'),
    ),
  ).toBe(true);
  const open = {
    ...sc,
    fences: sc.fences.map((f) =>
      f.layer === 'near' ? { ...f, closed: false } : f,
    ),
  };
  expect(
    validateChunkScenery(1, open, catalog).some((e) =>
      e.includes('allotment-boundary'),
    ),
  ).toBe(true);
});

const footpaths = (seed: number, k: number) => {
  const sc = chunkScenery(seed, k, catalog);
  return {
    sc,
    paths: sc.roads.filter(
      (r) =>
        r.layer === 'near' && r.style === 'path' && r.ownerId === sc.scene.id,
    ),
  };
};
it('review 11: the foreground footpath narrows to a point at both town edges (seed 6 / 55 → 56, 79 → 80)', () => {
  const span = settlementStreetPlan(6, 79 * 1024);
  expect(span).toMatchObject({ fromXU: 56 * 1024, toXU: 80 * 1024 });
  if (!span) return;
  // The countryside on either side carries no continuation.
  for (const k of [55, 80]) {
    const { sc, paths } = footpaths(6, k);
    expect(sc.scene.templateId.startsWith('settlements-')).toBe(false);
    expect(paths).toEqual([]);
  }
  for (const [k, edge, tipFirst] of [
    [79, span.toXU, false],
    [56, span.fromXU, true],
  ] as const) {
    const { sc, paths } = footpaths(6, k);
    expect(sc.scene.templateId).toBe('settlements-suburb');
    expect(paths).toHaveLength(1);
    const path = paths[0];
    if (!path) continue;
    const inward = tipFirst ? path.points : [...path.points].reverse();
    expect(inward[0]?.xU).toBe(edge);
    // The drawn end is a point, not a flat 10-u cap at the settlement edge.
    const [left, right] = [-1, 1].map((sign) => {
      const side = roadSide(path, sign);
      return tipFirst ? side[0] : side.at(-1);
    });
    if (!left || !right) throw Error('missing footpath side');
    expect(
      Math.hypot(left.xU - right.xU, left.yU - right.yU),
      `chunk ${k} drawn end width`,
    ).toBe(0);
    // It narrows steadily inside the settlement and is full width 160 u in.
    for (let i = 1; i < inward.length; i++)
      expect(inward[i]?.halfWidthU).toBeGreaterThanOrEqual(
        inward[i - 1]?.halfWidthU ?? Infinity,
      );
    for (const p of inward)
      if (Math.abs(p.xU - edge) >= 160) expect(p.halfWidthU).toBe(5);
    // Reservations follow the drawn geometry.
    expect(
      sc.reservations.find((r) => r.id === `${path.id}:reserve:village-road`)
        ?.polygon,
    ).toEqual(roadPolygon(path, 4));
    expect(validateChunkScenery(6, sc, catalog)).toEqual([]);
  }
  // Internal joins keep their shared full-width geometry.
  for (const k of [57, 78, 79]) {
    const before = footpaths(6, k - 1).paths[0],
      after = footpaths(6, k).paths[0];
    expect(before?.points.at(-1)).toEqual(after?.points[0]);
    expect(after?.points[0]?.halfWidthU).toBe(5);
  }
});
it('review 11: validator rejects a flat footpath end at a settlement edge, with positive coverage', () => {
  const { sc, paths } = footpaths(6, 79);
  const path = paths[0];
  if (!path) throw Error('missing footpath');
  const flat = {
    ...sc,
    roads: sc.roads.map((r) =>
      r === path
        ? { ...r, points: r.points.map((p) => ({ ...p, halfWidthU: 5 })) }
        : r,
    ),
  };
  expect(
    validateChunkScenery(6, flat, catalog).filter((e) =>
      e.includes(`footpath-end ${path.id}`),
    ),
  ).toHaveLength(1);
  expect(
    worldMotifCoverage([{ seed: 6, scenery: sc }], catalog)[
      'settlements-footpath-end'
    ] ?? 0,
  ).toBeGreaterThan(0);
  expect(worldMotifCoverage([], catalog)['settlements-footpath-end']).toBe(0);
});

/** Drawn width at the first and last point of a path. */
const drawnEndWidths = (path: RoadPath) =>
  [0, path.points.length - 1].map((i) => {
    const [l, r] = [-1, 1].map((sign) => roadSide(path, sign)[i]);
    if (!l || !r) throw Error('missing path side');
    return Math.hypot(l.xU - r.xU, l.yU - r.yU);
  });
const expectNarrowsFrom = (
  path: RoadPath,
  tipFirst: boolean,
  fullU: number,
  label: string,
) => {
  const inward = tipFirst ? path.points : [...path.points].reverse(),
    tip = inward[0];
  if (!tip) throw Error('missing path end');
  expect(drawnEndWidths(path)[tipFirst ? 0 : 1], `${label} drawn end`).toBe(0);
  // Widening steadily across the 160-u taper, full width beyond it.
  for (let i = 1; i < inward.length; i++)
    if (Math.abs((inward[i]?.xU ?? Infinity) - tip.xU) <= 160)
      expect(inward[i]?.halfWidthU).toBeGreaterThanOrEqual(
        inward[i - 1]?.halfWidthU ?? Infinity,
      );
  // A path that also narrows at its far end is full width between the tapers.
  const far = inward.at(-1),
    farTip = far?.halfWidthU === 0 ? far.xU : Infinity;
  for (const p of inward)
    if (Math.abs(p.xU - tip.xU) >= 160 && Math.abs(p.xU - farTip) >= 160)
      expect(p.halfWidthU).toBe(fullU);
};
const expectReservedAsDrawn = (
  sc: ReturnType<typeof chunkScenery>,
  path: RoadPath,
) =>
  expect(
    sc.reservations.find((r) => r.id === `${path.id}:reserve:village-road`)
      ?.polygon,
  ).toEqual(roadPolygon(path, 4));
it('review 12: the footpath narrows to a point before a working yard (seed 0 / 29 → 30, 31 → 32)', () => {
  for (const k of [30, 31]) {
    expect(sceneAt(0, k * 1024).templateId).toBe('settlements-yard');
    expect(footpaths(0, k).paths).toEqual([]);
  }
  for (const [k, edge, tipFirst] of [
    [29, 30 * 1024, false],
    [32, 32 * 1024, true],
  ] as const) {
    const { sc, paths } = footpaths(0, k);
    expect(paths).toHaveLength(1);
    const path = paths[0];
    if (!path) continue;
    expect((tipFirst ? path.points[0] : path.points.at(-1))?.xU).toBe(edge);
    expectNarrowsFrom(path, tipFirst, 5, `chunk ${k}`);
    expectReservedAsDrawn(sc, path);
    expect(validateChunkScenery(0, sc, catalog)).toEqual([]);
  }
});
it('review 12: a river splits the footpath into pieces that narrow before its banks (seed 0 / 27–29)', () => {
  const [before, sc, after] = [27, 28, 29].map((k) =>
    chunkScenery(0, k, catalog),
  );
  if (!before || !sc || !after) throw Error('missing chunks');
  const river = sc.reservations.filter((r) => r.purpose === 'river');
  expect(river.length).toBeGreaterThan(0);
  const paths = footpaths(0, 28).paths;
  expect(paths, 'footpath pieces beside the river').toHaveLength(2);
  const [west, east] = paths;
  if (!west || !east) return;
  const bankXs = river.flatMap((r) => r.polygon.map((p) => p.xU));
  expect(west.points.at(-1)?.xU).toBeLessThan(Math.min(...bankXs));
  expect(east.points[0]?.xU).toBeGreaterThan(Math.max(...bankXs));
  expectNarrowsFrom(west, false, 5, 'west piece');
  expectNarrowsFrom(east, true, 5, 'east piece');
  // The outer ends keep the full shared width of the neighbouring chunks.
  expect(west.points[0]).toEqual(footpaths(0, 27).paths.at(-1)?.points.at(-1));
  expect(east.points.at(-1)).toEqual(footpaths(0, 29).paths[0]?.points[0]);
  expect(west.points[0]?.halfWidthU).toBe(5);
  for (const path of paths) {
    for (const r of river)
      expect(polygonsHit(roadPolygon(path, 4), r.polygon)).toBe(false);
    expectReservedAsDrawn(sc, path);
  }
  expect(validateChunkScenery(0, sc, catalog)).toEqual([]);
  expect(validateFootpathJoin(0, before, sc)).toEqual([]);
  expect(validateFootpathJoin(0, sc, after)).toEqual([]);
});
it('review 12: the station service route narrows to a point at both platform ends (seed 6 / 56–58)', () => {
  const routes = [56, 57, 58].map((k) => {
    const sc = chunkScenery(6, k, catalog),
      route = sc.roads.find((r) => r.id === 'g2:chunk:57:station:0:service');
    if (!route) throw Error(`missing service route in chunk ${k}`);
    expectReservedAsDrawn(sc, route);
    expect(validateChunkScenery(6, sc, catalog)).toEqual([]);
    return route;
  });
  const route = routes[0];
  if (!route) return;
  for (const other of routes) expect(other).toEqual(route);
  expect([route.points[0]?.xU, route.points.at(-1)?.xU]).toEqual([
    57600, 59968,
  ]);
  expectNarrowsFrom(route, true, 6, 'service start');
  expectNarrowsFrom(route, false, 6, 'service end');
});
it('review 12: validator rejects any unconnected flat footpath end and a broken chunk join', () => {
  const widen = (road: RoadPath): RoadPath => ({
    ...road,
    points: road.points.map((p) => ({
      ...p,
      halfWidthU: Math.max(p.halfWidthU, 5),
    })),
  });
  for (const [seed, k, pick] of [
    [
      0,
      29,
      (r: RoadPath) =>
        r.id.endsWith(':pedestrian') || r.id.endsWith(':allotments-path'),
    ],
    [0, 28, (r: RoadPath) => r.layer === 'near' && r.id.includes(':piece:')],
    [6, 56, (r: RoadPath) => r.id.endsWith(':service')],
  ] as const) {
    const sc = chunkScenery(seed, k, catalog),
      target = sc.roads.find(pick);
    expect(target, `seed ${seed} chunk ${k} witness`).toBeDefined();
    if (!target) continue;
    const flat = {
      ...sc,
      roads: sc.roads.map((r) => (r === target ? widen(r) : r)),
    };
    expect(
      validateChunkScenery(seed, flat, catalog).filter((e) =>
        e.includes(`footpath-end ${target.id}`),
      ).length,
      `seed ${seed} chunk ${k} flat end`,
    ).toBeGreaterThan(0);
  }
  const before = chunkScenery(0, 27, catalog),
    river = chunkScenery(0, 28, catalog),
    west = river.roads.find(
      (r) => r.layer === 'near' && r.id.includes(':piece:'),
    );
  expect(
    validateFootpathJoin(0, before, {
      ...river,
      roads: river.roads.filter((r) => r !== west),
    }),
  ).toHaveLength(1);
  const coverage = worldMotifCoverage(
    [
      { seed: 0, scenery: chunkScenery(0, 29, catalog) },
      { seed: 0, scenery: river },
      { seed: 6, scenery: chunkScenery(6, 56, catalog) },
    ],
    catalog,
  );
  for (const motif of [
    'settlements-footpath-yard',
    'settlements-footpath-split',
    'station-service-end',
  ])
    expect(coverage[motif] ?? 0, motif).toBeGreaterThan(0);
});

const streetsOf = (sc: ReturnType<typeof chunkScenery>) =>
  sc.roads.filter((r) => r.id.includes(':street:'));
it('review 13: the main street crosses a river on a road bridge drawn from its reservation (seed 0 / 28)', () => {
  const sc = chunkScenery(0, 28, catalog),
    river = sc.reservations.find((r) => r.purpose === 'river');
  if (!river) throw Error('missing river witness');
  const riverXs = river.polygon.map((p) => p.xU);
  // Continuous asphalt: one street across the whole chunk, full width over the water.
  const streets = streetsOf(sc);
  expect(streets.map((r) => [r.fromXU, r.toXU])).toEqual([
    [28 * 1024, 29 * 1024],
  ]);
  const street = streets[0];
  if (!street) return;
  for (const p of street.points)
    if (p.xU >= Math.min(...riverXs) && p.xU <= Math.max(...riverXs))
      expect(p.halfWidthU).toBe(9);
  const bridges = sc.features.filter((f) => f.kind === 'road-bridge');
  expect(bridges).toHaveLength(1);
  const bridge = bridges[0];
  if (!bridge) return;
  expect(bridge.dependencies).toEqual([street.id, river.ownerId]);
  // The deck reaches dry ground on both banks.
  expect(bridge.fromXU).toBeLessThan(Math.min(...riverXs));
  expect(bridge.toXU).toBeGreaterThan(Math.max(...riverXs));
  const deck = sc.reservations.find((r) => r.ownerId === bridge.id);
  expect(deck?.polygon).toEqual(
    clipPolygonX(roadPolygon(street, 7), bridge.fromXU, bridge.toXU),
  );
  expect(validateChunkScenery(0, sc, catalog)).toEqual([]);
});
it('review 13: validator rejects a street cut flat at water and a river crossing without a bridge', () => {
  const sc = chunkScenery(0, 28, catalog),
    river = sc.reservations.find((r) => r.purpose === 'river');
  if (!river) throw Error('missing river witness');
  const [from, to] = [
    Math.min(...river.polygon.map((p) => p.xU)) - 40,
    Math.max(...river.polygon.map((p) => p.xU)) + 40,
  ];
  const points = streetsOf(sc)
    .flatMap((r) => r.points)
    .sort((a, b) => a.xU - b.xU);
  const piece = (id: string, keep: (x: number) => boolean): RoadPath => {
    const kept = points.filter((p) => keep(p.xU));
    return {
      id,
      ownerId: 'g2:region:1:town',
      fromXU: kept[0]?.xU ?? 0,
      toXU: kept.at(-1)?.xU ?? 0,
      points: kept,
    };
  };
  const withoutBridge = (roads: RoadPath[]) => ({
    ...sc,
    roads: [...sc.roads.filter((r) => !r.id.includes(':street:')), ...roads],
    features: sc.features.filter((f) => f.kind !== 'road-bridge'),
  });
  const cut = withoutBridge([
    piece('g2:region:1:town:street:28:piece:0', (x) => x < from),
    piece('g2:region:1:town:street:28:piece:1', (x) => x > to),
  ]);
  expect(
    validateInfrastructureSurfaces(0, cut).filter((e) =>
      e.includes('road-water-end'),
    ),
  ).toHaveLength(2);
  const unbridged = withoutBridge([
    piece('g2:region:1:town:street:28', () => true),
  ]);
  expect(
    validateInfrastructureSurfaces(0, unbridged).some((e) =>
      e.includes('road-infrastructure g2:region:1:town:street:28'),
    ),
  ).toBe(true);
});
it('review 13: every bed path starts inside the gate and stays inside the plot (seed 1 / 246, 8)', () => {
  for (const k of [246, 8]) {
    const sc = chunkScenery(1, k, catalog),
      group = sc.features.find((f) => f.kind === 'allotments'),
      fence = sc.fences.find((f) => f.ownerId === group?.id),
      trunk = sc.roads.find((r) => r.id === `${group?.id}:entrance`),
      paths = sc.roads.filter(
        (r) => r.ownerId === group?.id && r.id.endsWith(':bed-access'),
      );
    if (!group || !fence || !trunk) throw Error(`missing allotment ${k}`);
    expect(paths.length, `chunk ${k} bed paths`).toBeGreaterThanOrEqual(2);
    for (const path of paths) {
      const outside = roadPolygon(path).filter(
        (p) => !pointInside(p, fence.posts),
      );
      expect(outside, `chunk ${k} ${path.id} outside the fence`).toEqual([]);
      const start = path.points[0];
      if (!start) throw Error('missing bed path start');
      expect(pointInside(start, roadPolygon(trunk))).toBe(true);
      expect(pointInside(start, fence.posts)).toBe(true);
    }
    expect(validateChunkScenery(1, sc, catalog)).toEqual([]);
    // The validator catches a bed path moved out through the fence.
    const moved = paths[0];
    if (!moved) continue;
    const broken = {
      ...sc,
      roads: sc.roads.map((r) =>
        r === moved
          ? {
              ...r,
              points: r.points.map((p) => ({ ...p, yU: p.yU + 120 })),
            }
          : r,
      ),
    };
    expect(
      validateChunkScenery(1, broken, catalog).filter((e) =>
        e.includes(`allotment-path-outside ${moved.id}`),
      ),
    ).toHaveLength(1);
  }
});
