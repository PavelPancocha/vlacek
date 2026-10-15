import { hash32 } from './Hash.ts';
import { contextAt, sceneAt, type ScenePlan } from './WorldPlan.ts';
import { regionAt, type RegionPlan } from './Regions.ts';
import type { SceneryProp } from './Scenery.ts';
import type { FenceFeature } from './Fences.ts';
import { placementConflict, footprintAdmissible } from './Placement.ts';
import {
  railYUpU,
  propFootU,
  projectedBounds,
  rectPolygon,
  polygonsHit,
  boundsHitPolygon,
  roadPolygon,
  pointInside,
  clipPolygonX,
  type PlacementCatalog,
  type PointU,
  type RoadPath,
} from './SceneryGeometry.ts';
import { bankHeightU } from './Terrain.ts';
import { longStation } from './SettlementPlan.ts';
import { crossingSite } from './Crossings.ts';
import { secondarySite } from './SecondaryTrack.ts';
import {
  roadReservation,
  type Reservation,
  type FeatureExtent,
} from './Reservations.ts';

export const SETTLEMENT_KINDS = [
  'back.house-a',
  'back.house-b',
  'back.house-c',
  'back.house-gable',
  'back.house-hip',
  'back.barn-timber',
  'back.farmstead',
  'back.chapel',
  'back.bus',
  'back.bus-shelter',
  'back.playground',
  'back.row-house',
  'back.apartment-house',
  'back.panel-house',
  'back.warehouse',
  'back.sawmill',
  'tree.linden',
  'tree.apple',
  'back.bench',
  'back.person-a',
  'near.garden-spring',
  'near.garden-summer',
  'near.garden-autumn',
  'near.garden-winter',
  'back.logs',
  'back.crates',
  'near.bush',
  'near.stones',
] as const;
const modulo = (n: number, length: number) =>
  n - Math.floor(n / length) * length;

/** The low foreground footpath: full half-width, sample step, taper and shortest lone piece. */
const FOOTPATH_HALF_U = 5,
  FOOTPATH_STEP_U = 32,
  FOOTPATH_TAPER_U = 160,
  FOOTPATH_MIN_PIECE_U = 192;
/** A road bridge reaches this far onto dry ground beyond the reserved stream. */
const ROAD_BRIDGE_BANK_U = 8;
/** The deck extends past the asphalt for its low railings and stone fascia. */
export const ROAD_BRIDGE_EDGE_U = 7;
/** Deck of a street's road bridge: reserved and drawn as the same polygon. */
export function roadBridgeDeck(
  street: RoadPath,
  fromXU: number,
  toXU: number,
): PointU[] {
  return clipPolygonX(roadPolygon(street, ROAD_BRIDGE_EDGE_U), fromXU, toXU);
}
/** Every settlement chunk but a working yard keeps a foreground footpath. */
export function settlementFootpathChunk(seed: number, k: number): boolean {
  const id = sceneAt(seed, k * 1024).templateId;
  return id.startsWith('settlements-') && id !== 'settlements-yard';
}
/** Roads lane: query anywhere in the host region; test the returned span before placing roads. */
export function settlementStreetPlan(seed: number, worldXU: number) {
  const region = regionAt(seed, worldXU);
  const village = region.landscape === 'countryside';
  if (!village && region.landscape !== 'town') return undefined;
  const fromXU = region.fromXU + (village ? 8192 : 0),
    toXU = village ? region.fromXU + 14336 : region.toXU;
  return {
    id: village ? `${region.id}:village` : `${region.id}:town`,
    fromXU,
    toXU,
    endpoints: [fromXU, toXU].map((xU) => ({
      xU,
      yU: -railYUpU(seed, xU) - 220 + 4 * Math.sin(xU / 300),
    })),
  };
}
/** Single scene-owned green; both render chunks see exactly the same polygon. */
export function villageGreen(seed: number, scene: ScenePlan): Reservation {
  let end = scene.fromXU + 1840;
  for (let k = Math.floor(scene.fromXU / 1024); k < scene.toXU / 1024; k++) {
    const crossing = crossingSite(seed, k),
      secondary = secondarySite(seed, Math.floor(k / 8));
    if (crossing && k * 1024 + crossing.localXU > scene.fromXU + 1024)
      end = Math.min(end, k * 1024 + crossing.localXU - 104);
    if (secondary && secondary.fromX - 380 > scene.fromXU + 1024)
      end = Math.min(end, secondary.fromX - 420);
  }
  return {
    id: `${scene.id}:green`,
    ownerId: `${scene.id}:green`,
    purpose: 'village-green',
    layer: 'back',
    polygon: [
      [200, 65],
      [450, 145],
      [830, 155],
      [1180, 140],
      [1570, 150],
      [1840, 90],
      [1710, 85],
      [1050, 88],
      [480, 85],
    ].map(([x = 0, depth = 0]) => ({
      xU: scene.fromXU + 200 + ((x - 200) * (end - scene.fromXU - 200)) / 1640,
      yU:
        -railYUpU(
          seed,
          scene.fromXU + 200 + ((x - 200) * (end - scene.fromXU - 200)) / 1640,
        ) - depth,
    })),
  };
}
/** Roads first, then occupied parcels and access corridors; optional conflicts are omitted. */
export function settlementScenery(
  seed: number,
  k: number,
  scene: ScenePlan,
  region: RegionPlan,
  catalog: PlacementCatalog,
  obstacles: readonly Reservation[],
  animalXU: number,
  precedingHouses: readonly string[] = [],
) {
  const x0 = k * 1024,
    role = scene.templateId.slice('settlements-'.length),
    village = role.startsWith('village');
  const span = settlementStreetPlan(seed, x0 + 512);
  if (!span) throw Error('settlement outside owned span');
  const owner = span.id;
  const props: SceneryProp[] = [],
    roads: RoadPath[] = [],
    features: FeatureExtent[] = [],
    reservations: Reservation[] = [],
    fences: FenceFeature[] = [];
  const occupied: { id: string; polygon: Reservation['polygon'] }[] = [];
  const green =
    role === 'village-green' ? villageGreen(seed, scene) : undefined;
  if (green) {
    reservations.push(green);
    features.push({
      id: green.ownerId,
      ownerId: scene.id,
      kind: 'village-green',
      fromXU: scene.fromXU + 200,
      toXU: Math.max(...green.polygon.map((p) => p.xU)),
      dependencies: [],
    });
  }
  const taper = (x: number) =>
    Math.max(0, Math.min(1, (x - span.fromXU) / 160, (span.toXU - x) / 160));
  const roadY = (x: number, offset = 0) => {
    const greenStart = village ? region.fromXU + 10240 : Infinity;
    const aroundGreen = Math.max(
      0,
      Math.min(1, (x - greenStart) / 350, (greenStart + 2048 - x) / 350),
    );
    const station = longStation(seed, Math.floor(x / 8192));
    const aroundStation = station
      ? Math.max(
          0,
          Math.min(
            1,
            (x - station.fromXU + 160) / 160,
            (station.toXU + 160 - x) / 160,
          ),
        )
      : 0;
    // A detour is chunk-local; exported endpoints and neighbouring chunks keep
    // the canonical line. Smoothstep gives both shoulders a zero end tangent.
    // Keep the first/last 32-u segment unchanged as well: roadPolygon uses its
    // sampled tangent to compute the shared road edge, not the analytic curve.
    const t = Math.max(
      0,
      Math.min(1, (x - x0 - 32) / 160, (x0 + 992 - x) / 160),
    );
    const detour = offset * t * t * (3 - 2 * t);
    return (
      -railYUpU(seed, x) -
      140 -
      45 * aroundGreen -
      40 * aroundStation -
      80 * (1 - taper(x)) ** 2 +
      4 * Math.sin(x / 300) -
      detour
    );
  };
  /** The main street may cross a stream (`bridgeable`): it gets a road bridge. */
  const roadClear = (
    path: RoadPath,
    support?: Reservation,
    bridgeable = false,
  ) =>
    !obstacles
      .concat(reservations)
      .some(
        (r) =>
          r.id !== support?.id &&
          r.purpose !== 'village-green' &&
          r.layer !== (path.layer === 'near' ? 'back' : 'near') &&
          r.purpose !== 'crossing-road' &&
          !(bridgeable && r.purpose === 'river') &&
          polygonsHit(roadPolygon(path, 4), r.polygon),
      );
  const recordRoad = (
    path: RoadPath,
    dependencies: readonly string[],
    kind = 'path',
  ) => {
    roads.push(path);
    reservations.push(roadReservation(path));
    features.push({
      id: path.id,
      ownerId: path.ownerId,
      kind,
      fromXU:
        path.layer === 'near' && path.ownerId === scene.id
          ? scene.fromXU
          : path.fromXU,
      toXU:
        path.layer === 'near' && path.ownerId === scene.id
          ? scene.toXU
          : path.toXU,
      dependencies,
    });
  };
  // A street over a stream keeps its asphalt on a small road bridge whose
  // deck reaches dry ground on both banks; the deck is reserved exactly as drawn.
  const bridgeStreams = (street: RoadPath) => {
    for (const river of obstacles) {
      if (
        river.purpose !== 'river' ||
        !polygonsHit(roadPolygon(street, 4), river.polygon)
      )
        continue;
      const xs = river.polygon.map((p) => p.xU),
        id = `${street.id}:bridge`,
        fromXU = Math.min(...xs) - ROAD_BRIDGE_BANK_U,
        toXU = Math.max(...xs) + ROAD_BRIDGE_BANK_U;
      reservations.push({
        id: `${id}:reserve:village-road`,
        ownerId: id,
        purpose: 'village-road',
        layer: 'back',
        polygon: roadBridgeDeck(street, fromXU, toXU),
      });
      features.push({
        id,
        ownerId: street.ownerId,
        kind: 'road-bridge',
        fromXU,
        toXU,
        dependencies: [street.id, river.ownerId],
      });
    }
  };
  let road: RoadPath | undefined,
    roadOffset = 0;
  const mainRoads: RoadPath[] = [];
  for (const offset of [0, 40, -40]) {
    const candidate: RoadPath = {
      id: `${owner}:street:${k}`,
      ownerId: owner,
      fromXU: x0,
      toXU: x0 + 1024,
      points: Array.from({ length: 33 }, (_, i) => ({
        xU: x0 + i * 32,
        yU: roadY(x0 + i * 32, offset),
        halfWidthU: 9 * taper(x0 + i * 32),
      })),
    };
    if (roadClear(candidate, undefined, true)) {
      road = candidate;
      mainRoads.push(candidate);
      roadOffset = offset;
      recordRoad(
        candidate,
        obstacles
          .filter(
            (r) =>
              r.purpose === 'crossing-road' &&
              polygonsHit(roadPolygon(candidate, 4), r.polygon),
          )
          .map((r) => r.ownerId),
        'road',
      );
      bridgeStreams(candidate);
      break;
    }
  }
  // A portal hill can hide a middle span; retain dry connected pieces on either side.
  if (!road) {
    let points: RoadPath['points'][number][] = [];
    const finish = () => {
      if (points.length > 1) {
        const from = points[0],
          to = points.at(-1);
        if (from && to) {
          const piece: RoadPath = {
            id: `${owner}:street:${k}:piece:${mainRoads.length}`,
            ownerId: owner,
            fromXU: from.xU,
            toXU: to.xU,
            points,
          };
          mainRoads.push(piece);
          recordRoad(
            piece,
            obstacles
              .filter(
                (r) =>
                  r.purpose === 'crossing-road' &&
                  polygonsHit(roadPolygon(piece, 4), r.polygon),
              )
              .map((r) => r.ownerId),
            'road',
          );
          bridgeStreams(piece);
        }
      }
      points = [];
    };
    for (let i = 0; i < 32; i++) {
      const a = {
          xU: x0 + i * 32,
          yU: roadY(x0 + i * 32),
          halfWidthU: 9 * taper(x0 + i * 32),
        },
        b = {
          xU: x0 + (i + 1) * 32,
          yU: roadY(x0 + (i + 1) * 32),
          halfWidthU: 9 * taper(x0 + (i + 1) * 32),
        };
      if (
        roadClear(
          {
            id: 'candidate',
            ownerId: owner,
            fromXU: a.xU,
            toXU: b.xU,
            points: [a, b],
          },
          undefined,
          true,
        )
      ) {
        if (points.length === 0) points.push(a);
        points.push(b);
      } else finish();
    }
    finish();
    road = mainRoads[0];
  }
  let candidate = 0;
  const put = (
    kind: string,
    xU: number,
    depth: number,
    path = true,
    scale = 1,
    layer: 'back' | 'near' = kind.startsWith('near.') ? 'near' : 'back',
    support?: Reservation,
  ) => {
    const id = `g2:chunk:${k}:prop:settlement:candidate:${candidate++}`;
    const entranceStreet = mainRoads.find(
      (r) => x0 + xU >= r.fromXU && x0 + xU <= r.toXU,
    );
    if (path && !entranceStreet) return undefined;
    const prop: SceneryProp = {
      id,
      kind,
      layer,
      xU,
      depth,
      scale,
      flip: false,
      phase: (hash32(seed, id) % 1000) / 1000,
      dependencies: road ? [road.id] : [],
      ...(support
        ? {
            relations: [
              {
                reservationId: support.id,
                relation:
                  support.purpose === 'village-green'
                    ? 'object-on-village-green'
                    : support.purpose === 'working-yard'
                      ? 'object-in-yard'
                      : support.purpose === 'parcel'
                        ? 'object-on-parcel'
                        : 'pedestrian-on-path',
              },
            ],
          }
        : {}),
    };
    const part = catalog[kind];
    if (!part) throw Error(`missing settlement art ${kind}`);
    const body = projectedBounds(seed, k, prop, part),
      foot = projectedBounds(seed, k, prop, part, true);
    if (layer === 'near' && Math.abs(xU - animalXU) < 60) return undefined;
    if (
      body.leftU < x0 + 16 ||
      body.rightU > x0 + 1008 ||
      !footprintAdmissible(seed, k, prop, catalog) ||
      placementConflict(
        seed,
        k,
        prop,
        catalog,
        [...obstacles, ...reservations],
        prop.relations,
      )
    )
      return undefined;
    const building =
      /house|barn|farmstead|chapel|warehouse|sawmill|playground|shelter/.test(
        kind,
      );
    if (
      layer === 'back' &&
      (occupied.some((p) => boundsHitPolygon(body, p.polygon)) ||
        roads.some(
          (r) =>
            r.id.endsWith(':access') &&
            boundsHitPolygon(body, roadPolygon(r, 2)),
        ))
    )
      return undefined;
    if (path && entranceStreet) {
      const access: RoadPath = {
        id: `${id}:access`,
        ownerId: id,
        fromXU: x0 + xU - 5,
        toXU: x0 + xU + 5,
        style: 'path',
        points: [
          { xU: x0 + xU, yU: roadY(x0 + xU, roadOffset), halfWidthU: 4 },
          { xU: x0 + xU, yU: foot.bottomU + 2, halfWidthU: 4 },
        ],
      };
      if (
        obstacles
          .concat(reservations)
          .some(
            (r) =>
              !mainRoads.some((road) => r.id === roadReservation(road).id) &&
              r.id !== support?.id &&
              r.purpose !== 'village-green' &&
              r.layer !== 'near' &&
              polygonsHit(roadPolygon(access), r.polygon),
          ) ||
        occupied.some((p) => polygonsHit(roadPolygon(access), p.polygon))
      )
        return undefined;
      recordRoad(access, [entranceStreet.id]);
      prop.dependencies = [access.id];
      prop.relations = [
        ...(prop.relations ?? []),
        {
          reservationId: roadReservation(access).id,
          relation: 'entrance-on-path',
        },
      ];
    }
    if (building) {
      const parcel: Reservation = {
        id: `${id}:parcel`,
        ownerId: id,
        purpose: 'parcel',
        layer: 'back',
        polygon: rectPolygon(body),
      };
      reservations.push(parcel);
      occupied.push({ id, polygon: parcel.polygon });
      prop.relations = [
        ...(prop.relations ?? []),
        { reservationId: parcel.id, relation: 'object-on-parcel' },
      ];
    }
    props.push(prop);
    return prop;
  };
  const houses = [
    'back.house-gable',
    'back.house-b',
    'back.house-hip',
    'back.house-c',
    'back.house-a',
  ];
  const facades = [
    'back.row-house',
    'back.apartment-house',
    'back.panel-house',
  ];
  const count =
    roadOffset !== 0
      ? 2
      : role === 'village-green'
        ? 4
        : role === 'street' ||
            (role === 'suburb' &&
              road?.fromXU === x0 &&
              road.toXU === x0 + 1024)
          ? 4
          : role === 'yard' || role === 'park'
            ? 0
            : 2;
  const greenParcels = [
    [130, 0.48],
    [350, 0.86],
    [600, 0.98],
    [830, 0.98],
    [1180, 0.3],
    [1240, 0.98],
    [1740, 0.86],
    [1930, 0.48],
  ];
  const acceptedHouses: SceneryProp[] = [];
  for (let i = 0; i < count; i++) {
    const ordinal = (k - Math.floor(scene.fromXU / 1024)) * 4 + i;
    const parcel = greenParcels[ordinal];
    const x =
      green && parcel
        ? (parcel[0] ?? 0) + scene.fromXU - x0
        : 140 + i * (720 / Math.max(1, count - 1));
    const variant = modulo(
      k * 5 + i + hash32(seed, 'settlements:facades', region.index),
      houses.length,
    );
    const kind =
      role === 'street'
        ? facades[modulo(k * 4 + i, facades.length)]
        : role === 'suburb' && i === 1
          ? 'back.row-house'
          : Array.from(
              { length: houses.length },
              (_, offset) => houses[modulo(variant + offset, houses.length)],
            ).find(
              (kind) =>
                kind !== undefined &&
                ![...precedingHouses, ...acceptedHouses.map((p) => p.kind)]
                  .slice(-2)
                  .includes(kind),
            );
    if (!kind) throw Error('missing facade');
    const depth =
      roadOffset !== 0 ||
      (!green && -roadY(x0 + x) - railYUpU(seed, x0 + x) > 160)
        ? 0.99
        : green && parcel
          ? (parcel[1] ?? 0.98)
          : role === 'street' || kind === 'back.row-house'
            ? 0.95
            : 0.52;
    const house = put(kind, x, depth, true, role === 'street' ? 0.82 : 1);
    if (house) acceptedHouses.push(house);
  }
  if (green) {
    if (x0 === scene.fromXU) put('back.chapel', 960, 0.98);
    const middle = scene.fromXU + 1080;
    for (const [kind, worldX, depth] of [
      ['tree.linden', middle, 0.49],
      ['back.bench', middle - 105, 0.48],
    ] as const) {
      if (Math.floor(worldX / 1024) !== k) continue;
      const p = put(
        kind,
        worldX - x0,
        depth,
        kind === 'back.bench',
        1,
        'back',
        green,
      );
      if (p) p.dependencies = [green.ownerId];
    }
  }
  if (role === 'village-exit' && x0 !== scene.fromXU && road) {
    const bay: RoadPath = {
      id: `${owner}:bus-bay`,
      ownerId: owner,
      fromXU: x0 + 340,
      toXU: x0 + 640,
      points: [
        { xU: x0 + 340, yU: roadY(x0 + 340, roadOffset), halfWidthU: 8 },
        { xU: x0 + 430, yU: roadY(x0 + 430, roadOffset) - 24, halfWidthU: 12 },
        { xU: x0 + 550, yU: roadY(x0 + 550, roadOffset) - 24, halfWidthU: 12 },
        { xU: x0 + 640, yU: roadY(x0 + 640, roadOffset), halfWidthU: 8 },
      ],
    };
    if (
      !obstacles.some(
        (r) =>
          r.layer !== 'near' &&
          r.purpose !== 'crossing-road' &&
          polygonsHit(roadPolygon(bay, 4), r.polygon),
      )
    ) {
      recordRoad(bay, [road.id], 'road');
      const bus = put(
        'back.bus',
        490,
        (-roadY(x0 + 490, roadOffset) - railYUpU(seed, x0 + 490) + 24) / 220,
        false,
        1,
        'back',
        roadReservation(bay),
      );
      if (bus) {
        bus.dependencies = [bay.id];
        bus.relations = [
          {
            reservationId: roadReservation(bay).id,
            relation: 'vehicle-on-road',
          },
        ];
      }
      put('back.bus-shelter', 550, 0.98, true, 1, 'back', roadReservation(bay));
    }
    put('back.playground', 760, 0.75);
    put('back.farmstead', 260, 0.86);
    put('back.barn-timber', 660, 0.95);
  }
  if (role === 'park')
    for (let i = 0; i < 5; i++) {
      put('tree.linden', 120 + i * 175, 0.75 + 0.08 * (i % 2), false);
      if (i % 2 === 0) put('back.bench', 160 + i * 175, 0.36);
    }
  if (role === 'yard') {
    const yard: Reservation = {
      id: `${scene.id}:working-yard:${k}`,
      ownerId: `${scene.id}:yard:${k}`,
      purpose: 'working-yard',
      layer: 'back',
      polygon: rectPolygon({
        leftU: x0 + 100,
        rightU: x0 + 940,
        topU: -railYUpU(seed, x0 + 520) - 320,
        bottomU: -railYUpU(seed, x0 + 520) - 122,
      }),
    };
    if (
      !obstacles.some(
        (r) => r.layer !== 'near' && polygonsHit(yard.polygon, r.polygon),
      )
    ) {
      reservations.push(yard);
      features.push({
        id: yard.ownerId,
        ownerId: scene.id,
        kind: 'working-yard',
        fromXU: x0 + 100,
        toXU: x0 + 940,
        dependencies: road ? [road.id] : [],
      });
      const factory = put(
        modulo(
          hash32(seed, 'settlements:industry', region.index) +
            Math.floor(scene.index / 3),
          2,
        ) === 0
          ? 'back.warehouse'
          : 'back.sawmill',
        520,
        0.72,
        true,
        1,
        'back',
        yard,
      );
      if (factory)
        for (const x of [240, 340, 760]) {
          const p = put(
            factory.kind === 'back.sawmill' ? 'back.logs' : 'back.crates',
            x,
            0.82,
            false,
            1,
            'back',
            yard,
          );
          if (p) p.dependencies = [yard.ownerId];
        }
    }
  }
  const fence = (p: SceneryProp) => {
    const part = catalog[p.kind];
    if (!part) throw Error('missing garden');
    const b = projectedBounds(seed, k, p, part, true),
      fromXU = b.leftU - 14,
      toXU = b.rightU + 14;
    const posts = Array.from({ length: 5 }, (_, i) => {
      const x = fromXU + (i * (toXU - fromXU)) / 4;
      return {
        xU: x,
        yU: b.bottomU + 14,
      };
    });
    const bounds = {
      leftU: fromXU,
      rightU: toXU,
      topU: Math.min(...posts.map((p) => p.yU)) - 26,
      bottomU: Math.max(...posts.map((p) => p.yU)),
    };
    if (
      obstacles.some(
        (r) => r.layer !== 'near' && boundsHitPolygon(bounds, r.polygon),
      )
    )
      return false;
    fences.push({
      id: `${p.id}:fence`,
      ownerId: p.id,
      fromXU,
      toXU,
      style: 'picket',
      layer: 'back',
      depth: p.depth,
      posts,
      gatePanel: 2,
    });
    return true;
  };
  for (const house of acceptedHouses) {
    const part = catalog[house.kind];
    if (!part) throw Error('missing house');
    const hb = projectedBounds(seed, k, house, part);
    const season = contextAt(seed, x0 + house.xU).season;
    for (const side of [1, -1]) {
      const x = house.xU + side * ((hb.rightU - hb.leftU) / 2 + 38);
      const garden = put(
        `near.garden-${season}`,
        x,
        Math.min(1, house.depth + 0.02),
        false,
        0.65,
        'back',
      );
      if (!garden) continue;
      if (!fence(garden)) {
        props.splice(props.indexOf(garden), 1);
        continue;
      }
      const front = fences.at(-1),
        a = front?.posts[2],
        b = front?.posts[3];
      if (!a || !b) throw Error('garden gate missing');
      const gate = { xU: (a.xU + b.xU) / 2, yU: (a.yU + b.yU) / 2 };
      const entranceFoot = projectedBounds(seed, k, house, part, true);
      const access: RoadPath = {
        id: `${garden.id}:garden-access`,
        ownerId: house.id,
        fromXU: Math.min(x0 + house.xU, gate.xU),
        toXU: Math.max(x0 + house.xU, gate.xU),
        style: 'path',
        points: [
          { xU: x0 + house.xU, yU: entranceFoot.bottomU + 3, halfWidthU: 3 },
          { ...gate, halfWidthU: 3 },
        ],
      };
      if (
        occupied.some(
          (p) =>
            p.id !== house.id && polygonsHit(roadPolygon(access), p.polygon),
        ) ||
        obstacles.some(
          (r) =>
            r.layer !== 'near' && polygonsHit(roadPolygon(access), r.polygon),
        )
      ) {
        props.splice(props.indexOf(garden), 1);
        fences.pop();
        continue;
      }
      const parcel = reservations.find(
        (r) => r.purpose === 'parcel' && r.ownerId === house.id,
      );
      const gardenPart = catalog[garden.kind];
      if (!parcel || !gardenPart) throw Error('house garden has no parcel');
      const gb = projectedBounds(seed, k, garden, gardenPart);
      const bottom = Math.max(hb.bottomU, gb.bottomU + 14),
        step = Math.min(hb.bottomU - 4, gb.topU) - 2;
      // Follow the house roof and the low garden, rather than claiming the empty space above it.
      const proposed =
        x > house.xU
          ? [
              { xU: hb.leftU, yU: hb.topU },
              { xU: hb.rightU, yU: hb.topU },
              { xU: hb.rightU, yU: step },
              { xU: gb.rightU + 14, yU: step },
              { xU: gb.rightU + 14, yU: bottom },
              { xU: hb.leftU, yU: bottom },
            ]
          : [
              { xU: hb.leftU, yU: hb.topU },
              { xU: hb.rightU, yU: hb.topU },
              { xU: hb.rightU, yU: bottom },
              { xU: gb.leftU - 14, yU: bottom },
              { xU: gb.leftU - 14, yU: step },
              { xU: hb.leftU, yU: step },
            ];
      if (
        reservations.some(
          (r) =>
            r.purpose === 'parcel' &&
            r.ownerId !== house.id &&
            polygonsHit(proposed, r.polygon),
        ) ||
        roads.some(
          (r) =>
            r.style === 'path' &&
            r.ownerId !== house.id &&
            polygonsHit(proposed, roadPolygon(r)),
        )
      ) {
        props.splice(props.indexOf(garden), 1);
        fences.pop();
        continue;
      }
      recordRoad(access, [house.dependencies?.[0] ?? house.id]);
      parcel.polygon = proposed;
      garden.relations = [
        ...(garden.relations ?? []),
        { reservationId: parcel.id, relation: 'object-on-parcel' },
      ];
      house.relations = [
        ...(house.relations ?? []),
        {
          reservationId: roadReservation(access).id,
          relation: 'entrance-on-path',
        },
      ];
      const id = `${garden.id}:house-garden`;
      features.push({
        id,
        ownerId: house.id,
        kind: 'house-garden',
        fromXU: x0 + x - 40,
        toXU: x0 + x + 40,
        dependencies: [house.id, access.id],
      });
      garden.dependencies = [id];
      break;
    }
  }
  if (role !== 'yard') {
    // The footpath joins at full width only towards a neighbouring chunk
    // that keeps one. Towards the countryside or a working yard it narrows
    // into the meadow and ends in a point at the chunk edge.
    const openFrom = settlementFootpathChunk(seed, k - 1),
      openTo = settlementFootpathChunk(seed, k + 1),
      segments = 1024 / FOOTPATH_STEP_U;
    const centre = (x: number) =>
      propFootU(
        {
          kind: 'path',
          layer: 'near',
          xU: x,
          depth: 0.56,
          scale: 1,
          flip: false,
        },
        x,
        railYUpU(seed, x),
        bankHeightU(seed, x),
      );
    /** Samples `from`..`to` of the chunk; every end but a join tapers. */
    const footpath = (id: string, from: number, to: number): RoadPath => {
      const fromXU = x0 + from * FOOTPATH_STEP_U,
        toXU = x0 + to * FOOTPATH_STEP_U,
        closedFrom = from > 0 || !openFrom,
        closedTo = to < segments || !openTo,
        reach = Math.min(
          FOOTPATH_TAPER_U,
          closedFrom && closedTo ? (toXU - fromXU) / 2 : toXU - fromXU,
        );
      return {
        id,
        ownerId: scene.id,
        fromXU,
        toXU,
        layer: 'near',
        style: 'path',
        points: Array.from({ length: to - from + 1 }, (_, i) => {
          const x = fromXU + i * FOOTPATH_STEP_U;
          return {
            ...centre(x),
            halfWidthU:
              FOOTPATH_HALF_U *
              Math.min(
                1,
                closedFrom ? (x - fromXU) / reach : 1,
                closedTo ? (toXU - x) / reach : 1,
              ),
          };
        }),
      };
    };
    const path = footpath(
      `${scene.id}:${role === 'street' ? 'pedestrian' : 'allotments-path'}`,
      0,
      segments,
    );
    const whole = roadClear(path);
    if (!whole) {
      // A river or another reserved crossing splits the footpath. Each clear
      // run becomes a piece that narrows to a point before the obstacle; a
      // piece joining a neighbour is always kept so both sides still meet.
      const segmentClear = (i: number) =>
        roadClear({
          id: `${path.id}:candidate`,
          ownerId: scene.id,
          fromXU: x0 + i * FOOTPATH_STEP_U,
          toXU: x0 + (i + 1) * FOOTPATH_STEP_U,
          layer: 'near',
          style: 'path',
          points: [i, i + 1].map((j) => ({
            ...centre(x0 + j * FOOTPATH_STEP_U),
            halfWidthU: FOOTPATH_HALF_U,
          })),
        });
      let start: number | undefined,
        pieces = 0;
      for (let i = 0; i <= segments; i++) {
        if (i < segments && segmentClear(i)) {
          start ??= i;
          continue;
        }
        if (
          start !== undefined &&
          ((start === 0 && openFrom) ||
            (i === segments && openTo) ||
            (i - start) * FOOTPATH_STEP_U >= FOOTPATH_MIN_PIECE_U)
        ) {
          const piece = footpath(`${path.id}:piece:${k}:${pieces}`, start, i);
          if (roadClear(piece)) {
            recordRoad(piece, []);
            pieces++;
          }
        }
        start = undefined;
      }
    }
    if (whole) {
      recordRoad(path, []);
      const support = roadReservation(path);
      if (role === 'street') {
        const person = put(
          'back.person-a',
          480,
          0.56,
          false,
          1,
          'near',
          support,
        );
        if (person) person.dependencies = [path.id];
        for (const x of [200, 760]) {
          const shrub = put('near.bush', x, 0.7, false);
          if (shrub) shrub.dependencies = [path.id];
        }
      } else if (role !== 'park' && x0 === scene.fromXU) {
        // One plot per two-chunk scene, containing 2–4 full-size beds.
        const group = `${scene.id}:allotments`;
        const nearPoint = (xU: number, depth: number) =>
          propFootU(
            { kind: 'path', layer: 'near', xU, depth, scale: 1, flip: false },
            xU,
            railYUpU(seed, xU),
            bankHeightU(seed, xU),
          );
        const corners = [
          nearPoint(x0 + 192, 0.525),
          nearPoint(x0 + 832, 0.525),
          nearPoint(x0 + 800, 0.32),
          nearPoint(x0 + 224, 0.32),
        ];
        const plot: Reservation = {
          id: `${group}:parcel`,
          ownerId: group,
          purpose: 'parcel',
          layer: 'near',
          polygon: corners,
        };
        const clear = !obstacles.concat(reservations).some(
          (r) =>
            r.layer !== 'back' &&
            polygonsHit(
              corners.map((p, i) => ({
                xU: p.xU + (i === 0 || i === 3 ? -4 : 4),
                yU: p.yU + (i < 2 ? 2 : -26),
              })),
              r.polygon,
            ),
        );
        if (clear) {
          reservations.push(plot);
          const beds: SceneryProp[] = [];
          const columns = [
            [340, 420, 280],
            [684, 620, 744],
          ].flatMap((candidates) => {
            const x = candidates.find((x) => Math.abs(x - animalXU) >= 80);
            return x === undefined ? [] : [x];
          });
          for (const depth of [0.4, 0.49])
            for (const x of columns) {
              const bed = put(
                `near.garden-${contextAt(seed, x0 + x).season}`,
                x,
                depth,
                false,
                1,
                'near',
                plot,
              );
              if (!bed) continue;
              const part = catalog[bed.kind];
              if (!part) throw Error('missing bed');
              if (
                !rectPolygon(projectedBounds(seed, k, bed, part)).every((p) =>
                  pointInside(p, corners),
                )
              ) {
                props.splice(props.indexOf(bed), 1);
                continue;
              }
              beds.push(bed);
            }
          if (beds.length >= 2) {
            const posts: FenceFeature['posts'][number][] = [];
            for (const [i, a] of corners.entries()) {
              const b = corners[(i + 1) % corners.length];
              if (!b) throw Error('missing plot corner');
              const segments = Math.ceil(
                Math.hypot(b.xU - a.xU, b.yU - a.yU) / 64,
              );
              for (let j = 0; j < segments; j++)
                posts.push({
                  xU: a.xU + ((b.xU - a.xU) * j) / segments,
                  yU: a.yU + ((b.yU - a.yU) * j) / segments,
                });
            }
            const gatePanel = 5,
              a = posts[gatePanel],
              b = posts[gatePanel + 1];
            if (!a || !b) throw Error('missing plot gate');
            const gate = { xU: (a.xU + b.xU) / 2, yU: (a.yU + b.yU) / 2 };
            fences.push({
              id: `${group}:boundary`,
              ownerId: group,
              fromXU: x0 + 192,
              toXU: x0 + 832,
              style: 'picket',
              layer: 'near',
              depth: 0.525,
              posts,
              gatePanel,
              closed: true,
            });
            features.push({
              id: group,
              ownerId: scene.id,
              kind: 'allotments',
              fromXU: x0 + 192,
              toXU: x0 + 832,
              dependencies: [path.id],
            });
            const innerEnd = nearPoint(gate.xU, 0.4);
            const trunk: RoadPath = {
              id: `${group}:entrance`,
              ownerId: group,
              fromXU: gate.xU - 3,
              toXU: gate.xU + 3,
              layer: 'near',
              style: 'path',
              points: [
                { ...nearPoint(gate.xU, 0.56), halfWidthU: 3 },
                { ...gate, halfWidthU: 3 },
                {
                  ...innerEnd,
                  yU: innerEnd.yU + 3,
                  halfWidthU: 3,
                },
              ],
            };
            recordRoad(trunk, [path.id]);
            // The front fence runs straight between its corner posts while
            // the ground under the beds may dip, so each bed path keeps its
            // 3-u half-width plus 3 u inside that line: it leaves the gate
            // path inside the plot and stays there.
            const [frontA, frontB] = corners;
            if (!frontA || !frontB) throw Error('missing plot front');
            const insideFence = (xU: number, yU: number) =>
              Math.min(
                yU,
                frontA.yU +
                  ((frontB.yU - frontA.yU) * (xU - frontA.xU)) /
                    (frontB.xU - frontA.xU) -
                  6,
              );
            for (const bed of beds) {
              const part = catalog[bed.kind];
              if (!part) throw Error('missing bed');
              const body = projectedBounds(seed, k, bed, part);
              const access: RoadPath = {
                id: `${bed.id}:bed-access`,
                ownerId: group,
                fromXU: Math.min(gate.xU, x0 + bed.xU),
                toXU: Math.max(gate.xU, x0 + bed.xU),
                layer: 'near',
                style: 'path',
                points: [
                  {
                    xU: gate.xU,
                    yU: insideFence(
                      gate.xU,
                      nearPoint(gate.xU, bed.depth).yU + 3,
                    ),
                    halfWidthU: 3,
                  },
                  {
                    xU: x0 + bed.xU,
                    yU: insideFence(x0 + bed.xU, body.bottomU + 3),
                    halfWidthU: 3,
                  },
                ],
              };
              recordRoad(access, [trunk.id]);
              bed.dependencies = [group, access.id];
              bed.relations = [
                ...(bed.relations ?? []),
                {
                  reservationId: roadReservation(access).id,
                  relation: 'entrance-on-path',
                },
              ];
            }
          } else {
            for (const bed of beds) props.splice(props.indexOf(bed), 1);
            reservations.splice(reservations.indexOf(plot), 1);
          }
        }
      }
    }
  }
  return { props, roads, features, reservations, fences };
}
