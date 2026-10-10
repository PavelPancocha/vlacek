import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { snapshot, tapAction } from './helpers.ts';

const SECONDS = Number(process.env['PERF_SECONDS'] ?? 60);
const WAGON_TYPES = [
  'passenger_classic',
  'passenger_open',
  'cargo_box',
  'cargo_coal',
  'cargo_container',
  'service_crane',
  'fun_balloons',
];

/**
 * PERF-01 (lite): 100 wagons restored from a v1 save, held throttle for
 * PERF_SECONDS (default 60). Records frame times with an independent rAF
 * probe. Results are a measurement of this machine, not of target devices.
 */
test('measure a ride with 100 wagons', async ({
  page,
  browserName,
}, testInfo) => {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: Array.from({ length: 100 }, (_, i) => ({
      instanceId: `w${i + 1}`,
      definitionId: WAGON_TYPES[i % WAGON_TYPES.length] ?? 'cargo_box',
      visualSeed: i,
    })),
  };
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
      generatorVersion: 0,
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
  let maxRendered = 0;
  for (let second = 0; second < SECONDS; second++) {
    await page.waitForTimeout(1000);
    const state = await snapshot(page);
    maxLiveChunks = Math.max(maxLiveChunks, state.liveChunks);
    maxRendered = Math.max(maxRendered, state.renderedVehicles);
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
    maxRenderedVehicles: maxRendered,
    maxLiveChunks,
    headChunkAtEnd: final.headChunk,
    frames: frames.length,
    medianFps: 1000 / at(0.5),
    p95FrameMs: at(0.95),
    worstFrameMs: frames.at(-1) ?? 0,
    errors,
  };
  const path = testInfo.outputPath('perf-100-wagons.json');
  writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  expect(errors).toEqual([]);
  expect(final.vehicles).toBe(101);
  expect(final.trackStartS).toBeLessThanOrEqual(final.tailS);
  expect(maxLiveChunks).toBeLessThanOrEqual(30);
});
