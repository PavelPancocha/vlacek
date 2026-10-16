import { ruralScenes } from './rural.ts';
import type { LocalityTemplate, PropRule } from '../sceneryTypes.ts';
const machine = (
  season: 'spring' | 'summer' | 'autumn' | 'winter',
  work: NonNullable<PropRule['work']>,
): PropRule => ({
  kinds: ['back.tractor-work'],
  layer: 'near',
  surface: 'field',
  count: [1, 1],
  x: [340, 640],
  depth: [0.37, 0.37],
  scale: [1, 1],
  motion: { rangeU: 260, speedUPerSec: 20 },
  seasons: [season],
  work,
});
export const fieldScene: LocalityTemplate = {
  id: 'farm-forest-field',
  biome: 'countryside',
  weight: 4,
  near: 'meadow',
  back: 'crops',
  nearSurface: { kind: 'field', depth: [0.16, 0.74] },
  paths: [
    { layer: 'near', depth: 0.37, widthU: 32, x: [64, 960] },
    { layer: 'back', depth: 0.55, widthU: 32, x: [64, 960] },
  ],
  rules: [
    machine('spring', 'sow'),
    machine('summer', 'bale'),
    machine('autumn', 'plough'),
    machine('winter', 'snow-clear'),
    {
      kinds: ['back.combine'],
      layer: 'back',
      count: [1, 1],
      x: [320, 650],
      depth: [0.55, 0.55],
      scale: [1, 1],
      motion: { rangeU: 260, speedUPerSec: 22 },
      seasons: ['summer'],
      work: 'harvest',
    },
    {
      kinds: ['back.tractor-work'],
      layer: 'back',
      count: [1, 1],
      x: [320, 650],
      depth: [0.55, 0.55],
      scale: [1, 1],
      motion: { rangeU: 260, speedUPerSec: 20 },
      seasons: ['spring', 'autumn', 'winter'],
      work: 'seasonal',
    },
    ...(['spring', 'summer', 'autumn'] as const).flatMap((season) =>
      (['near', 'back'] as const).flatMap((layer) =>
        [layer === 'near' ? 0.53 : 0.76, layer === 'near' ? 0.66 : 0.88].map(
          (depth) => ({
            kinds: [
              season === 'autumn' ? 'near.stubble' : `near.crop-rows-${season}`,
            ],
            layer,
            layout: 'rows' as const,
            count: [6, 6] as const,
            depth: [depth, depth] as const,
            scale: [1, 1] as const,
            seasons: [season],
            ...(layer === 'near' ? { surface: 'field' as const } : {}),
          }),
        ),
      ),
    ),
    {
      kinds: ['back.haybale', 'near.stubble'],
      layer: 'near',
      surface: 'field',
      count: [2, 3],
      x: [160, 860],
      depth: [0.59, 0.67],
      spacingU: 140,
      seasons: ['summer'],
    },
    {
      kinds: ['back.farmer-work'],
      layer: 'near',
      surface: 'field',
      count: [1, 1],
      x: [190, 230],
      depth: [0.5, 0.5],
      scale: [1, 1],
      seasons: ['spring', 'summer', 'autumn'],
      work: 'farmer',
    },
  ],
  animals: ['hedgehog'],
  animalDepth: [0.88, 0.92],
  animalX: [128, 128],
};
const edgeRules: PropRule[] = (
  ['spring', 'summer', 'autumn', 'winter'] as const
).map((season) => ({
  kinds: [`near.forest-edge-${season}`],
  layer: 'near',
  layout: 'forest-edge',
  surface: 'forest-floor',
  count: [3, 3],
  depth: [0.28, 0.28],
  scale: [1, 1],
  seasons: [season],
}));
export const denseScene: LocalityTemplate = {
  id: 'farm-forest-dense',
  biome: 'forest',
  weight: 0,
  calm: true,
  near: 'forest',
  back: 'forest',
  nearSurface: { kind: 'forest-floor', depth: [0.15, 0.9] },
  rules: [
    ...edgeRules,
    ...(['spring', 'summer', 'autumn', 'winter'] as const).flatMap((season) =>
      (
        [
          ['mid', 0.12],
          ['far', 0.86],
        ] as const
      ).map(([layer, depth]) => ({
        kinds: [`backdrop.forest-dense-${layer}-${season}`],
        layer: 'back' as const,
        layout: 'forest-band' as const,
        count: [3, 3] as const,
        depth: [depth, depth] as const,
        scale: [1.05, 1.05] as const,
        seasons: [season],
      })),
    ),
    {
      kinds: ['tree.spruce', 'tree.pine', 'tree.oak', 'tree.birch'],
      layer: 'back',
      layout: 'forest-trees',
      count: [16, 16],
      depth: [0.14, 0.14],
      scale: [0.85, 0.85],
    },
    {
      kinds: ['near.fern-big', 'near.log', 'near.young-spruce'],
      layer: 'near',
      surface: 'forest-floor',
      count: [3, 6],
      depth: [0.35, 0.75],
      seasons: ['spring', 'summer', 'autumn'],
    },
  ],
  animals: ['squirrel', 'deer'],
  animalDepth: [0.78, 0.9],
};
export const workScene: LocalityTemplate = {
  ...denseScene,
  id: 'farm-forest-work',
  weight: 2,
  calm: false,
  paths: [
    { layer: 'near', depth: 0.57, widthU: 32, x: [180, 860] },
    { layer: 'back', depth: 0.68, widthU: 32, x: [100, 700] },
  ],
  rules: [
    {
      kinds: ['back.harvester'],
      layer: 'near',
      surface: 'forest-floor',
      count: [1, 1],
      x: [300, 300],
      depth: [0.57, 0.57],
      scale: [1, 1],
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      work: 'harvester',
    },
    {
      kinds: ['back.forwarder'],
      layer: 'near',
      surface: 'forest-floor',
      count: [1, 1],
      x: [660, 660],
      depth: [0.57, 0.57],
      scale: [1, 1],
      motion: { rangeU: 120, speedUPerSec: 10 },
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      work: 'forwarder',
    },
    {
      kinds: ['back.logs'],
      layer: 'near',
      surface: 'forest-floor',
      count: [1, 2],
      x: [470, 630],
      depth: [0.78, 0.84],
      spacingU: 110,
      seasons: ['spring', 'summer', 'autumn', 'winter'],
    },
    {
      kinds: ['back.log-truck'],
      layer: 'back',
      count: [1, 1],
      x: [540, 580],
      depth: [0.68, 0.68],
      scale: [1, 1],
      work: 'truck',
    },
    {
      kinds: ['back.logs'],
      layer: 'back',
      count: [2, 3],
      x: [140, 390],
      depth: [0.8, 0.86],
      spacingU: 90,
    },
    ...denseScene.rules,
  ],
  animals: ['hedgehog'],
  animalDepth: [0.92, 0.94],
  animalX: [128, 128],
};

const pasture = ruralScenes.find((t) => t.id === 'pasture');
if (!pasture) throw new Error('missing base pasture');
// Existing grazing animals share a dry pasture and a trough beside their safe range.
export const pastureScene: LocalityTemplate = {
  ...pasture,
  id: 'farm-forest-pasture',
  weight: 2,
  rules: [
    ...pasture.rules,
    {
      kinds: ['near.water-trough'],
      layer: 'near',
      count: [1, 1],
      depth: [0.5, 0.55],
      aroundAnimalU: 80,
    },
  ],
};

export const scenes: readonly LocalityTemplate[] = [
  fieldScene,
  pastureScene,
  denseScene,
  workScene,
  {
    ...denseScene,
    id: 'farm-forest-lodge',
    weight: 1,
    calm: false,
    rules: [
      ...denseScene.rules,
      {
        kinds: ['back.feeding-rack'],
        layer: 'back',
        count: [1, 1],
        x: [120, 220],
        depth: [0.3, 0.4],
      },
      {
        kinds: ['back.lodge'],
        layer: 'back',
        count: [1, 1],
        x: [430, 650],
        depth: [0.4, 0.5],
      },
    ],
  },
];
