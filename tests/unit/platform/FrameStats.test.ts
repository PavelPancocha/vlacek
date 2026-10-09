import { describe, expect, it } from 'vitest';
import { FrameStats } from '../../../src/platform/FrameStats.ts';

describe('FrameStats', () => {
  it('reports median FPS and 95th percentile frame time over a bounded window', () => {
    const stats = new FrameStats(100);
    for (let i = 0; i < 95; i++) stats.add(1000 / 60);
    for (let i = 0; i < 5; i++) stats.add(50);
    const summary = stats.summary();
    expect(summary.samples).toBe(100);
    expect(summary.medianFps).toBeCloseTo(60, 5);
    expect(summary.p95FrameMs).toBeCloseTo(1000 / 60, 5);
    expect(summary.worstFrameMs).toBe(50);
    stats.add(16);
    expect(stats.summary().samples).toBe(100);
  });

  it('is empty-safe and ignores invalid frame times', () => {
    const stats = new FrameStats(10);
    stats.add(Number.NaN);
    stats.add(-1);
    expect(stats.summary()).toEqual({
      samples: 0,
      medianFps: 0,
      p95FrameMs: 0,
      worstFrameMs: 0,
    });
  });
});
