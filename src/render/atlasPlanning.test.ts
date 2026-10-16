import { expect, it } from 'vitest';
import { worldParts, isBackdropPart } from '../content/worldArt.ts';
import { worldAtlasKeys } from '../content/worldAtlasGroups.ts';
import {
  packWorldPages,
  packRectsInSteps,
  worldPagePlanning,
  atlasDecodeBatch,
  artAtlasItems,
} from './atlasPacking.ts';
it('yields incomplete planning before publishing the same bounded page plan', () => {
  const items = [
    { key: 'wide', width: 2040, height: 170 },
    { key: 'tall', width: 170, height: 2040 },
  ];
  const work = worldPagePlanning(items);
  let step = work.next();
  expect(step.done).toBe(false);
  while (!step.done) step = work.next();
  expect(step.value).toEqual(packWorldPages(items));
});

it('keeps the small countryside window and its track sliver on one page', () => {
  const catalogue: Readonly<
    Record<string, { widthU: number; heightU: number }>
  > = worldParts;
  const keys = worldAtlasKeys(worldParts, [
    { landscape: 'lakes', season: 'summer' },
    { landscape: 'countryside', season: 'summer' },
  ]);
  const parts = Object.fromEntries(
    keys
      .filter((key) => !isBackdropPart(key))
      .map((key) => {
        const part = catalogue[key];
        if (!part) throw new Error(`missing ${key}`);
        return [key, part];
      }),
  );
  expect(packWorldPages(artAtlasItems(parts, 1))).toHaveLength(1);
});

it('admits parallel small bitmaps but keeps their combined pixel copies within one large-source budget', () => {
  const items = [
    { key: 'large', width: 32, height: 32 },
    ...Array.from({ length: 4 }, (_, i) => ({
      key: `small-${i}`,
      width: 10,
      height: 10,
    })),
  ];
  expect(atlasDecodeBatch(items, 0, 4096).map((p) => p.key)).toEqual(['large']);
  expect(atlasDecodeBatch(items, 1, 4096)).toHaveLength(4);
});

it('bootstraps more small bitmaps within the same four-large-source envelope', () => {
  const items = Array.from({ length: 16 }, (_, i) => ({
    key: `small-${i}`,
    width: 10,
    height: 10,
  }));
  expect(atlasDecodeBatch(items, 0, 5296, 16)).toHaveLength(13);
});

it('slices one packing candidate into steps of at most 32 placed parts (D-032 plan spikes)', () => {
  const items = Array.from({ length: 200 }, (_, i) => ({
    key: `part-${String(i).padStart(3, '0')}`,
    width: 20 + (i % 13) * 7,
    height: 15 + (i % 11) * 5,
  }));
  const steps = packRectsInSteps(items, 2048, 'height');
  let yields = 0;
  let step = steps.next();
  while (!step.done) {
    yields++;
    step = steps.next();
  }
  // 200 placements yield after every 32: 6 times before the result.
  expect(yields).toBe(Math.ceil(items.length / 32) - 1);
  expect(
    step.value.flatMap((page) => [...page.plan.frames.keys()]).sort(),
  ).toEqual(items.map((item) => item.key));
  expect(packWorldPages(items)).toEqual(packWorldPages(items));
});
