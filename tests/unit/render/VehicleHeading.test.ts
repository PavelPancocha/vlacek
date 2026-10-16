import { expect, it } from 'vitest';
import { vehicleHeading } from '../../../src/domain/interaction/VehicleHeading.ts';

it('SCN-RD02/03: world velocity wins; stops retain heading and reversal leads with the front', () => {
  const heading = { rotationRad: 0, flipX: false };
  const front = { xU: 1, yU: 0 };
  expect(vehicleHeading(front, -70, -7, heading)).toBe(heading);
  expect(heading.flipX).toBe(true);
  expect(heading.rotationRad).toBeCloseTo(Math.atan2(7, 70));
  const stopped = { ...heading };
  vehicleHeading(front, 0, 0, heading);
  expect(heading).toEqual(stopped);
  vehicleHeading(front, 70, -7, heading);
  expect(heading.flipX).toBe(false);
  expect(heading.rotationRad).toBeCloseTo(Math.atan2(-7, 70));
});
it('SCN-RD02: signed tangent fallback, vertical front/back assets and vertical velocities', () => {
  const heading = { rotationRad: 0, flipX: false };
  vehicleHeading({ xU: 1, yU: 0 }, 0, 0, heading, 1, 0.1, -70);
  expect(heading.flipX).toBe(true);
  expect(heading.rotationRad).toBeCloseTo(Math.atan2(0.1, 1));
  for (const sign of [-1, 1]) {
    vehicleHeading({ xU: 0, yU: sign }, 3 * sign, 70 * sign, heading);
    expect(heading.flipX).toBe(false);
    expect(heading.rotationRad).toBeCloseTo(-Math.atan2(3, 70));
  }
  vehicleHeading({ xU: 1, yU: 0 }, 0, -70, heading);
  expect(heading.rotationRad).toBeCloseTo(-Math.PI / 2);
});

it('SCN-RD02: every car/boat variant in both directions on slopes', async () => {
  const { roadVehicleArt } =
    await import('../../../src/content/roadVehicleArt.ts');
  const { roadActorParts } = await import('../../../src/content/worldArt.ts');
  const keys = [
    'back.car',
    'back.tractor',
    'back.rowboat',
    'back.sailboat',
    'back.fishing-boat',
    ...Object.values(roadActorParts).flatMap((views) => [
      views.front,
      views.back,
    ]),
  ];
  for (const key of keys) {
    const art = roadVehicleArt[key];
    expect(art, key).toBeDefined();
    if (!art) continue;
    for (const direction of [-1, 1])
      for (const slope of [-0.12, 0, 0.12]) {
        const horizontal = art.front.xU !== 0;
        const vx = horizontal ? direction * 70 : direction * slope * 70;
        const vy = horizontal ? direction * slope * 70 : direction * 70;
        const h = { rotationRad: 0, flipX: false };
        vehicleHeading(art.front, vx, vy, h);
        const fx = (h.flipX ? -1 : 1) * art.front.xU;
        const x =
          fx * Math.cos(h.rotationRad) - art.front.yU * Math.sin(h.rotationRad);
        const y =
          fx * Math.sin(h.rotationRad) + art.front.yU * Math.cos(h.rotationRad);
        expect(x * vx + y * vy, `${key}/${direction}/${slope}`).toBeGreaterThan(
          0,
        );
        const stopped = { ...h };
        vehicleHeading(art.front, 0, 0, h);
        expect(h).toEqual(stopped);
      }
  }
});

it.each([
  [1, 1, false],
  [1, -1, true],
  [-1, 1, true],
  [-1, -1, false],
] as const)(
  'SCN-CR03/FO06: farm art front %s, direction %s retains its prior flip %s',
  (frontX, direction, flip) => {
    const heading = vehicleHeading({ xU: frontX, yU: 0 }, direction, 0, {
      rotationRad: 0,
      flipX: false,
    });
    expect(heading.flipX).toBe(flip);
    expect(heading.rotationRad).toBeCloseTo(0);
  },
);
