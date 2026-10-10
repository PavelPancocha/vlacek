import { describe, expect, it } from 'vitest';
import { animalParts, worldParts } from '../../../src/content/worldArt.ts';
import {
  ANIMAL_HOP_U,
  ANIMAL_SCALE,
  NEAR_DEPTH_RANGE_U,
  NEAR_PROP_MAX_HEIGHT_U,
  nearDepthScale,
} from '../../../src/domain/world/Scenery.ts';
import { placeAnimal } from '../../../src/render/animalPlacement.ts';

/** How far the drawn animal (with hop) reaches above the cap; ≤ 0 is fine. */
const overCap = (heightU: number, depth: number, fit: number) =>
  fit * (heightU * ANIMAL_SCALE * nearDepthScale(depth) + ANIMAL_HOP_U) -
  (NEAR_PROP_MAX_HEIGHT_U + depth * NEAR_DEPTH_RANGE_U);

const heights = Object.values(animalParts).map(
  (key) => worldParts[key].heightU,
);

describe('placeAnimal: near meadow, below the train, above the controls (doc 02, doc 05 §2)', () => {
  it('keeps the generated depth and full size when there is room', () => {
    expect(placeAnimal(0.4, 30, 0.9)).toEqual({ depth: 0.4, fit: 1 });
  });

  it('raises a deep animal into the band free of the corner controls', () => {
    expect(placeAnimal(0.55, 30, 0.35)).toEqual({ depth: 0.35, fit: 1 });
  });

  it('shrinks an animal that does not fit between the train and the controls', () => {
    for (const height of heights) {
      for (const free of [0.02, 0.06, 0.12, 0.2]) {
        const placed = placeAnimal(0.5, height, free);
        if (!placed) throw new Error('no room for the animal');
        expect(placed.depth).toBeCloseTo(free, 9);
        expect(placed.fit).toBeGreaterThan(0);
        expect(placed.fit).toBeLessThanOrEqual(1);
        expect(overCap(height, placed.depth, placed.fit)).toBeLessThanOrEqual(
          1e-9,
        );
      }
    }
  });

  it('never draws a generated animal over the train at full size', () => {
    for (const height of heights)
      for (const depth of [0.26, 0.4, 0.6]) {
        const placed = placeAnimal(depth, height, 1);
        if (!placed) throw new Error('no room for the animal');
        expect(overCap(height, placed.depth, placed.fit)).toBeLessThanOrEqual(
          1e-9,
        );
      }
  });

  it('leaves the animal out when the controls reach above the meadow foot (568×320)', () => {
    // No band is free of the brake and the horn: even depth 0 would put
    // the foot among the controls, and shrinking cannot lift it.
    expect(placeAnimal(0.4, 40, -0.05)).toBeUndefined();
    expect(placeAnimal(0.4, 40, 0)).toEqual(
      expect.objectContaining({ depth: 0 }),
    );
  });
});
