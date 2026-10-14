import type { LocalityTemplate } from '../sceneryTypes.ts';
import { tufts, flowers, meadowFeatures, snowField } from './rules.ts';
export const highlandsScenes: readonly LocalityTemplate[] = [
  {
    id: 'hill-pasture',
    biome: 'foothills',
    weight: 3,
    calm: true,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.rock-a', 'back.rock-b'],
        layer: 'back',
        count: [2, 4],
        depth: [0.1, 0.8],
        spacingU: 120,
        flip: true,
      },
      {
        kinds: ['tree.birch', 'tree.spruce'],
        layer: 'back',
        count: [2, 4],
        depth: [0.4, 1],
        spacingU: 150,
        flip: true,
      },
      {
        kinds: ['fence.wood-panel'],
        layer: 'back',
        count: [3, 6],
        depth: [0.12, 0.14],
        spacingU: 64,
      },
      tufts,
      { ...flowers, count: [6, 10] },
      ...meadowFeatures,
      {
        kinds: ['near.stones', 'near.young-spruce'],
        layer: 'near',
        count: [2, 4],
        depth: [0.2, 1],
        spacingU: 140,
        flip: true,
      },
    ],
    animals: ['cow', 'sheep'],
  },
  {
    id: 'snowfield',
    biome: 'mountains',
    weight: 3,
    calm: true,
    near: 'snow',
    back: 'snow',
    rules: [
      {
        kinds: ['tree.spruce-snow', 'tree.spruce-snow', 'tree.pine-snow'],
        layer: 'back',
        count: [6, 10],
        depth: [0.05, 1],
        flip: true,
      },
      {
        kinds: ['back.rock-snow'],
        layer: 'back',
        count: [1, 3],
        depth: [0.1, 0.7],
        spacingU: 150,
        flip: true,
      },
      {
        kinds: ['back.snowman'],
        layer: 'back',
        count: [0, 1],
        depth: [0.08, 0.2],
      },
      ...snowField,
    ],
    animals: ['fox', 'deer'],
  },
  {
    id: 'alpine',
    biome: 'mountains',
    weight: 2,
    near: 'snow',
    back: 'snow',
    rules: [
      {
        kinds: ['back.chalet-snow'],
        layer: 'back',
        count: [1, 1],
        x: [300, 700],
        depth: [0.35, 0.5],
      },
      {
        kinds: ['tree.spruce-snow'],
        layer: 'back',
        count: [4, 7],
        depth: [0.3, 1],
        spacingU: 90,
        flip: true,
      },
      ...snowField,
    ],
    animals: ['dog', 'fox'],
  },
];

export const summerMountainScene: LocalityTemplate = {
  ...(highlandsScenes.find((s) => s.id === 'hill-pasture') ??
    (() => {
      throw new Error('missing hill pasture');
    })()),
  id: 'mountain-meadow',
  biome: 'mountains',
  calm: true,
};
