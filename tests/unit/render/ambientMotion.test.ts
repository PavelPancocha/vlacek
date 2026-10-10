import { describe, expect, it } from 'vitest';
import {
  glintAlpha,
  motionScale,
  swayAmplitudeRad,
  swayAngle,
} from '../../../src/render/ambientMotion.ts';

describe('ambient motion of the scenery (doc 14 §4: grass, branches, water)', () => {
  it('sways meadow plants a little, trees barely, and never buildings or stones', () => {
    expect(swayAmplitudeRad('near.tall-grass')).toBeGreaterThan(0.02);
    expect(swayAmplitudeRad('near.tall-grass')).toBeLessThanOrEqual(0.06);
    expect(swayAmplitudeRad('tree.oak')).toBeGreaterThan(0);
    expect(swayAmplitudeRad('tree.oak')).toBeLessThanOrEqual(0.015);
    for (const still of [
      'back.house-a',
      'near.boulder',
      'back.station',
      'near.log',
    ])
      expect(swayAmplitudeRad(still), still).toBe(0);
  });

  it('stays within the amplitude and repeats, frozen while time stands', () => {
    const amplitude = swayAmplitudeRad('near.grass-a');
    let previous: number | undefined;
    for (let t = 0; t < 20; t += 0.37) {
      const angle = swayAngle('near.grass-a', t, 0.3);
      expect(Math.abs(angle)).toBeLessThanOrEqual(amplitude + 1e-12);
      if (previous !== undefined) expect(angle).not.toBe(previous);
      previous = angle;
    }
    expect(swayAngle('near.grass-a', 5, 0.3)).toBe(
      swayAngle('near.grass-a', 5, 0.3),
    );
  });

  it('lets water glints twinkle now and then, never fully opaque', () => {
    const samples = Array.from({ length: 400 }, (_, i) =>
      glintAlpha(i * 0.05, 0.2),
    );
    expect(Math.min(...samples)).toBe(0);
    expect(Math.max(...samples)).toBeGreaterThan(0.5);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.85);
    // Mostly dark: a glint is a short flash.
    expect(samples.filter((a) => a > 0.1).length).toBeLessThan(
      samples.length / 2,
    );
  });

  it('reduced effects calm the sway, the glints and the breathing (doc 07 §9)', () => {
    expect(motionScale('standard')).toBe(1);
    const calm = motionScale('low');
    expect(calm).toBeGreaterThan(0);
    expect(calm).toBeLessThanOrEqual(0.3);
    for (let t = 0; t < 10; t += 0.13) {
      expect(
        Math.abs(swayAngle('near.grass-a', t, 0.2, calm)),
      ).toBeLessThanOrEqual(calm * swayAmplitudeRad('near.grass-a') + 1e-12);
      expect(glintAlpha(t, 0.4, calm)).toBeLessThanOrEqual(
        calm * glintAlpha(t, 0.4) + 1e-12,
      );
    }
  });
});
