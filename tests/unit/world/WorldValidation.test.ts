import { describe, expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import {
  validateChunkScenery,
  validateWorld,
} from '../../../src/domain/world/WorldValidation.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';

describe('GEN-19 world validator mutation proofs', () => {
  it('catches a full footprint on the crossing road', () => {
    const sc = chunkScenery(83, 19, worldPlacementCatalog);
    const p = sc.props[0];
    if (!p || !sc.crossing) throw new Error('empty mutation case');
    sc.props[0] = { ...p, kind: 'back.house-a', xU: sc.crossing.localXU };
    expect(
      validateChunkScenery(83, sc, worldPlacementCatalog).some((e) =>
        e.includes('collision'),
      ),
    ).toBe(true);
  });
  it('catches a missing support dependency', () => {
    const sc = chunkScenery(1, 0, worldPlacementCatalog),
      p = sc.props[0];
    if (!p) throw new Error('empty mutation case');
    sc.props[0] = { ...p, dependencies: ['absent-water'] };
    expect(
      validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
        e.includes('dependency'),
      ),
    ).toBe(true);
  });
  it('catches duplicate logical ids', () => {
    const sc = chunkScenery(1, 0, worldPlacementCatalog),
      p = sc.props[0];
    if (!p) throw new Error('empty mutation case');
    sc.props.push({ ...p });
    expect(
      validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
        e.includes('duplicate'),
      ),
    ).toBe(true);
  });
});

it('GEN-17: rejects two mill candidates in one region, also across chunks', () => {
  const a = chunkScenery(1, 0, worldPlacementCatalog),
    b = chunkScenery(1, 2, worldPlacementCatalog);
  const pa = a.props[0],
    pb = b.props[0];
  if (!pa || !pb) throw new Error('empty mutation');
  a.props[0] = { ...pa, kind: 'back.watermill' };
  b.props[0] = { ...pb, kind: 'back.watermill' };
  expect(
    validateWorld(
      [
        { seed: 1, scenery: a },
        { seed: 1, scenery: b },
      ],
      worldPlacementCatalog,
    ).some((e) => e.includes('repetition')),
  ).toBe(true);
});

import { validateOwnership } from '../../../src/domain/world/WorldValidation.ts';
it('GEN-19: catches duplicate logical children across two owning chunks', () => {
  expect(
    validateOwnership([
      { chunkIndex: 4, propIds: ['same-house'], features: [] },
      { chunkIndex: 5, propIds: ['same-house'], features: [] },
    ]).some((e) => e.includes('duplicate')),
  ).toBe(true);
});
it('GEN-19: catches conflicting long-feature owners and duplicate fragment keys', () => {
  const f = {
    id: 'fence',
    ownerId: 'scene:1',
    kind: 'fence',
    fromXU: 0,
    toXU: 2048,
    dependencies: [],
  };
  const first = { chunkIndex: 0, propIds: [], features: [f] };
  expect(
    validateOwnership([
      first,
      { chunkIndex: 1, propIds: [], features: [{ ...f, ownerId: 'scene:2' }] },
    ]).some((e) => e.includes('ownership')),
  ).toBe(true);
  expect(
    validateOwnership([first, first]).some((e) => e.includes('fragment')),
  ).toBe(true);
});

import { prominentMotifs } from '../../../src/domain/world/WorldValidation.ts';
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';
it('GEN-17: prominence includes actual water surfaces, not only pond sprites', () => {
  let sc = chunkScenery(7, 0, worldPlacementCatalog);
  for (let k = 0; k < 480; k++)
    if (sceneAt(7, k * 1024).templateId === 'lakeside') {
      sc = chunkScenery(7, k, worldPlacementCatalog);
      if (sc.water.some((w) => w.kind === 'pond')) break;
    }
  const water = sc.water.find((w) => w.kind === 'pond');
  expect(water).toBeDefined();
  if (!water) return;
  expect(
    prominentMotifs(sc).some((m) => m.id === water.id && m.kind === 'pond'),
  ).toBe(true);
});

import { catenaryPoleXs } from '../../../src/domain/world/Catenary.ts';
import { railYUpU } from '../../../src/domain/world/SceneryGeometry.ts';
it('GEN-21: rejects a catenary mast planted in water', () => {
  const sc = chunkScenery(1, 0, worldPlacementCatalog);
  const x = catenaryPoleXs(1, 0, 1024)[1] ?? 256;
  sc.water.push({
    id: 'mutation-water',
    kind: 'pond',
    fromX: x - 120,
    toX: x + 120,
    nearDepth: 0,
    farDepth: 0.3,
  });
  expect(
    validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
      e.includes('catenary-water'),
    ),
  ).toBe(true);
});
it('GEN-22: rejects a road crossing the railway without a planned crossing', () => {
  const sc = chunkScenery(1, 0, worldPlacementCatalog),
    x = 512,
    y = -railYUpU(1, x);
  sc.roads.push({
    id: 'mutation-road',
    ownerId: 'mutation',
    fromXU: x,
    toXU: x + 1,
    points: [
      { xU: x, yU: y - 100, halfWidthU: 12 },
      { xU: x, yU: y + 100, halfWidthU: 12 },
    ],
  });
  expect(
    validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
      e.includes('unplanned-road-crossing'),
    ),
  ).toBe(true);
});
it('GEN-22: a crossing owner id only permits its actual planned crossing corridor', () => {
  const sc = chunkScenery(1, 3, worldPlacementCatalog);
  if (!sc.crossing) throw new Error('missing crossing');
  const x = 3 * 1024 + sc.crossing.localXU + 200,
    y = -railYUpU(1, x);
  sc.roads.push({
    id: 'claimed-crossing-road',
    ownerId: sc.crossing.id,
    fromXU: x,
    toXU: x + 1,
    points: [
      { xU: x, yU: y - 100, halfWidthU: 12 },
      { xU: x, yU: y + 100, halfWidthU: 12 },
    ],
  });
  expect(
    validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
      e.includes('unplanned-road-crossing'),
    ),
  ).toBe(true);
});

import {
  worldMotifCoverage,
  validateTrackProfile,
} from '../../../src/domain/world/WorldValidation.ts';
it('GEN-19: positive coverage distinguishes missing motifs, and supports each dependency', () => {
  const cases = [
    -16, -15, -9, -8, 295, 296, 327, 328, 329, 335, 336, 392, 393,
  ].map((k) => ({
    seed: 0,
    scenery: chunkScenery(0, k, worldPlacementCatalog),
  }));
  const coverage = worldMotifCoverage(cases, worldPlacementCatalog);
  for (const motif of [
    'back.rowboat',
    'back.sailboat',
    'back.fishing-boat',
    'mill-channel',
    'duck-pond',
    'coastal-station',
    'coastal-neighbours',
    'pier-water',
  ])
    expect(coverage[motif], motif).toBeGreaterThan(0);
  expect(
    worldMotifCoverage([], worldPlacementCatalog)['back.fishing-boat'],
  ).toBe(0);
});
it('CNT-03: validator detects an unsafe direct mountain reversal, but permits a full 12% flat-to-slope', () => {
  const reversal = {
    vertices: [
      { xU: 0, yU: 0 },
      { xU: 1000, yU: 100 },
      { xU: 2000, yU: 0 },
    ],
    transitionU: 192,
  };
  expect(validateTrackProfile(reversal)).toContain(
    'pantograph reversal exceeds 0.098',
  );
  expect(
    validateTrackProfile({
      ...reversal,
      vertices: [
        { xU: 0, yU: 0 },
        { xU: 1000, yU: 98 },
        { xU: 2000, yU: 0 },
      ],
    }),
  ).toEqual([]);
  expect(
    validateTrackProfile({
      ...reversal,
      vertices: [
        { xU: 0, yU: 0 },
        { xU: 1000, yU: 0 },
        { xU: 2000, yU: 120 },
      ],
    }),
  ).toEqual([]);
});
