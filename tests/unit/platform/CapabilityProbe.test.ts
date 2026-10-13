import { describe, expect, it } from 'vitest';
import {
  debugEnabled,
  devReloadUrl,
  qualityOverride,
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

describe('qualityOverride', () => {
  it('accepts low, standard and auto for this page load', () => {
    for (const value of ['low', 'standard', 'auto'] as const)
      expect(qualityOverride(`?quality=${value}`)).toBe(value);
  });
  it('ignores rubbish and missing values', () => {
    for (const search of ['', '?debug=1', '?quality=', '?quality=HIGH'])
      expect(qualityOverride(search)).toBeUndefined();
  });
});

describe('developer precedence: valid address, stored option, default', () => {
  const stored = { debug: true, renderer: 'canvas', seed: 123 } as const;
  it('uses the store when the option is absent or invalid', () => {
    for (const search of ['', '?debug=bad&renderer=bad&seed=bad']) {
      expect(debugEnabled(search, stored)).toBe(true);
      expect(rendererPreference(search, stored)).toBe('canvas');
      expect(seedOverride(search, stored)).toBe(123);
    }
  });
  it('explicit URL defaults also win over stored developer values', () => {
    expect(debugEnabled('?debug=0', stored)).toBe(false);
    expect(rendererPreference('?renderer=auto', stored)).toBe('auto');
    expect(seedOverride('?seed=0', stored)).toBe(0);
    expect(seedOverride('?seed=456', stored)).toBe(456);
    expect(debugEnabled('?debug=1', { ...stored, debug: false })).toBe(true);
  });
});

it('apply removes all developer URL values and keeps the base path, other values and hash', () => {
  expect(
    devReloadUrl(
      'https://example.test/vlacek/?debug=1&renderer=canvas&quality=low&seed=123&debug=0&keep=yes&keep=two#here',
    ),
  ).toBe('https://example.test/vlacek/?keep=yes&keep=two#here');
});

it('quality resolves the saved setting after a missing or ignored address value', () => {
  expect(qualityOverride('', 'low')).toBe('low');
  expect(qualityOverride('?quality=bad', 'standard')).toBe('standard');
  expect(qualityOverride('?quality=auto', 'low')).toBe('auto');
});
