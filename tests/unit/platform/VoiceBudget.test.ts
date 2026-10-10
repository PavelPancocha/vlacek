import { describe, expect, it } from 'vitest';
import { VoiceBudget } from '../../../src/platform/VoiceBudget.ts';

describe('VoiceBudget (doc 07 §6)', () => {
  it('allows at most five one-shots and three loops, eight in total', () => {
    const budget = new VoiceBudget({
      maxVoices: 8,
      maxLoopVoices: 3,
      maxOneShotVoices: 5,
    });
    const oneShots = Array.from({ length: 6 }, () => budget.acquire('oneShot'));
    expect(oneShots.filter(Boolean)).toHaveLength(5);
    const loops = Array.from({ length: 4 }, () => budget.acquire('loop'));
    expect(loops.filter(Boolean)).toHaveLength(3);
    expect(budget.active).toBe(8);
  });

  it('frees a voice when it ends', () => {
    const budget = new VoiceBudget({
      maxVoices: 8,
      maxLoopVoices: 3,
      maxOneShotVoices: 1,
    });
    expect(budget.acquire('oneShot')).toBe(true);
    expect(budget.acquire('oneShot')).toBe(false);
    budget.release('oneShot');
    expect(budget.acquire('oneShot')).toBe(true);
  });
});
