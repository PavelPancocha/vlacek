import { gameConfig } from '../../config/gameConfig.ts';
import { hash32 } from './Hash.ts';
import { TRACK_GENERATOR_VERSION } from './TrackProfile.ts';

export const BIOMES = [
  'countryside',
  'forest',
  'lakes',
  'foothills',
  'mountains',
  'coast',
] as const;
export type Biome = (typeof BIOMES)[number];

export interface BiomePlace {
  biome: Biome;
  /** Biome of the next block, for the transition slot. */
  next: Biome;
  /** Chunk position in its block, 0 … chunksPerBiomeBlock − 1. */
  slot: number;
  block: number;
}

/**
 * Route itineraries of doc 04 §5. Each starts in the countryside and ends
 * in a biome that blends into the next cycle's countryside, so no snowy
 * tunnel ever opens straight onto a beach.
 */
const ITINERARIES: readonly (readonly Biome[])[] = [
  [
    'countryside',
    'forest',
    'foothills',
    'mountains',
    'foothills',
    'lakes',
    'coast',
    'lakes',
  ],
  [
    'countryside',
    'lakes',
    'coast',
    'lakes',
    'forest',
    'foothills',
    'mountains',
    'foothills',
  ],
  [
    'countryside',
    'forest',
    'lakes',
    'coast',
    'lakes',
    'foothills',
    'mountains',
    'foothills',
  ],
];

const { chunksPerBiomeBlock, blocksPerRouteCycle } = gameConfig.world;

/** Biome of block `b`: the seed picks one itinerary per cycle. */
function blockBiome(seed: number, b: number): Biome {
  const cycle = Math.floor(b / blocksPerRouteCycle);
  const route =
    ITINERARIES[
      hash32(seed, TRACK_GENERATOR_VERSION, 'route-template', cycle) %
        ITINERARIES.length
    ];
  const biome = route?.[b - cycle * blocksPerRouteCycle];
  if (biome === undefined) throw new RangeError(`no biome for block ${b}`);
  return biome;
}

/**
 * Biome, block and slot of a chunk (doc 04 §5–6), from the seed and the
 * chunk index alone: no earlier block has to be generated, also for
 * negative indices.
 */
export function biomeAt(seed: number, chunkIndex: number): BiomePlace {
  const block = Math.floor(chunkIndex / chunksPerBiomeBlock);
  return {
    biome: blockBiome(seed, block),
    next: blockBiome(seed, block + 1),
    slot: chunkIndex - block * chunksPerBiomeBlock,
    block,
  };
}
