import { expect, test } from '@playwright/test';
import { artParts } from '../../src/content/artManifest.ts';
import { isBackdropPart, worldParts } from '../../src/content/worldArt.ts';
import { snapshot, startRide, tapAction } from './helpers.ts';

/** Vehicles, track, props and animals share the main atlas (D-013). */
const MAIN_FRAMES =
  Object.keys(artParts).length +
  Object.keys(worldParts).filter((key) => !isBackdropPart(key)).length;

test.describe('vehicle art (doc 14 §3)', () => {
  test('the ride draws every vehicle from its art in one atlas', async ({
    page,
  }) => {
    await startRide(page, ['cargo_box', 'fun_balloons']);
    await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(3);
    const state = await snapshot(page);
    expect(state.renderedVehicles).toBe(3);
    expect(state.artAtlas?.frames).toBe(MAIN_FRAMES);
    expect(state.artAtlas?.width).toBeLessThanOrEqual(2048);
    expect(state.artAtlas?.height).toBeLessThanOrEqual(2048);
  });

  test('the depot shows the same parts, loaded from the build', async ({
    page,
  }) => {
    await page.goto('./?debug=1');
    const parts = page.locator('[data-action="loco:steam_local"] svg image');
    await expect(parts).toHaveCount(9);
    const loaded = await parts.evaluateAll((images) =>
      Promise.all(
        images.map(async (image) => {
          const href = image.getAttribute('href') ?? '';
          const response = await fetch(href);
          return response.ok && (await response.text()).includes('<svg');
        }),
      ),
    );
    expect(loaded).toEqual(Array.from({ length: 9 }, () => true));
    await tapAction(page, 'loco:steam_local');
    await tapAction(page, 'to-depot');
    await expect(page.locator('.strip .strip-item.loco svg image')).toHaveCount(
      9,
    );
  });

  test('PWA-10: art that fails to download falls back to marked placeholders', async ({
    page,
  }) => {
    await page.route(/steam_local\.body-[^/]*\.svg$/, (route) => route.abort());
    await startRide(page, ['cargo_box']);
    await expect
      .poll(async () => (await snapshot(page)).renderedVehicles)
      .toBe(2);
    const state = await snapshot(page);
    expect(state.artAtlas).toBeUndefined();
    expect(state.artVehicles).toBe(0);
  });

  test('D-011: the art is rasterised at the screen scale and again after a resize', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 720 });
    await startRide(page, ['cargo_box']);
    // Zoom 0.72 × 1280 / 1600 = 0.576 game px per u → raster step 0.75.
    await expect
      .poll(async () => (await snapshot(page)).artAtlas?.pxPerU)
      .toBe(0.75);
    await page.setViewportSize({ width: 1920, height: 1080 });
    // 0.72 × 1920 / 1600 = 0.864 → 1.
    await expect
      .poll(async () => (await snapshot(page)).artAtlas?.pxPerU)
      .toBe(1);
    const state = await snapshot(page);
    expect(state.artVehicles).toBe(2);
    expect(state.trainBox).toBeDefined();
    expect(errors).toEqual([]);
  });
});
