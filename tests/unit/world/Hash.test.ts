import { describe, expect, it } from 'vitest';
import { hash32, unitRandom } from '../../../src/domain/world/Hash.ts';

describe('hash32 (doc 04 §3)', () => {
  it('matches the doc 11 reference values', () => {
    expect(hash32(123456, 1, 'terrain-boundary', 0)).toBe(2052965658);
    expect(hash32(123456, 1, 'terrain-boundary', -1)).toBe(3405464579);
    expect(hash32(0, 1, 'route-template', 0)).toBe(2985350705);
    expect(hash32(4294967295, 1, 'tree-position', 9999)).toBe(3781884757);
  });

  it('maps to [0, 1) for unitRandom', () => {
    for (let k = -500; k < 500; k++) {
      const value = unitRandom(7, 0, 'terrain-boundary', k);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('rejects numbers that are not safe integers instead of colliding', () => {
    expect(() => hash32(1, Number.NaN)).toThrow(RangeError);
    expect(() => hash32(1, 0.5)).toThrow(RangeError);
    expect(() => hash32(1, Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
