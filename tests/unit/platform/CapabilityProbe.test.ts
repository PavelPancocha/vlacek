import { describe, expect, it } from 'vitest';
import {
  debugEnabled,
  rendererPreference,
  seedOverride,
} from '../../../src/platform/CapabilityProbe.ts';

describe('rendererPreference', () => {
  it('prefers automatic WebGL with Canvas fallback by default', () => {
    expect(rendererPreference('')).toBe('auto');
    expect(rendererPreference('?debug=1')).toBe('auto');
  });

  it('forces the Canvas path for verification', () => {
    expect(rendererPreference('?renderer=canvas')).toBe('canvas');
  });

  it('ignores unknown values instead of failing', () => {
    expect(rendererPreference('?renderer=webgpu')).toBe('auto');
  });
});

describe('debugEnabled', () => {
  it('is opt-in through the query string only', () => {
    expect(debugEnabled('')).toBe(false);
    expect(debugEnabled('?debug=0')).toBe(false);
    expect(debugEnabled('?debug=1')).toBe(true);
  });
});

describe('seedOverride', () => {
  it('is absent unless the page URL names a world', () => {
    expect(seedOverride('')).toBeUndefined();
    expect(seedOverride('?debug=1')).toBeUndefined();
  });

  it('accepts every non-negative 32-bit seed (doc 04 §3)', () => {
    expect(seedOverride('?seed=0')).toBe(0);
    expect(seedOverride('?seed=123')).toBe(123);
    expect(seedOverride('?debug=1&seed=4294967295')).toBe(4294967295);
  });

  it('ignores values that are not a plain 32-bit decimal', () => {
    for (const value of [
      '',
      '-1',
      '4294967296',
      '12.5',
      '1e3',
      '0x10',
      ' 7',
      'abc',
      '99999999999999999999',
    ]) {
      expect(
        seedOverride(`?seed=${encodeURIComponent(value)}`),
      ).toBeUndefined();
    }
  });
});
