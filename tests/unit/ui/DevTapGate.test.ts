import { expect, it } from 'vitest';
import { devTap, type DevTapState } from '../../../src/ui/DevTapGate.ts';

it('UI-07: four activations do not open, the fifth within 3 s opens and resets', () => {
  let state: DevTapState = { count: 0, startMs: 0 };
  for (const nowMs of [100, 500, 1000, 2000]) {
    const next = devTap(state, nowMs);
    expect(next.open).toBe(false);
    state = next;
  }
  const fifth = devTap(state, 3100);
  expect(fifth.open).toBe(true);
  expect(fifth.count).toBe(0);
  expect(devTap(fifth, 3101)).toMatchObject({ count: 1, open: false });
});

it('slow activations reset the whole window, not just the interval between taps', () => {
  let state: DevTapState = { count: 0, startMs: 0 };
  for (const nowMs of [0, 1000, 2000, 3001, 4000]) {
    const next = devTap(state, nowMs);
    expect(next.open).toBe(false);
    state = next;
  }
  expect(state.count).toBe(2);
});
