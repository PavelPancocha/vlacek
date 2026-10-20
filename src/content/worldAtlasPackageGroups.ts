import { BIOMES } from '../domain/world/Biomes.ts';
import type { WorldAtlasGroup } from './worldAtlasGroups.ts';
/** Staging package scene references and variants, 2026-10-13 (D-030). */
const groups: readonly { keys: readonly string[]; group: WorldAtlasGroup }[] = [
  {
    keys: ['near.stubble'],
    group: {
      landscapes: ['countryside', 'foothills'],
      seasons: ['summer', 'autumn'],
    },
  },
  {
    keys: ['back.sled-child'],
    group: { landscapes: ['foothills'], seasons: ['winter'] },
  },
  {
    keys: ['fx.petal-pink', 'fx.petal-cream'],
    group: { landscapes: ['countryside', 'town'], seasons: ['spring'] },
  },
  {
    keys: ['wheel.farm-medium', 'back.tractor-work', 'back.baler'],
    group: { landscapes: ['countryside', 'foothills'] },
  },
  {
    keys: [
      'wheel.forest',
      'wheel.log-truck',
      'back.harvester',
      'back.forwarder',
      'back.forest-boom',
      'back.forest-stick',
      'back.harvester-gripper',
      'back.harvester-gripper-open',
      'back.work-trunk',
      'back.log-truck',
      'back.footbridge',
      'back.feeding-rack',
      'animal.woodpecker',
      'animal.owl',
    ],
    group: { landscapes: ['forest'] },
  },
  {
    keys: [
      'wheel.excavator',
      'back.cableway-tower',
      'back.cableway-cabin',
      'back.cableway-station',
      'back.quarry-wall',
      'back.excavator',
      'back.excavator-boom',
      'back.excavator-stick',
      'back.excavator-bucket',
    ],
    group: { landscapes: ['foothills'] },
  },
  {
    keys: ['back.combine', 'back.combine-header', 'near.water-trough'],
    group: { landscapes: ['countryside'] },
  },
  {
    keys: ['back.snow-blade'],
    group: { landscapes: ['countryside', 'foothills'], seasons: ['winter'] },
  },
  {
    keys: ['back.farmer-work', 'back.farmer-wave'],
    group: { landscapes: ['countryside', 'foothills', 'forest'] },
  },
  {
    keys: ['near.crop-rows-spring'],
    group: { landscapes: ['countryside'], seasons: ['spring'] },
  },
  {
    keys: ['near.crop-rows-summer'],
    group: { landscapes: ['countryside'], seasons: ['summer'] },
  },
  {
    keys: [
      'backdrop.forest-dense-far-spring',
      'backdrop.forest-dense-mid-spring',
      'near.forest-edge-spring',
    ],
    group: { landscapes: ['forest', 'foothills'], seasons: ['spring'] },
  },
  {
    keys: [
      'backdrop.forest-dense-far-summer',
      'backdrop.forest-dense-mid-summer',
      'near.forest-edge-summer',
    ],
    group: { landscapes: ['forest', 'foothills'], seasons: ['summer'] },
  },
  {
    keys: [
      'backdrop.forest-dense-far-autumn',
      'backdrop.forest-dense-mid-autumn',
      'near.forest-edge-autumn',
    ],
    group: { landscapes: ['forest', 'foothills'], seasons: ['autumn'] },
  },
  {
    keys: [
      'backdrop.forest-dense-far-winter',
      'backdrop.forest-dense-mid-winter',
      'near.forest-edge-winter',
    ],
    group: { landscapes: ['forest', 'foothills'], seasons: ['winter'] },
  },
  {
    keys: ['back.quarry-wall-snow'],
    group: { landscapes: ['foothills'], seasons: ['winter'] },
  },
  {
    keys: [
      'back.house-gable',
      'back.house-hip',
      'back.barn-timber',
      'back.farmstead',
      'back.chapel',
      'back.playground',
      'back.playground-swing',
    ],
    group: { landscapes: ['countryside', 'town'] },
  },
  {
    keys: ['near.garden-spring'],
    group: { landscapes: ['countryside', 'town'], seasons: ['spring'] },
  },
  {
    keys: ['near.garden-summer'],
    group: { landscapes: ['countryside', 'town'], seasons: ['summer'] },
  },
  {
    keys: ['near.garden-autumn'],
    group: { landscapes: ['countryside', 'town'], seasons: ['autumn'] },
  },
  {
    keys: ['near.garden-winter', 'snow.roof-128', 'snow.roof-dome'],
    group: { landscapes: ['countryside', 'town'], seasons: ['winter'] },
  },
  {
    keys: [
      'back.row-house',
      'back.apartment-house',
      'back.panel-house',
      'back.warehouse',
      'back.sawmill',
      'back.industrial-hall',
      'back.small-depot',
      'back.yard-crane',
      'back.yard-crane-arm',
      'backdrop.town-sparse',
      'backdrop.town-medium',
      'backdrop.town-dense',
      'back.station-big',
    ],
    group: { landscapes: ['town'] },
  },
  {
    keys: [
      'back.platform-start',
      'back.platform-middle',
      'back.platform-end',
      'back.station-bench',
      'back.bus-shelter',
      'back.bus',
      'back.bus-wheel',
      'back.passenger-a',
      'back.passenger-b',
      'back.dispatcher-wave',
      'back.station-medium',
      'back.platform-canopy',
      'back.platform-canopy-roof',
      'back.station-lamp',
      'back.passenger-arm-a',
      'back.passenger-arm-b',
      'back.dispatcher-arm',
      'back.station-flag-a',
      'back.station-flag-b',
      'bridge.steel-span',
      'bridge.abutment',
      'bridge.railing-long',
      'bridge.catenary-console',
      'tunnel.contact',
      'catenary.station-beam',
      'tunnel.rock-mouth',
    ],
    group: { landscapes: BIOMES },
  },
  {
    keys: [
      'near.fisherman',
      'near.fishing-rod',
      'fx.dragonfly',
      'animal.fish',
      'back.fishpond-sluice',
      'near.reed-clump',
      'back.watermill-body',
      'back.watermill-wheel',
      'life.watermill-body',
      'life.watermill-wheel',
      'fx.dragonfly-mid',
      'fx.dragonfly-fold',
      'animal.duck-swim-male',
      'animal.duck-swim-female',
      'animal.duck-swim-male-alert',
      'fx.duck-ripple-a',
      'fx.duck-ripple-b',
    ],
    group: { landscapes: ['lakes'] },
  },
  {
    keys: ['near.reed-clump-autumn'],
    group: { landscapes: ['lakes'], seasons: ['autumn'] },
  },
  {
    keys: [
      'back.coast-rock',
      'near.coast-rock',
      'back.harbour-quay',
      'fx.gull-up',
      'fx.gull-glide',
      'fx.gull-down',
    ],
    group: { landscapes: ['coast'] },
  },
  {
    keys: ['back.ferry', 'back.ferryman-arm', 'back.harbour-pier'],
    group: { landscapes: ['coast', 'lakes'] },
  },
  {
    keys: [
      'backdrop.dunes-ridge',
      'backdrop.dunes-pines',
      'near.young-pine',
      'near.heather',
      'near.heather-green',
    ],
    group: { landscapes: ['dunes'] },
  },
  {
    keys: [
      'backdrop.mountains-ridges',
      'backdrop.mountains-slope',
      'tunnel.rock-portal-front',
      'tunnel.rock-portal-mouth',
      'tunnel.rock-cover',
      'tunnel.rock-cap',
    ],
    // water-mountains@2e64ad3 declares these snow-free variants for spring to autumn.
    group: {
      landscapes: ['mountains'],
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  {
    keys: [
      'bridge.viaduct-arch',
      'bridge.viaduct-pier',
      'tunnel.rock-left',
      'tunnel.rock-right',
      'tunnel.rock-crown',
    ],
    group: { landscapes: ['mountains'] },
  },
  {
    keys: [
      'backdrop.mountains-ridges-snow',
      'backdrop.mountains-slope-snow',
      'tunnel.rock-portal-front-snow',
      'tunnel.rock-portal-mouth-snow',
      'tunnel.rock-cover-snow',
      'tunnel.rock-cap-snow',
    ],
    group: { landscapes: ['mountains'], seasons: ['winter'] },
  },
  { keys: ['back.water-footbridge'], group: { landscapes: ['lakes'] } },
  {
    keys: ['back.cutting-rock'],
    group: {
      landscapes: ['foothills', 'mountains'],
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  {
    keys: ['back.cutting-rock-snow'],
    group: { landscapes: ['foothills', 'mountains'], seasons: ['winter'] },
  },
  {
    keys: ['bridge.snow-cap'],
    group: {
      landscapes: ['mountains', 'foothills', 'lakes'],
      seasons: ['winter'],
    },
  },
  {
    keys: [
      'tree.oak-spring',
      'tree.birch-spring',
      'tree.linden-spring',
      'tree.apple-spring',
      'tree.plum-spring',
      'tree.willow-spring',
    ],
    group: {
      landscapes: ['countryside', 'forest', 'town', 'lakes', 'foothills'],
      seasons: ['spring'],
    },
  },
  {
    keys: [
      'tree.oak-autumn',
      'tree.birch-autumn',
      'tree.linden-autumn',
      'tree.apple-autumn',
      'tree.plum-autumn',
      'tree.willow-autumn',
    ],
    group: {
      landscapes: ['countryside', 'forest', 'town', 'lakes', 'foothills'],
      seasons: ['autumn'],
    },
  },
  {
    keys: [
      'tree.oak-winter',
      'tree.oak-winter-snow',
      'tree.birch-winter',
      'tree.birch-winter-snow',
      'tree.linden-winter',
      'tree.linden-winter-snow',
      'tree.apple-winter',
      'tree.apple-winter-snow',
      'tree.plum-winter',
      'tree.plum-winter-snow',
      'tree.willow-winter',
      'tree.willow-winter-snow',
    ],
    group: {
      landscapes: ['countryside', 'forest', 'town', 'lakes', 'foothills'],
      seasons: ['winter'],
    },
  },
  {
    keys: ['near.leaf-litter'],
    group: {
      landscapes: [
        'countryside',
        'forest',
        'town',
        'foothills',
        'lakes',
        'mountains',
      ],
      seasons: ['autumn'],
    },
  },
  {
    keys: ['near.snow-field'],
    group: {
      landscapes: ['countryside', 'foothills', 'forest'],
      seasons: ['winter'],
    },
  },
  {
    keys: [
      'fx.leaf-oak-amber',
      'fx.leaf-birch-gold',
      'fx.leaf-linden-orange',
      'fx.leaf-plum-red',
      'fx.leaf-willow-ochre',
    ],
    group: {
      landscapes: ['forest', 'countryside', 'town'],
      seasons: ['autumn'],
    },
  },
  {
    keys: ['fx.snow-far', 'fx.snow-mid', 'fx.snow-near', 'fx.snow-kick'],
    group: {
      landscapes: ['countryside', 'forest', 'town', 'mountains'],
      seasons: ['winter'],
    },
  },
  {
    keys: ['fx.swirl'],
    group: { landscapes: ['countryside', 'dunes', 'mountains'] },
  },
  {
    keys: ['fx.dust'],
    group: { landscapes: ['countryside', 'foothills', 'dunes'] },
  },
  {
    keys: ['fx.bird-glide'],
    group: { landscapes: ['countryside', 'town', 'forest', 'dunes'] },
  },
  {
    keys: ['fx.songbird-up', 'fx.songbird-glide', 'fx.songbird-down'],
    group: {
      landscapes: [
        'countryside',
        'forest',
        'town',
        'foothills',
        'mountains',
        'dunes',
      ],
    },
  },
  {
    keys: [
      'tunnel.rock-portal-front',
      'tunnel.rock-portal-mouth',
      'tunnel.rock-cover',
      'tunnel.rock-cap',
    ],
    group: {
      landscapes: ['mountains', 'foothills', 'coast'],
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  {
    keys: [
      'tunnel.rock-portal-front-snow',
      'tunnel.rock-portal-mouth-snow',
      'tunnel.rock-cover-snow',
      'tunnel.rock-cap-snow',
    ],
    group: {
      landscapes: ['mountains', 'foothills', 'coast'],
      seasons: ['winter'],
    },
  },
];
const hostLandscapes: Readonly<
  Record<string, readonly (typeof BIOMES)[number][]>
> = {
  // D-026 generator-owned infrastructure and the short dune mound.
  'bridge.steel-span': ['lakes'],
  'bridge.abutment': ['lakes'],
  'bridge.viaduct-arch': ['mountains', 'foothills'],
  'bridge.viaduct-pier': ['mountains', 'foothills'],
  'bridge.railing-long': ['mountains', 'foothills', 'lakes'],
  'bridge.catenary-console': ['mountains', 'foothills', 'lakes'],
  'tunnel.contact': ['mountains', 'foothills'],
  'near.flowers-b': [
    'countryside',
    'foothills',
    'forest',
    'lakes',
    'mountains',
    'town',
    'dunes',
  ],
  'wheel.farm-large': ['countryside', 'foothills', 'forest'],
  'wheel.farm-small': ['countryside', 'foothills', 'forest'],
  'back.plough': ['countryside', 'foothills'],
  'snow.roof-64': [
    'countryside',
    'town',
    'forest',
    'lakes',
    'foothills',
    'mountains',
  ],
  'tree.pine-snow': ['mountains', 'forest', 'foothills', 'dunes'],
  'tree.spruce-snow': ['mountains', 'forest', 'foothills'],
};
export const worldAtlasPackageGroups: Readonly<
  Record<string, WorldAtlasGroup>
> = {
  ...Object.fromEntries(
    groups.flatMap(({ keys, group }) =>
      keys.map((key) => [
        key,
        {
          ...group,
          ...(key.startsWith('tree.birch-')
            ? { landscapes: [...(group.landscapes ?? []), 'mountains'] }
            : {}),
        },
      ]),
    ),
  ),
  ...Object.fromEntries(
    Object.entries(hostLandscapes).map(([key, landscapes]) => [
      key,
      {
        landscapes,
        ...(key === 'snow.roof-64' || key.endsWith('-snow')
          ? { seasons: ['winter'] }
          : {}),
      },
    ]),
  ),
  ...Object.fromEntries(
    ['countryside', 'village'].flatMap((band) =>
      ['far', 'mid'].flatMap((depth) =>
        (['spring', 'autumn', 'winter'] as const).map((season) => [
          `backdrop.${band}-${depth}-${season}`,
          { landscapes: ['countryside', 'town'], seasons: [season] },
        ]),
      ),
    ),
  ),
};
