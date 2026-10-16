import { expect, it } from 'vitest';
import { chunkScenery } from '../domain/world/Scenery.ts';
import { contextAt } from '../domain/world/WorldPlan.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { farmForestEmissions } from './farmForestEmissions.test-helper.ts';

it('resolves every real farm/forest attachment and animation frame to its own page', () => {
  const keys = new Set<string>();
  for (let k = 0; k < 120; k++)
    for (const prop of chunkScenery(1, k, worldPlacementCatalog).props) {
      if (!prop.work) continue;
      for (const frame of farmForestEmissions(
        prop,
        contextAt(1, k * 1024 + prop.xU).season,
      )) {
        keys.add(frame.key);
        expect(frame.texture, frame.key).toBe(`page:${frame.key}`);
      }
    }
  expect(keys.has('back.harvester-gripper-open')).toBe(true);
  expect(keys.has('wheel.farm-large')).toBe(true);
});
