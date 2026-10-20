import { expect, it, vi } from 'vitest';
import { AudioTunnelWindow } from '../../../src/app/AudioTunnelWindow.ts';
import * as structures from '../../../src/domain/world/Structures.ts';
import { coveredFraction } from '../../../src/platform/audio/AudioDirector.ts';

it('does no tunnel scans for unchanged track windows and preserves audio coverage across window and seed changes', () => {
  const cache = new AudioTunnelWindow();
  const site = vi.spyOn(structures, 'tunnelSite');
  const first = cache.update(20261009, -2, 7);
  site.mockClear();
  for (let i = 0; i < 60; i++)
    expect(cache.update(20261009, -2, 7)).toBe(first);
  expect(site).not.toHaveBeenCalled();
  for (const seed of [20261009, 4])
    for (let k = 0; k < 250; k += 3) {
      const expected: { fromX: number; toX: number }[] = [];
      for (let i = k; i <= k + 8; i++) {
        const t = structures.tunnelSite(seed, i);
        if (!t) continue;
        const fromX = i * 1024 + t.fromX;
        if (!expected.some((r) => r.fromX === fromX))
          expected.push({ fromX, toX: i * 1024 + t.toX });
      }
      const actual = cache.update(seed, k, k + 8);
      expect(actual).toEqual(expected);
      expect(coveredFraction(k * 1024, k * 1024 + 2000, actual)).toBe(
        coveredFraction(k * 1024, k * 1024 + 2000, expected),
      );
    }
  site.mockRestore();
});

it('keeps AudioDirector layers, tunnel gain and steam beats identical along the seeded track', async () => {
  const { AudioDirector } =
    await import('../../../src/platform/audio/AudioDirector.ts');
  const { AudioManager } =
    await import('../../../src/platform/AudioManager.ts');
  const { contextAt } = await import('../../../src/domain/world/WorldPlan.ts');
  const before = new AudioManager(),
    after = new AudioManager();
  const oldLayers = vi.spyOn(before, 'setLayers').mockImplementation(() => {});
  const newLayers = vi.spyOn(after, 'setLayers').mockImplementation(() => {});
  const oldCovered = vi
    .spyOn(before, 'setCovered')
    .mockImplementation(() => {});
  const newCovered = vi.spyOn(after, 'setCovered').mockImplementation(() => {});
  const oldChuff = vi.spyOn(before, 'chuff').mockImplementation(() => {});
  const newChuff = vi.spyOn(after, 'chuff').mockImplementation(() => {});
  const oldDirector = new AudioDirector(before),
    newDirector = new AudioDirector(after);
  const cache = new AudioTunnelWindow();
  for (let x = 0; x < 150000; x += 480) {
    const k = Math.floor(x / 1024),
      seed = 20261009;
    const tunnels: { fromX: number; toX: number }[] = [];
    for (let i = k - 3; i <= k + 6; i++) {
      const t = structures.tunnelSite(seed, i);
      if (!t) continue;
      const fromX = i * 1024 + t.fromX;
      if (!tunnels.some((range) => range.fromX === fromX))
        tunnels.push({ fromX, toX: i * 1024 + t.toX });
    }
    const common = {
      power: 'steam',
      speedUPerSec: 480,
      distanceU: 480,
      wheelRadiusU: 24,
      throttle: true,
      bellGain: k % 3 === 0 ? 0.5 : 0,
    } as const;
    oldDirector.update({
      ...common,
      biome: contextAt(seed, x).region.landscape,
      season: contextAt(seed, x).season,
      covered: coveredFraction(x - 2000, x, tunnels),
    });
    const context = contextAt(seed, x);
    newDirector.update({
      ...common,
      biome: context.region.landscape,
      season: context.season,
      covered: coveredFraction(x - 2000, x, cache.update(seed, k - 3, k + 6)),
    });
  }
  expect(newLayers.mock.calls).toEqual(oldLayers.mock.calls);
  expect(newCovered.mock.calls).toEqual(oldCovered.mock.calls);
  expect(newChuff.mock.calls).toEqual(oldChuff.mock.calls);
  before.dispose();
  after.dispose();
});
