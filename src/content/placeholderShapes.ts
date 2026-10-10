import type { VehicleBase } from '../domain/types.ts';

/**
 * Marked PLACEHOLDER silhouette for a vehicle without art: a catalog
 * vehicle still marked `placeholder: true`, or any vehicle whose art failed
 * to download (PWA-10). One neutral look with hazard stripes, never shown
 * as the vehicle's design; `validate:assets -- --release` rejects catalog
 * placeholders. Shared by the Phaser renderer and the DOM previews.
 * Vehicle-local units: x from the rear coupler end (0) to the front
 * (lengthU), y up from the underframe (0) to the body height.
 */
export interface Shape {
  color: string;
  points: readonly (readonly [number, number])[];
}

type Point = readonly [number, number];

const DARK = '#2c2c2c';

function rect(
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Shape {
  return {
    color,
    points: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  };
}

function circle(
  color: string,
  cx: number,
  cy: number,
  r: number,
  sides = 12,
): Shape {
  const points: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return { color, points };
}

/** Body height of the placeholder silhouette above the underframe. */
export const PLACEHOLDER_BODY_HEIGHT_U = 56;

/** Any vehicle as drawn by the renderer and the depot. */
export type ShapedVehicle = VehicleBase & { placeholder?: true };

/** The neutral silhouette in the vehicle's length. */
export function vehicleShapes(vehicle: VehicleBase): Shape[] {
  const L = vehicle.lengthU;
  const h = PLACEHOLDER_BODY_HEIGHT_U;
  const stripes: Shape[] = [];
  for (let x = 8; x + 10 < L - 4; x += 16) {
    stripes.push({
      color: '#f4d03f',
      points: [
        [x, 10],
        [x + 6, 10],
        [x + 12, h - 6],
        [x + 6, h - 6],
      ],
    });
  }
  return [
    rect(DARK, 2, 0, L - 4, 10),
    rect('#9ea4ab', 4, 10, L - 8, h - 10),
    ...stripes,
    rect('#6b7178', 4, h - 6, L - 8, 6),
  ];
}

/** PLACEHOLDER interactive object (a sheep-like figure), x centred on 0. */
export const OBJECT_SHAPES: readonly Shape[] = [
  rect(DARK, -16, 0, 5, 12),
  rect(DARK, 10, 0, 5, 12),
  circle('#fdfefe', -10, 22, 13),
  circle('#fdfefe', 6, 24, 14),
  circle('#f4f6f6', -2, 30, 12),
  circle(DARK, 22, 30, 8),
];

/** Visual size of the object in world units (for hit areas). */
export const OBJECT_RADIUS_U = 28;
