import { describe, expect, it } from 'vitest';
import {
  OBJECT_SHAPES,
  vehicleBodyHeightU,
  vehicleShapes,
} from '../../../src/content/placeholderShapes.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';

describe('placeholder vehicle shapes', () => {
  const all = [...locomotives, ...wagons];

  it('stay inside the declared vehicle length and body height', () => {
    for (const vehicle of all) {
      const height = vehicleBodyHeightU(vehicle);
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

  it('gives every vehicle type its own silhouette, not just a colour swap', () => {
    const outlines = all.map((vehicle) =>
      JSON.stringify(vehicleShapes(vehicle).map((shape) => shape.points)),
    );
    expect(new Set(outlines).size).toBe(all.length);
  });

  it('describes the interactive placeholder object', () => {
    expect(OBJECT_SHAPES.length).toBeGreaterThan(1);
  });
});
