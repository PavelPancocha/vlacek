import { expect, it } from 'vitest';
import { summarizeTraceGc } from '../../e2e/perfTrace.ts';
import { markers, rendererTrace } from '../../fixtures/perf/renderer-trace.ts';

it('attributes GC to the marked game page CrRendererMain, with worker GC separate', () => {
  const result = summarizeTraceGc(rendererTrace, markers);
  expect(result.renderer).toMatchObject({ count: 2, totalMs: 5, maxMs: 3 });
  expect(result.workers).toMatchObject({ count: 2, totalMs: 5, maxMs: 4 });
});

it('clips GC to the exact marked window, excluding setup and extraction on both threads', () => {
  const events = [
    ...rendererTrace,
    { ph: 'X', name: 'MinorGC', pid: 1, tid: 10, ts: 1_000, dur: 2_000 },
    { ph: 'X', name: 'MinorGC', pid: 1, tid: 10, ts: 9_000, dur: 2_000 },
    { ph: 'X', name: 'MajorGC', pid: 1, tid: 10, ts: 29_000, dur: 4_000 },
    { ph: 'X', name: 'MajorGC', pid: 1, tid: 10, ts: 30_000, dur: 5_000 },
    { ph: 'X', name: 'MinorGC', pid: 1, tid: 11, ts: 2_000, dur: 2_000 },
    { ph: 'X', name: 'MinorGC', pid: 1, tid: 11, ts: 29_000, dur: 2_000 },
  ];
  const result = summarizeTraceGc(events, markers);
  expect(result.window).toEqual({
    startUs: 10_000,
    endUs: 30_000,
    durationMs: 20,
  });
  expect(result.renderer).toMatchObject({ count: 4, totalMs: 7, maxMs: 3 });
  expect(result.workers).toMatchObject({ count: 3, totalMs: 6, maxMs: 4 });
});

it('rejects missing, duplicate, cross-thread or reversed boundaries instead of guessing a page', () => {
  expect(() => summarizeTraceGc([], markers)).toThrow('start mark');
  expect(() =>
    summarizeTraceGc([...rendererTrace, rendererTrace[4]], markers),
  ).toThrow('start mark');
  expect(() =>
    summarizeTraceGc(
      rendererTrace.filter((e) => e.name !== markers.end),
      markers,
    ),
  ).toThrow('end mark');
  for (const change of [{ pid: 9, tid: 90 }, { ts: 1_000 }]) {
    const events = rendererTrace.map((e) =>
      e.name === markers.end ? { ...e, ...change } : e,
    );
    expect(() => summarizeTraceGc(events, markers)).toThrow('end mark');
  }
  const workerMarks = rendererTrace.map((e) =>
    e.name === markers.start || e.name === markers.end ? { ...e, tid: 11 } : e,
  );
  expect(() => summarizeTraceGc(workerMarks, markers)).toThrow(
    'CrRendererMain',
  );
});
