import type { LocalityTemplate } from '../sceneryTypes.ts';
import { villageScenes } from './village.ts';
// shortcut: rural town composition, replaced by the settlements-stations lane in the same PR.
export const townScenes: readonly LocalityTemplate[] = villageScenes
  .filter((s) => s.id === 'village')
  .map((s) => ({ ...s, id: 'town-village', biome: 'town', calm: true }));
