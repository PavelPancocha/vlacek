import { describe, expect, it } from 'vitest';
import {
  CooldownGate,
  ObjectReactions,
} from '../../../src/domain/interaction/Cooldowns.ts';

describe('ObjectReactions', () => {
  it('INP-05: one reaction per cooldown, regardless of repeated activation', () => {
    const reactions = new ObjectReactions(90);
    expect(reactions.activate('g0:chunk:1:object:0', 100)).toBe(true);
    expect(reactions.activate('g0:chunk:1:object:0', 150)).toBe(false);
    expect(reactions.activatedTick('g0:chunk:1:object:0')).toBe(100);
    expect(reactions.activate('g0:chunk:1:object:0', 190)).toBe(true);
  });

  it('tracks objects independently', () => {
    const reactions = new ObjectReactions(90);
    expect(reactions.activate('a', 0)).toBe(true);
    expect(reactions.activate('b', 1)).toBe(true);
  });

  it('forgets finished reactions and whole chunks (bounded memory)', () => {
    const reactions = new ObjectReactions(90);
    reactions.activate('g0:chunk:1:object:0', 0);
    reactions.activate('g0:chunk:2:object:0', 0);
    reactions.prune(10);
    expect(reactions.size).toBe(2);
    reactions.forgetChunk(1);
    expect(reactions.size).toBe(1);
    reactions.prune(90);
    expect(reactions.size).toBe(0);
  });
});

describe('CooldownGate (horn)', () => {
  it('allows the horn at most once per interval', () => {
    const horn = new CooldownGate(42);
    expect(horn.tryPass(0)).toBe(true);
    expect(horn.tryPass(41)).toBe(false);
    expect(horn.tryPass(42)).toBe(true);
  });
});
