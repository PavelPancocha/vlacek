import { afterEach, expect, it, vi } from 'vitest';
import {
  PerformanceProbe,
  observeLongTasks,
} from '../../../src/platform/PerformanceProbe.ts';

it('records navigation, request, first presented frame and complete art independently', () => {
  let now = 200;
  const probe = new PerformanceProbe(() => now);
  probe.markStartInteractive();
  now = 500;
  probe.requestRide();
  now = 800;
  probe.presented(false, false);
  now = 900;
  probe.presented(true, true);
  now = 1000;
  probe.presented(true, true);
  expect(probe.snapshot()).toMatchObject({
    startInteractiveMs: 200,
    ride: {
      requestedAtMs: 500,
      firstFrameMs: 300,
      artReadyMs: 400,
      ridingAtMs: 900,
    },
  });
});

it('sums successful SVG fetch/decode and atlas CPU stages without double counting', () => {
  let now = 100;
  const probe = new PerformanceProbe(() => now);
  probe.svgFetched('a', 12);
  probe.svgFetched('b', 8);
  now = 130;
  probe.svgDecoded('a');
  now = 140;
  probe.svgDecoded('b');
  probe.svgDecoded('a');
  probe.atlas(25, 5);
  probe.atlas(10, 2);
  expect(probe.snapshot()).toMatchObject({
    svg: { fetchCount: 2, fetchMs: 20, decodeCount: 2, decodeMs: 70 },
    atlas: { count: 2, packRasterMs: 28, uploadMs: 7 },
  });
});

it('bounds chunk samples and counts only >50 ms tasks starting in the first 15 s of riding', () => {
  let now = 100;
  const probe = new PerformanceProbe(() => now);
  probe.requestRide();
  probe.presented(true, false);
  probe.longTask(110, 80);
  now = 1000;
  probe.presented(true, true);
  for (let i = 0; i < 20; i++) {
    probe.chunk(i, 'generation', 2);
    probe.chunk(i, 'bake', 4);
  }
  probe.longTask(1000, 50);
  probe.longTask(999, 70);
  probe.longTask(1050, 60);
  probe.longTask(15999, 80);
  probe.longTask(16000, 90);
  const first = probe.snapshot();
  expect(first).toMatchObject({
    chunks: Array.from({ length: 12 }, (_, index) => ({
      index,
      generationMs: 2,
      bakeMs: 4,
    })),
    longTasks: { supported: false, count: 2, totalMs: 140, maxMs: 80 },
  });
  // Reports are detached; consumers cannot alter the next sample.
  expect(probe.snapshot()).toEqual(first);
});

it('restarts the ride window without resetting boot and catalogue totals', () => {
  let now = 20;
  const probe = new PerformanceProbe(() => now);
  probe.markStartInteractive();
  probe.svgFetched('a', 2);
  now = 30;
  probe.svgDecoded('a');
  probe.requestRide();
  probe.presented(true, true);
  probe.chunk(0, 'bake', 4);
  probe.longTask(40, 70);
  now = 100;
  probe.requestRide();
  expect(probe.snapshot()).toMatchObject({
    startInteractiveMs: 20,
    svg: { fetchCount: 1, decodeCount: 1 },
    ride: {
      requestedAtMs: 100,
      firstFrameMs: undefined,
      artReadyMs: undefined,
      ridingAtMs: undefined,
    },
    chunks: [],
    longTasks: { count: 0, totalMs: 0, maxMs: 0 },
  });
  const sample = probe.snapshot();
  sample.svg.fetchCount = 99;
  expect(probe.snapshot().svg.fetchCount).toBe(1);
});

afterEach(() => vi.unstubAllGlobals());

it('disconnects the browser observer and supports browsers without Long Tasks API', () => {
  const probe = new PerformanceProbe(() => 100);
  vi.stubGlobal('PerformanceObserver', undefined);
  expect(() => observeLongTasks(probe)()).not.toThrow();
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = ['longtask'];
      disconnect = disconnect;
      observe = observe;
    },
  );
  const stop = observeLongTasks(probe);
  expect(observe).toHaveBeenCalledWith({ type: 'longtask', buffered: true });
  expect(probe.snapshot().longTasks.supported).toBe(true);
  stop();
  expect(disconnect).toHaveBeenCalledOnce();
});
