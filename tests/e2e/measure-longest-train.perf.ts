import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { summarizeTraceGc } from './perfTrace.ts';
import { longestMixedConsist } from './perfConsist.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction, waitForRideStart } from './helpers.ts';

const SECONDS = Number(process.env['PERF_SECONDS'] ?? 60);
/** Locomotive of the measured train; `electric_retro` adds the catenary. */
const LOCOMOTIVE = process.env['PERF_LOCOMOTIVE'] ?? 'steam_local';
/** Repeated wagon type; unset preserves the default mixed train. */
const CPU_RATE = Number(process.env['PERF_CPU_RATE'] ?? 1);
const TRACE = process.env['PERF_TRACE'] === '1';
const WAGON = process.env['PERF_WAGON'];

/**
 * PERF-01 (lite): the longest allowed train (doc 14 §2) restored from a v1
 * save, held throttle for PERF_SECONDS (default 60). Records frame times
 * with an independent rAF probe. Results are a measurement of this machine,
 * not of target devices.
 */
test('measure a ride with the longest allowed train', async ({
  page,
  browserName,
}, testInfo) => {
  const consist = longestMixedConsist(LOCOMOTIVE, WAGON);
  const save = {
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-09T00:00:00.000Z',
    appBuildId: 'perf-fixture',
    settings: {
      sfxEnabled: false,
      musicEnabled: false,
      reducedEffects: false,
      maxSpeedFactor: 1,
      quality: 'auto',
    },
    lastConsist: consist,
    journey: {
      seed: 20261009,
      generatorVersion: TRACK_GENERATOR_VERSION,
      consist,
      head: { chunkIndex: 0, arcOffsetU: 512 },
      simulationTick: 0,
      activeEntities: [],
    },
  };
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('perf-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('perf-seeded', '1');
    }
    const probe = {
      frames: new Float64Array(120 * 240),
      count: 0,
      active: false,
      startMs: 0,
      endMs: 0,
    };
    Object.assign(window, { __frameProbe: probe });
    let last = 0;
    const loop = (now: number) => {
      if (
        probe.active &&
        last >= probe.startMs &&
        probe.count < probe.frames.length
      )
        probe.frames[probe.count++] = now - last;
      last = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, JSON.stringify(save));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  // D-030 publishes the restored ride under the curtain; measure from its
  // first presented frame (owner decision 2026-10-16, 15 s start bound).
  await waitForRideStart(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
  const { frameTree } = await cdp.send('Page.getFrameTree');
  // These unique marks are emitted only in this CDP page's main JS context.
  const markers = {
    start: `vlacek-perf:${frameTree.frame.id}:start`,
    end: `vlacek-perf:${frameTree.frame.id}:end`,
  };
  const traceEvents: unknown[] = [];
  cdp.on('Tracing.dataCollected', (data) => traceEvents.push(...data.value));
  if (TRACE)
    await cdp.send('Tracing.start', {
      categories:
        'v8,disabled-by-default-v8.gc,devtools.timeline,blink.user_timing',
      transferMode: 'ReportEvents',
    });
  const startMs = await page.evaluate((mark) => {
    const probe = (
      window as unknown as {
        __frameProbe: { active: boolean; count: number; startMs: number };
      }
    ).__frameProbe;
    probe.count = 0;
    const now = performance.now();
    probe.startMs = now;
    probe.active = true;
    performance.mark(mark, { startTime: now });
    return now;
  }, markers.start);
  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.waitForTimeout(SECONDS * 1000);
  const endMs = await page.evaluate((mark) => {
    const p = (
      window as unknown as { __frameProbe: { active: boolean; endMs: number } }
    ).__frameProbe;
    const now = performance.now();
    p.active = false;
    p.endMs = now;
    performance.mark(mark, { startTime: now });
    return now;
  }, markers.end);
  if (TRACE) {
    const complete = new Promise<void>((resolve) =>
      cdp.once('Tracing.tracingComplete', () => resolve()),
    );
    await cdp.send('Tracing.end');
    await complete;
  }
  // Copy only after both sampling and tracing are closed: extraction GC is excluded.
  const frames = await page.evaluate(() => {
    const p = (
      window as unknown as {
        __frameProbe: { count: number; frames: Float64Array };
      }
    ).__frameProbe;
    return Array.from(p.frames.subarray(0, p.count));
  });
  await page.mouse.up();
  const final = await snapshot(page);
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ??
    0;
  const gapsMs: number[] = [],
    gapsFrames: number[] = [];
  let lastLongFrame = -1,
    lastLongMs = 0,
    timeMs = 0,
    overMedian = 0;
  for (let i = 0; i < frames.length; i++) {
    timeMs += frames[i] ?? 0;
    if ((frames[i] ?? 0) <= at(0.5) * 1.5) continue;
    overMedian++;
    if (lastLongFrame >= 0) {
      gapsMs.push(timeMs - lastLongMs);
      gapsFrames.push(i - lastLongFrame);
    }
    lastLongFrame = i;
    lastLongMs = timeMs;
  }
  const median = (values: number[]) =>
    values.sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)] ?? 0;
  const traceGc = TRACE ? summarizeTraceGc(traceEvents, markers) : undefined;
  if (traceGc)
    expect(traceGc.window.durationMs).toBeCloseTo(endMs - startMs, 1);
  const pacing = 'framePacing' in final ? final.framePacing : undefined;
  const minRendered =
    pacing?.summary.minRenderedVehicles ?? final.renderedVehicles;
  const maxLiveChunks = pacing?.summary.maxLiveChunks ?? final.liveChunks;
  const result = {
    environment: `${browserName} headless, ${process.platform}, viewport 1280x720 (emulation, not a target device)`,
    buildId: final.buildId,
    renderer: final.renderer,
    seconds: SECONDS,
    vehicles: final.vehicles,
    renderedVehiclesAtEnd: final.renderedVehicles,
    minRenderedVehicles: minRendered,
    maxLiveChunks,
    liveChunksAtEnd: final.liveChunks,
    headChunkAtEnd: final.headChunk,
    frames: frames.length,
    medianFrameMs: at(0.5),
    medianFps: 1000 / at(0.5),
    p95FrameMs: at(0.95),
    worstFrameMs: sorted.at(-1) ?? 0,
    cpuThrottle: CPU_RATE,
    longFrames: {
      overMedian,
      over50: frames.filter((f) => f > 50).length,
      over100: frames.filter((f) => f > 100).length,
      medianGapMs: median(gapsMs),
      medianGapFrames: median(gapsFrames),
    },
    samplingWindow: {
      startMs,
      endMs,
      durationMs: endMs - startMs,
      pageUrl: page.url(),
      pageFrameId: frameTree.frame.id,
      markers,
      trace: traceGc?.window,
      rendererThread: traceGc?.rendererThread,
    },
    gc: traceGc?.renderer,
    // All worker-named threads in this trace, never mixed into renderer GC.
    workerGc: traceGc?.workers,
    framePacing: pacing,
    intervalsMs: frames,
    errors,
  };
  const path = testInfo.outputPath('perf-longest-train.json');
  writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      { ...result, framePacing: undefined, intervalsMs: undefined },
      null,
      2,
    ),
  );
  if (TRACE)
    writeFileSync(
      testInfo.outputPath('trace.json'),
      JSON.stringify({ traceEvents }),
    );
  expect(errors).toEqual([]);
  expect(final.vehicles).toBe(consist.wagons.length + 1);
  // New builds collect per-frame bounds without snapshot polling (doc 14 §2).
  expect(minRendered).toBe(final.vehicles);
  expect(final.trackStartS).toBeLessThanOrEqual(final.tailS);
  expect(maxLiveChunks).toBeLessThanOrEqual(30);
});
