import type { LocalityTemplate } from '../sceneryTypes.ts';
export const stationScenes: readonly LocalityTemplate[] = [
  {
    id: 'station',
    biome: 'countryside',
    weight: 0,
    station: true,
    near: 'meadow',
    back: 'meadow',
    rules: [],
    animals: ['dog', 'cat'],
  },
];
