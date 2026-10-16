import type { LocalityTemplate } from '../sceneryTypes.ts';
import { beachSand } from './rules.ts';
export const dunesScenes: readonly LocalityTemplate[] = [
  {
    id: 'dunes',
    biome: 'dunes',
    weight: 3,
    calm: true,
    near: 'sand',
    back: 'sand',
    animals: ['deer', 'fox'],
    rules: [
      {
        kinds: ['tree.pine'],
        layer: 'back',
        count: [5, 9],
        depth: [0.25, 0.95],
        spacingU: 100,
        flip: true,
      },
      ...beachSand
        .map((rule) => ({
          ...rule,
          kinds: rule.kinds.filter(
            (kind) => kind !== 'near.shells' && kind !== 'near.driftwood',
          ),
        }))
        .filter((rule) => rule.kinds.length > 0),
    ],
  },
];
