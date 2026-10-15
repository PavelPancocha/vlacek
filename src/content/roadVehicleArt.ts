import type { PointU } from '../domain/world/SceneryGeometry.ts';

/** Asset-local front/bow vectors, x right/y down, before any render transform. */
export interface RoadVehicleArt {
  front: PointU;
  wheels?: readonly { xU: number; yU: number; radiusU: number }[];
  exhaust?: PointU;
}
const sideCar: RoadVehicleArt = {
  front: { xU: 1, yU: 0 },
  wheels: [
    { xU: 15, yU: 22, radiusU: 2 },
    { xU: 46, yU: 22, radiusU: 2 },
  ],
  exhaust: { xU: 3, yU: 22 },
};
const frontCar: RoadVehicleArt = {
  front: { xU: 0, yU: 1 },
  wheels: [
    { xU: 7.5, yU: 22, radiusU: 1.5 },
    { xU: 26.5, yU: 22, radiusU: 1.5 },
  ],
  exhaust: { xU: 28, yU: 23 },
};
const backCar: RoadVehicleArt = {
  ...frontCar,
  front: { xU: 0, yU: -1 },
  exhaust: { xU: 28, yU: 23 },
};
/** The bow of the existing symmetric hulls is explicitly the SVG +x end. */
export const roadVehicleArt: Readonly<
  Record<string, RoadVehicleArt | undefined>
> = {
  'back.car': sideCar,
  'back.tractor': { front: { xU: 1, yU: 0 } },
  'back.rowboat': { front: { xU: 1, yU: 0 } },
  'back.sailboat': { front: { xU: 1, yU: 0 } },
  'back.fishing-boat': { front: { xU: 1, yU: 0 } },
  'road.car-a-front': frontCar,
  'road.car-b-front': frontCar,
  'road.car-a-back': backCar,
  'road.car-b-back': backCar,
  'road.bike-front': { front: { xU: 0, yU: 1 } },
  'road.bike-back': { front: { xU: 0, yU: -1 } },
};
