import { gameConfig } from '../../config/gameConfig.ts';
import { biomeAt } from './Biomes.ts';
import { chunkObjects } from './ChunkObjects.ts';
import { hash32 } from './Hash.ts';
import {
  TRACK_GENERATOR_VERSION,
  generateTrackProfile,
  profileGrade,
} from './TrackProfile.ts';

/** Scenery keeps this far (u, along x) from a crossing's road. */
export const CROSSING_RESERVE_U = 64;
/** The track stays straight this far on both sides of the road. */
const STRAIGHT_U = 96;
/** The road keeps this far from the chunk's interactive animal. */
const ANIMAL_CLEARANCE_U = 120;
/** Crossing slot of a biome block (doc 04 §6). */
const CROSSING_SLOT = 3;
const CANDIDATE_FROM_U = 160;
const CANDIDATE_TO_U = 864;
const CANDIDATE_STEP_U = 32;
const GRADE_STEP_U = 16;

/** A level crossing: a road across the player's track (doc 05 §4). */
export interface CrossingSite {
  /** Stable id `g<version>:chunk:<k>:crossing:0` (doc 04 §3). */
  id: string;
  chunkIndex: number;
  /** Chunk-local x of the road's middle. */
  localXU: number;
}

/**
 * The crossing of a chunk, if any: only in slot 3 of a biome block, on a
 * straight piece of track (constant grade over ± 96 u, so the road meets
 * level rails), away from the interactive animal; the seed picks among
 * the fitting places. Pure: seed and chunk index only, so a crossing is
 * known long before its track is streamed in.
 */
export function crossingSite(
  seed: number,
  chunkIndex: number,
): CrossingSite | undefined {
  if (biomeAt(seed, chunkIndex).slot !== CROSSING_SLOT) return undefined;
  const profile = generateTrackProfile(seed, chunkIndex);
  const animal = chunkObjects(seed, chunkIndex)[0]?.localXU;
  const candidates: number[] = [];
  for (let x = CANDIDATE_FROM_U; x <= CANDIDATE_TO_U; x += CANDIDATE_STEP_U) {
    if (animal !== undefined && Math.abs(animal - x) < ANIMAL_CLEARANCE_U)
      continue;
    const grade = profileGrade(profile, x);
    let straight = true;
    for (let dx = -STRAIGHT_U; dx <= STRAIGHT_U && straight; dx += GRADE_STEP_U)
      straight = Math.abs(profileGrade(profile, x + dx) - grade) < 1e-12;
    if (straight) candidates.push(x);
  }
  if (candidates.length === 0) return undefined;
  const pick =
    hash32(seed, TRACK_GENERATOR_VERSION, 'crossing', chunkIndex) %
    candidates.length;
  const localXU = candidates[pick];
  if (localXU === undefined) return undefined;
  return {
    id: `g${TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:crossing:0`,
    chunkIndex,
    localXU,
  };
}

/** World x of a crossing's road. */
export function crossingWorldX(site: CrossingSite): number {
  return site.chunkIndex * gameConfig.world.chunkWidthU + site.localXU;
}
