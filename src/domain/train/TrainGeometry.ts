import type { TrackSample } from '../world/ArcLengthTable.ts';

/** The part of a vehicle definition the track geometry needs. */
export interface VehicleGeometry {
  lengthU: number;
  bogieOffsetU: number;
}

/**
 * Distances along the track measured backwards from the locomotive centre
 * (doc 03 §4): `s[i] = headS - centerOffsetsU[i]`, `frontS = headS +
 * frontOffsetU`, `tailS = headS - tailOffsetU`. Computed once per consist.
 */
export interface ConsistLayout {
  centerOffsetsU: readonly number[];
  frontOffsetU: number;
  tailOffsetU: number;
}

export function layoutConsist(
  vehicles: readonly VehicleGeometry[],
  couplerGapU: number,
): ConsistLayout {
  const first = vehicles[0];
  if (!first) throw new RangeError('A consist needs a locomotive');
  const centerOffsetsU = [0];
  for (let i = 1; i < vehicles.length; i++) {
    const previous = vehicles[i - 1] ?? first;
    const current = vehicles[i] ?? first;
    centerOffsetsU.push(
      (centerOffsetsU[i - 1] ?? 0) +
        previous.lengthU / 2 +
        couplerGapU +
        current.lengthU / 2,
    );
  }
  const last = vehicles[vehicles.length - 1] ?? first;
  return {
    centerOffsetsU,
    frontOffsetU: first.lengthU / 2,
    tailOffsetU: (centerOffsetsU[vehicles.length - 1] ?? 0) + last.lengthU / 2,
  };
}

/** World-space placement of one vehicle (x right, y up, angle in radians). */
export interface VehiclePose {
  centerX: number;
  centerY: number;
  angleRad: number;
  frontBogie: { x: number; y: number };
  rearBogie: { x: number; y: number };
}

/** Body follows the secant between its own two support points on the track. */
export function poseVehicle(
  sample: (s: number) => TrackSample,
  centerS: number,
  vehicle: VehicleGeometry,
): VehiclePose {
  const front = sample(centerS + vehicle.bogieOffsetU);
  const rear = sample(centerS - vehicle.bogieOffsetU);
  return {
    centerX: (front.x + rear.x) / 2,
    centerY: (front.y + rear.y) / 2,
    angleRad: Math.atan2(front.y - rear.y, front.x - rear.x),
    frontBogie: { x: front.x, y: front.y },
    rearBogie: { x: rear.x, y: rear.y },
  };
}
