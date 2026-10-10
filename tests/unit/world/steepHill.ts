import { gameConfig } from '../../../src/config/gameConfig.ts';
import type { TrackProfile } from '../../../src/domain/world/TrackProfile.ts';

const { gradeRangeMax, transitionU } = gameConfig.world.profile;

/**
 * Generator v1's steepest case in every chunk: flat, a climb at the largest
 * grade, the shortest top flat, an equally steep descent, flat again, with
 * the configured transitions. Symmetric about local x = 512 and flat at both
 * chunk ends, so chunks tile with a continuous height and grade.
 */
export const steepHill: TrackProfile = {
  vertices: [
    { xU: -200, yU: 0 },
    { xU: 96, yU: 0 },
    { xU: 416, yU: gradeRangeMax * 320 },
    { xU: 608, yU: gradeRangeMax * 320 },
    { xU: 928, yU: 0 },
    { xU: 1224, yU: 0 },
  ],
  transitionU,
};
