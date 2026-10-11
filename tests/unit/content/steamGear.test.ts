import { describe, expect, it } from 'vitest';
import {
  steamGear,
  type SteamGearGeometry,
} from '../../../src/content/steamGear.ts';

/** Vehicle-local render coordinates: x forward, y down, rail at y = 0. */
const GEAR: SteamGearGeometry = {
  mainWheel: { x: 24, y: -15 },
  crankU: 7,
  connectingRodU: 40,
  /** Height of the cylinder axis (crosshead guide), y down. */
  guideY: -17,
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('steamGear (doc 14 §3: rods move with the wheels)', () => {
  it('puts the crank pin on the wheel at the wheel rotation (clockwise on screen)', () => {
    const forward = steamGear(GEAR, 0);
    expect(forward.crankPin.x).toBeCloseTo(24 + 7, 9);
    expect(forward.crankPin.y).toBeCloseTo(-15, 9);
    const quarter = steamGear(GEAR, Math.PI / 2);
    // A quarter turn clockwise (y down) moves the pin below the axle.
    expect(quarter.crankPin.x).toBeCloseTo(24, 9);
    expect(quarter.crankPin.y).toBeCloseTo(-15 + 7, 9);
  });

  it('moves the coupling rod with the pin, without rotating it', () => {
    for (const angle of [0, 1, 2.5, 4, 6]) {
      const gear = steamGear(GEAR, angle);
      expect(gear.couplingOffset.x).toBeCloseTo(7 * Math.cos(angle), 9);
      expect(gear.couplingOffset.y).toBeCloseTo(7 * Math.sin(angle), 9);
    }
  });

  it('keeps the connecting rod length and the crosshead on its guide', () => {
    for (let angle = 0; angle < 2 * Math.PI; angle += 0.3) {
      const gear = steamGear(GEAR, angle);
      expect(gear.crosshead.y).toBeCloseTo(GEAR.guideY, 9);
      expect(distance(gear.crosshead, gear.crankPin)).toBeCloseTo(40, 9);
      // The cylinder is in front of the main wheel.
      expect(gear.crosshead.x).toBeGreaterThan(gear.crankPin.x);
      expect(gear.connectingRodAngle).toBeCloseTo(
        Math.atan2(
          gear.crosshead.y - gear.crankPin.y,
          gear.crosshead.x - gear.crankPin.x,
        ),
        9,
      );
    }
  });

  it('strokes the crosshead by twice the crank radius per turn', () => {
    const xs: number[] = [];
    for (let angle = 0; angle < 2 * Math.PI; angle += 0.01)
      xs.push(steamGear(GEAR, angle).crosshead.x);
    const stroke = Math.max(...xs) - Math.min(...xs);
    expect(stroke).toBeGreaterThan(2 * 7 - 0.1);
    expect(stroke).toBeLessThan(2 * 7 + 0.5);
  });
});
