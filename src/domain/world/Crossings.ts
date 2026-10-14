import { gameConfig } from '../../config/gameConfig.ts';
import { biomeAt } from './Biomes.ts';
import { hash32 } from './Hash.ts';
import { PORTAL_HILL_U, secondarySite } from './SecondaryTrack.ts';
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
 * level rails), away from the interactive animal and from a second
 * track's portal hill; the seed picks among the fitting places. Pure: seed and chunk index only, so a crossing is
 * known long before its track is streamed in.
 */
function planCrossingSite(
  seed: number,
  chunkIndex: number,
): CrossingSite | undefined {
  const place = biomeAt(seed, chunkIndex);
  if (place.slot !== CROSSING_SLOT) return undefined;
  const profile = generateTrackProfile(seed, chunkIndex);
  // The road stays clear of a second track's left portal hill (slot 4).
  const lastX = secondarySite(seed, place.block)
    ? Math.min(
        CANDIDATE_TO_U,
        gameConfig.world.chunkWidthU - PORTAL_HILL_U - CROSSING_RESERVE_U,
      )
    : CANDIDATE_TO_U;
  const candidates: number[] = [];
  for (let x = CANDIDATE_FROM_U; x <= lastX; x += CANDIDATE_STEP_U) {
    const grade = profileGrade(profile, x);
    let straight = true;
    for (let dx = -STRAIGHT_U; dx <= STRAIGHT_U && straight; dx += GRADE_STEP_U)
      straight = Math.abs(profileGrade(profile, x + dx) - grade) < 1e-12;
    if (straight) candidates.push(x);
  }
  if (candidates.length === 0) return undefined;
  const pick = hash32(seed, 1, 'crossing', chunkIndex) % candidates.length;
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

const siteCache = new Map<string, CrossingSite | undefined>();
/** Road planning is independent of animals; bounded memoization owns no runtime state. */
export function crossingSite(
  seed: number,
  chunkIndex: number,
): CrossingSite | undefined {
  const key = `${seed}/${chunkIndex}`;
  if (siteCache.has(key)) return siteCache.get(key);
  const site = planCrossingSite(seed, chunkIndex);
  if (siteCache.size === 128) {
    const first = siteCache.keys().next().value;
    if (first !== undefined) siteCache.delete(first);
  }
  siteCache.set(key, site ? Object.freeze(site) : undefined);
  return site;
}
