import { gameConfig } from '../../config/gameConfig.ts';
import { biomeAt, type Biome } from './Biomes.ts';
import { chunkObjects } from './ChunkObjects.ts';
import { hash32, unitRandom } from './Hash.ts';
import { secondarySite } from './SecondaryTrack.ts';
import { TRACK_GENERATOR_VERSION } from './TrackProfile.ts';

const { chunkWidthU } = gameConfig.world;

/** Bridge in slot 4, short tunnel in slot 6 (doc 04 §6). */
const BRIDGE_SLOT = 4;
const TUNNEL_SLOT = 6;
/** Half the stream's width where it passes under the track, u. */
export const RIVER_HALF_U = 40;
/** The stone bridge's abutments reach this far from the stream's middle. */
export const BRIDGE_HALF_U = RIVER_HALF_U + 32;
/** Scenery keeps this far from the stream's middle at the track. */
export const BRIDGE_RESERVE_U = BRIDGE_HALF_U + 24;
/** The animal keeps out of the valley around the bridge. */
const ANIMAL_CLEARANCE_U = BRIDGE_RESERVE_U + 96;
/**
 * The stream lies in a flat-bottomed valley: this deep under the bridge
 * (track bed above the near meadow), easing out over VALLEY_EASE_U.
 */
export const VALLEY_DEPTH_U = 56;
const VALLEY_FLAT_HALF_U = BRIDGE_HALF_U + 8;
const VALLEY_EASE_U = 220;
/** A short tunnel; it stays clear of the chunk's ends. */
const TUNNEL_LENGTH_U = 448;
const EDGE_U = 96;
const STEP_U = 32;
/** How often a block without a second track gets its tunnel. */
const TUNNEL_SHARE: Readonly<Record<Biome, number>> = {
  countryside: 0.3,
  forest: 0.6,
  lakes: 0.3,
  foothills: 0.9,
  mountains: 1,
  coast: 0.3,
};

/** A stone bridge over a stream across the track (doc 03 §8). */
export interface BridgeSite {
  /** Stable id `g<version>:chunk:<k>:bridge:0`. */
  id: string;
  chunkIndex: number;
  /** Chunk-local x of the stream's middle. */
  localXU: number;
}

/** A short tunnel through a hill over the track (doc 03 §8). */
export interface TunnelSite {
  /** Stable id `g<version>:chunk:<k>:tunnel:0`. */
  id: string;
  chunkIndex: number;
  /** Chunk-local x of its two portals. */
  fromX: number;
  toX: number;
}

/** Slot 4 or 6 of a block without a second track, or undefined. */
function freeSlot(seed: number, chunkIndex: number, slot: number) {
  const place = biomeAt(seed, chunkIndex);
  if (place.slot !== slot || secondarySite(seed, place.block)) return undefined;
  return place;
}

/**
 * The bridge of a chunk, if any: in slot 4 of every block without a second
 * track, the stream away from the chunk's interactive animal; the seed
 * picks among the fitting places. Pure: seed and chunk index.
 */
export function bridgeSite(
  seed: number,
  chunkIndex: number,
): BridgeSite | undefined {
  if (!freeSlot(seed, chunkIndex, BRIDGE_SLOT)) return undefined;
  const animal = chunkObjects(seed, chunkIndex)[0]?.localXU;
  const candidates: number[] = [];
  for (
    let x = EDGE_U + BRIDGE_RESERVE_U;
    x <= chunkWidthU - EDGE_U - BRIDGE_RESERVE_U;
    x += STEP_U
  )
    if (animal === undefined || Math.abs(animal - x) > ANIMAL_CLEARANCE_U)
      candidates.push(x);
  const pick =
    candidates[
      hash32(seed, TRACK_GENERATOR_VERSION, 'bridge', chunkIndex) %
        Math.max(1, candidates.length)
    ];
  if (pick === undefined) return undefined;
  return {
    id: `g${TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:bridge:0`,
    chunkIndex,
    localXU: pick,
  };
}

/**
 * The tunnel of a chunk, if any: in slot 6 of the first block, and of other
 * blocks without a second track by biome (hills more often). Pure.
 */
export function tunnelSite(
  seed: number,
  chunkIndex: number,
): TunnelSite | undefined {
  const place = freeSlot(seed, chunkIndex, TUNNEL_SLOT);
  if (!place) return undefined;
  if (
    place.block !== 0 &&
    unitRandom(seed, TRACK_GENERATOR_VERSION, 'tunnel', place.block) >=
      TUNNEL_SHARE[place.biome]
  )
    return undefined;
  const room = chunkWidthU - 2 * EDGE_U - TUNNEL_LENGTH_U;
  const steps = Math.floor(room / STEP_U);
  const fromX =
    EDGE_U +
    STEP_U *
      (hash32(seed, TRACK_GENERATOR_VERSION, 'tunnel-at', chunkIndex) %
        (steps + 1));
  return {
    id: `g${TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:tunnel:0`,
    chunkIndex,
    fromX,
    toX: fromX + TUNNEL_LENGTH_U,
  };
}

/**
 * How deep the stream's valley lowers the near meadow at world x: flat
 * under the bridge, easing out to either side (smoothstep), 0 elsewhere.
 * The track itself never changes (doc 04 §4).
 */
export function valleyDepthU(seed: number, worldX: number): number {
  const k = Math.floor(worldX / chunkWidthU);
  let depth = 0;
  for (const chunk of [k - 1, k, k + 1]) {
    const site = bridgeSite(seed, chunk);
    if (!site) continue;
    const distance = Math.abs(worldX - (chunk * chunkWidthU + site.localXU));
    if (distance <= VALLEY_FLAT_HALF_U) return VALLEY_DEPTH_U;
    const t = 1 - (distance - VALLEY_FLAT_HALF_U) / VALLEY_EASE_U;
    if (t > 0) depth = Math.max(depth, VALLEY_DEPTH_U * t * t * (3 - 2 * t));
  }
  return depth;
}
