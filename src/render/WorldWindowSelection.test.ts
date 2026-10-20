import { expect, it, vi } from 'vitest';
import { WorldWindowSelection } from './WorldAtlasRequests.ts';
import { worldAtlasRegions } from './worldAtlasWindow.ts';
import * as groups from '../content/worldAtlasGroups.ts';
import { worldParts } from '../content/worldArt.ts';

it('reuses unchanged frame requests and preserves the legacy request sequence across seeded region boundaries and scales', () => {
  const selection = new WorldWindowSelection();
  const keys = vi.spyOn(groups, 'worldAtlasWindowKeys');
  const first = selection.update(20261009, 0, 6800, 1, 0.75);
  keys.mockClear();
  for (let x = 1; x < 100; x++)
    expect(selection.update(20261009, x, 6800 + x, 1, 0.75)).toBe(first);
  expect(keys).not.toHaveBeenCalled();
  const oldSequence: string[] = [],
    newSequence: string[] = [];
  const regions = new Set<string>();
  for (let x = 0; x < 150000; x += 480) {
    const window = worldAtlasRegions(20261009, x, x + 6800);
    for (const region of window) regions.add(region.id);
    const scale = x > 70000 ? 1.25 : 1;
    const id = `${scale}/0.75/${groups.worldAtlasWindowKeys(worldParts, window).join(',')}`;
    if (oldSequence.at(-1) !== id) oldSequence.push(id);
    const actual = selection.update(20261009, x, x + 6800, scale, 0.75).id;
    if (newSequence.at(-1) !== actual) newSequence.push(actual);
  }
  expect(regions.size).toBeGreaterThanOrEqual(3);
  expect(newSequence).toEqual(oldSequence);
  keys.mockRestore();
});
