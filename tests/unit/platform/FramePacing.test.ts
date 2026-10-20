import { expect, it } from 'vitest';
import { FramePacing } from '../../../src/platform/FrameStats.ts';

it('keeps frames and causal events ordered after wrap, counts whole-ride stalls and estimates their period', () => {
  const pacing = new FramePacing(8);
  let time = 0;
  for (let i = 0; i < 30; i++) {
    const interval = i % 5 === 4 ? 120 : 20;
    time += interval;
    pacing.begin(time, interval);
    pacing.phase('audio', 2);
    pacing.phase('trackChunks', 7);
    pacing.event('chunkCreated', time + 1, 6, i);
    pacing.end(12, 2, i === 29 ? 0.1 : 0);
  }
  const sample = pacing.snapshot();
  expect(sample.summary).toMatchObject({
    frames: 30,
    overMedian: 6,
    over50: 6,
    over100: 6,
    medianGapMs: 200,
    medianGapFrames: 5,
  });
  expect(sample.frames.map((f) => f[0])).toEqual([
    22, 23, 24, 25, 26, 27, 28, 29,
  ]);
  expect(sample.frames.at(-1)?.slice(2, 6)).toEqual([120, 12, 2, 0.1]);
  expect(sample.events.at(-1)?.slice(0, 3)).toEqual([29, 1201, 6]);
});

it('records phase sums, resets whole-ride counters and bounds the event ring independently', () => {
  const p = new FramePacing(2);
  p.begin(20, 20);
  p.phase('save', 3);
  p.phase('save', 2);
  p.end(8, 1, 0);
  expect(p.snapshot().frames[0]?.[12]).toBe(5);
  for (let i = 0; i < 300; i++) p.event('save', i, 2);
  expect(p.snapshot().events).toHaveLength(256);
  expect(p.snapshot().events[0]?.[1]).toBe(44);
  p.reset();
  expect(p.snapshot().summary.frames).toBe(0);
  expect(p.snapshot().events).toEqual([]);
  expect(p.snapshot().frames).toEqual([]);
});

it('estimates long-frame period in active ride time across a pause', () => {
  const p = new FramePacing();
  let time = 0;
  for (let i = 0; i < 15; i++) {
    if (i === 5 || i === 10) time += 10000;
    const interval = i % 5 === 4 ? 120 : 20;
    time += interval;
    p.begin(time, interval);
    p.end(1, 1, 0);
  }
  expect(p.snapshot().summary.medianGapMs).toBe(200);
});

it('retains whole-ride render bounds without sampling the full snapshot', () => {
  const p = new FramePacing();
  p.observeScene(12, 7);
  p.observeScene(11, 8);
  p.observeScene(12, 6);
  expect(p.snapshot().summary).toMatchObject({
    minRenderedVehicles: 11,
    maxLiveChunks: 8,
  });
  p.reset();
  expect(p.snapshot().summary).toMatchObject({
    minRenderedVehicles: undefined,
    maxLiveChunks: 0,
  });
});

it('exports dropped simulation seconds without rounding away a fraction of a step', () => {
  const p = new FramePacing();
  p.begin(100, 100);
  p.end(2, 5, 1 / 60);
  expect(p.snapshot().frames[0]?.[5]).toBe(1 / 60);
});
