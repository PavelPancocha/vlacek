import { describe, expect, it } from 'vitest';
import {
  stationSite,
  chunkScenery,
  stationSlot,
  stationFlat,
} from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import {
  generateTrackProfile,
  profileGrade,
} from '../../../src/domain/world/TrackProfile.ts';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';

describe('D-024 settlements', () => {
  it('SCN-VI01/02/06: every cycle has the ordered 6144-u village with entry, green and bus/exit', () => {
    for (let seed = 0; seed < 12; seed++) {
      const ids = Array.from(
        { length: 480 },
        (_, k) => sceneAt(seed, k * 1024).templateId,
      );
      const first = ids.indexOf('settlements-village-entry');
      expect(first, `seed=${seed}`).toBeGreaterThanOrEqual(0);
      expect(ids.slice(first, first + 6)).toEqual([
        'settlements-village-entry',
        'settlements-village-entry',
        'settlements-village-green',
        'settlements-village-green',
        'settlements-village-exit',
        'settlements-village-exit',
      ]);
    }
  });
  it('SCN-TO01/02/03: each town starts/ends in suburbs, with street, park and service yard', () => {
    for (let seed = 0; seed < 12; seed++)
      for (let x = 0; x < 480 * 1024;) {
        const r = regionAt(seed, x);
        x = r.toXU;
        if (r.landscape !== 'town') continue;
        const ids = Array.from(
          { length: (r.toXU - r.fromXU) / 2048 },
          (_, i) => sceneAt(seed, r.fromXU + i * 2048).templateId,
        );
        expect(ids[0]).toBe('settlements-suburb');
        expect(ids.at(-1)).toBe('settlements-suburb');
        expect(ids).toContain('settlements-street');
        expect(ids).toContain('settlements-park');
        expect(ids).toContain('settlements-yard');
      }
  });
  it('SCN-ST01/02/03/04/07: real platforms have three sizes, flat length, one owner and one pair of ends', () => {
    const lengths = new Set<number>();
    for (let k = 0; k < 480; k++) {
      const sc = chunkScenery(1, k, worldPlacementCatalog);
      for (const f of sc.features.filter((f) => f.kind === 'station')) {
        lengths.add(f.toXU - f.fromXU);
        for (let x = f.fromXU; x <= f.toXU; x += 16)
          expect(
            profileGrade(
              generateTrackProfile(1, Math.floor(x / 1024)),
              x % 1024,
            ),
          ).toBeCloseTo(0, 10);
        if (f.toXU - f.fromXU !== 2368) continue;
        const pieces = Array.from(
          { length: Math.ceil(f.toXU / 1024) - Math.floor(f.fromXU / 1024) },
          (_, i) =>
            chunkScenery(
              1,
              Math.floor(f.fromXU / 1024) + i,
              worldPlacementCatalog,
            ),
        );
        expect(
          pieces.every((s) => s.features.some((other) => other.id === f.id)),
        ).toBe(true);
        expect(
          pieces
            .flatMap((s) => s.props)
            .filter((p) => p.kind === 'back.platform-start'),
        ).toHaveLength(1);
        expect(
          pieces
            .flatMap((s) => s.props)
            .filter((p) => p.kind === 'back.platform-end'),
        ).toHaveLength(1);
        expect(f.toXU - f.fromXU - 32).toBeGreaterThan(2000);
      }
    }
    expect([...lengths].sort((a, b) => a - b)).toEqual([480, 1216, 2368]);
    for (let seed = 0; seed < 100; seed++) {
      expect(stationSlot(seed, 0)).toBe(1);
      const flat = stationFlat(seed, 1);
      expect(flat && flat[1] - flat[0]).toBeGreaterThanOrEqual(448);
    }
  });
  it('SCN-VI03/04/05, TO04/05, ST05: bounded witnesses have access, bus bay, seasonal gardens and safe reservations', () => {
    const counts = new Map<string, number>();
    for (let k = 0; k < 480; k++) {
      const sc = chunkScenery(1, k, worldPlacementCatalog);
      if (
        !sc.locality.startsWith('settlements-') &&
        !sc.features.some((f) => f.kind === 'station')
      )
        continue;
      expect(validateChunkScenery(1, sc, worldPlacementCatalog)).toEqual([]);
      for (const p of sc.props)
        counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
      for (const p of sc.props.filter((p) =>
        /house|farmstead|chapel|warehouse|sawmill|bus$/.test(p.kind),
      ))
        expect(p.dependencies?.length, p.id).toBeGreaterThan(0);
      const houses = sc.props
        .filter((p) => p.kind.includes('house'))
        .sort((a, b) => a.xU - b.xU);
      for (let i = 1; i < houses.length; i++)
        expect(houses[i]?.kind).not.toBe(houses[i - 1]?.kind);
    }
    for (const kind of [
      'back.chapel',
      'back.bus',
      'back.bus-shelter',
      'back.playground',
      'back.row-house',
      'back.apartment-house',
      'back.panel-house',
      'back.warehouse',
      'near.garden-summer',
    ])
      expect(counts.get(kind) ?? 0, kind).toBeGreaterThan(0);
  });
});

import { admissibleKind } from '../../../src/domain/world/Placement.ts';
import { contextAt } from '../../../src/domain/world/WorldPlan.ts';
it('D-024 seasons: a garden uses only the effective season of its complete footprint', () => {
  for (const season of ['spring', 'autumn', 'winter'])
    expect(admissibleKind(`near.garden-${season}`, 1, 850)).toBe(false);
  expect(contextAt(1, 850).season).toBe('summer');
  expect(admissibleKind('near.garden-summer', 1, 850)).toBe(true);
});
it('SCN-ST04: validator rejects a station extent that includes a grade, not merely its owning chunk', () => {
  const sc = chunkScenery(1, 1, worldPlacementCatalog);
  const feature = sc.features.find((f) => f.kind === 'station');
  if (!feature) throw new Error('station mutation witness missing');
  feature.toXU = 8192;
  expect(
    validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
      e.includes('platform-grade'),
    ),
  ).toBe(true);
});

import { locateTestScene } from '../../../src/domain/world/TestScenes.ts';
it('D-024 locator: every requested scene resolves to its actual composition in a bounded scan', () => {
  // The UI uses this same locator; existing town must resolve to a street, not a village copy.
  for (const kind of [
    'village',
    'village-bus',
    'suburb',
    'town',
    'halt',
    'large-station',
    'big-station',
  ] as const) {
    const found = locateTestScene(1, kind, worldPlacementCatalog, 480);
    expect(found, kind).toBeDefined();
    if (found && kind === 'town')
      expect(sceneAt(1, found.worldXU).templateId).toBe('settlements-street');
  }
});
it('SCN-ST05: equipment and passenger envelopes leave canopy columns clear', () => {
  const props = [];
  for (let k = 0; k < 480; k++)
    if (stationSite(1, k))
      props.push(
        ...chunkScenery(1, k, worldPlacementCatalog).props.map((p) => ({
          ...p,
          worldXU: k * 1024 + p.xU,
        })),
      );
  for (const canopy of props.filter((p) => p.kind === 'back.platform-canopy'))
    for (const column of [-60, 0, 60])
      for (const p of props.filter(
        (p) =>
          p.kind.startsWith('back.passenger-') ||
          p.kind === 'back.station-bench' ||
          p.kind === 'back.dispatcher-wave',
      )) {
        expect(
          Math.abs(p.worldXU - (canopy.worldXU + column)),
          p.id,
        ).toBeGreaterThanOrEqual(p.kind === 'back.station-bench' ? 24 : 18);
      }
});

import { projectedBounds } from '../../../src/domain/world/SceneryGeometry.ts';
it('D-024: animated people reserve the full 24 × 44 u arm envelope, not only the body', () => {
  const sc = chunkScenery(1, 1, worldPlacementCatalog);
  const person = sc.props.find((p) => p.kind === 'back.passenger-a');
  expect(person).toBeDefined();
  if (!person) return;
  const part = worldPlacementCatalog[person.kind];
  if (!part) throw new Error('passenger footprint missing');
  const bounds = projectedBounds(1, 1, person, part);
  expect(bounds.rightU - bounds.leftU).toBeCloseTo(24, 10);
  expect(bounds.bottomU - bounds.topU).toBeCloseTo(44, 10);
});
it('D-024: station actor phases stay in the documented [0, 1) range', () => {
  for (let k = 0; k < 480; k++) {
    if (!stationSite(1, k)) continue;
    for (const prop of chunkScenery(1, k, worldPlacementCatalog).props) {
      expect(prop.phase, prop.id).toBeGreaterThanOrEqual(0);
      expect(prop.phase, prop.id).toBeLessThan(1);
    }
  }
});
it('SCN-ST07: a negative chunk retains its station slot, platform and flat geometry (seed 1 / -159)', () => {
  expect(stationSlot(1, -20)).toBe(1);
  const site = stationSite(1, -159);
  expect(site).toBeDefined();
  const sc = chunkScenery(1, -159, worldPlacementCatalog);
  expect(sc.features.some((f) => f.kind === 'station')).toBe(true);
  expect(validateChunkScenery(1, sc, worldPlacementCatalog)).toEqual([]);
});

import { placementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it('D-024: the numeric boundary rejects a present but invalid animation envelope', () => {
  const part = { widthU: 16, heightU: 36, pivotU: { x: 8, y: 36 } };
  // Deliberately malformed runtime metadata, unseen by the TypeScript shape.
  Object.defineProperty(part, 'motionBoundsU', { value: 0 });
  expect(() => placementCatalog({ person: part })).toThrow(
    'invalid motion envelope',
  );
});
it('SCN-TO04: the town street joins a planned crossing road without losing its houses (seed 1 / 219)', () => {
  const sc = chunkScenery(1, 219, worldPlacementCatalog);
  expect(sc.crossing).toBeDefined();
  expect(sc.roads.some((r) => r.id.includes(':street:'))).toBe(true);
  expect(
    sc.props.filter((p) => p.kind.includes('house')).length,
  ).toBeGreaterThanOrEqual(3);
  expect(validateChunkScenery(1, sc, worldPlacementCatalog)).toEqual([]);
});
import { traceChunkPlacement } from '../../../src/domain/world/PlacementTrace.ts';
it('D-024: the existing placement trace resolves an authored house without changing the scene', () => {
  const sc = chunkScenery(1, 10, worldPlacementCatalog);
  const house = sc.props.find(
    (p) => p.id.includes(':settlement:') && p.kind.includes('house'),
  );
  expect(house).toBeDefined();
  if (!house) return;
  expect(
    traceChunkPlacement(1, 10, worldPlacementCatalog, house.id).some(
      (t) => t.candidate.id === house.id && t.rejectionCode === 'accepted',
    ),
  ).toBe(true);
  expect(chunkScenery(1, 10, worldPlacementCatalog)).toEqual(sc);
});
it('SCN-ST06: each size-specific locator stands the locomotive inside the usable platform', () => {
  for (const kind of ['halt', 'large-station', 'big-station'] as const) {
    const found = locateTestScene(1, kind, worldPlacementCatalog);
    expect(found).toBeDefined();
    if (!found) continue;
    const xU = found.head.chunkIndex * 1024 + found.head.arcOffsetU;
    const site = stationSite(1, found.head.chunkIndex);
    expect(site).toBeDefined();
    if (!site) continue;
    expect(xU).toBeGreaterThanOrEqual(site.fromXU + 16);
    expect(xU).toBeLessThanOrEqual(site.toXU - 16);
  }
});
