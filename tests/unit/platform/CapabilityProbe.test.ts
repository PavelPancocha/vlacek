import { describe, expect, it } from 'vitest';
import {
  debugEnabled,
  rendererPreference,
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
