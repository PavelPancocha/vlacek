import {
  ROAD_CONFLICT_U,
  ROAD_FAR_END_U,
  ROAD_NEAR_END_U,
  TRACK_CONFLICT_U,
} from '../domain/interaction/LevelCrossing.ts';
import { NEAR_DEPTH_RANGE_U, nearDepthScale } from '../domain/world/Scenery.ts';
import { NEAR_FOOT_OFFSET_U } from './groundLayout.ts';

/** Where the road meets the track: rail head and bank foot (render y). */
export interface RoadFrame {
  railY: number;
  meadowY: number;
}

/** Half road width at the track: the train's conflict zone, u. */
const ROAD_HALF_U = TRACK_CONFLICT_U;
const FAR_SPAN_U = -ROAD_FAR_END_U - ROAD_CONFLICT_U;

/**
 * Render y of a road position (domain road units, 0 at the track,
 * negative behind it). Behind the track the road climbs the back ground
 * to the horizon like the back props; across the track it spans the rail
 * head to the bank foot; in front it runs down the near meadow like the
 * near props (doc 05 §4, D-013 depths).
 */
export function roadPointY(frame: RoadFrame, roadU: number): number {
  if (roadU <= -ROAD_CONFLICT_U) return frame.railY + roadU;
  const nearTop = frame.meadowY + NEAR_FOOT_OFFSET_U;
  if (roadU < ROAD_CONFLICT_U) {
    const t = (roadU + ROAD_CONFLICT_U) / (2 * ROAD_CONFLICT_U);
    const top = frame.railY - ROAD_CONFLICT_U;
    return top + (nearTop - top) * t;
  }
  return nearTop + (roadU - ROAD_CONFLICT_U);
}

/** Half the road width at a road position: narrower far, wider near. */
export function roadHalfWidthU(roadU: number): number {
  if (roadU <= -ROAD_CONFLICT_U)
    return ROAD_HALF_U * (1 - (0.55 * (-roadU - ROAD_CONFLICT_U)) / FAR_SPAN_U);
  if (roadU < ROAD_CONFLICT_U) return ROAD_HALF_U;
  return (
    ROAD_HALF_U * nearDepthScale((roadU - ROAD_CONFLICT_U) / NEAR_DEPTH_RANGE_U)
  );
}

/** Drawing scale of a car or bike at a road position. */
export function roadScale(roadU: number): number {
  if (roadU <= -ROAD_CONFLICT_U)
    return 1 - (0.35 * (-roadU - ROAD_CONFLICT_U)) / FAR_SPAN_U;
  if (roadU < ROAD_CONFLICT_U) return 1;
  return nearDepthScale((roadU - ROAD_CONFLICT_U) / NEAR_DEPTH_RANGE_U);
}

/** Where the barriers stand: between each stop line and the track. */
export const FAR_POST_ROAD_U = -34;
export const NEAR_POST_ROAD_U = 52;
/** From the road's edge to a post's pole (the boom hinge), u. */
export const POST_SIDE_GAP_U = 4;
/** Cars and bikes are drawn a little smaller than the art (lane width). */
export const ROAD_ACTOR_SCALE = 0.85;
/** A raised boom stands nearly upright (83°). */
const BOOM_RAISED_RAD = Math.PI / 2 - 0.12;
/** Traffic fades in and out over this much road at its ends. */
const ROAD_FADE_U = 30;
/** The red lamps take turns each half second; the white blinks slower. */
const RED_PERIOD_SEC = 1;
const WHITE_PERIOD_SEC = 1.4;

/**
 * Rotation of a boom (render y down) at `barrier` 0 up … 1 down. The left
 * boom hinges on the left of its lane and points right, the right one
 * points left; both rise towards the sky.
 */
export function boomAngle(barrier: number, side: 'left' | 'right'): number {
  const raised = (1 - barrier) * BOOM_RAISED_RAD;
  return side === 'left' ? -raised : Math.PI + raised;
}

/**
 * Lane middle relative to the road's middle line: traffic towards the
 * viewer (+1) keeps to its right, which is the left of the picture.
 */
export function laneOffsetU(direction: 1 | -1, roadU: number): number {
  return (-direction * roadHalfWidthU(roadU)) / 2;
}

/** Opacity of a car or bike: faded in and out at the road's ends. */
export function roadActorAlpha(roadU: number): number {
  const fromEnd = Math.min(roadU - ROAD_FAR_END_U, ROAD_NEAR_END_U - roadU);
  return Math.max(0, Math.min(1, fromEnd / ROAD_FADE_U));
}

/** The two red lamps, lit in turn (while the crossing warns). */
export function redLampsLit(timeSec: number): readonly [boolean, boolean] {
  const phase = timeSec / RED_PERIOD_SEC - Math.floor(timeSec / RED_PERIOD_SEC);
  return phase < 0.5 ? [true, false] : [false, true];
}

/** The white lamp's slow blink (while the crossing is open). */
export function whiteLampLit(timeSec: number): boolean {
  const phase =
    timeSec / WHITE_PERIOD_SEC - Math.floor(timeSec / WHITE_PERIOD_SEC);
  return phase < 0.5;
}
