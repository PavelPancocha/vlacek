import { expect, test, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { parseSave, saveRules } from '../../src/platform/SaveValidation.ts';
import { driveUntilMoving, snapshot, startRide, tapAction } from './helpers.ts';

/** Observe rendered frames, rather than waiting for a fixed wall-clock time. */
async function frames(page: Page, count = 30): Promise<DebugSnapshot[]> {
  return page.evaluate(async (count) => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    const states: DebugSnapshot[] = [];
    for (let i = 0; i < count; i++) {
      await new Promise(requestAnimationFrame);
      states.push(api.snapshot());
    }
    return states;
  }, count);
}

async function firstDrawAfter(
  page: Page,
  counter: number,
): Promise<DebugSnapshot> {
  return page.evaluate(async (counter) => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    for (let i = 0; i < 120; i++) {
      await new Promise(requestAnimationFrame);
      const state = api.snapshot();
      if (state.rideFramesDrawn > counter) return state;
    }
    throw new Error('ride did not draw again');
  }, counter);
}

function expectHidden(states: DebugSnapshot[]): void {
  expect(states).toHaveLength(30);
  const first = states[0];
  if (!first) throw new Error('no observed frames');
  expect(first.rideFramesDrawn).toBeGreaterThan(0);
  for (const state of states) {
    expect(
      state.rideFramesDrawn,
      'ride must not draw behind an opaque screen',
    ).toBe(first.rideFramesDrawn);
    expect(state.simulationTick).toBe(first.simulationTick);
    expect(state.effects.checksum).toBe(first.effects.checksum);
  }
}

test('UI-04: depot hides the live ride; back snaps the first frame and resume draws again', async ({
  page,
}) => {
  await startRide(page, ['cargo_box'], '?debug=1&seed=123');
  await driveUntilMoving(page);
  await page.mouse.up();
  await tapAction(page, 'pause');
  await frames(page, 2);
  const paused = await snapshot(page);
  await tapAction(page, 'open-depot');
  expectHidden(await frames(page));
  // Saves still depend on Phaser frames while the opaque depot is open.
  await tapAction(page, 'add:passenger_classic');
  await expect
    .poll(async () => {
      const json = await page.evaluate(() =>
        localStorage.getItem('vlacek.save.v1'),
      );
      const result = parseSave(
        json ?? '',
        saveRules(gameConfig, locomotives, wagons),
      );
      return result.status === 'valid'
        ? result.save.builderDraft?.wagons.length
        : undefined;
    })
    .toBe(2);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport missing');
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height + 160,
  });
  expectHidden(await frames(page));
  const hidden = await snapshot(page);
  const firstFrame = firstDrawAfter(page, hidden.rideFramesDrawn);
  await tapAction(page, 'back');
  const first = await firstFrame;
  expect(first.screen).toBe('PAUSED');
  expect(first.seed).toBe(paused.seed);
  expect(first.headS).toBe(paused.headS);
  expect(first.renderedChunks).toBeGreaterThan(0);
  expect(first.renderedVehicles).toBe(paused.renderedVehicles);
  expect(first.scenery.biome).toBe(paused.scenery.biome);
  expect(first.backdrop).toEqual({
    currentBiome: first.scenery.biome,
    incomingBiome: undefined,
    fade: 1,
    world: expect.objectContaining({
      generatorVersion: TRACK_GENERATOR_VERSION,
      seed: first.seed,
    }),
  });
  expect(first.effects.checksum).toBe(paused.effects.checksum);
  expect(first.trainBox).toBeDefined();
  expect(paused.trainBox).toBeDefined();
  if (!first.trainBox || !paused.trainBox) throw new Error('train box missing');
  expect(first.trainBox.left).toBeCloseTo(paused.trainBox.left, 1);
  expect(first.trainBox.top - paused.trainBox.top).toBeCloseTo(
    160 * gameConfig.camera.bandAnchor,
    1,
  );
  await tapAction(page, 'resume');
  const resumed = await frames(page);
  expect(resumed.at(-1)?.rideFramesDrawn).toBeGreaterThan(
    first.rideFramesDrawn,
  );
});

test('UI-06/INP-13: rotate hides the ride, landscape restores it and pause keeps drawing', async ({
  page,
}) => {
  await startRide(page, [], '?debug=1&seed=123');
  await driveUntilMoving(page);
  await page.mouse.up();
  const landscape = page.viewportSize();
  if (!landscape) throw new Error('viewport missing');
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(page.locator('.overlay.rotate')).toBeVisible();
  expectHidden(await frames(page));
  const hidden = await snapshot(page);
  const firstFrame = firstDrawAfter(page, hidden.rideFramesDrawn);
  await page.setViewportSize(landscape);
  const first = await firstFrame;
  expect(first.screen).toBe('PAUSED');
  expect(first.backdrop).toEqual({
    currentBiome: first.scenery.biome,
    incomingBiome: undefined,
    fade: 1,
    world: expect.objectContaining({
      generatorVersion: TRACK_GENERATOR_VERSION,
      seed: first.seed,
    }),
  });
  expect(first.renderedVehicles).toBe(1);
  await expect(page.locator('.overlay.rotate')).toHaveCount(0);
  const paused = await frames(page);
  expect(paused.at(-1)?.rideFramesDrawn).toBeGreaterThan(first.rideFramesDrawn);
  expect(paused.at(-1)?.simulationTick).toBe(first.simulationTick);
  expect(paused.at(-1)?.effects.checksum).toBe(first.effects.checksum);
  await tapAction(page, 'resume');
  expect((await frames(page)).at(-1)?.rideFramesDrawn).toBeGreaterThan(
    paused.at(-1)?.rideFramesDrawn ?? 0,
  );
});
