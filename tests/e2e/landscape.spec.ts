import { expect, test } from '@playwright/test';
import { artParts } from '../../src/content/artManifest.ts';
import { isBackdropPart, worldParts } from '../../src/content/worldArt.ts';
import {
  buildLongestTrain,
  driveUntilMoving,
  snapshot,
  startRide,
  tapAction,
} from './helpers.ts';

const worldKeys = Object.keys(worldParts);
const MAIN_FRAMES =
  Object.keys(artParts).length +
  worldKeys.filter((key) => !isBackdropPart(key)).length;
const BACKDROP_FRAMES = worldKeys.filter(isBackdropPart).length;

test.describe('landscape (doc 14 §5, D-013)', () => {
  test('the ride draws track, scenery and backdrops from two atlases', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await startRide(page, ['cargo_box'], '?debug=1&seed=123');
    await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(2);
    const state = await snapshot(page);
    expect(state.artAtlas?.frames).toBe(MAIN_FRAMES);
    expect(state.backdropAtlas?.frames).toBe(BACKDROP_FRAMES);
    for (const atlas of [state.artAtlas, state.backdropAtlas]) {
      expect(atlas?.width).toBeLessThanOrEqual(2048);
      expect(atlas?.height).toBeLessThanOrEqual(2048);
    }
    // Every route cycle starts in the countryside (doc 04 §5).
    expect(state.scenery.biome).toBe('countryside');
    expect(state.scenery.localities.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  for (const seed of [7, 123, 2026])
    test(`near-meadow props never cover the longest train (seed ${seed})`, async ({
      page,
    }) => {
      // Building the longest train takes many taps; slow under load.
      test.setTimeout(60_000);
      await buildLongestTrain(page, `?debug=1&seed=${seed}`);
      await tapAction(page, 'depart');
      await expect
        .poll(async () => (await snapshot(page)).screen)
        .toBe('RIDING');
      await driveUntilMoving(page, 200);
      let seen = 0;
      for (let sample = 0; sample < 12; sample++) {
        const { scenery } = await snapshot(page);
        expect(scenery.nearPropsOverTrain).toBe(0);
        seen += scenery.nearProps;
        await page.waitForTimeout(250);
      }
      await page.mouse.up();
      // The check is not vacuous: the meadow had props next to the train.
      expect(seen).toBeGreaterThan(0);
    });

  test('doc 02: on a phone, animals stay above the brake and the horn', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 844, height: 390 });
    await buildLongestTrain(page, '?debug=1&seed=123');
    await tapAction(page, 'depart');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    await driveUntilMoving(page, 200);
    let seen = 0;
    for (let sample = 0; sample < 16; sample++) {
      const state = await snapshot(page);
      const brake = state.brakeRect;
      if (!brake) throw new Error('no brake rect');
      // Smaller on a phone, but still below the train (doc 14 §5).
      expect(state.scenery.nearPropsOverTrain).toBe(0);
      for (const object of state.objects) {
        seen += 1;
        expect(object.y, object.id).toBeLessThan(brake.top);
      }
      await page.waitForTimeout(250);
    }
    await page.mouse.up();
    expect(seen).toBeGreaterThan(0);
  });
});
