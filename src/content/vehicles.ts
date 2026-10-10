import type {
  LocomotiveDefinition,
  WagonDefinition,
  WagonGroup,
} from '../domain/types.ts';

/**
 * Vehicles are drawn from their art (`artManifest.ts`, D-011). A vehicle
 * added before its art carries `placeholder: true` and is drawn as the
 * neutral marked silhouette; a release build must not ship placeholders
 * (doc 06 §8).
 */
export type CatalogLocomotive = LocomotiveDefinition & { placeholder?: true };
export type CatalogWagon = WagonDefinition & { placeholder?: true };

const assets = (id: string) => ({
  bodyAsset: `vehicle.${id}.body`,
  previewAsset: `vehicle.${id}.preview`,
});

/** Temporary subset of doc 06 §2 (stable IDs and lengths; no electric yet). */
export const locomotives: readonly CatalogLocomotive[] = [
  {
    kind: 'locomotive',
    id: 'steam_local',
    labelCs: 'Malá parní mašinka',
    power: 'steam',
    requiresCatenary: false,
    lengthU: 156,
    bogieOffsetU: 46,
    wheelRadiusU: 15,
    hornAudio: 'audio.horn.steam_local',
    effect: 'steam',
    ...assets('steam_local'),
  },
  {
    kind: 'locomotive',
    id: 'diesel_mainline',
    labelCs: 'Velká naftová lokomotiva',
    power: 'diesel',
    requiresCatenary: false,
    lengthU: 196,
    bogieOffsetU: 62,
    wheelRadiusU: 13,
    hornAudio: 'audio.horn.diesel_mainline',
    effect: 'diesel',
    ...assets('diesel_mainline'),
  },
  {
    kind: 'locomotive',
    id: 'magic_stars',
    labelCs: 'Hvězdičková mašinka',
    power: 'fantasy',
    requiresCatenary: false,
    lengthU: 164,
    bogieOffsetU: 48,
    wheelRadiusU: 15,
    hornAudio: 'audio.horn.magic_stars',
    effect: 'stars',
    ...assets('magic_stars'),
  },
];

function wagon(
  id: string,
  labelCs: string,
  group: WagonGroup,
  lengthU: number,
): CatalogWagon {
  return {
    kind: 'wagon',
    id,
    labelCs,
    group,
    lengthU,
    bogieOffsetU: Math.round(lengthU * 0.31),
    wheelRadiusU: 12,
    ...assets(id),
  };
}

/** Temporary subset of doc 06 §3 covering all four groups. */
export const wagons: readonly CatalogWagon[] = [
  wagon('passenger_classic', 'Osobní vagón', 'passenger', 176),
  wagon('passenger_open', 'Otevřený výletní vagónek', 'passenger', 144),
  wagon('cargo_box', 'Krytý nákladní', 'cargo', 164),
  wagon('cargo_coal', 'Uhlák', 'cargo', 152),
  wagon('cargo_container', 'Kontejnerový', 'cargo', 188),
  wagon('service_crane', 'Jeřábový vagón', 'service', 188),
  wagon('fun_balloons', 'Balónkový vagónek', 'fun', 164),
];
