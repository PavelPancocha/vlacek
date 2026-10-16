import type { StationExtent } from './SettlementPlan.ts';
import type { SceneryProp } from './Scenery.ts';
import { bankHeightU } from './Terrain.ts';
import {
  railYUpU,
  rectPolygon,
  roadPolygon,
  polygonsHit,
  projectedBounds,
  propFootU,
  type PlacementCatalog,
  type RoadPath,
} from './SceneryGeometry.ts';
import {
  roadReservation,
  type FeatureExtent,
  type Reservation,
} from './Reservations.ts';

/** Low plants and stones along a long station's service path, alternating. */
export const STATION_SERVICE_KINDS = ['near.bush', 'near.stones'] as const;

/** Platform tiles stay at 1 u/u; perspective must not shorten usable length. */
export function stationScenery(
  seed: number,
  k: number,
  site: StationExtent,
  catalog: PlacementCatalog,
  obstacles: readonly Reservation[],
) {
  const x0 = k * 1024,
    length = site.toXU - site.fromXU;
  const y = -railYUpU(seed, site.fromXU);
  const platform: Reservation = {
    id: `${site.id}:reserve:platform`,
    ownerId: site.id,
    purpose: 'platform',
    layer: 'back',
    polygon: rectPolygon({
      leftU: site.fromXU - 2,
      rightU: site.toXU + 2,
      topU: y - 42,
      bottomU: y - 14,
    }),
  };
  const props: SceneryProp[] = [];
  let candidate = 0;
  const at = (
    kind: string,
    worldXU: number,
    offsetY: number,
    onPlatform = true,
  ) => {
    const index = candidate++;
    if (Math.floor(worldXU / 1024) !== k) return;
    const depth = offsetY / 220;
    props.push({
      id: `g2:chunk:${k}:prop:station:candidate:${index}`,
      kind,
      layer: 'back',
      xU: worldXU - x0,
      depth,
      scale: 1 / (1 - 0.35 * depth),
      flip: false,
      phase: (index % 31) / 31,
      dependencies: [site.id],
      ...(onPlatform
        ? {
            relations: [
              {
                reservationId: platform.id,
                relation: 'platform-beside-track' as const,
              },
            ],
          }
        : {}),
    });
  };
  at('back.platform-start', site.fromXU + 16, 16);
  for (let x = site.fromXU + 32; x < site.toXU - 32; x += 128) {
    const step = Math.min(128, site.toXU - 32 - x);
    at(
      step === 128 ? 'back.platform-middle' : 'back.platform-short',
      x + step / 2,
      16,
    );
  }
  at('back.platform-end', site.toXU - 16, 16);
  const middle = (site.fromXU + site.toXU) / 2;
  at(
    site.size === 'halt'
      ? 'back.station'
      : site.size === 'station'
        ? 'back.station-medium'
        : 'back.station-big',
    middle,
    114,
    false,
  );
  const canopyCount =
    site.size === 'halt' ? 0 : site.size === 'station' ? 2 : 4;
  const canopyXs = Array.from(
    { length: canopyCount },
    (_, i) =>
      site.fromXU + 224 + (i * (length - 448)) / Math.max(1, canopyCount - 1),
  );
  const clearColumns = (x: number, clearance: number) => {
    for (let attempt = 0; attempt < 8; attempt++, x += 32) {
      if (
        canopyXs.every((c) =>
          [-60, 0, 60].every((offset) => Math.abs(x - c - offset) >= clearance),
        )
      )
        return x;
    }
    throw new Error(`station equipment cannot fit ${site.id}`);
  };
  const groups = site.size === 'halt' ? 2 : site.size === 'station' ? 4 : 8;
  for (let i = 0; i < groups; i++) {
    const x = site.fromXU + 96 + (i * (length - 192)) / Math.max(1, groups - 1);
    at('back.station-lamp', x, 36);
    at(
      i % 2 === 0 ? 'back.passenger-a' : 'back.passenger-b',
      clearColumns(x + 28, 18),
      36,
    );
    if (i % 2 === 0) at('back.station-bench', clearColumns(x + 62, 24), 36);
  }
  if (site.size !== 'halt') {
    at('back.dispatcher-wave', clearColumns(middle - 56, 18), 36);
    for (const x of canopyXs) at('back.platform-canopy', x, 40);
  }
  const path = (role: string, points: RoadPath['points']): RoadPath => ({
    id: `${site.id}:${role}`,
    ownerId: site.id,
    fromXU: Math.min(...points.map((p) => p.xU)) - 1,
    toXU: Math.max(...points.map((p) => p.xU)) + 1,
    points,
  });
  const clear = (road: RoadPath) =>
    !obstacles.some(
      (r) =>
        r.layer !== (road.layer === 'near' ? 'back' : 'near') &&
        polygonsHit(roadPolygon(road, 4), r.polygon),
    );
  let streetY = y - 136;
  for (const offset of [136, 120, 150]) {
    const street = path('street', [
      { xU: site.fromXU, yU: y - offset, halfWidthU: 8 },
      { xU: site.toXU, yU: y - offset, halfWidthU: 8 },
    ]);
    if (clear(street)) {
      streetY = y - offset;
      break;
    }
  }
  const roads: RoadPath[] = [
    path('street', [
      { xU: site.fromXU, yU: streetY, halfWidthU: 8 },
      { xU: site.toXU, yU: streetY, halfWidthU: 8 },
    ]),
    path('entrance', [
      { xU: middle, yU: streetY, halfWidthU: 5 },
      { xU: middle, yU: y - 114, halfWidthU: 5 },
    ]),
    path('platform-path', [
      { xU: middle - 200, yU: streetY, halfWidthU: 4 },
      { xU: middle - 200, yU: y - 40, halfWidthU: 4 },
    ]),
  ]
    .filter(clear)
    .map((r) =>
      r.id.endsWith(':street') ? r : { ...r, style: 'path' as const },
    );
  const reservations: Reservation[] = [platform, ...roads.map(roadReservation)];
  const extras: FeatureExtent[] = [];
  if (site.size !== 'halt') {
    const forecourt: Reservation = {
      id: `${site.id}:forecourt:reserve`,
      ownerId: `${site.id}:forecourt`,
      purpose: 'forecourt',
      layer: 'back',
      polygon: rectPolygon({
        leftU: middle - 190,
        rightU: middle + 190,
        topU: streetY - 10,
        bottomU: y - 58,
      }),
    };
    if (
      !obstacles.some(
        (r) => r.layer !== 'near' && polygonsHit(forecourt.polygon, r.polygon),
      )
    ) {
      reservations.push(forecourt);
      extras.push({
        id: forecourt.ownerId,
        ownerId: site.id,
        kind: 'forecourt',
        fromXU: middle - 190,
        toXU: middle + 190,
        dependencies: [`${site.id}:street`],
      });
      for (const [kind, x, offset] of [
        ['back.bench', middle + 145, 85],
        ['near.bush', middle - 135, 85],
        ['near.bush', middle + 170, 108],
      ] as const) {
        const before = props.length;
        at(kind, x, offset, false);
        const p = props[before];
        if (p) {
          p.dependencies = [forecourt.ownerId];
          p.relations = [
            { reservationId: forecourt.id, relation: 'object-on-forecourt' },
          ];
        }
      }
    }
    const service: RoadPath = {
      ...path(
        'service',
        Array.from({ length: Math.ceil(length / 32) + 1 }, (_, i) => {
          const x = Math.min(site.toXU, site.fromXU + i * 32);
          return {
            ...propFootU(
              {
                kind: 'path',
                layer: 'near',
                xU: x,
                depth: 0.47,
                scale: 1,
                flip: false,
              },
              x,
              railYUpU(seed, x),
              bankHeightU(seed, x),
            ),
            // Nothing joins the low route at the platform ends, so it
            // narrows into the meadow over 160 u instead of a flat cap.
            halfWidthU:
              6 * Math.min(1, (x - site.fromXU) / 160, (site.toXU - x) / 160),
          };
        }),
      ),
      layer: 'near',
      style: 'service',
    };
    if (clear(service)) {
      roads.push(service);
      reservations.push(roadReservation(service));
      for (let x = site.fromXU + 128; x < site.toXU; x += 320) {
        if (Math.floor(x / 1024) !== k) continue;
        props.push({
          id: `g2:chunk:${k}:prop:station:candidate:${candidate++}`,
          kind:
            Math.floor((x - site.fromXU) / 320) % 2 === 0
              ? STATION_SERVICE_KINDS[0]
              : STATION_SERVICE_KINDS[1],
          layer: 'near',
          xU: x - x0,
          depth: 0.62,
          scale: 1,
          flip: false,
          phase: 0,
          dependencies: [service.id],
        });
      }
    }
  }
  const feature: FeatureExtent = {
    id: site.id,
    ownerId: `g2:chunk:${site.ownerChunk}`,
    kind: 'station',
    fromXU: site.fromXU,
    toXU: site.toXU,
    dependencies: [],
  };
  const paths: FeatureExtent[] = [
    ...extras,
    ...roads.map((road) => ({
      id: road.id,
      ownerId: site.id,
      kind: 'path',
      fromXU: road.fromXU,
      toXU: road.toXU,
      dependencies: [site.id],
    })),
  ];
  for (const prop of props)
    if (
      ['back.station', 'back.station-medium', 'back.station-big'].includes(
        prop.kind,
      )
    ) {
      prop.dependencies = [`${site.id}:entrance`];
      const part = catalog[prop.kind];
      if (!part) throw Error('missing station building');
      const parcel: Reservation = {
        id: `${prop.id}:parcel`,
        ownerId: prop.id,
        purpose: 'parcel',
        layer: 'back',
        polygon: rectPolygon(projectedBounds(seed, k, prop, part, true)),
      };
      reservations.push(parcel);
      prop.relations = [
        { reservationId: parcel.id, relation: 'object-on-parcel' },
        ...reservations
          .filter((r) => r.purpose === 'forecourt')
          .map((r) => ({
            reservationId: r.id,
            relation: 'object-on-forecourt' as const,
          })),
        {
          reservationId: `${site.id}:entrance:reserve:village-road`,
          relation: 'entrance-on-path',
        },
      ];
    }
  return { props, platform, reservations, roads, feature, paths };
}
