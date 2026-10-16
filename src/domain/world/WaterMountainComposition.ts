import type { PlacementTraceEntry } from './PlacementTrace.ts';
import type { ChunkScenery, SceneryProp, WaterBasin } from './Scenery.ts';
import { footprintAdmissible, placementConflict } from './Placement.ts';
import { waterReservation, roadReservation } from './Reservations.ts';
import { contextAt } from './WorldPlan.ts';
import {
  propScale,
  projectedBounds,
  railYUpU,
  waterSectionU,
  waterPolygon,
  pointInside,
  propFootU,
  roadPolygon,
  polygonsHit,
  type PlacementCatalog,
} from './SceneryGeometry.ts';
import { unitRandom, hash32 } from './Hash.ts';
import { streamBendU } from './StreamGeometry.ts';

export const WATER_MOUNTAIN_MOTIFS = [
  'tree.sahara-pine-a',
  'tree.sahara-pine-b',
  'back.fishpond-sluice',
  'near.fisherman',
  'back.ferry',
  'back.harbour-pier',
  'back.harbour-quay',
  'near.heather',
  'near.young-pine',
  'back.cutting-rock',
  'back.quarry-wall',
  'back.excavator',
  'back.cableway-tower',
  'back.water-footbridge',
  'near.reed-clump',
  'tree.willow',
  'back.coast-rock',
  'near.coast-rock',
] as const;
export const WATER_MOUNTAIN_CHILD_KINDS: readonly string[] = [
  ...WATER_MOUNTAIN_MOTIFS,
  'near.reed-clump-autumn',
  'back.cutting-rock-snow',
  'back.quarry-wall-snow',
];
type Composition = Pick<
  ChunkScenery,
  | 'chunkIndex'
  | 'locality'
  | 'region'
  | 'scene'
  | 'water'
  | 'props'
  | 'reservations'
  | 'features'
  | 'bridge'
  | 'roads'
>;
/** Authored children follow concrete bank/water/slope parents; no scene-global timers. */
export function waterMountainComposition(
  seed: number,
  sc: Composition,
  catalog: PlacementCatalog,
  sceneChunks: readonly Composition[],
  trace?: PlacementTraceEntry[],
): void {
  const k = sc.chunkIndex,
    x0 = k * 1024;
  if (sc.region.landscape === 'dunes')
    for (const p of sc.props)
      if (p.kind === 'tree.pine')
        p.kind = p.phase < 0.5 ? 'tree.sahara-pine-a' : 'tree.sahara-pine-b';
  if (sc.locality === 'station') return;
  const season = contextAt(seed, x0 + 512).season;
  const prop = (
    kind: string,
    xU: number,
    depth: number,
    scale = 1,
    role = String(xU),
  ): SceneryProp => ({
    id: `g2:chunk:${k}:prop:rule:${1000 + hash32(1, 'water-mountains-kind', kind)}:candidate:${hash32(1, 'water-mountains-role', role)}`,
    kind,
    layer: 'back',
    xU,
    depth,
    scale,
    flip: false,
    phase: unitRandom(seed, 'water-mountains', k, kind, String(xU)),
  });
  const accept = (p: SceneryProp) => {
    const part = catalog[p.kind];
    if (!part) throw new Error(`missing water-mountains art ${p.kind}`);
    const b = projectedBounds(seed, k, p, part);
    const conflict = placementConflict(
      seed,
      k,
      p,
      catalog,
      sc.reservations,
      p.relations,
      b,
    );
    const outside = b.leftU < x0 || b.rightU > x0 + 1024;
    const context = footprintAdmissible(seed, k, p, catalog, b);
    trace?.push({
      candidate: {
        id: p.id,
        kind: p.kind,
        worldXU: x0 + p.xU,
        layer: p.layer,
        depth: p.depth,
        attempt: 0,
      },
      admissible: [p.kind],
      rejectionCode: outside
        ? 'outside-chunk'
        : !context
          ? 'context'
          : conflict
            ? 'collision'
            : 'accepted',
      conflictingReservation: conflict,
      missingDependency: undefined,
    });
    if (outside || !context || conflict) return false;
    sc.props.push(p);
    return true;
  };
  const waterFits = (chunk: Composition, w: WaterBasin) => {
    const polygon = waterPolygon(seed, chunk.chunkIndex, w);
    return (
      chunk.locality !== 'station' &&
      !chunk.reservations.some(
        (r) =>
          !['water', 'catenary'].includes(r.purpose) &&
          !(w.flowSpan && r.purpose === 'river') &&
          r.layer !== 'near' &&
          polygonsHit(polygon, r.polygon),
      )
    );
  };
  const addWater = (w: WaterBasin) => {
    if (!waterFits(sc, w)) return false;
    const reservation = waterReservation(seed, k, w);
    sc.water.push(w);
    sc.reservations.push(reservation);
    sc.features.push({
      id: w.id,
      ownerId: sc.scene.id,
      kind: w.kind,
      fromXU: w.flowSpan?.fromXU ?? x0 + w.fromX,
      toXU: w.flowSpan?.toXU ?? x0 + w.toX,
      dependencies: [],
    });
    return true;
  };
  if (
    sc.locality === 'water-mountains-fishponds' &&
    x0 === sc.scene.fromXU + 1024
  ) {
    for (const [i, [fromX, toX, nearDepth, farDepth]] of [
      [48, 280, 0.3, 0.78],
      [365, 635, 0.45, 0.94],
      [720, 972, 0.35, 0.83],
    ].entries()) {
      if (
        fromX === undefined ||
        toX === undefined ||
        nearDepth === undefined ||
        farDepth === undefined
      )
        throw new Error('invalid pond group');
      const behindRail = sc.reservations.some(
        (r) => r.purpose === 'secondary-track',
      );
      addWater({
        id: `${sc.scene.id}:fishpond-group:${i}`,
        kind: 'pond',
        fromX,
        toX,
        nearDepth: behindRail ? Math.max(0.6, nearDepth) : nearDepth,
        farDepth: behindRail ? Math.max(0.86, farDepth) : farDepth,
      });
    }
  }
  if (
    sc.locality === 'water-mountains-river' &&
    !sc.water.some((w) => w.kind === 'sea')
  ) {
    const behindRail = sceneChunks.some((chunk) =>
      chunk.reservations.some((r) => r.purpose === 'secondary-track'),
    );
    const river: WaterBasin = {
      id: `${sc.scene.id}:river-channel`,
      kind: 'channel',
      fromX: 0,
      toX: 1024,
      nearDepth: behindRail ? 0.6 : 0.3,
      farDepth: 0.9,
      flowSpan: { fromXU: sc.scene.fromXU, toXU: sc.scene.toXU },
    };
    // Both fragments use one accepted scene extent; rejected continuations become real endpoints.
    const accepted = sceneChunks.filter(
      (chunk) =>
        !chunk.water.some((w) => w.kind === 'sea') && waterFits(chunk, river),
    );
    const first = accepted[0],
      last = accepted.at(-1);
    if (first && last && accepted.some((chunk) => chunk.chunkIndex === k)) {
      river.flowSpan = {
        fromXU: first.chunkIndex * 1024,
        toXU: (last.chunkIndex + 1) * 1024,
      };
      addWater(river);
    }
  }
  for (const w of sc.water) {
    if (w.kind === 'channel' && sc.locality !== 'water-mountains-river')
      continue;
    const x = (w.fromX + w.toX) / 2;
    const bank = (kind: string, at: number, margin = 5) => {
      const section = waterSectionU(seed, k, w, at);
      const p = prop(
        kind,
        at,
        (-railYUpU(seed, x0 + at) - section.bottomU - margin) / 220,
        1,
        `${w.id}:${kind}:${at < x ? 'left' : at > x ? 'right' : 'centre'}`,
      );
      p.dependencies = [w.id];
      return p;
    };
    if (sc.region.landscape === 'lakes' && w.kind !== 'sea') {
      const sluice = bank('back.fishpond-sluice', x, 1);
      sluice.relations = [
        { reservationId: `${w.id}:reserve:water`, relation: 'reeds-at-water' },
      ];
      accept(sluice);
      if (
        season !== 'winter' &&
        (!w.id.includes(':fishpond-group:') || w.id.endsWith(':0'))
      )
        accept(bank('near.fisherman', x - 65, 10));
      const reeds = bank(
        season === 'autumn' ? 'near.reed-clump-autumn' : 'near.reed-clump',
        x + 70,
        2,
      );
      reeds.relations = [
        { reservationId: `${w.id}:reserve:water`, relation: 'reeds-at-water' },
      ];
      accept(reeds);
      accept(bank('tree.willow', Math.min(w.toX - 25, x + 100), 8));
    }
    if (w.kind === 'sea' && sc.locality === 'water-mountains-rocky-coast') {
      accept(bank('back.coast-rock', x, 12));
      const low = prop('near.coast-rock', x + 220, 0.26);
      low.layer = 'near';
      accept(low);
    }
    const harbour =
      x0 === sc.scene.fromXU &&
      w.kind === 'sea' &&
      ['harbour', 'water-mountains-harbour'].includes(sc.locality);
    const river =
      sc.locality === 'water-mountains-river' && w.kind === 'channel';
    if (harbour || river) {
      const piers: string[] = [];
      for (const at of [x - 240, x + 240]) {
        const pier = bank('back.harbour-pier', at, -3);
        pier.flip = at > x;
        pier.rotationRad = at > x ? 0.28 : -0.28;
        pier.relations = [
          { reservationId: `${w.id}:reserve:water`, relation: 'pier-at-water' },
        ];
        if (accept(pier)) piers.push(pier.id);
      }
      if (harbour) {
        const quay = bank('back.harbour-quay', x, 0);
        quay.offsetYU = -29 * propScale(quay);
        quay.relations = [
          { reservationId: `${w.id}:reserve:water`, relation: 'pier-at-water' },
        ];
        accept(quay);
      }
      if (piers.length === 2) {
        const section = waterSectionU(seed, k, w, x),
          ferry = prop(
            'back.ferry',
            x,
            (-railYUpU(seed, x0 + x) - (section.topU + section.bottomU) / 2) /
              220,
          );
        ferry.motion = { rangeU: 260, speedUPerSec: 10 };
        ferry.dependencies = [w.id, ...piers];
        ferry.relations = [
          { reservationId: `${w.id}:reserve:water`, relation: 'boat-on-water' },
        ];
        const part = catalog[ferry.kind];
        if (
          part &&
          [-130, 0, 130].every((dx) => {
            const foot = projectedBounds(
                seed,
                k,
                { ...ferry, xU: x + dx, motion: { rangeU: 0 } },
                part,
                true,
              ),
              polygon = waterPolygon(seed, k, w);
            return [foot.leftU, foot.rightU].every((x) =>
              [foot.topU, foot.bottomU].every((y) =>
                pointInside({ xU: x, yU: y }, polygon),
              ),
            );
          })
        )
          accept(ferry);
      }
    }
  }
  for (const mill of sc.props.filter((p) => p.kind === 'back.watermill')) {
    const foot = propFootU(mill, x0 + mill.xU, railYUpU(seed, x0 + mill.xU), 0),
      scale = propScale(mill);
    const road = {
      id: `${mill.id}:access`,
      ownerId: sc.scene.id,
      layer: 'back' as const,
      surface: 'dirt' as const,
      style: 'path' as const,
      fromXU: foot.xU - 90 * scale,
      toXU: foot.xU - 19 * scale,
      points: [
        { xU: foot.xU - 90 * scale, yU: foot.yU - 2 * scale, halfWidthU: 1 },
        { xU: foot.xU - 19 * scale, yU: foot.yU - 2 * scale, halfWidthU: 1 },
      ],
    };
    const polygon = roadPolygon(road);
    if (
      !sc.reservations.some(
        (r) => r.layer !== 'near' && polygonsHit(polygon, r.polygon),
      )
    ) {
      sc.roads.push(road);
      sc.reservations.push(roadReservation(road));
      mill.relations = [
        ...(mill.relations ?? []),
        {
          reservationId: roadReservation(road).id,
          relation: 'building-at-path',
        },
      ];
      sc.features.push({
        id: road.id,
        ownerId: mill.id,
        kind: 'path',
        fromXU: road.fromXU,
        toXU: road.toXU,
        dependencies: [mill.id],
      });
    }
  }
  if (sc.region.landscape === 'lakes' && sc.bridge) {
    const bridge = sc.bridge;
    const p = prop(
      'back.water-footbridge',
      bridge.localXU + streamBendU(k, -0.62 * 220),
      0.62,
    );
    p.offsetYU =
      railYUpU(seed, x0 + p.xU) - railYUpU(seed, x0 + bridge.localXU);
    p.dependencies = [bridge.id];
    p.relations = sc.reservations
      .filter((r) => r.purpose === 'river')
      .map((r) => ({ reservationId: r.id, relation: 'bridge-over-river' }));
    const foot = propFootU(p, x0 + p.xU, railYUpU(seed, x0 + p.xU), 0);
    const road = {
      id: `${p.id}:path`,
      ownerId: sc.scene.id,
      layer: 'back' as const,
      surface: 'dirt' as const,
      fromXU: foot.xU - 110,
      toXU: foot.xU + 110,
      points: [
        { xU: foot.xU - 110, yU: foot.yU - 14 * propScale(p), halfWidthU: 4 },
        { xU: foot.xU + 110, yU: foot.yU - 14 * propScale(p), halfWidthU: 4 },
      ],
    };
    const polygon = roadPolygon(road);
    if (
      !sc.reservations.some(
        (r) =>
          r.purpose !== 'river' &&
          r.layer !== 'near' &&
          polygonsHit(polygon, r.polygon),
      ) &&
      accept(p)
    ) {
      sc.roads.push(road);
      sc.reservations.push(roadReservation(road));
      sc.features.push({
        id: road.id,
        ownerId: sc.scene.id,
        kind: 'path',
        fromXU: road.fromXU,
        toXU: road.toXU,
        dependencies: [p.id],
      });
    }
  }
  if (['mountains', 'foothills'].includes(sc.region.landscape)) {
    for (const x of [220, 780]) {
      const grade =
        (railYUpU(seed, x0 + x + 64) - railYUpU(seed, x0 + x - 64)) / 128;
      if (Math.abs(grade) < 0.025) continue;
      const p = prop(
        season === 'winter' ? 'back.cutting-rock-snow' : 'back.cutting-rock',
        x,
        0.3,
      );
      p.offsetYU = Math.abs(grade) * 80 * propScale(p) + 6;
      accept(p);
    }
    if (sc.locality === 'water-mountains-quarry') {
      const x = 512,
        grade =
          (railYUpU(seed, x0 + x + 200) - railYUpU(seed, x0 + x - 200)) / 400;
      if (Math.abs(grade) >= 0.025) {
        const wall = prop(
          season === 'winter' ? 'back.quarry-wall-snow' : 'back.quarry-wall',
          x,
          0.6,
        );
        wall.offsetYU = Math.abs(grade) * 256 * propScale(wall) + 10;
        if (accept(wall)) {
          const excavator = prop('back.excavator', x + 90, 0.6);
          excavator.offsetYU =
            (wall.offsetYU ?? 0) +
            railYUpU(seed, x0 + excavator.xU) -
            railYUpU(seed, x0 + x);
          excavator.dependencies = [wall.id];
          accept(excavator);
        }
      }
    }
    if (sc.locality === 'water-mountains-cableway') {
      const cable = prop('back.cableway-tower', 300, 0.55);
      const part = catalog[cable.kind];
      if (!part) throw new Error('missing cableway footprint');
      const owner = sceneChunks.find((chunk) => {
        if (chunk.locality === 'station') return false;
        const bounds = projectedBounds(seed, chunk.chunkIndex, cable, part);
        return (
          bounds.leftU >= chunk.chunkIndex * 1024 &&
          bounds.rightU <= (chunk.chunkIndex + 1) * 1024 &&
          footprintAdmissible(seed, chunk.chunkIndex, cable, catalog, bounds) &&
          !placementConflict(
            seed,
            chunk.chunkIndex,
            cable,
            catalog,
            chunk.reservations,
            cable.relations,
            bounds,
          )
        );
      });
      if (owner?.chunkIndex === k && accept(cable))
        sc.features.push({
          id: `${sc.scene.id}:cableway`,
          ownerId: sc.scene.id,
          kind: 'cableway',
          fromXU: x0 + cable.xU - 70 * propScale(cable),
          toXU: x0 + cable.xU + 400 * propScale(cable),
          dependencies: [cable.id],
        });
    }
  }
}
