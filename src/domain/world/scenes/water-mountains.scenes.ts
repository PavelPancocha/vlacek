import type { LocalityTemplate } from '../sceneryTypes.ts';
import type { RegionPlan } from '../Regions.ts';
import { beachSand, meadowLife } from './rules.ts';

export const scenes: readonly LocalityTemplate[] = [
  {
    id: 'water-mountains-fishponds',
    biome: 'lakes',
    weight: 0,
    near: 'meadow',
    back: 'meadow',
    rules: [],
    animals: ['frog'],
  },
  {
    id: 'water-mountains-river',
    biome: 'lakes',
    weight: 1,
    near: 'meadow',
    back: 'meadow',
    rules: [...meadowLife],
    animals: ['frog'],
  },
  {
    id: 'water-mountains-rocky-coast',
    biome: 'coast',
    weight: 2,
    near: 'sand',
    back: 'sand',
    rules: [...beachSand],
    animals: ['gull'],
  },
  {
    id: 'water-mountains-harbour',
    biome: 'coast',
    weight: 0,
    near: 'sand',
    back: 'sand',
    rules: [
      {
        kinds: ['back.fishing-boat'],
        layer: 'back',
        count: [1, 2],
        x: [300, 710],
        depth: [0.5, 0.8],
        motion: { rangeU: 120, speedUPerSec: 10 },
      },
      ...beachSand,
    ],
    animals: ['gull'],
  },
  {
    id: 'water-mountains-open-dunes',
    biome: 'dunes',
    weight: 1,
    calm: true,
    near: 'sand',
    back: 'sand',
    rules: [
      {
        kinds: ['tree.sahara-pine-a', 'tree.sahara-pine-b'],
        layer: 'back',
        count: [2, 3],
        depth: [0.5, 0.85],
        spacingU: 200,
      },
      {
        kinds: ['near.dune-grass', 'near.stones'],
        layer: 'near',
        count: [6, 9],
        depth: [0.25, 0.8],
      },
    ],
    animals: ['fox'],
  },
  {
    id: 'water-mountains-heather',
    biome: 'dunes',
    weight: 2,
    near: 'sand',
    back: 'sand',
    rules: [
      {
        kinds: ['tree.sahara-pine-a', 'tree.sahara-pine-b'],
        layer: 'back',
        count: [7, 10],
        depth: [0.35, 0.85],
        spacingU: 75,
      },
      {
        kinds: ['near.heather', 'near.heather-green'],
        layer: 'near',
        count: [5, 9],
        depth: [0.28, 0.55],
        spacingU: 90,
      },
      {
        kinds: ['near.young-pine'],
        layer: 'near',
        count: [2, 4],
        depth: [0.25, 0.5],
        spacingU: 170,
      },
    ],
    animals: ['fox'],
  },
  {
    id: 'water-mountains-quarry',
    biome: 'foothills',
    weight: 1,
    near: 'meadow',
    back: 'meadow',
    rules: [],
    animals: ['fox'],
  },
  {
    id: 'water-mountains-cableway',
    biome: 'foothills',
    weight: 1,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['tree.birch', 'tree.spruce'],
        layer: 'back',
        count: [4, 7],
        depth: [0.85, 0.9],
        spacingU: 120,
      },
    ],
    animals: ['sheep'],
  },
];
/** Guaranteed opportunities remain subordinate to actual infrastructure reservations. */
export function waterMountainSceneId(
  region: RegionPlan,
  index: number,
): string | undefined {
  if (region.landscape === 'lakes')
    return index === 2
      ? 'water-mountains-fishponds'
      : index === 6
        ? 'water-mountains-river'
        : undefined;
  if (region.landscape === 'coast')
    return index === 2
      ? 'water-mountains-rocky-coast'
      : index === 4
        ? 'water-mountains-harbour'
        : undefined;
  if (region.landscape === 'dunes')
    return index === 0
      ? 'water-mountains-open-dunes'
      : index === 2
        ? 'water-mountains-heather'
        : undefined;
  if (region.landscape === 'foothills')
    return index === 2
      ? 'water-mountains-cableway'
      : index === 6
        ? 'water-mountains-quarry'
        : undefined;
  return undefined;
}
