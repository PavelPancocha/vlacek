import { hash32 } from './Hash.ts';
import { RIVER_HALF_U } from './Structures.ts';
import {
  ROAD_CONFLICT_U,
  ROAD_FAR_END_U,
} from '../interaction/LevelCrossing.ts';
import { nearDepthScale, NEAR_DEPTH_RANGE_U } from './SceneryGeometry.ts';
/** Shared by drawing and the authored footbridge bank anchors. */
export function streamBendU(k: number, roadU: number): number {
  const amplitude =
    14 * Math.min(1, Math.max(0, Math.abs(roadU) - ROAD_CONFLICT_U) / 90);
  return amplitude * Math.sin(roadU / 52 + (hash32('stream', k) % 628) / 100);
}
export function streamHalfWidthU(roadU: number): number {
  if (roadU <= -ROAD_CONFLICT_U)
    return (
      RIVER_HALF_U *
      (1 -
        (0.55 * (-roadU - ROAD_CONFLICT_U)) /
          (-ROAD_FAR_END_U - ROAD_CONFLICT_U))
    );
  return roadU < ROAD_CONFLICT_U
    ? RIVER_HALF_U
    : RIVER_HALF_U *
        nearDepthScale((roadU - ROAD_CONFLICT_U) / NEAR_DEPTH_RANGE_U);
}
