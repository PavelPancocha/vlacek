import { STATION_KINDS } from '../domain/world/Scenery.ts';
import { LOCALITIES } from '../domain/world/sceneryTemplates.ts';
import {
  animalParts,
  backdropParts,
  catenaryParts,
  cloudParts,
  crossingParts,
  effectParts,
  secondaryParts,
  roadActorParts,
  trackTileSets,
} from './worldArt.ts';

/**
 * Every world part key the game refers to: track tiles, the kinds the
 * world generator places (localities and stations), animals, backdrops,
 * clouds, effect sprites, crossings, road traffic,
 * catenary and second-track portals. `validate:assets` reports parts outside this
 * list.
 */
export function worldUsedKeys(): string[] {
  return [
    ...new Set<string>([
      ...Object.values(trackTileSets).flat(),
      ...LOCALITIES.flatMap((t) => t.rules.flatMap((rule) => rule.kinds)),
      ...STATION_KINDS,
      ...Object.values(animalParts),
      ...Object.values(backdropParts).flatMap((b) => [b.far, b.mid]),
      ...cloudParts,
      ...effectParts,
      ...Object.values(crossingParts),
      ...Object.values(catenaryParts),
      ...Object.values(secondaryParts),
      ...Object.values(roadActorParts).flatMap((p) => [p.front, p.back]),
    ]),
  ];
}
