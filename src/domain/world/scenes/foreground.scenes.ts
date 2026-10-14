import type { LocalityTemplate } from '../sceneryTypes.ts';
import { ruralScenes } from './rural.ts';
import { forestScenes } from './forest.ts';
const field = ruralScenes.find((t) => t.id === 'field'),
  lodge = forestScenes.find((t) => t.id === 'lodge');
if (!field || !lodge) throw new Error('missing foreground base scene');
/** CR-01 and FO-04 first slice; new machinery/seasonal work is owned by content lanes. */
export const scenes: readonly LocalityTemplate[] = [
  {
    ...field,
    id: 'near-field',
    nearSurface: {
      kind: 'field',
      seasons: ['spring', 'summer', 'autumn'],
      depth: [0.18, 0.62],
    },
    rules: [
      {
        kinds: ['back.tractor'],
        layer: 'near',
        surface: 'field',
        count: [1, 1],
        x: [200, 824],
        depth: [0.35, 0.4],
        scale: [1, 1],
        motion: { rangeU: 180, speedUPerSec: 26 },
      },
      ...field.rules,
    ],
  },
  {
    ...lodge,
    id: 'forest-work',
    nearSurface: {
      kind: 'forest-floor',
      seasons: ['spring', 'summer', 'autumn'],
      depth: [0.15, 0.9],
    },
    rules: [
      {
        kinds: ['back.logs'],
        layer: 'near',
        surface: 'forest-floor',
        count: [2, 3],
        depth: [0.32, 0.6],
        spacingU: 130,
      },
      {
        kinds: ['near.young-spruce'],
        layer: 'near',
        surface: 'forest-floor',
        count: [3, 5],
        depth: [0.25, 0.7],
        spacingU: 100,
        flip: true,
      },
      ...lodge.rules,
    ],
  },
];
