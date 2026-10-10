import { gameConfig } from '../../config/gameConfig.ts';
import type { TrackSample } from './ArcLengthTable.ts';
import { unitRandom } from './Hash.ts';
import {
  TRACK_GENERATOR_VERSION,
  generateTrackProfile,
} from './TrackProfile.ts';
import { TrackWindow } from './TrackWindow.ts';

const world = gameConfig.world;
const {
  chunkWidthU,
  chunksPerBiomeBlock,
  secondaryTrackOffsetU,
  secondaryRailProbability,
  forcedSecondaryBiomeBlock,
} = world;

/** The visible second track takes slots 4–6 of its block (doc 04 §6). */
const FIRST_SLOT = 4;
const SLOTS = 3;
/** The first block of a route shows a bridge and a tunnel instead. */
const DEMO_BLOCK = 0;

/**
 * Drawing scale of the deeper layer the second track runs in, like back
 * props at its depth (1 − 0.35 × 64 / 220): its train is laid out and
 * drawn at this scale.
 */
export const SECONDARY_SCALE = 0.9;

/**
 * Back depth (0 at the main track … 1 at the horizon of the 220 u back
 * plane) the second track's band reaches: the track lies at 64 u; nothing
 * of the back scenery stands nearer than this along its stretch and its
 * portal hills, so the oncoming train is never wrongly covered (D-017).
 */
export const SECONDARY_CLEAR_DEPTH = 0.45;
/** The portal hills reach this far beyond each portal, u. */
export const PORTAL_HILL_U = 320;

/** The visible stretch of a second track (doc 04 §7). */
export interface SecondarySite {
  /** Stable id `g<version>:block:<b>:secondary:0`. */
  id: string;
  block: number;
  /** World x where the track comes out of its left and right portals. */
  fromX: number;
  toX: number;
}

/**
 * The second track of a biome block, if any: always in the forced block,
 * never in the first block (bridge and tunnel there), otherwise with the
 * doc 13 probability from the `secondary-rail` key. Pure: seed and block.
 */
export function secondarySite(
  seed: number,
  block: number,
): SecondarySite | undefined {
  if (block === DEMO_BLOCK && block !== forcedSecondaryBiomeBlock)
    return undefined;
  const chosen =
    block === forcedSecondaryBiomeBlock ||
    unitRandom(seed, TRACK_GENERATOR_VERSION, 'secondary-rail', block) <
      secondaryRailProbability;
  if (!chosen) return undefined;
  const first = block * chunksPerBiomeBlock + FIRST_SLOT;
  return {
    id: `g${TRACK_GENERATOR_VERSION}:block:${block}:secondary:0`,
    block,
    fromX: first * chunkWidthU,
    toX: (first + SLOTS) * chunkWidthU,
  };
}

/** The second track whose visible stretch includes chunk `chunkIndex`. */
export function secondarySiteOfChunk(
  seed: number,
  chunkIndex: number,
): SecondarySite | undefined {
  const block = Math.floor(chunkIndex / chunksPerBiomeBlock);
  const slot = chunkIndex - block * chunksPerBiomeBlock;
  if (slot < FIRST_SLOT || slot >= FIRST_SLOT + SLOTS) return undefined;
  return secondarySite(seed, block);
}

/**
 * Chunk-local x ranges of chunk `chunkIndex` where back scenery keeps
 * behind SECONDARY_CLEAR_DEPTH: a second track's visible stretch with both
 * portal hills.
 */
export function secondaryClearRanges(
  seed: number,
  chunkIndex: number,
): { fromX: number; toX: number }[] {
  const block = Math.floor(chunkIndex / chunksPerBiomeBlock);
  const site = secondarySite(seed, block);
  if (!site) return [];
  const x0 = chunkIndex * chunkWidthU;
  const fromX = Math.max(site.fromX - PORTAL_HILL_U, x0);
  const toX = Math.min(site.toX + PORTAL_HILL_U, x0 + chunkWidthU);
  return fromX < toX ? [{ fromX: fromX - x0, toX: toX - x0 }] : [];
}

/**
 * Geometry of a second track: the main track's profile `secondaryTrackOffsetU`
 * deeper (drawn that much higher), from `hiddenU` before its visible
 * stretch to `hiddenU` after it, so a train can hide whole in both portals
 * (doc 04 §7). Its own window of chunks, independent of the player's.
 */
export class SecondaryLine {
  readonly site: SecondarySite;
  readonly #track: TrackWindow;
  readonly #startS: number;
  readonly #endS: number;

  constructor(seed: number, site: SecondarySite, hiddenU: number) {
    this.site = site;
    const fromX = site.fromX - hiddenU;
    const toX = site.toX + hiddenU;
    const first = Math.floor(fromX / chunkWidthU);
    const last = Math.floor(toX / chunkWidthU);
    this.#track = new TrackWindow(
      (k) => generateTrackProfile(seed, k),
      first,
      world,
    );
    // Chunk by chunk up to the one holding the hidden right end.
    while (this.#track.lastChunkIndex < last)
      this.#track.ensureRange(0, this.#track.endS + 1);
    this.#startS = this.sAtX(fromX);
    this.#endS = this.sAtX(toX);
  }

  get startS(): number {
    return this.#startS;
  }

  get endS(): number {
    return this.#endS;
  }

  /** Arc coordinate of world x on this line. */
  sAtX(x: number): number {
    const k = Math.floor(x / chunkWidthU);
    return this.#track.sFromLocalX(k, x - k * chunkWidthU);
  }

  sample(s: number): TrackSample {
    if (!(s >= this.#startS - 1e-6 && s <= this.#endS + 1e-6))
      throw new RangeError(`No second track at s ${s}`);
    const point = this.#track.sample(s);
    return { ...point, y: point.y + secondaryTrackOffsetU };
  }
}
