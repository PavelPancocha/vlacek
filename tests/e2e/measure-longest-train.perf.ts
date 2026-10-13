import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { longestMixedConsist } from './perfConsist.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

const SECONDS = Number(process.env['PERF_SECONDS'] ?? 60);
/** Locomotive of the measured train; `electric_retro` adds the catenary. */
const LOCOMOTIVE = process.env['PERF_LOCOMOTIVE'] ?? 'steam_local';
/** Repeated wagon type; unset preserves the default mixed train. */
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
    const frames: number[] = [];
    (window as unknown as { __frames: number[] }).__frames = frames;
    let last = performance.now();
    const loop = (now: number) => {
      frames.push(now - last);
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
  await page.evaluate(() =>
    (window as unknown as { __frames: number[] }).__frames.splice(0),
  );
  await page.mouse.move(700, 300);
  await page.mouse.down();
  let maxLiveChunks = 0;
  // The fewest vehicles drawn on any sample: one culled frame shows here.
  let minRendered = Infinity;
  for (let second = 0; second < SECONDS; second++) {
    await page.waitForTimeout(1000);
    const state = await snapshot(page);
    maxLiveChunks = Math.max(maxLiveChunks, state.liveChunks);
    minRendered = Math.min(minRendered, state.renderedVehicles);
  }
  await page.mouse.up();
  const final = await snapshot(page);
  const frames = (
    await page.evaluate(
      () => (window as unknown as { __frames: number[] }).__frames,
    )
  ).sort((a, b) => a - b);
  const at = (q: number) =>
    frames[Math.min(frames.length - 1, Math.floor(q * (frames.length - 1)))] ??
    0;
  const result = {
    environment: `${browserName} headless, ${process.platform}, viewport 1280x720 (emulation, not a target device)`,
    buildId: final.buildId,
    renderer: final.renderer,
    seconds: SECONDS,
    vehicles: final.vehicles,
    minRenderedVehicles: minRendered,
    maxLiveChunks,
    headChunkAtEnd: final.headChunk,
    frames: frames.length,
    medianFrameMs: at(0.5),
    medianFps: 1000 / at(0.5),
    p95FrameMs: at(0.95),
    worstFrameMs: frames.at(-1) ?? 0,
    errors,
  };
  const path = testInfo.outputPath('perf-longest-train.json');
  writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  expect(errors).toEqual([]);
  expect(final.vehicles).toBe(consist.wagons.length + 1);
  // The whole train is drawn on every sampled second (doc 14 §2).
  expect(minRendered).toBe(final.vehicles);
  expect(final.trackStartS).toBeLessThanOrEqual(final.tailS);
  expect(maxLiveChunks).toBeLessThanOrEqual(30);
});
