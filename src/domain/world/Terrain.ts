import { gameConfig } from '../../config/gameConfig.ts';
import { unitRandom } from './Hash.ts';
import { TRACK_GENERATOR_VERSION } from './TrackProfile.ts';

const { latticeU, maxEmbankmentU } = gameConfig.world.terrain;

/** Seeded height at lattice node `i`; low banks are more common. */
function embankmentNodeU(seed: number, i: number): number {
  const roll = unitRandom(seed, TRACK_GENERATOR_VERSION, 'embankment', i);
  return maxEmbankmentU * roll * roll;
}

/**
 * Height of the track bed above the near meadow, u ≥ 0 (doc 14 §6: the
 * terrain around may be more varied than the track bed). Value noise:
 * seeded node heights every `latticeU`, blended with smoothstep, so it is
 * continuous with a continuous slope, computed from world x alone and the
 * same at any chunk boundary in any generation order.
 */
export function embankmentU(seed: number, worldXU: number): number {
  const i = Math.floor(worldXU / latticeU);
  const t = worldXU / latticeU - i;
  const blend = t * t * (3 - 2 * t);
  const a = embankmentNodeU(seed, i);
  return a + (embankmentNodeU(seed, i + 1) - a) * blend;
}
