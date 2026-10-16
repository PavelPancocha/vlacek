import { secondarySite } from './SecondaryTrack.ts';
import { crossingSite } from './Crossings.ts';
import { regionAt } from './Regions.ts';
import { unitRandom, hash32 } from './Hash.ts';
import { railYUpU, type RoadPath, type RoadPointU } from './SceneryGeometry.ts';
import { ROAD_ACTOR_SPEED_U_PER_SEC } from '../interaction/roadTraffic.ts';
import type { SceneryProp } from './Scenery.ts';
import { stationFlat, stationSlot } from './Stations.ts';
import { sceneAt, templateById } from './WorldPlan.ts';
import { settlementStreetPlan } from './SettlementScenery.ts';

export type RoadStretchKind = 'parallel-road' | 'highway';
export interface RoadStretch extends RoadPath {
  kind: RoadStretchKind;
  seed: number;
  /** Whole feature extent, shared by every fragment. */
  startXU: number;
  endXU: number;
  settlementConnections: readonly {
    settlementId: string;
    boundaryXU: number;
    side: 'start' | 'end';
    mode: 'terrain-hidden';
    roadEnd: { xU: number; yU: number };
  }[];
}

/** Settlement ownership is planned, including the station override of a scene. */
export function settlementSpanAt(
  seed: number,
  k: number,
): { id: string; fromXU: number; toXU: number } | undefined {
  const xU = k * 1024;
  const span = settlementStreetPlan(seed, xU);
  if (span && xU < span.toXU && xU + 1024 > span.fromXU)
    return { id: span.id, fromXU: span.fromXU, toXU: span.toXU };
  const scene = sceneAt(seed, xU);
  if (templateById(scene.templateId).station) return scene;
  if (
    stationSlot(seed, Math.floor(k / 8)) === k - Math.floor(k / 8) * 8 &&
    stationFlat(seed, k)
  )
    return {
      id: `g2:chunk:${k}:station:0`,
      fromXU: k * 1024,
      toXU: (k + 1) * 1024,
    };
  return undefined;
}
/** A long approach recedes past the horizon; no visible transverse end cap. */
export function roadStretchPoint(road: RoadStretch, xU: number): RoadPointU {
  const middle = (road.startXU + road.endXU) / 2;
  const offset = road.kind === 'highway' ? 174 : 104;
  const sway =
    (road.kind === 'highway' ? 5 : 12) * Math.sin((xU - middle) / 620);
  const end = Math.max(
    0,
    1 - Math.min(xU - road.startXU, road.endXU - xU) / 384,
  );
  const distance = offset + sway + 230 * end * end;
  return {
    xU,
    yU: -railYUpU(road.seed, xU) - distance,
    halfWidthU: road.kind === 'highway' ? 28 : 12,
  };
}
/** Block slots 2–3 avoid bridge/tunnel/secondary slots; neighbours share world samples. */
export function roadStretchesInChunk(seed: number, k: number): RoadStretch[] {
  const block = Math.floor(k / 8),
    slot = k - block * 8;
  const region = regionAt(seed, k * 1024);
  if (!['countryside', 'foothills', 'town'].includes(region.landscape))
    return [];
  if (block * 8192 >= region.toXU - 8192) return [];
  if (settlementSpanAt(seed, k)) return [];
  const kinds: RoadStretchKind[] = [];
  if ((slot === 2 || slot === 3) && !secondarySite(seed, block))
    kinds.push('parallel-road');
  if (
    (slot === 0 || slot === 1) &&
    region.landscape !== 'foothills' &&
    block === region.fromXU / 8192 + 2 &&
    hash32(seed, 'roads-v2:highway', region.index) % 4 === 0
  )
    kinds.push('highway');
  return kinds.map((kind) => {
    const nominalStart = block * 8192 + (kind === 'highway' ? 0 : 2048);
    let startXU = nominalStart,
      endXU = nominalStart + 2048;
    if (settlementSpanAt(seed, nominalStart / 1024)) startXU += 1024;
    if (settlementSpanAt(seed, nominalStart / 1024 + 1)) endXU -= 1024;
    const before = settlementSpanAt(seed, startXU / 1024 - 1),
      after = settlementSpanAt(seed, endXU / 1024);
    // The complete widest reservation, not just its centreline, stays outside the span.
    if (before) startXU += 96;
    if (after) endXU -= 96;
    const road: RoadStretch = {
      id: `g2:block:${block}:${kind}`,
      ownerId: region.id,
      kind,
      seed,
      startXU,
      endXU,
      fromXU: Math.max(k * 1024, startXU),
      toXU: Math.min((k + 1) * 1024, endXU),
      points: [],
      settlementConnections: [],
      ...(kind === 'highway' ? { medianHalfWidthU: 4 } : {}),
    };
    const points: RoadPointU[] = [];
    // One extra chord on either side gives the shared sample the same normal.
    for (
      let x = Math.max(k * 1024 - 32, startXU);
      x <= Math.min((k + 1) * 1024 + 32, endXU);
      x += 32
    )
      points.push(roadStretchPoint(road, x));
    const settlementConnections: RoadStretch['settlementConnections'][number][] =
      [];
    if (before)
      settlementConnections.push(
        settlementRoadConnection(road, before, 'start'),
      );
    if (after)
      settlementConnections.push(settlementRoadConnection(road, after, 'end'));
    return { ...road, points, settlementConnections };
  });
}
/** Ownership boundary and hidden road endpoint are intentionally separate. */
export function settlementRoadConnection(
  road: RoadStretch,
  span: { id: string; fromXU: number; toXU: number },
  side: 'start' | 'end',
): RoadStretch['settlementConnections'][number] {
  return {
    settlementId: span.id,
    boundaryXU: side === 'start' ? span.toXU : span.fromXU,
    side,
    mode: 'terrain-hidden',
    roadEnd: roadStretchPoint(
      road,
      side === 'start' ? road.startXU : road.endXU,
    ),
  };
}
/** Kinds placed on road stretches, which run beside the track in any landscape. */
export const ROAD_STRETCH_KINDS = ['back.car'] as const;
/** Existing patrol descriptors in two lanes; no new simulation. */
export function roadStretchCars(road: RoadStretch, k: number): SceneryProp[] {
  return [-1, 1].map((direction) => {
    const crossing =
      road.kind === 'parallel-road' ? crossingSite(road.seed, k) : undefined;
    const xU = crossing ? (crossing.localXU <= 512 ? 704 : 320) : 512,
      x = k * 1024 + xU;
    const p = roadStretchPoint(road, x);
    return {
      id: `g2:chunk:${k}:prop:road:${road.kind}:candidate:${direction < 0 ? 0 : 1}`,
      kind: ROAD_STRETCH_KINDS[0],
      layer: 'back',
      xU,
      depth:
        (-railYUpU(road.seed, x) - p.yU - (direction * p.halfWidthU) / 2) / 220,
      scale: road.kind === 'highway' ? 0.65 : 0.9,
      flip: direction < 0,
      phase:
        (direction < 0 ? 1 : 0) / 2 +
        unitRandom(road.seed, 'roads-v2:car', road.id, k) * 0.1,
      motion: {
        rangeU: crossing
          ? 160
          : road.kind === 'highway' && road.endXU - road.startXU < 2048
            ? 128
            : 320,
        speedUPerSec: ROAD_ACTOR_SPEED_U_PER_SEC.car,
      },
      dependencies: [road.id],
      roadPath: road,
      laneDirection: direction < 0 ? -1 : 1,
      relations: [
        {
          reservationId: `${road.id}:reserve:village-road`,
          relation: 'vehicle-on-road',
        },
      ],
    };
  });
}
