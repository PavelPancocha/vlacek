import type { LocalityTemplate } from '../sceneryTypes.ts';
import { meadowLife } from './rules.ts';
import type { SettlementScene } from '../SettlementPlan.ts';
const roles: readonly SettlementScene[] = [
  'village-entry',
  'village-green',
  'village-exit',
  'suburb',
  'street',
  'park',
  'yard',
];
export const scenes: readonly LocalityTemplate[] = roles.map((role) => ({
  id: `settlements-${role}`,
  biome: role.startsWith('village') ? 'countryside' : 'town',
  weight: role.startsWith('village') ? 0 : 1,
  calm: role === 'suburb',
  near: 'meadow',
  back: 'meadow',
  rules: meadowLife,
  animals: ['dog', 'cat'],
}));
