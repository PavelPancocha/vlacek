import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../integration/helpers.ts';
import {
  DEV_KEY,
  defaultDevOptions,
  readDevOptions,
  writeDevOptions,
  clearDevOptions,
} from '../../../src/platform/DevOptions.ts';

describe('developer storage is separate from the save', () => {
  it('round trips debug, renderer and seed, and clears only its own key', () => {
    const storage = new MemoryStorage();
    storage.setItem('vlacek.save.v1', 'keep');
    const options = { debug: true, renderer: 'canvas', seed: 0 } as const;
    expect(writeDevOptions(storage, options)).toBe(true);
    expect(readDevOptions(storage)).toEqual(options);
    expect(clearDevOptions(storage)).toBe(true);
    expect(storage.getItem(DEV_KEY)).toBeNull();
    expect(readDevOptions(storage)).toEqual(defaultDevOptions);
    expect(storage.getItem('vlacek.save.v1')).toBe('keep');
  });
  it('rubbish, wrong types, missing and throwing storage give defaults', () => {
    const storage = new MemoryStorage();
    for (const raw of [
      'broken',
      'null',
      '[]',
      'true',
      '1',
      '"canvas"',
      '{}',
      '{"debug":"1","renderer":false,"seed":"123"}',
      '{"seed":-1}',
      '{"seed":4294967296}',
      '{"seed":1.5}',
    ]) {
      storage.setItem(DEV_KEY, raw);
      expect(readDevOptions(storage)).toEqual(defaultDevOptions);
    }
    expect(readDevOptions(undefined)).toEqual(defaultDevOptions);
    const throws = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(readDevOptions(throws)).toEqual(defaultDevOptions);
    expect(writeDevOptions(throws, defaultDevOptions)).toBe(false);
    expect(clearDevOptions(throws)).toBe(false);
    expect(writeDevOptions(undefined, defaultDevOptions)).toBe(false);
    expect(clearDevOptions(undefined)).toBe(false);
  });
});

it('dev JSON stores only its three owned fields even when passed menu values', () => {
  const storage = new MemoryStorage();
  const values = {
    debug: true,
    renderer: 'canvas',
    seed: 123,
    quality: 'low',
    reducedEffects: true,
  } as const;
  expect(writeDevOptions(storage, values)).toBe(true);
  expect(JSON.parse(storage.getItem(DEV_KEY) ?? 'null')).toEqual({
    debug: true,
    renderer: 'canvas',
    seed: 123,
  });
});
