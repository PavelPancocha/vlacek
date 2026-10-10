import { describe, expect, it } from 'vitest';
import { formatBuildId, normalizeBasePath } from '../../scripts/build-info.ts';

describe('formatBuildId', () => {
  it('joins version and short commit as SemVer build metadata', () => {
    expect(
      formatBuildId('0.1.0', 'f8ae2b611276b9c33f204f7e5609b138f8170015'),
    ).toBe('0.1.0+f8ae2b6');
  });

  it('marks builds from a dirty working tree', () => {
    expect(formatBuildId('0.1.0', 'f8ae2b6111', { dirty: true })).toBe(
      '0.1.0+f8ae2b6.dirty',
    );
  });

  it('stays identifiable without Git metadata', () => {
    expect(formatBuildId('0.1.0', undefined)).toBe('0.1.0+nogit');
  });
});

describe('normalizeBasePath', () => {
  it('defaults to the domain root', () => {
    expect(normalizeBasePath(undefined)).toBe('/');
    expect(normalizeBasePath('')).toBe('/');
  });

  it('accepts a project subdirectory with or without slashes', () => {
    expect(normalizeBasePath('/vlacek')).toBe('/vlacek/');
    expect(normalizeBasePath('vlacek/')).toBe('/vlacek/');
    expect(normalizeBasePath('/a/b/')).toBe('/a/b/');
  });

  it('rejects URLs and path traversal', () => {
    expect(() => normalizeBasePath('https://example.com/')).toThrow();
    expect(() => normalizeBasePath('/../x/')).toThrow();
    expect(() => normalizeBasePath('/a b/')).toThrow();
  });
});
