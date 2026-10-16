import { expect, it } from 'vitest';
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';
import { settlementSpanAt } from '../../../src/domain/world/RoadStretches.ts';
import { settlementStreetPlan } from '../../../src/domain/world/SettlementScenery.ts';
import {
  stationSlot,
  stationFlat,
  chunkScenery,
} from '../../../src/domain/world/Scenery.ts';
import {
  roadStretchesInChunk,
  roadStretchPoint,
  settlementRoadConnection,
} from '../../../src/domain/world/RoadStretches.ts';
import { roadPolygon } from '../../../src/domain/world/SceneryGeometry.ts';
import { roadReservation } from '../../../src/domain/world/Reservations.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import { validateInfrastructureSurfaces } from '../../../src/domain/world/WorldValidation.ts';
import { railYUpU } from '../../../src/domain/world/SceneryGeometry.ts';

function settlement(seed: number, k: number) {
  return settlementSpanAt(seed, k) !== undefined;
}

it.each([
  { seed: 1, k: 10, kind: 'village' },
  { seed: 1, k: 218, kind: 'town' },
])(
  'SCN-RD08: first $kind block leaves slots 2–3 and both curves to settlements',
  ({ seed, k, kind }) => {
    expect(settlementStreetPlan(seed, k * 1024)?.id.endsWith(`:${kind}`)).toBe(
      true,
    );
    for (const chunk of [k, k + 1]) {
      expect(roadStretchesInChunk(seed, chunk)).toEqual([]);
      expect(
        chunkScenery(seed, chunk, catalog).reservations.filter(
          (r) => r.id.includes(':parallel-road') || r.id.includes(':highway'),
        ),
      ).toEqual([]);
    }
  },
);

it('SCN-RD08: geometry and complete reservations stay outside settlement spans over a seed sweep', () => {
  let roads = 0,
    stations = 0,
    villages = 0,
    towns = 0;
  for (let seed = 0; seed < 20; seed++)
    for (let k = 0; k < 480; k++) {
      const planned = roadStretchesInChunk(seed, k);
      const s = sceneAt(seed, k * 1024);
      if (s.templateId === 'settlements-village-green') villages++;
      if (s.templateId === 'settlements-street') towns++;
      if (
        stationSlot(seed, Math.floor(k / 8)) === k % 8 &&
        stationFlat(seed, k)
      )
        stations++;
      for (const road of planned) {
        roads++;
        for (const polygon of [
          roadPolygon(road),
          roadReservation(road).polygon,
          ...(road.kind === 'highway' ? [roadPolygon(road, 20)] : []),
        ]) {
          const from = Math.min(...polygon.map((p) => p.xU)),
            to = Math.max(...polygon.map((p) => p.xU));
          for (
            let chunk = Math.floor(from / 1024);
            chunk <= Math.floor(to / 1024);
            chunk++
          )
            expect(
              settlement(seed, chunk),
              `${seed}/${k}/${road.id} envelope enters chunk ${chunk}`,
            ).toBe(false);
        }
      }
    }
  for (const count of [roads, stations, villages, towns])
    expect(count).toBeGreaterThan(0);
});

it('SCN-RD08: validator catches a road reservation injected into a settlement', () => {
  const sc = chunkScenery(1, 10, catalog);
  sc.reservations.push({
    id: 'g2:block:0:parallel-road:reserve:village-road',
    ownerId: 'bad-road',
    purpose: 'village-road',
    layer: 'back',
    polygon: [
      { xU: 10400, yU: -170 },
      { xU: 10600, yU: -170 },
      { xU: 10600, yU: -130 },
      { xU: 10400, yU: -130 },
    ],
  });
  expect(
    validateInfrastructureSurfaces(1, sc).some((e) =>
      e.includes('settlement-road'),
    ),
  ).toBe(true);
});

it('SCN-RD05/08: both named connection curves disappear behind terrain outside the owned span', () => {
  const sides = new Set<string>();
  for (let seed = 0; seed < 20; seed++)
    for (let k = 0; k < 480; k++)
      for (const road of roadStretchesInChunk(seed, k))
        for (const connection of road.settlementConnections) {
          sides.add(connection.side);
          const end = roadStretchPoint(
            road,
            connection.side === 'start' ? road.startXU : road.endXU,
          );
          const span = settlementStreetPlan(
            seed,
            connection.boundaryXU + (connection.side === 'start' ? -1 : 0),
          );
          if (
            span &&
            connection.boundaryXU >= span.fromXU &&
            connection.boundaryXU <= span.toXU
          ) {
            expect(connection.settlementId).toBe(span.id);
            expect(connection.boundaryXU).toBe(
              connection.side === 'start' ? span.toXU : span.fromXU,
            );
            expect(connection.roadEnd.xU).not.toBe(connection.boundaryXU);
          }
          expect(connection.mode).toBe('terrain-hidden');
          expect(connection.roadEnd).toEqual(end);
          const first = road.points[0];
          if (!first) throw new Error('road sample missing');
          expect(end.yU + railYUpU(seed, end.xU)).toBeLessThan(
            -220 - first.halfWidthU,
          );
          expect(
            connection.side === 'start'
              ? end.xU - connection.boundaryXU
              : connection.boundaryXU - end.xU,
          ).toBe(96);
          expect(settlement(seed, Math.floor(end.xU / 1024))).toBe(false);
        }
  const span = settlementStreetPlan(1, 8192);
  const base = roadStretchesInChunk(1, 16)[0];
  if (!span || !base) throw new Error('combined plan boundary witness missing');
  for (const side of ['start', 'end'] as const) {
    const startXU = side === 'start' ? span.toXU + 96 : span.fromXU - 2048;
    const endXU = side === 'start' ? span.toXU + 2048 : span.fromXU - 96;
    const road = { ...base, startXU, endXU };
    const c = settlementRoadConnection(road, span, side);
    sides.add(c.side);
    expect(c.settlementId).toBe(span.id);
    expect(c.boundaryXU).toBe(side === 'start' ? span.toXU : span.fromXU);
    expect(Math.abs(c.boundaryXU - c.roadEnd.xU)).toBe(96);
    expect(c.roadEnd).toEqual(
      roadStretchPoint(road, side === 'start' ? startXU : endXU),
    );
    expect(c.roadEnd.yU + railYUpU(1, c.roadEnd.xU)).toBeLessThan(-248);
  }
  expect([...sides].sort()).toEqual(['end', 'start']);
});
