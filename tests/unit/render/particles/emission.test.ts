import { describe, expect, it } from 'vitest';
import {
  EmissionClock,
  emitterWorldPoint,
  passEffectAt,
} from '../../../../src/render/particles/emission.ts';

describe('EmissionClock: steady rates from uneven frames', () => {
  it('carries fractions between frames', () => {
    const clock = new EmissionClock();
    let total = 0;
    for (let i = 0; i < 10; i++) total += clock.tick(3, 0.1);
    expect(total).toBe(3);
  });

  it('emits nothing at rate 0 or while paused', () => {
    const clock = new EmissionClock();
    expect(clock.tick(0, 1)).toBe(0);
    expect(clock.tick(50, 0)).toBe(0);
  });

  it('caps the burst after a long hitch', () => {
    const clock = new EmissionClock();
    expect(clock.tick(10, 5, 8)).toBe(8);
    // The backlog is dropped, not paid out later.
    expect(clock.tick(10, 0.1, 8)).toBe(1);
  });
});

describe('emitterWorldPoint: emitters ride on the vehicle model (doc 14 §4)', () => {
  const frame = { lengthU: 160, heightU: 100 };
  const chimney = { xU: 130.5, yU: 6 };

  it('places the chimney above the body on the flat', () => {
    const point = emitterWorldPoint(chimney, frame, {
      centerX: 1000,
      centerY: 50,
      angleRad: 0,
    });
    expect(point.x).toBeCloseTo(1050.5, 9);
    // Render y points down: 94 u above the rail at height 50.
    expect(point.y).toBeCloseTo(-144, 9);
    expect(point.tiltDeg).toBeCloseTo(0, 9);
  });

  it('mirrors and scales the emitter for a train driving left in the deeper layer', () => {
    const point = emitterWorldPoint(
      chimney,
      frame,
      { centerX: 1000, centerY: 50, angleRad: 0 },
      { mirrored: true, scale: 0.9 },
    );
    // The chimney is ahead of the middle, so left of it when mirrored.
    expect(point.x).toBeCloseTo(1000 - 50.5 * 0.9, 9);
    expect(point.y).toBeCloseTo(-(50 + 94 * 0.9), 9);
  });

  it('follows the tilt of a vehicle on a climb', () => {
    const angle = 0.1;
    const point = emitterWorldPoint(chimney, frame, {
      centerX: 0,
      centerY: 0,
      angleRad: angle,
    });
    const lx = 130.5 - 80;
    const ly = -(100 - 6);
    expect(point.x).toBeCloseTo(lx * Math.cos(angle) + ly * Math.sin(angle), 9);
    expect(point.y).toBeCloseTo(
      -lx * Math.sin(angle) + ly * Math.cos(angle),
      9,
    );
    // Nose up: the chimney leans back, so its smoke leaves leaning left.
    expect(point.tiltDeg).toBeCloseTo((-angle * 180) / Math.PI, 9);
  });
});

describe('passEffectAt: leaves and snow only where they lie', () => {
  const near = [
    { style: 'meadow' as const, fromX: 0, toX: 300 },
    { style: 'forest' as const, fromX: 300, toX: 600 },
    { style: 'snow' as const, fromX: 600, toX: 900 },
    { style: 'sand' as const, fromX: 900, toX: 1024 },
  ];

  it('maps the near ground to a pass effect', () => {
    expect(passEffectAt(near, 100)).toBeUndefined();
    expect(passEffectAt(near, 400)).toBe('leaves');
    expect(passEffectAt(near, 700)).toBe('snow');
    expect(passEffectAt(near, 950)).toBeUndefined();
  });
});
