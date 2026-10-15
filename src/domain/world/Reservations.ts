import type { CrossingSite } from './Crossings.ts';
import { tunnelSite, type BridgeSite, type TunnelSite } from './Structures.ts';
import { secondarySite } from './SecondaryTrack.ts';
import { catenaryPoleXs, catenarySupport } from './Catenary.ts';
import {
  railYUpU,
  roadPolygon,
  rectPolygon,
  waterPolygon,
  type BoundsU,
  type PointU,
  type RoadPath,
  type WaterGeometry,
} from './SceneryGeometry.ts';

export type ReservationPurpose =
  | 'work-road'
  | 'field'
  | 'forest-floor'
  | 'track'
  | 'crossing-road'
  | 'village-road'
  | 'highway-setback'
  | 'river'
  | 'water'
  | 'tunnel-hill'
  | 'secondary-hill'
  | 'secondary-track'
  | 'village-green'
  | 'parcel'
  | 'working-yard'
  | 'forecourt'
  | 'platform'
  | 'catenary';
export type AllowedRelation =
  | 'object-on-parcel'
  | 'object-in-yard'
  | 'object-on-forecourt'
  | 'entrance-on-path'
  | 'pedestrian-on-path'
  | 'object-on-village-green'
  | 'object-on-field'
  | 'object-on-forest-floor'
  | 'bridge-over-river'
  | 'platform-beside-track'
  | 'reeds-at-water'
  | 'pier-at-water'
  | 'mill-wheel-in-channel'
  | 'forest-crowns'
  | 'vehicle-on-road'
  | 'boat-on-water';
export interface Reservation {
  id: string;
  ownerId: string;
  purpose: ReservationPurpose;
  polygon: readonly PointU[];
  /** Track/hill/catenary obstacles affect the relevant projection plane. */
  layer: 'back' | 'near' | 'both';
}
export interface FeatureExtent {
  id: string;
  ownerId: string;
  kind: string;
  fromXU: number;
  toXU: number;
  /** Half-open fragment keys are render identities, never logical features. */
  dependencies: readonly string[];
}
export interface PlacementRelation {
  reservationId: string;
  relation: AllowedRelation;
}
export function relationAllows(
  purpose: ReservationPurpose,
  relation: AllowedRelation,
): boolean {
  switch (relation) {
    case 'object-on-parcel':
      return purpose === 'parcel';
    case 'object-in-yard':
      return purpose === 'working-yard';
    case 'object-on-forecourt':
      return purpose === 'forecourt';
    case 'entrance-on-path':
    case 'pedestrian-on-path':
      return purpose === 'village-road';
    case 'object-on-village-green':
      return purpose === 'village-green';
    case 'object-on-field':
      return purpose === 'field';
    case 'object-on-forest-floor':
      return purpose === 'forest-floor';
    case 'platform-beside-track':
      return purpose === 'track' || purpose === 'platform';
    case 'vehicle-on-road':
      return purpose === 'village-road' || purpose === 'work-road';
    case 'boat-on-water':
    case 'reeds-at-water':
    case 'pier-at-water':
      return purpose === 'water';
    case 'mill-wheel-in-channel':
      return purpose === 'water';
    case 'bridge-over-river':
      return purpose === 'river';
    case 'forest-crowns':
      return false;
  }
}
function band(
  seed: number,
  from: number,
  to: number,
  top: (x: number) => number,
  bottom: (x: number) => number,
): PointU[] {
  const xs: number[] = [];
  for (let x = from; x < to; x += 16) xs.push(x);
  xs.push(to);
  return [
    ...xs.map((x) => ({ xU: x, yU: -railYUpU(seed, x) + top(x) })),
    ...xs.reverse().map((x) => ({ xU: x, yU: -railYUpU(seed, x) + bottom(x) })),
  ];
}
export function infrastructureReservations(
  seed: number,
  k: number,
  crossing: CrossingSite | undefined,
  bridge: BridgeSite | undefined,
  tunnel: TunnelSite | undefined,
): Reservation[] {
  const x0 = k * 1024,
    result: Reservation[] = [];
  const add = (
    ownerId: string,
    purpose: ReservationPurpose,
    polygon: readonly PointU[],
    layer: Reservation['layer'] = 'both',
  ) =>
    result.push({
      id: `${ownerId}:reserve:${purpose}`,
      ownerId,
      purpose,
      polygon,
      layer,
    });
  add(
    `g2:chunk:${k}:track`,
    'track',
    band(
      seed,
      x0 - 200,
      x0 + 1224,
      () => -12,
      () => 22,
    ),
  );
  if (crossing) {
    const x = x0 + crossing.localXU;
    add(
      crossing.id,
      'crossing-road',
      rectPolygon({
        leftU: x - 64,
        rightU: x + 64,
        topU: -1000,
        bottomU: 1400,
      }),
    );
  }
  if (bridge) {
    const x = x0 + bridge.localXU;
    add(
      bridge.id,
      'river',
      rectPolygon({
        leftU: x - 96,
        rightU: x + 96,
        topU: -1000,
        bottomU: 1400,
      }),
    );
  }
  for (const hill of [
    tunnel,
    tunnelSite(seed, k - 1),
    tunnelSite(seed, k + 1),
  ]) {
    if (!hill) continue;
    const from = hill.chunkIndex * 1024 + hill.fromX - 170,
      to = hill.chunkIndex * 1024 + hill.toX + 170,
      middle = (from + to) / 2,
      half = (to - from) / 2;
    add(
      hill.id,
      'tunnel-hill',
      band(
        seed,
        from,
        to,
        (x) =>
          -290 *
            Math.sqrt(Math.max(0, 1 - (Math.abs(x - middle) / half) ** 3)) -
          16,
        () => 4,
      ),
      'back',
    );
  }
  const secondary = secondarySite(seed, Math.floor(k / 8));
  if (secondary) {
    const from = Math.max(x0 - 200, secondary.fromX),
      to = Math.min(x0 + 1224, secondary.toX);
    if (from < to)
      add(
        secondary.id,
        'secondary-track',
        band(
          seed,
          from,
          to,
          () => -100,
          () => -40,
        ),
        'back',
      );
    for (const [x, pivot] of [
      [secondary.fromX, 380],
      [secondary.toX, 60],
    ] as const) {
      if (x + 440 - pivot < x0 - 200 || x - pivot > x0 + 1224) continue;
      const y = -railYUpU(seed, x) - 64;
      add(
        `${secondary.id}:portal:${x}`,
        'secondary-hill',
        rectPolygon({
          leftU: x - pivot,
          rightU: x + 440 - pivot,
          topU: y - 194,
          bottomU: y + 6,
        }),
        'back',
      );
    }
  }
  // Always reserve possible electric supports: locomotive choice never reseeds scenery.
  for (const x of catenaryPoleXs(seed, x0 - 200, x0 + 1224))
    if (catenarySupport(seed, x) === 'mast') {
      const y = -railYUpU(seed, x) - 12;
      add(
        `g2:catenary:${x}`,
        'catenary',
        rectPolygon({
          leftU: x - 16,
          rightU: x + 14,
          topU: y - 2,
          bottomU: y + 2,
        }),
        'back',
      );
    }
  return result;
}
export function roadReservation(road: RoadPath): Reservation {
  return {
    id: `${road.id}:reserve:village-road`,
    ownerId: road.ownerId,
    purpose: road.surface === 'dirt' ? 'work-road' : 'village-road',
    polygon: roadPolygon(road, 4),
    layer: road.layer ?? 'back',
  };
}
export function waterReservation(
  seed: number,
  k: number,
  water: WaterGeometry,
): Reservation {
  return {
    id: `${water.id}:reserve:water`,
    ownerId: water.id,
    purpose: 'water',
    polygon: waterPolygon(seed, k, water),
    layer: 'back',
  };
}
export function platformReservation(id: string, bounds: BoundsU): Reservation {
  return {
    id: `${id}:reserve:platform`,
    ownerId: id,
    purpose: 'platform',
    polygon: rectPolygon(bounds),
    layer: 'back',
  };
}
