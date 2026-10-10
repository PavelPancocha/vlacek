import type { VehicleBase } from '../domain/types.ts';
import type { PlaceholderLook } from './vehicles.ts';

/**
 * PLACEHOLDER art (M0/M1): vehicles and the interactive object described as
 * flat polygons, shared by the Phaser renderer and the DOM previews so both
 * show the same silhouettes. Vehicle-local units: x from the rear coupler end
 * (0) to the front (lengthU), y up from the underframe (0) to the body height.
 */
export interface Shape {
  color: string;
  points: readonly (readonly [number, number])[];
}

type Point = readonly [number, number];

const DARK = '#2c2c2c';
const WINDOW = '#d6eaf8';

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

function polygon(color: string, points: Point[]): Shape {
  return { color, points };
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

function star(color: string, cx: number, cy: number, r: number): Shape {
  const points: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  return { color, points };
}

const BODY_HEIGHT_U: Record<PlaceholderLook['silhouette'], number> = {
  steam: 70,
  diesel: 66,
  fantasy: 72,
  coach: 60,
  open: 56,
  box: 60,
  hopper: 50,
  container: 62,
  crane: 66,
  balloons: 72,
};

const FALLBACK: PlaceholderLook = {
  bodyColor: '#9e9e9e',
  accentColor: '#616161',
  silhouette: 'box',
};

/** Catalog vehicles carry their placeholder look while real art is missing. */
export type ShapedVehicle = VehicleBase & { placeholder?: PlaceholderLook };

function lookOf(vehicle: ShapedVehicle): PlaceholderLook {
  return vehicle.placeholder ?? FALLBACK;
}

export function vehicleBodyHeightU(vehicle: ShapedVehicle): number {
  return BODY_HEIGHT_U[lookOf(vehicle).silhouette];
}

export function vehicleShapes(vehicle: ShapedVehicle): Shape[] {
  const { bodyColor: body, accentColor: accent, silhouette } = lookOf(vehicle);
  const L = vehicle.lengthU;
  const windows = (
    y: number,
    size: number,
    from: number,
    to: number,
  ): Shape[] => {
    const count = Math.max(1, Math.floor((to - from) / (size * 1.7)));
    const step = (to - from) / count;
    return Array.from({ length: count }, (_, i) =>
      rect(WINDOW, from + i * step + (step - size) / 2, y, size, size),
    );
  };
  switch (silhouette) {
    case 'steam':
      return [
        rect(DARK, 4, 0, L - 8, 10),
        rect(body, L * 0.3, 10, L * 0.62, 34),
        rect(accent, L * 0.3, 22, L * 0.62, 4),
        rect(body, 4, 10, L * 0.3, 52),
        rect(WINDOW, L * 0.08, 40, L * 0.16, 14),
        rect(DARK, 2, 60, L * 0.34, 6),
        circle(accent, L * 0.56, 46, 7),
        rect(DARK, L * 0.8, 44, 12, 24),
      ];
    case 'diesel':
      return [
        rect(DARK, 2, 0, L - 4, 10),
        rect(body, L * 0.14, 10, L * 0.72, 38),
        rect(accent, L * 0.2, 20, L * 0.6, 6),
        rect(body, 2, 10, L * 0.14, 52),
        rect(body, L - 2 - L * 0.14, 10, L * 0.14, 52),
        rect(WINDOW, 6, 42, L * 0.14 - 8, 14),
        rect(WINDOW, L - L * 0.14 + 2, 42, L * 0.14 - 8, 14),
        rect(accent, L * 0.86, 60, L * 0.12, 6),
      ];
    case 'fantasy':
      return [
        rect(DARK, 6, 0, L - 12, 10),
        polygon(body, [
          [L * 0.32, 10],
          [L - 6, 10],
          [L - 2, 26],
          [L - 6, 42],
          [L * 0.32, 42],
        ]),
        rect(body, 6, 10, L * 0.3, 50),
        polygon(accent, [
          [2, 60],
          [L * 0.38, 60],
          [L * 0.2, 70],
        ]),
        circle(WINDOW, L * 0.17, 42, 9),
        star(accent, L * 0.78, 56, 13),
      ];
    case 'coach':
      return [
        rect(body, 2, 0, L - 4, 52),
        rect(accent, 0, 52, L, 8),
        ...windows(24, 16, 12, L - 12),
      ];
    case 'open':
      return [
        rect(body, 2, 0, L - 4, 16),
        rect(DARK, 6, 16, 6, 34),
        rect(DARK, L - 12, 16, 6, 34),
        rect(accent, 0, 48, L, 8),
        rect(accent, L * 0.25, 16, L * 0.5, 8),
      ];
    case 'box':
      return [
        rect(body, 2, 0, L - 4, 56),
        rect(accent, L * 0.38, 6, L * 0.24, 46),
        rect(accent, 2, 54, L - 4, 6),
        rect(accent, L * 0.12, 6, 4, 46),
        rect(accent, L * 0.84, 6, 4, 46),
      ];
    case 'hopper':
      return [
        polygon(body, [
          [12, 0],
          [L - 12, 0],
          [L - 2, 40],
          [2, 40],
        ]),
        polygon(accent, [
          [6, 40],
          [L * 0.3, 50],
          [L * 0.55, 46],
          [L * 0.8, 50],
          [L - 6, 40],
        ]),
      ];
    case 'container':
      return [
        rect(DARK, 2, 0, L - 4, 10),
        rect(body, 6, 10, L / 2 - 9, 50),
        rect(accent, L / 2 + 3, 10, L / 2 - 9, 50),
        rect(DARK, L / 4 - 2, 14, 4, 42),
        rect(DARK, (3 * L) / 4 - 2, 14, 4, 42),
      ];
    case 'crane':
      return [
        rect(DARK, 2, 0, L - 4, 12),
        rect(body, 10, 12, L * 0.34, 34),
        rect(WINDOW, 18, 28, L * 0.12, 12),
        polygon(accent, [
          [L * 0.34, 40],
          [L * 0.38, 46],
          [L - 8, 66],
          [L - 4, 60],
        ]),
        rect(DARK, L - 10, 30, 4, 30),
      ];
    case 'balloons':
      return [
        rect(body, 2, 0, L - 4, 18),
        rect(DARK, L * 0.3, 18, 2, 30),
        rect(DARK, L * 0.5, 18, 2, 34),
        rect(DARK, L * 0.7, 18, 2, 28),
        circle(accent, L * 0.3, 54, 10),
        circle('#f1c40f', L * 0.5, 60, 11),
        circle('#3498db', L * 0.7, 52, 10),
      ];
  }
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
