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

/**
 * The ten locomotives of doc 06 §2 in its order (stable IDs and lengths).
 * Running gear, effects and horns of the locomotives added in the catalog
 * V1 slice follow its vehicle contract, frozen before the art was drawn.
 */
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
    id: 'steam_express',
    labelCs: 'Velká parní lokomotiva',
    power: 'steam',
    requiresCatenary: false,
    lengthU: 216,
    bogieOffsetU: 78,
    wheelRadiusU: 19,
    hornAudio: 'audio.horn.steam_express',
    effect: 'steam',
    ...assets('steam_express'),
  },
  {
    kind: 'locomotive',
    id: 'diesel_shunter',
    labelCs: 'Naftový posunovač',
    power: 'diesel',
    requiresCatenary: false,
    lengthU: 148,
    bogieOffsetU: 44,
    wheelRadiusU: 13,
    hornAudio: 'audio.horn.diesel_shunter',
    effect: 'diesel',
    ...assets('diesel_shunter'),
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
    id: 'electric_retro',
    labelCs: 'Hranatá elektrická',
    power: 'electric',
    // The journey gets its catenary (doc 03 §9, D-016).
    requiresCatenary: true,
    lengthU: 188,
    bogieOffsetU: 58,
    wheelRadiusU: 13,
    hornAudio: 'audio.horn.electric_retro',
    effect: 'none',
    ...assets('electric_retro'),
  },
  {
    kind: 'locomotive',
    id: 'electric_modern',
    labelCs: 'Moderní elektrická',
    power: 'electric',
    // The journey gets its catenary (doc 03 §9, D-016).
    requiresCatenary: true,
    lengthU: 204,
    bogieOffsetU: 66,
    wheelRadiusU: 13,
    hornAudio: 'audio.horn.electric_modern',
    effect: 'none',
    ...assets('electric_modern'),
  },
  {
    kind: 'locomotive',
    id: 'electric_mountain',
    labelCs: 'Horská elektrická',
    power: 'electric',
    // The journey gets its catenary (doc 03 §9, D-016).
    requiresCatenary: true,
    lengthU: 160,
    bogieOffsetU: 48,
    wheelRadiusU: 13,
    hornAudio: 'audio.horn.electric_mountain',
    effect: 'none',
    ...assets('electric_mountain'),
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
  {
    kind: 'locomotive',
    id: 'magic_bubbles',
    labelCs: 'Bublinková mašinka',
    power: 'fantasy',
    requiresCatenary: false,
    lengthU: 164,
    bogieOffsetU: 46,
    wheelRadiusU: 13,
    hornAudio: 'audio.horn.magic_bubbles',
    effect: 'bubbles',
    ...assets('magic_bubbles'),
  },
  {
    kind: 'locomotive',
    id: 'magic_rainbow',
    labelCs: 'Duhová mašinka',
    power: 'fantasy',
    requiresCatenary: false,
    lengthU: 176,
    bogieOffsetU: 52,
    wheelRadiusU: 12,
    hornAudio: 'audio.horn.magic_rainbow',
    effect: 'rainbow',
    ...assets('magic_rainbow'),
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

/** The 32 wagon types of doc 06 §3 in its order and four groups. */
export const wagons: readonly CatalogWagon[] = [
  wagon('passenger_classic', 'Osobní vagón', 'passenger', 176),
  wagon('passenger_double', 'Patrový vagón', 'passenger', 192),
  wagon('passenger_sleeper', 'Lůžkový vagón', 'passenger', 184),
  wagon('passenger_dining', 'Jídelní vagón', 'passenger', 184),
  wagon('passenger_panorama', 'Vyhlídkový vagón', 'passenger', 192),
  wagon('passenger_open', 'Otevřený výletní vagónek', 'passenger', 144),
  wagon('cargo_box', 'Krytý nákladní', 'cargo', 164),
  wagon('cargo_logs', 'Klády', 'cargo', 176),
  wagon('cargo_coal', 'Uhlák', 'cargo', 152),
  wagon('cargo_sand', 'Písek', 'cargo', 152),
  wagon('cargo_gravel', 'Kamení', 'cargo', 152),
  wagon('cargo_container', 'Kontejnerový', 'cargo', 188),
  wagon('cargo_tank', 'Cisterna', 'cargo', 176),
  wagon('cargo_milk', 'Mléčný vagón', 'cargo', 168),
  wagon('cargo_grain', 'Obilný vagón', 'cargo', 172),
  wagon('cargo_hay', 'Sláma', 'cargo', 164),
  wagon('cargo_apples', 'Jablka', 'cargo', 156),
  wagon('cargo_cars', 'Přepravník aut', 'cargo', 204),
  wagon('cargo_tractor', 'Vagón s traktorem', 'cargo', 184),
  wagon('cargo_excavator', 'Vagón s bagrem', 'cargo', 192),
  wagon('cargo_mail', 'Poštovní vagón', 'cargo', 164),
  wagon('cargo_refrigerated', 'Chladírenský vagón', 'cargo', 176),
  wagon('service_crane', 'Jeřábový vagón', 'service', 188),
  wagon('service_tools', 'Dílenský vagón', 'service', 164),
  wagon('service_snowplow', 'Vagón s pluhem', 'service', 156),
  wagon('fun_balloons', 'Balónkový vagónek', 'fun', 164),
  wagon('fun_stars', 'Hvězdičkový vagónek', 'fun', 164),
  wagon('fun_garden', 'Zahrádkový vagónek', 'fun', 172),
  wagon('fun_aquarium', 'Akvarijní vagónek', 'fun', 176),
  wagon('fun_windmill', 'Větrníkový vagónek', 'fun', 160),
  wagon('fun_lights', 'Světýlkový vagónek', 'fun', 168),
  wagon('fun_toyblocks', 'Vagónek s kostkami', 'fun', 164),
];
