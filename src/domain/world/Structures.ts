import type { Season } from './Regions.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import { biomeAt, type Biome } from './Biomes.ts';
import { chunkObjects } from './ChunkObjects.ts';
import { hash32, unitRandom } from './Hash.ts';
import { secondarySite } from './SecondaryTrack.ts';
import {
  longTunnelRange,
  largeBridgeRange,
} from './scenes/tunnels-bridges.scenes.ts';
import { TRACK_GENERATOR_VERSION } from './TrackProfile.ts';

const { chunkWidthU } = gameConfig.world;

/** Logical bridge owner in slot 4, tunnel owner in slot 6 (D-026). */
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
export const LARGE_VALLEY_DEPTH_U = 180;
const VALLEY_FLAT_HALF_U = BRIDGE_HALF_U + 8;
export const VALLEY_EASE_U = 220;
/** A short tunnel; it stays clear of the chunk's ends. */
const TUNNEL_LENGTH_U = 448;
export const EDGE_U = 96;
const STEP_U = 32;
/** How often a block without a second track gets its tunnel. */
const TUNNEL_SHARE: Readonly<Record<Biome, number>> = {
  countryside: 0.3,
  forest: 0.6,
  lakes: 0.3,
  foothills: 0.9,
  mountains: 1,
  coast: 0.3,
  dunes: 0.3,
  town: 0.3,
};

/** A stone bridge over a stream across the track (doc 03 §8). */
export interface BridgeSite {
  /** Stable id `g<version>:chunk:<k>:bridge:0`. */
  id: string;
  chunkIndex: number;
  /** Chunk-local x of the stream's middle. */
  localXU: number;
  variant?: 'stone' | 'steel' | 'viaduct';
  fromX?: number;
  toX?: number;
}

/** One tunnel through a hill; every queried chunk carries its full extent (D-026). */
export interface TunnelSite {
  /** Stable id `g<version>:chunk:<owner-slot-6>:tunnel:0`. */
  id: string;
  chunkIndex: number;
  /** Full portal positions relative to chunkIndex; may extend outside this chunk. */
  fromX: number;
  toX: number;
  rock?: boolean;
  season?: Season;
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
  const large = largeBridgeRange(seed, chunkIndex, animal);
  if (large)
    return {
      id: `g${TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:bridge:0`,
      chunkIndex,
      localXU:
        (large.fromX + large.toX) / 2 + (large.variant === 'viaduct' ? 80 : 0),
      ...large,
    };
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
      hash32(seed, 1, 'bridge', chunkIndex) % Math.max(1, candidates.length)
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
  // Query any fragment directly; no reference to the entrance ChunkView is needed.
  const block = Math.floor(chunkIndex / 8);
  for (const b of [block - 1, block]) {
    const owner = b * 8 + TUNNEL_SLOT;
    if (!freeSlot(seed, owner, TUNNEL_SLOT)) continue;
    const range = longTunnelRange(seed, owner);
    if (!range) continue;
    const from = owner * chunkWidthU + range.fromX;
    const to = owner * chunkWidthU + range.toX;
    if (
      (chunkIndex + 1) * chunkWidthU > from - 170 &&
      chunkIndex * chunkWidthU < to + 170
    )
      return {
        id: `g${TRACK_GENERATOR_VERSION}:chunk:${owner}:tunnel:0`,
        chunkIndex,
        fromX: from - chunkIndex * chunkWidthU,
        toX: to - chunkIndex * chunkWidthU,
        rock: true,
        season: range.season,
      };
  }
  const place = freeSlot(seed, chunkIndex, TUNNEL_SLOT);
  if (!place) return undefined;
  if (
    place.block !== 0 &&
    unitRandom(seed, 1, 'tunnel', place.block) >= TUNNEL_SHARE[place.biome]
  )
    return undefined;
  const room = chunkWidthU - 2 * EDGE_U - TUNNEL_LENGTH_U;
  const steps = Math.floor(room / STEP_U);
  const fromX =
    EDGE_U + STEP_U * (hash32(seed, 1, 'tunnel-at', chunkIndex) % (steps + 1));
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
    const center =
      site.fromX !== undefined && site.toX !== undefined
        ? (site.fromX + site.toX) / 2
        : site.localXU;
    const distance = Math.abs(worldX - (chunk * chunkWidthU + center));
    const half =
      site.fromX === undefined || site.toX === undefined
        ? VALLEY_FLAT_HALF_U
        : (site.toX - site.fromX) / 2 + 8;
    const low =
      site.variant === 'viaduct'
        ? LARGE_VALLEY_DEPTH_U
        : site.variant === 'steel'
          ? 110
          : VALLEY_DEPTH_U;
    if (distance <= half) return low;
    const t = 1 - (distance - half) / VALLEY_EASE_U;
    if (t > 0) depth = Math.max(depth, low * t * t * (3 - 2 * t));
  }
  return depth;
}
