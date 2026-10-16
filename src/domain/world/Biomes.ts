import { gameConfig } from '../../config/gameConfig.ts';
import { regionAt } from './Regions.ts';
export const BIOMES = [
  'countryside',
  'forest',
  'lakes',
  'foothills',
  'mountains',
  'coast',
  'dunes',
  'town',
] as const;
export type Biome = (typeof BIOMES)[number];
export interface BiomePlace {
  biome: Biome;
  next: Biome;
  slot: number;
  block: number;
}
/** Compatibility adapter for infrastructure slots; landscape belongs to a region. */
export function biomeAt(seed: number, chunkIndex: number): BiomePlace {
  const { chunksPerBiomeBlock, chunkWidthU } = gameConfig.world;
  const block = Math.floor(chunkIndex / chunksPerBiomeBlock);
  return {
    biome: regionAt(seed, chunkIndex * chunkWidthU).landscape,
    next: regionAt(seed, (block + 1) * chunksPerBiomeBlock * chunkWidthU)
      .landscape,
    slot: chunkIndex - block * chunksPerBiomeBlock,
    block,
  };
}
