import type {
  LocomotiveDefinition,
  WagonDefinition,
  WagonGroup,
} from '../domain/types.ts';

/**
 * PLACEHOLDER look for 0.1 (M0/M1): vehicles are drawn from simple shapes in
 * these colours. Real assets and the full 10 + 32 catalog arrive in M4; a
 * release build must not ship placeholders (doc 06 §8).
 */
export interface PlaceholderLook {
  bodyColor: string;
  accentColor: string;
  silhouette:
    | 'steam'
    | 'diesel'
    | 'fantasy'
    | 'coach'
    | 'open'
    | 'box'
    | 'hopper'
    | 'container'
    | 'crane'
    | 'balloons';
}

export type CatalogLocomotive = LocomotiveDefinition & {
  placeholder?: PlaceholderLook;
};
export type CatalogWagon = WagonDefinition & { placeholder?: PlaceholderLook };

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
    placeholder: {
      bodyColor: '#2f3640',
      accentColor: '#c0392b',
      silhouette: 'steam',
    },
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
    placeholder: {
      bodyColor: '#d35400',
      accentColor: '#f1c40f',
      silhouette: 'diesel',
    },
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
    placeholder: {
      bodyColor: '#6c3483',
      accentColor: '#f4d03f',
      silhouette: 'fantasy',
    },
  },
];

function wagon(
  id: string,
  labelCs: string,
  group: WagonGroup,
  lengthU: number,
  placeholder: PlaceholderLook,
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
    placeholder,
  };
}

/** Temporary subset of doc 06 §3 covering all four groups. */
export const wagons: readonly CatalogWagon[] = [
  wagon('passenger_classic', 'Osobní vagón', 'passenger', 176, {
    bodyColor: '#27ae60',
    accentColor: '#f7f1e3',
    silhouette: 'coach',
  }),
  wagon('passenger_open', 'Otevřený výletní vagónek', 'passenger', 144, {
    bodyColor: '#e67e22',
    accentColor: '#f7f1e3',
    silhouette: 'open',
  }),
  wagon('cargo_box', 'Krytý nákladní', 'cargo', 164, {
    bodyColor: '#8e5a3c',
    accentColor: '#5d3a26',
    silhouette: 'box',
  }),
  wagon('cargo_coal', 'Uhlák', 'cargo', 152, {
    bodyColor: '#4b4b4b',
    accentColor: '#1e1e1e',
    silhouette: 'hopper',
  }),
  wagon('cargo_container', 'Kontejnerový', 'cargo', 188, {
    bodyColor: '#2471a3',
    accentColor: '#c0392b',
    silhouette: 'container',
  }),
  wagon('service_crane', 'Jeřábový vagón', 'service', 188, {
    bodyColor: '#f1c40f',
    accentColor: '#34495e',
    silhouette: 'crane',
  }),
  wagon('fun_balloons', 'Balónkový vagónek', 'fun', 164, {
    bodyColor: '#f5b7b1',
    accentColor: '#e74c3c',
    silhouette: 'balloons',
  }),
];
