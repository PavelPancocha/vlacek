import type { LocalityTemplate } from '../sceneryTypes.ts';
import { fieldScene, workScene } from './farm-forest.scenes.ts';
/** Keep the first-slice locator/planning IDs while replacing their content. */
export const scenes: readonly LocalityTemplate[] = [
  { ...fieldScene, id: 'near-field', weight: 0 },
  { ...workScene, id: 'forest-work', weight: 0 },
];
