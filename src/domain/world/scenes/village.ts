import type { LocalityTemplate } from '../sceneryTypes.ts';
import { meadowLife, broadleaf } from './rules.ts';
export const villageScenes: readonly LocalityTemplate[] = [
  {
    id: 'village',
    biome: 'countryside',
    weight: 3,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.house-a', 'back.house-b', 'back.house-c'],
        layer: 'back',
        count: [3, 4],
        depth: [0.3, 0.6],
        spacingU: 190,
      },
      {
        kinds: ['back.church'],
        layer: 'back',
        count: [0, 1],
        depth: [0.8, 0.9],
      },
      {
        kinds: ['back.car'],
        layer: 'back',
        count: [1, 1],
        // The road bends away to the horizon within the chunk.
        x: [320, 704],
        depth: [0.2, 0.22],
        motion: { rangeU: 400, speedUPerSec: 70 },
      },
      {
        kinds: broadleaf,
        layer: 'back',
        count: [4, 6],
        depth: [0.62, 1],
        spacingU: 120,
        flip: true,
      },
      {
        kinds: ['back.bush-a', 'back.bush-b', 'tree.apple'],
        layer: 'back',
        count: [3, 5],
        depth: [0.25, 0.65],
        spacingU: 90,
        flip: true,
      },
      {
        kinds: ['fence.picket-panel'],
        layer: 'near',
        count: [2, 4],
        depth: [0.05, 0.12],
        spacingU: 80,
      },
      ...meadowLife,
    ],
    animals: ['dog', 'cat', 'hen'],
  },
  {
    id: 'hamlet',
    biome: 'foothills',
    weight: 2,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.chalet'],
        layer: 'back',
        count: [1, 2],
        depth: [0.35, 0.6],
        spacingU: 260,
      },
      {
        kinds: ['back.hayrack'],
        layer: 'back',
        count: [1, 2],
        depth: [0.15, 0.3],
        spacingU: 200,
      },
      {
        kinds: ['tree.spruce', 'tree.birch'],
        layer: 'back',
        count: [3, 5],
        depth: [0.5, 1],
        spacingU: 120,
        flip: true,
      },
      ...meadowLife,
    ],
    animals: ['dog', 'hen'],
  },
];
