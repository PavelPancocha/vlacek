import { additionalScenes } from './scenes/registry.generated.ts';
export type * from './sceneryTypes.ts';
import type { LocalityTemplate } from './sceneryTypes.ts';
import { ruralScenes } from './scenes/rural.ts';
import { villageScenes } from './scenes/village.ts';
import { stationScenes } from './scenes/station.ts';
import { forestScenes } from './scenes/forest.ts';
import { waterScenes } from './scenes/water.ts';
import { highlandsScenes, summerMountainScene } from './scenes/highlands.ts';
import { coastScenes } from './scenes/coast.ts';
import { dunesScenes } from './scenes/dunes.ts';
import { townScenes } from './scenes/town.ts';
export const LOCALITIES: readonly LocalityTemplate[] = [
  ...ruralScenes,
  ...villageScenes,
  ...stationScenes,
  ...forestScenes,
  ...waterScenes,
  ...highlandsScenes,
  summerMountainScene,
  ...coastScenes,
  ...dunesScenes,
  ...townScenes,
  ...additionalScenes,
];
