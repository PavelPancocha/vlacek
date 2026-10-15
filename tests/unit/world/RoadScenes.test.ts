import { roadStretchesInChunk } from '../../../src/domain/world/RoadStretches.ts';
import { expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import {
  boundsHitPolygon,
  projectedBounds,
} from '../../../src/domain/world/SceneryGeometry.ts';
import { placementConflict } from '../../../src/domain/world/Placement.ts';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';

it.each([
  'back.house-a',
  'back.farmhouse',
  'back.barn',
  'back.farmstead',
  'back.row-house',
  'back.apartment-house',
  'back.panel-house',
])(
  'SCN-RD06: motorway setback checks the %s body even when its feet are clear',
  (kind) => {
    const sc = chunkScenery(1, 16, catalog),
      house = {
        kind,
        layer: 'back' as const,
        xU: 512,
        depth: 0.5,
        scale: 0.7,
        flip: false,
      };
    const part = catalog[house.kind],
      setback = sc.reservations.find((r) => r.purpose === 'highway-setback');
    if (!part || !setback) throw new Error('setback witness missing');
    expect(
      boundsHitPolygon(
        projectedBounds(1, 16, house, part, true),
        setback.polygon,
      ),
    ).toBe(false);
    expect(placementConflict(1, 16, house, catalog, [setback])).toBe(
      setback.id,
    );
  },
);

it('SCN-RD06: validator rejects a village house depending only on the highway', () => {
  const sc = chunkScenery(1, 10, catalog),
    road = chunkScenery(1, 16, catalog).roads.find((r) => r.medianHalfWidthU);
  if (!road) throw new Error('highway witness missing');
  sc.roads.push(road);
  sc.props.push({
    id: 'bad-house',
    kind: 'back.house-a',
    layer: 'back',
    xU: 512,
    depth: 0.2,
    scale: 0.7,
    flip: false,
    phase: 0,
    dependencies: [road.id],
  });
  expect(
    validateChunkScenery(1, sc, catalog).some((e) =>
      e.includes('house-access bad-house'),
    ),
  ).toBe(true);
});

it('SCN-RD06/08: the former highway witness at seed 123/x 500224 belongs to the village street', () => {
  const sc = chunkScenery(123, 488, catalog);
  expect(sc.roads.some((r) => r.medianHalfWidthU)).toBe(false);
  expect(sc.reservations.some((r) => r.id.includes(':highway'))).toBe(false);
  expect(sc.props.some((p) => p.kind.startsWith('back.house-'))).toBe(true);
  for (const house of sc.props.filter((p) => p.kind.startsWith('back.house-')))
    expect(
      house.dependencies?.some((id) =>
        sc.roads.some((r) => r.id === id && !r.medianHalfWidthU),
      ),
    ).toBe(true);
});

it('SCN-RD01/04/05: parallel road joins a crossing and shares geometry across chunks', () => {
  const a = chunkScenery(123, 2, catalog),
    b = chunkScenery(123, 3, catalog);
  const road = a.roads.find((r) => r.id.includes(':parallel-road'));
  expect(road).toBeDefined();
  expect(
    b.roads
      .find((r) => r.id === road?.id)
      ?.points.filter((p) => p.xU >= 3040 && p.xU <= 3104),
  ).toEqual(road?.points.filter((p) => p.xU >= 3040 && p.xU <= 3104));
  expect(b.crossing).toBeDefined();
  for (const sc of [a, b]) {
    const cars = sc.props.filter((p) =>
      p.dependencies?.includes(road?.id ?? ''),
    );
    expect(cars.length).toBe(2);
    expect(cars.find((p) => p.laneDirection === 1)?.depth).toBeLessThan(
      cars.find((p) => p.laneDirection === -1)?.depth ?? 0,
    );
  }
});
it('SCN-RD06: a rarer highway exists as a road in an existing landscape', () => {
  let parallel = 0,
    highway = 0;
  let witness: { seed: number; k: number } | undefined;
  for (let seed = 0; seed < 20; seed++)
    for (let k = 0; k < 96; k++) {
      const roads = roadStretchesInChunk(seed, k);
      parallel += roads.filter((r) => r.kind === 'parallel-road').length;
      const found = roads.filter((r) => r.kind === 'highway').length;
      highway += found;
      if (found) witness = { seed, k };
    }
  expect(highway).toBeGreaterThan(0);
  expect(highway).toBeLessThan(parallel);
  expect(witness).toBeDefined();
  if (witness)
    expect(
      chunkScenery(witness.seed, witness.k, catalog).roads.some((r) =>
        r.id.includes(':highway'),
      ),
    ).toBe(true);
});

it.each(Array.from({ length: 20 }, (_, seed) => seed))(
  'SCN-RD01/05: road corridor sweep and shared seams, seed %i',
  async (seed) => {
    const { roadPolygon, polygonsHit, roadPositionAt } =
      await import('../../../src/domain/world/SceneryGeometry.ts');
    const { infrastructureReservations } =
      await import('../../../src/domain/world/Reservations.ts');
    for (let k = -8; k < 480; k++)
      for (const road of roadStretchesInChunk(seed, k)) {
        const track = infrastructureReservations(
          seed,
          k,
          undefined,
          undefined,
          undefined,
        ).find((r) => r.purpose === 'track');
        expect(track).toBeDefined();
        if (track)
          expect(
            polygonsHit(roadPolygon(road), track.polygon),
            `${seed}/${k}/${road.id}`,
          ).toBe(false);
        const next = roadStretchesInChunk(seed, k + 1).find(
          (r) => r.id === road.id,
        );
        if (next)
          expect(
            roadPolygon(road).filter(
              (p) => p.xU >= (k + 1) * 1024 - 1 && p.xU <= (k + 1) * 1024 + 1,
            ),
          ).toEqual(
            roadPolygon(next).filter(
              (p) => p.xU >= (k + 1) * 1024 - 1 && p.xU <= (k + 1) * 1024 + 1,
            ),
          );
        const left = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 },
          right = { ...left };
        roadPositionAt(road, k * 1024 + 512, -1, left);
        roadPositionAt(road, k * 1024 + 512, 1, right);
        expect(right.yU - left.yU).toBeGreaterThan(0);
        expect(Math.abs(right.yU - left.yU)).toBeGreaterThan(10);
      }
  },
);

it('SCN-RD01: road cars respect the actual 380u secondary portal hill, seed 0/chunk 11', async () => {
  const { validateChunkScenery } =
    await import('../../../src/domain/world/WorldValidation.ts');
  expect(
    validateChunkScenery(0, chunkScenery(0, 11, catalog), catalog),
  ).toEqual([]);
});

it('SCN-RD01: the full road patrol includes an endpoint between the 8u samples', async () => {
  const { projectedBounds, roadPositionAt } =
    await import('../../../src/domain/world/SceneryGeometry.ts');
  const sc = chunkScenery(123, 2, catalog),
    car = sc.props.find((p) => p.roadPath);
  const part = catalog['back.car'];
  if (!car?.roadPath || !part) throw new Error('road car witness missing');
  const at = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 };
  roadPositionAt(car.roadPath, 2048 + car.xU + 90, car.laneDirection ?? 1, at);
  const end = projectedBounds(
    123,
    2,
    {
      ...car,
      xU: car.xU + 90,
      motion: { rangeU: 0 },
      rotationRad: Math.atan2(at.tangentY, at.tangentX),
    },
    part,
    true,
  );
  const whole = projectedBounds(
    123,
    2,
    { ...car, motion: { rangeU: 180 } },
    part,
    true,
  );
  expect(whole.rightU).toBeGreaterThanOrEqual(end.rightU);
});
