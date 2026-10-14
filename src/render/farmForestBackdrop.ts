import type { Biome } from '../domain/world/Biomes.ts';
import type { Season } from '../domain/world/Regions.ts';
import { backdropParts } from '../content/worldArt.ts';
export function farmForestBackdropKey(
  biome: Biome,
  season: Season,
  layer: 'far' | 'mid',
): string {
  return biome === 'forest'
    ? `backdrop.forest-dense-${layer}-${season}`
    : backdropParts[biome][layer];
}
