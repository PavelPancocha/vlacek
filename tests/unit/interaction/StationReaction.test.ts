import { expect, it } from 'vitest';
import { StationReaction } from '../../../src/domain/interaction/StationReaction.ts';
it('SCN-ST06: a single actor greets once, detects a voluntary stop at 4 u/s / 0.5 s, and respects 12 s cooldown', () => {
  const reaction = new StationReaction(1000, 3368, 60, 4, 0.5, 12);
  expect(reaction.step(0, 0, 100)).toBeUndefined();
  expect(reaction.step(1, 400, 100)).toBe(0);
  expect(reaction.step(61, 1100, 100)).toBe(1);
  expect(reaction.step(121, 1500, 100)).toBeUndefined();
  reaction.step(200, 1500, 4);
  reaction.step(720, 1500, 4);
  expect(reaction.step(721, 1500, 3.9)).toBeUndefined();
  expect(reaction.step(750, 1500, 3.9)).toBeUndefined();
  expect(reaction.step(751, 1500, 3.9)).toBe(0);
  expect(reaction.step(900, 1500, 0)).toBeUndefined();
  expect(reaction.step(1500, 1500, 0)).toBeUndefined();
  // Starting to move is never held by a reaction; after a new stop it may react again.
  reaction.step(1510, 1500, 5);
  reaction.step(1511, 1500, 0);
  expect(reaction.step(1541, 1500, 0)).toBe(0);
});
