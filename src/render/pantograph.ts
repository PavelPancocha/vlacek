import { artParts, vehicleArt } from '../content/artManifest.ts';
import { PANTOGRAPH_STRETCH } from '../content/artLayers.ts';

// All three electrics share the same arms and unscaled contact head.
const pantograph = vehicleArt['electric_retro']?.pantograph;
if (!pantograph) throw new Error('Electric pantograph art missing');
export const PANTOGRAPH_WORKING_HEIGHT_U: readonly [number, number] = [
  34,
  artParts[pantograph.arms].heightU * PANTOGRAPH_STRETCH[1] +
    pantograph.headContactU,
];

/**
 * Distance along the tilted vehicle's up axis to the wire at the head.
 * `base` is in render coordinates (y down); the wire height is world y up.
 * Invalid wire geometry is reported and clamped, never stretched further.
 */
export function pantographReach(
  base: { x: number; y: number },
  angleRad: number,
  wireHeightU: (x: number) => number,
): { reachU: number; outOfRange: boolean } {
  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);
  let reach = 0;
  for (let i = 0; i < 4; i++) {
    reach = (base.y + wireHeightU(base.x - reach * sin)) / cos;
    if (!Number.isFinite(reach)) break;
  }
  const [min, max] = PANTOGRAPH_WORKING_HEIGHT_U;
  return {
    reachU: Number.isNaN(reach) ? min : Math.min(max, Math.max(min, reach)),
    outOfRange: !Number.isFinite(reach) || reach < min || reach > max,
  };
}

/** Numeric render interface; diagnostic callers use `pantographReach`. */
export function pantographReachU(
  base: { x: number; y: number },
  angleRad: number,
  wireHeightU: (x: number) => number,
): number {
  return pantographReach(base, angleRad, wireHeightU).reachU;
}
