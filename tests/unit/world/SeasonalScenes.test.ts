import { expect, it } from 'vitest';
import { scenes } from '../../../src/domain/world/scenes/seasons-life.scenes.ts';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it('SCN-FH06: winter sled has a bounded dry run behind the track and no summer scene', () => {
  expect(
    scenes.some((t) =>
      t.rules.some((r) => r.kinds.includes('back.sled-child')),
    ),
  ).toBe(true);
  let count = 0;
  for (let seed = 1; seed < 12; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 24; i++) {
      if (r.landscape === 'foothills' && r.season === 'winter') {
        for (let x = r.fromXU; x < r.toXU - 8192; x += 2048) {
          const sc = chunkScenery(seed, x / 1024, worldPlacementCatalog);
          for (const p of sc.props.filter(
            (p) => p.kind === 'back.sled-child',
          )) {
            expect(p.layer).toBe('back');
            expect(p.motion?.rangeU).toBe(48);
            count++;
          }
        }
      }
      r = regionAt(seed, r.toXU);
    }
  }
  expect(count).toBeGreaterThan(0);
});

it('SCN-FH06: the sled is inadmissible after the effective winter-to-autumn boundary', async () => {
  const { admissibleKind } =
    await import('../../../src/domain/world/Placement.ts');
  let witnesses = 0;
  for (let seed = 1; seed < 20; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 36; i++) {
      const next = regionAt(seed, r.toXU);
      if (r.season === 'winter' && next.season === 'autumn') {
        expect(
          admissibleKind('back.sled-child', seed, r.toXU - 1024, 'back'),
        ).toBe(false);
        witnesses++;
      }
      r = next;
    }
  }
  expect(witnesses).toBeGreaterThan(0);
});
