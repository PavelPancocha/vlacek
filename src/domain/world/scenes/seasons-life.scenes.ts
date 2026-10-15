import type { LocalityTemplate } from '../sceneryTypes.ts';
/** FH-02 winter clearing: short bounded sled path well behind the railway. */
export const scenes: readonly LocalityTemplate[] = [
  {
    id: 'winter-sled',
    biome: 'foothills',
    weight: 2,
    near: 'snow',
    back: 'snow',
    rules: [
      {
        kinds: ['back.sled-child'],
        layer: 'back',
        count: [1, 1],
        x: [200, 824],
        depth: [0.55, 0.7],
        motion: { rangeU: 48, speedUPerSec: 6 },
      },
      {
        kinds: ['tree.birch', 'tree.pine'],
        layer: 'back',
        count: [2, 4],
        depth: [0.8, 0.95],
        spacingU: 160,
      },
    ],
    animals: ['deer'],
  },
];
