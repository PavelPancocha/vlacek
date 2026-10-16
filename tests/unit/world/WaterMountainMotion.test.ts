import { expect, it } from 'vitest';
import { waterMountainBackdropKey } from '../../../src/render/waterMountainBackdrop.ts';
import { waterMountainParts } from '../../../src/content/world-modules/water-mountains.art.ts';

it('MO: every resolved mountain backdrop belongs to the active season atlas', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const)
    for (const layer of ['far', 'mid'] as const) {
      const key = waterMountainBackdropKey('mountains', season, layer);
      expect(waterMountainParts[key]?.atlasGroup?.seasons).toContain(season);
    }
});
import {
  ferryPose,
  boatFlip,
} from '../../../src/render/waterMountainMotion.ts';
it('LA06: ferry holds at both banks, crosses in 26s, and keeps its heading while moored', () => {
  const pose = { ratio: 0, direction: 1 as 1 | -1, moored: true };
  expect(ferryPose(6, 0, pose, 'summer')).toEqual({
    ratio: 0,
    direction: 1,
    moored: true,
  });
  expect(ferryPose(25, 0, pose, 'summer')).toEqual({
    ratio: 0.5,
    direction: 1,
    moored: false,
  });
  expect(ferryPose(44, 0, pose, 'summer')).toEqual({
    ratio: 1,
    direction: 1,
    moored: true,
  });
  expect(ferryPose(63, 0, pose, 'summer')).toEqual({
    ratio: 0.5,
    direction: -1,
    moored: false,
  });
  expect(ferryPose(76, 0, pose, 'summer')).toEqual({
    ratio: 0,
    direction: -1,
    moored: true,
  });
  for (let t = 0; t < 200; t++)
    expect(ferryPose(t, 0.23, pose, 'summer').ratio).toBeGreaterThanOrEqual(0);
  expect(boatFlip(1, 'left')).toBe(true);
  expect(boatFlip(-1, 'left')).toBe(false);
  expect(boatFlip(1, 'right')).toBe(false);
  expect(boatFlip(-1, 'right')).toBe(true);
});
it('CO/LA boats keep their last approach heading during a dock stay and turn when the return leg starts', () => {
  const pose = { ratio: 0, direction: 1 as 1 | -1, moored: true };
  expect(ferryPose(37, 0, pose, 'summer').direction).toBe(1);
  expect(ferryPose(44, 0, pose, 'summer').direction).toBe(1);
  expect(ferryPose(51, 0, pose, 'summer').direction).toBe(-1);
  expect(ferryPose(77, 0, pose, 'summer').direction).toBe(-1);
  expect(ferryPose(89, 0, pose, 'summer').direction).toBe(1);
});
it('LA08: the winter ferry stays moored instead of crossing', () => {
  const pose = { ratio: 0, direction: 1 as 1 | -1, moored: true };
  for (const time of [0, 25, 63, 89])
    expect(ferryPose(time, 0.23, pose, 'winter')).toEqual({
      ratio: 0,
      direction: 1,
      moored: true,
    });
});
