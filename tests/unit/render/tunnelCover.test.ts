import { describe, expect, it } from 'vitest';
import {
  vehicleInCover,
  portalMasonryPoint,
  secondaryPortalCoversPoint,
  portalFootPoints,
  trainInTunnel,
} from '../../../src/render/tunnelCover.ts';

const tunnel = { fromX: 1000, toX: 1448 };

it('tells whether the train is outside, partly or wholly inside (TRN-06)', () => {
  expect(trainInTunnel({ minX: 0, maxX: 1000 }, tunnel)).toBe('outside');
  expect(trainInTunnel({ minX: 1448, maxX: 1900 }, tunnel)).toBe('outside');
  expect(trainInTunnel({ minX: 700, maxX: 1100 }, tunnel)).toBe('partly');
  expect(trainInTunnel({ minX: 1400, maxX: 1800 }, tunnel)).toBe('partly');
  expect(trainInTunnel({ minX: 1000, maxX: 1448 }, tunnel)).toBe('inside');
});

// The same coverage rule applies to the two tracks' closed intervals.
describe('tunnel-1: individual vehicles and the sloped secondary portal', () => {
  const positions = [100, 35, 0, -35, -100];
  it.each(['player', 'npc'] as const)(
    '%s vehicles at both portals',
    (track) => {
      const covers =
        track === 'player'
          ? [{ fromX: 1052, toX: 1396 }]
          : [
              { fromX: -Infinity, toX: 964 },
              { fromX: 1484, toX: Infinity },
            ];
      const expectedLeft =
        track === 'player'
          ? ['inside', 'partly', 'outside', 'outside', 'outside']
          : ['outside', 'outside', 'outside', 'partly', 'inside'];
      const expectedRight = [...expectedLeft].reverse();
      for (const [portal, expected] of [
        [1000, expectedLeft],
        [1448, expectedRight],
      ] as const)
        expect(
          positions.map((delta) =>
            vehicleInCover(
              {
                minX: portal + delta - 35,
                maxX: portal + delta + 35,
              },
              covers,
            ),
          ),
        ).toEqual(expected);
    },
  );

  it.each([false, true])(
    'fits the bottom to grade −0.07885, mirrored=%s',
    (mirrored) => {
      const railY = (x: number) => 0.07885 * x;
      const points = portalFootPoints(0, mirrored, railY);
      expect(points.length).toBeGreaterThan(10);
      // Lower edge is at least 12 u below this track, including its low side.
      for (const point of points.slice(points.length / 2))
        expect(point.y).toBeGreaterThanOrEqual(railY(point.x) + 12);
      expect(points.some((p) => Math.abs(p.x) >= 100)).toBe(true);
    },
  );
});

it('tunnel-1: points in portal masonry cannot emit, the arch remains open', () => {
  expect(portalMasonryPoint(70, -50, 74, 222, 58, 128)).toBe(true);
  expect(portalMasonryPoint(0, -200, 74, 222, 58, 128)).toBe(true);
  expect(portalMasonryPoint(0, -70, 74, 222, 58, 128)).toBe(false);
  expect(portalMasonryPoint(55, -170, 74, 222, 58, 128)).toBe(true);
  expect(portalMasonryPoint(80, -50, 74, 222, 58, 128)).toBe(false);
});

it('tunnel-1: NPC sources behind the sloped rear plane cannot escape through the arch', () => {
  const left = { x: 1000, y: 0, grade: -0.07885, mirrored: false };
  expect(secondaryPortalCoversPoint({ x: 1005, y: -94 }, left)).toBe(true);
  expect(secondaryPortalCoversPoint({ x: 1025, y: -70 }, left)).toBe(false);
  const right = { ...left, x: 2000, mirrored: true };
  expect(secondaryPortalCoversPoint({ x: 2005, y: -40 }, right)).toBe(true);
  expect(secondaryPortalCoversPoint({ x: 1975, y: -70 }, right)).toBe(false);
});
