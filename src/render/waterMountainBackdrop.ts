import type { Season } from '../domain/world/Regions.ts';
export function waterMountainBackdropKey(
  biome: 'dunes' | 'mountains',
  season: Season,
  layer: 'far' | 'mid',
): string {
  if (biome === 'dunes')
    return layer === 'far' ? 'backdrop.dunes-ridge' : 'backdrop.dunes-pines';
  return `backdrop.mountains-${layer === 'far' ? 'ridges' : 'slope'}${season === 'winter' ? '-snow' : ''}`;
}
