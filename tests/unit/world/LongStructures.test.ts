import { describe, expect, it } from 'vitest';
import {
  bridgeSite,
  tunnelSite,
  valleyDepthU,
} from '../../../src/domain/world/Structures.ts';
import {
  generateTrackProfile,
  profileGrade,
} from '../../../src/domain/world/TrackProfile.ts';
import { biomeAt } from '../../../src/domain/world/Biomes.ts';
import { secondarySite } from '../../../src/domain/world/SecondaryTrack.ts';

/** TB-01–05: bounded witnesses, not vacuously passing filters. */
describe('D-026 long structures', () => {
  it('TB-05: a >2000u tunnel has one identity, a fitted track profile and complete chunk fragments', () => {
    let long = 0;
    const lengths = new Set<number>();
    for (let seed = 0; seed < 24; seed++)
      for (let k = 6; k < 480; k += 8) {
        const site = tunnelSite(seed, k);
        if (!site || site.toX - site.fromX <= 2000) continue;
        long++;
        lengths.add(site.toX - site.fromX);
        expect(['mountains', 'foothills']).toContain(biomeAt(seed, k).biome);
        const from = k * 1024 + site.fromX,
          to = k * 1024 + site.toX;
        const grades: number[] = [];
        for (let x = from; x <= to; x += 8) {
          const chunk = Math.floor(x / 1024);
          const fragment = tunnelSite(seed, chunk);
          expect(fragment?.id, `seed=${seed} chunk=${chunk}`).toBe(site.id);
          expect(chunk * 1024 + (fragment?.fromX ?? NaN)).toBe(from);
          expect(chunk * 1024 + (fragment?.toX ?? NaN)).toBe(to);
          grades.push(
            profileGrade(generateTrackProfile(seed, chunk), x - chunk * 1024),
          );
        }
        expect(Math.max(...grades.map(Math.abs))).toBeLessThanOrEqual(0.12);
        expect(site.toX - site.fromX).toBeGreaterThanOrEqual(3072);
        expect(secondarySite(seed, Math.floor(k / 8))).toBeUndefined();
      }
    expect(long).toBeGreaterThan(0);
    expect(lengths.size).toBeGreaterThan(1);
  });

  it('TB-01–03: stone, steel and valley viaducts have nonzero bounded coverage', () => {
    const coverage = new Set<string>();
    for (let seed = 0; seed < 24; seed++)
      for (let k = 4; k < 480; k += 8) {
        const site = bridgeSite(seed, k);
        if (!site) continue;
        const variant = 'variant' in site ? site.variant : 'stone';
        coverage.add(String(variant));
        if (variant === 'viaduct')
          expect(
            valleyDepthU(seed, k * 1024 + site.localXU),
          ).toBeGreaterThanOrEqual(160);
      }
    expect([...coverage].sort()).toEqual(['steel', 'stone', 'viaduct']);
  });
});

it('SCN-TB05 locator: the tunnel preset prefers a long tunnel without losing its bounded fallback', async () => {
  const { locateTestScene } =
    await import('../../../src/domain/world/TestScenes.ts');
  const { worldPlacementCatalog } =
    await import('../../../src/content/worldPlacementCatalog.ts');
  const location = locateTestScene(1, 'tunnel', worldPlacementCatalog);
  expect(location).toBeDefined();
  if (!location) return;
  const k = Math.floor(location.worldXU / 1024),
    site = tunnelSite(1, k);
  expect((site?.toX ?? 0) - (site?.fromX ?? 0)).toBeGreaterThanOrEqual(3072);
});

it('SCN-TB01/03: a viaduct feature declares the whole deck rather than only its water corridor', async () => {
  const { chunkScenery } = await import('../../../src/domain/world/Scenery.ts');
  const { worldPlacementCatalog } =
    await import('../../../src/content/worldPlacementCatalog.ts');
  const scenery = chunkScenery(0, 188, worldPlacementCatalog),
    bridge = scenery.bridge;
  expect(bridge?.variant).toBe('viaduct');
  const feature = scenery.features.find((f) => f.id === bridge?.id);
  expect(feature?.fromXU).toBe(188 * 1024 + (bridge?.fromX ?? NaN));
  expect(feature?.toXU).toBe(188 * 1024 + (bridge?.toX ?? NaN));
  const { validateStructureFeatures } =
    await import('../../../src/domain/world/StructureValidation.ts');
  expect(validateStructureFeatures(scenery)).toEqual([]);
  if (!feature) throw new Error('feature missing');
  feature.fromXU++;
  expect(
    validateStructureFeatures(scenery).some((e) =>
      e.includes('structure extent'),
    ),
  ).toBe(true);
});
