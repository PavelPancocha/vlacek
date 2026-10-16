import { expect, it } from 'vitest';
import { worldParts } from '../../../src/content/worldArt.ts';
import { worldAtlasWindowKeys } from '../../../src/content/worldAtlasGroups.ts';
import {
  BUDGET_BYTES,
  integratedCatalogue,
  lifetimeModel,
  windowResidency,
} from '../../helpers/atlasResidency.ts';

it('D-026: all retained long-structure fragments and readbacks fit the unchanged low budget', () => {
  const parts = integratedCatalogue(worldParts);
  const keys = worldAtlasWindowKeys(parts, [
    { landscape: 'foothills', season: 'autumn' },
    { landscape: 'town', season: 'winter' },
  ]);
  const world = windowResidency(parts, keys, false, 1.25);
  const backdrop = windowResidency(parts, keys, true, 0.75);
  expect(lifetimeModel('low', world, backdrop, true).peakBytes).toBeLessThan(
    BUDGET_BYTES.low,
  );
});
