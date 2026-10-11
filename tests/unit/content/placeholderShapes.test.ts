import { describe, expect, it } from 'vitest';
import {
  OBJECT_SHAPES,
  PLACEHOLDER_BODY_HEIGHT_U,
  vehicleShapes,
} from '../../../src/content/placeholderShapes.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';

describe('placeholder vehicle silhouette (PWA-10 fallback)', () => {
  const all = [...locomotives, ...wagons];

  it('stay inside the declared vehicle length and body height', () => {
    for (const vehicle of all) {
      const height = PLACEHOLDER_BODY_HEIGHT_U;
      for (const shape of vehicleShapes(vehicle)) {
        for (const [x, y] of shape.points) {
          expect(x, vehicle.id).toBeGreaterThanOrEqual(0);
          expect(x, vehicle.id).toBeLessThanOrEqual(vehicle.lengthU);
          expect(y, vehicle.id).toBeGreaterThanOrEqual(0);
          expect(y, vehicle.id).toBeLessThanOrEqual(height);
        }
      }
    }
  });

  it('describes the interactive placeholder object', () => {
    expect(OBJECT_SHAPES.length).toBeGreaterThan(1);
  });
});
