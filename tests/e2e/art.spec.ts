import { expect, test } from '@playwright/test';
import { artParts } from '../../src/content/artManifest.ts';
import { isBackdropPart, worldParts } from '../../src/content/worldArt.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
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
    // The atlases replace the decoded per-part textures.
    expect(state.artSourceTextures).toBe(0);
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
    // The parts that did load are released too (D-011): the fallback must
    // not keep the whole decoded art set in memory.
    expect(state.backdropAtlas).toBeDefined();
    expect(state.artSourceTextures).toBe(0);
  });

  test('PWA-10: without its art the ride still shows the wire, the crossing and the tunnel', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.route(/steam_local\.body-[^/]*\.svg$/, (route) => route.abort());
    // An electric journey in world 123 before the crossing of chunk 3; the
    // tunnel of chunk 6 lies ahead (doc 04 §6).
    const consist = {
      locomotiveId: 'electric_retro',
      wagons: [{ instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 0 }],
    };
    const save = JSON.stringify({
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: '2026-10-10T00:00:00.000Z',
      appBuildId: 'fallback-test',
      settings: {
        sfxEnabled: false,
        musicEnabled: false,
        reducedEffects: false,
        maxSpeedFactor: 1,
        quality: 'auto',
      },
      lastConsist: consist,
      journey: {
        seed: 123,
        generatorVersion: TRACK_GENERATOR_VERSION,
        consist,
        head: { chunkIndex: 3, arcOffsetU: 300 },
        simulationTick: 0,
        activeEntities: [],
      },
    });
    await page.addInitScript((json) => {
      if (!sessionStorage.getItem('fallback-seeded')) {
        localStorage.setItem('vlacek.save.v1', json);
        sessionStorage.setItem('fallback-seeded', '1');
      }
    }, save);
    await page.goto('./?debug=1');
    await tapAction(page, 'continue');
    await tapAction(page, 'resume');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    expect((await snapshot(page)).artAtlas).toBeUndefined();
    // The wire along the whole route (AGENTS.md) and the crossing's
    // barriers and lamps are drawn without the art too.
    await expect
      .poll(async () => (await snapshot(page)).catenary.poles)
      .toBeGreaterThan(0);
    expect((await snapshot(page)).scenery.crossingViews).toBeGreaterThan(0);
    // Drive on to the tunnel: its see-through cover works without art.
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await expect
      .poll(async () => (await snapshot(page)).tunnels.length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    await page.mouse.up();
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
