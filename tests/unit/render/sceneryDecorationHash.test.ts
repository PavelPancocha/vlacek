import { expect, it } from 'vitest';
import { hash32 } from '../../../src/domain/world/Hash.ts';
import { sceneryDecorationHash } from '../../../src/render/sceneryDecorationHash.ts';
it('seed 2 chunk 288: a mill channel clipped at a fractional bank still has deterministic baked details', () => {
  const value = () => sceneryDecorationHash('glint', 288, 508.2504011598732, 0);
  expect(value).not.toThrow();
  expect(value()).toBe(value());
  expect(value()).not.toBe(
    sceneryDecorationHash('glint', 288, 508.2504011598733, 0),
  );
});
it('keeps released integer keys and rejects non-finite coordinates', () => {
  expect(sceneryDecorationHash('glint', 4, 128, 0)).toBe(
    hash32('glint', 4, 128, 0),
  );
  for (const from of [NaN, Infinity, -Infinity])
    expect(() => sceneryDecorationHash('glint', 4, from, 0)).toThrow();
});
