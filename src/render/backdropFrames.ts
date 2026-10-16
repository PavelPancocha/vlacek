import { waterMountainBackdropKey } from './waterMountainBackdrop.ts';
import { backdropParts } from '../content/worldArt.ts';
import type { Biome } from '../domain/world/Biomes.ts';
import type { Season } from '../domain/world/Regions.ts';
export function backdropFrames(
  biome: Biome,
  season: Season,
  exists: (key: string) => boolean,
  subzone = '',
) {
  if (biome === 'dunes' || biome === 'mountains') {
    const far = waterMountainBackdropKey(biome, season, 'far'),
      mid = waterMountainBackdropKey(biome, season, 'mid');
    if (exists(far) && exists(mid)) return { far, mid };
  }
  const original =
    biome === 'town' &&
    exists('backdrop.town-sparse') &&
    exists('backdrop.town-dense')
      ? { far: 'backdrop.town-sparse', mid: 'backdrop.town-dense' }
      : backdropParts[biome];
  if (biome === 'coast' || biome === 'dunes') return original;
  const landscape =
    (biome === 'countryside' || biome === 'town') && subzone.includes('village')
      ? 'village'
      : biome;
  const choose = (band: 'far' | 'mid') => {
    const dense = `backdrop.forest-dense-${band}-${season}`;
    const variant = `backdrop.${landscape}-${band}-${season}`;
    return biome === 'forest' && exists(dense)
      ? dense
      : exists(variant)
        ? variant
        : exists(`${original[band]}-${season}`)
          ? `${original[band]}-${season}`
          : original[band];
  };
  return { far: choose('far'), mid: choose('mid') };
}

export function backdropWindowFrames(seed: number, xU: number): string[] {
  const t = transitionAt(seed, xU);
  const exists = (key: string) => key in worldParts;
  const a = backdropFrames(
    t.from.landscape,
    t.from.season,
    exists,
    sceneAt(seed, xU).subzone,
  );
  const b = backdropFrames(
    t.to.landscape,
    t.to.season,
    exists,
    sceneAt(seed, t.to.fromXU).subzone,
  );
  return [
    ...new Set([
      a.far,
      a.mid,
      ...(t.progress > 0 ? [b.far, b.mid] : []),
      ...cloudParts,
    ]),
  ].sort();
}
import { worldParts, cloudParts } from '../content/worldArt.ts';

import { transitionAt } from '../domain/world/Regions.ts';
import { sceneAt } from '../domain/world/WorldPlan.ts';

/** Tile spacing in u; art width still determines the drawn silhouette. */
export function backdropTileStepU(frame: string, artWidthU: number): number {
  return frame.startsWith('backdrop.forest-dense-') ? 480 : artWidthU;
}
