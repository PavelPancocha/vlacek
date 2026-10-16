import { describe, expect, it } from 'vitest';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import { settlementStreetPlan } from '../../../src/domain/world/SettlementScenery.ts';
import {
  roadStretchesInChunk,
  settlementSpanAt,
  settlementRoadConnection,
} from '../../../src/domain/world/RoadStretches.ts';
import { roadPolygon } from '../../../src/domain/world/SceneryGeometry.ts';
import { roadReservation } from '../../../src/domain/world/Reservations.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';

describe('SCN-RD06/08: combined plan retains non-zero rare highways outside authoritative settlements', () => {
  it.each(Array.from({ length: 20 }, (_, seed) => seed))(
    'seed %i, chunks 0–479',
    (seed) => {
      for (let k = 0; k < 480; k++) {
        const planned = roadStretchesInChunk(seed, k);
        const scenery = planned.length
          ? chunkScenery(seed, k, catalog)
          : undefined;
        if (scenery)
          expect(validateChunkScenery(seed, scenery, catalog)).toEqual([]);
        for (const road of planned) {
          expect(scenery?.roads.find((r) => r.id === road.id)).toEqual(road);
          expect(scenery?.reservations).toContainEqual(roadReservation(road));
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
            ) {
              const span = settlementStreetPlan(seed, chunk * 1024);
              expect(
                Boolean(span && from < span.toXU && to > span.fromXU),
                `${seed}/${k}/${road.id}`,
              ).toBe(false);
            }
          }
        }
      }
    },
  );

  it('aggregate highway presence and rarity across all 20 seeds × 480 planned chunks', () => {
    let highwayChunks = 0;
    let checkedChunks = 0;
    const highwayIds = new Set<string>();
    const regions = new Set<string>();
    for (let seed = 0; seed < 20; seed++)
      for (let k = 0; k < 480; k++) {
        const region = regionAt(seed, k * 1024);
        regions.add(`${seed}/${region.id}`);
        for (const road of roadStretchesInChunk(seed, k))
          if (road.kind === 'highway') {
            highwayChunks++;
            highwayIds.add(`${seed}/${road.id}`);
          }
        checkedChunks++;
      }
    expect(checkedChunks).toBe(9600);
    expect(highwayChunks).toBeGreaterThan(0);
    expect(highwayIds.size).toBeLessThan(regions.size / 4);
    console.log(
      `Combined road plan: ${highwayChunks}/9600 highway chunks, ${highwayIds.size}/${regions.size} regions`,
    );
  });
});

it.each(['village', 'town'] as const)(
  'SCN-RD08: %s adapter shares ownership IDs and both whole-span boundaries',
  (kind) => {
    let span: ReturnType<typeof settlementStreetPlan>;
    for (let k = 0; k < 480; k++) {
      const candidate = settlementStreetPlan(1, k * 1024);
      if (candidate?.id.endsWith(`:${kind}`)) {
        span = candidate;
        break;
      }
    }
    if (!span) throw new Error('settlement span witness missing');
    for (const x of [span.fromXU, span.toXU - 1]) {
      const owned = settlementSpanAt(1, Math.floor(x / 1024));
      expect(owned).toEqual({
        id: span.id,
        fromXU: span.fromXU,
        toXU: span.toXU,
      });
    }
    const base = roadStretchesInChunk(1, 16)[0];
    if (!base) throw new Error('highway witness missing');
    for (const side of ['start', 'end'] as const) {
      const road = {
        ...base,
        startXU: side === 'start' ? span.toXU + 96 : span.fromXU - 2048,
        endXU: side === 'start' ? span.toXU + 2048 : span.fromXU - 96,
      };
      const connection = settlementRoadConnection(road, span, side);
      expect(connection.settlementId).toBe(span.id);
      expect(connection.boundaryXU).toBe(
        side === 'start' ? span.toXU : span.fromXU,
      );
      expect(connection.mode).toBe('terrain-hidden');
      expect(connection.roadEnd.xU).toBe(
        side === 'start' ? span.toXU + 96 : span.fromXU - 96,
      );
      expect(span.endpoints.some((p) => p.xU === connection.roadEnd.xU)).toBe(
        false,
      );
    }
  },
);
