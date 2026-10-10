import type { GameConfig } from '../../config/gameConfig.ts';
import type { MotionIntent } from '../input/InputReducer.ts';

/** Kinematic constants for one journey; no forces, masses or slipping. */
export interface MotionParams {
  maxSpeedUPerSec: number;
  accelerationUPerSec2: number;
  coastDecelerationUPerSec2: number;
  brakeDecelerationUPerSec2: number;
  stopEpsilonUPerSec: number;
  uphillSpeedReduction: number;
  gradeAccelerationFactor: number;
  maxTrackGrade: number;
}

/** `speedFactor` is the parent setting: 1 or `train.slowModeSpeedFactor`. */
export function motionParams(
  config: GameConfig,
  speedFactor: number,
): MotionParams {
  const { train } = config;
  return {
    maxSpeedUPerSec: train.maxSpeedUPerSec * speedFactor,
    accelerationUPerSec2: train.accelerationUPerSec2,
    coastDecelerationUPerSec2: train.coastDecelerationUPerSec2,
    brakeDecelerationUPerSec2: train.brakeDecelerationUPerSec2,
    stopEpsilonUPerSec: train.stopEpsilonUPerSec,
    uphillSpeedReduction: train.uphillSpeedReduction,
    gradeAccelerationFactor: train.gradeAccelerationFactor,
    maxTrackGrade: config.world.maxTrackGrade,
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function moveTowards(value: number, target: number, maxDelta: number): number {
  return value < target
    ? Math.min(target, value + maxDelta)
    : Math.max(target, value - maxDelta);
}

/**
 * One fixed simulation step (doc 03 §2). `grade` is dy/dx of the track under
 * the locomotive. Speed stays within [0, max]; the travelled distance along
 * the track uses trapezoidal integration and is never negative.
 */
export function stepMotion(
  speedUPerSec: number,
  intent: MotionIntent,
  grade: number,
  params: MotionParams,
  dtSec: number,
): { speedUPerSec: number; distanceU: number } {
  const g = clamp(grade / params.maxTrackGrade, -1, 1);
  let next: number;
  if (intent === 'THROTTLE') {
    const target =
      params.maxSpeedUPerSec *
      (1 - params.uphillSpeedReduction * Math.max(g, 0));
    const acceleration =
      params.accelerationUPerSec2 * (1 - params.gradeAccelerationFactor * g);
    next =
      speedUPerSec < target
        ? moveTowards(speedUPerSec, target, acceleration * dtSec)
        : moveTowards(
            speedUPerSec,
            target,
            params.coastDecelerationUPerSec2 * dtSec,
          );
  } else {
    const deceleration =
      intent === 'BRAKE'
        ? params.brakeDecelerationUPerSec2
        : params.coastDecelerationUPerSec2;
    next = moveTowards(speedUPerSec, 0, deceleration * dtSec);
  }
  next = clamp(next, 0, params.maxSpeedUPerSec);
  if (next < params.stopEpsilonUPerSec) next = 0;
  return {
    speedUPerSec: next,
    distanceU: Math.max(0, ((speedUPerSec + next) / 2) * dtSec),
  };
}
