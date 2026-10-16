import type { EffectiveClimate } from '../domain/world/Seasons.ts';
import type { Season } from '../domain/world/Regions.ts';
export const DECIDUOUS = [
  'tree.oak',
  'tree.birch',
  'tree.linden',
  'tree.apple',
  'tree.plum',
  'tree.willow',
];
export function seasonalFrame(
  kind: string,
  season: Season,
  snow: boolean,
  exists: (key: string) => boolean,
): string {
  if (season === 'summer') return kind;
  if (season === 'winter' && exists(`${kind}-snow`)) return `${kind}-snow`;
  const snowy = `${kind}-winter-snow`;
  const variant = `${kind}-${season}`;
  if (season === 'winter' && snow && exists(snowy)) return snowy;
  return exists(variant) ? variant : kind;
}
export function seasonalFrames(
  kind: string,
  climate: EffectiveClimate,
  exists: (key: string) => boolean,
) {
  return {
    from: seasonalFrame(
      kind,
      climate.from.season,
      climate.from.weather === 'snow',
      exists,
    ),
    to: seasonalFrame(
      kind,
      climate.to.season,
      climate.to.weather === 'snow',
      exists,
    ),
    progress: climate.progress,
  };
}

/** Opaque spatial mixing: one supported static variant for the prop's entire lifetime. */
export function opaqueSeasonalFrame(
  kind: string,
  climate: EffectiveClimate,
  exists: (key: string) => boolean,
  mix: number,
  tagged = false,
): string {
  if (
    !kind.startsWith('tree.') &&
    !['back.bush-a', 'back.bush-b'].includes(kind) &&
    !tagged
  )
    return kind;
  const frames = seasonalFrames(kind, climate, exists);
  return mix < frames.progress ? frames.to : frames.from;
}
