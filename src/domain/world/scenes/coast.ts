import type { LocalityTemplate } from '../sceneryTypes.ts';
import { beachSand } from './rules.ts';
export const coastScenes: readonly LocalityTemplate[] = [
  {
    id: 'beach',
    biome: 'coast',
    weight: 3,
    calm: true,
    near: 'sand',
    back: 'sand',
    water: { depth: [0.3, 0.9] },
    rules: [
      {
        kinds: ['back.sailboat'],
        layer: 'back',
        count: [1, 2],
        x: [210, 814],
        depth: [0.55, 0.85],
        spacingU: 300,
        motion: { rangeU: 260, speedUPerSec: 18 },
      },
      {
        kinds: ['back.beach-hut', 'back.parasol'],
        layer: 'back',
        count: [2, 4],
        depth: [0.05, 0.2],
        spacingU: 160,
      },
      ...beachSand,
      {
        kinds: ['near.sand-toys'],
        layer: 'near',
        count: [0, 1],
        depth: [0.2, 0.9],
      },
    ],
    animals: ['gull'],
  },
  {
    id: 'harbour',
    biome: 'coast',
    weight: 2,
    near: 'sand',
    back: 'sand',
    water: { x: [0, 760], depth: [0.1, 0.86] },
    rules: [
      {
        kinds: ['back.lighthouse'],
        layer: 'back',
        count: [1, 1],
        x: [820, 960],
        depth: [0.6, 0.75],
      },
      {
        kinds: ['back.pier'],
        layer: 'back',
        count: [1, 1],
        x: [200, 420],
        depth: [0.1, 0.12],
      },
      {
        kinds: ['back.fishing-boat'],
        layer: 'back',
        count: [1, 2],
        x: [140, 620],
        depth: [0.3, 0.6],
        spacingU: 200,
        motion: { rangeU: 120, speedUPerSec: 10 },
      },
      ...beachSand,
    ],
    animals: ['gull', 'cat'],
  },
];
