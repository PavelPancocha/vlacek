import { describe, expect, it } from 'vitest';
import {
  TUNNEL_SEE_THROUGH_ALPHA,
  easeAlpha,
  nextCoverAlpha,
  trainInTunnel,
  tunnelCoverTarget,
} from '../../../src/render/tunnelCover.ts';

const tunnel = { fromX: 1000, toX: 1448 };

describe('tunnel cover (doc 14 §2, doc 03 §8)', () => {
  it('turns see-through while any part of the train is in or at the tunnel, opaque otherwise', () => {
    expect(tunnelCoverTarget({ minX: 0, maxX: 600 }, tunnel)).toBe(1);
    expect(tunnelCoverTarget({ minX: 1800, maxX: 2400 }, tunnel)).toBe(1);
    // The front reaches the portal: the child sees the train go in.
    expect(tunnelCoverTarget({ minX: 400, maxX: 950 }, tunnel)).toBe(
      TUNNEL_SEE_THROUGH_ALPHA,
    );
    // Only the last wagon still inside.
    expect(tunnelCoverTarget({ minX: 1400, maxX: 2000 }, tunnel)).toBe(
      TUNNEL_SEE_THROUGH_ALPHA,
    );
    expect(TUNNEL_SEE_THROUGH_ALPHA).toBeLessThan(0.5);
    expect(TUNNEL_SEE_THROUGH_ALPHA).toBeGreaterThan(0);
  });

  it('fades smoothly, in simulation time, and holds still at zero time', () => {
    expect(easeAlpha(1, 0.3, 0)).toBe(1);
    let alpha = 1;
    const steps: number[] = [];
    for (let i = 0; i < 60; i++) {
      alpha = easeAlpha(alpha, 0.3, 1 / 60);
      steps.push(alpha);
    }
    // Half a second gets most of the way; no single frame jumps.
    expect(steps[29] ?? 1).toBeLessThan(0.45);
    for (let i = 1; i < steps.length; i++)
      expect((steps[i - 1] ?? 1) - (steps[i] ?? 1)).toBeLessThan(0.08);
    expect(steps.at(-1) ?? 1).toBeGreaterThanOrEqual(0.3);
  });

  it('tells whether the train is outside, partly or wholly inside (TRN-06)', () => {
    expect(trainInTunnel({ minX: 0, maxX: 1000 }, tunnel)).toBe('outside');
    expect(trainInTunnel({ minX: 1448, maxX: 1900 }, tunnel)).toBe('outside');
    expect(trainInTunnel({ minX: 700, maxX: 1100 }, tunnel)).toBe('partly');
    expect(trainInTunnel({ minX: 1400, maxX: 1800 }, tunnel)).toBe('partly');
    expect(trainInTunnel({ minX: 1000, maxX: 1448 }, tunnel)).toBe('inside');
    expect(trainInTunnel({ minX: 1100, maxX: 1300 }, tunnel)).toBe('inside');
  });

  it('starts at its target, so a restored train inside is never hidden', () => {
    // First frame of a restored, paused journey: no time passes.
    expect(nextCoverAlpha(undefined, TUNNEL_SEE_THROUGH_ALPHA, 0)).toBe(
      TUNNEL_SEE_THROUGH_ALPHA,
    );
    expect(nextCoverAlpha(undefined, 1, 0)).toBe(1);
    // Later frames ease as before.
    expect(nextCoverAlpha(1, TUNNEL_SEE_THROUGH_ALPHA, 0)).toBe(1);
    expect(nextCoverAlpha(1, TUNNEL_SEE_THROUGH_ALPHA, 1 / 60)).toBeLessThan(1);
  });
});
