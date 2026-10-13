import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { npcFleetFor } from '../../src/domain/interaction/npcFleet.ts';
import { journeyArtKeys } from '../../src/render/atlasPacking.ts';
import { expect, test } from '@playwright/test';
import { isBackdropPart, worldParts } from '../../src/content/worldArt.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, startRide, tapAction } from './helpers.ts';

/** World parts keep their atlas across journeys (D-019). */
const MAIN_FRAMES = Object.keys(worldParts).filter(
  (key) => !isBackdropPart(key),
).length;

test.describe('vehicle art (doc 14 §3)', () => {
  test('the ride draws every vehicle from its art in one atlas', async ({
    page,
  }) => {
    await startRide(page, ['cargo_box', 'fun_balloons'], '?debug=1&seed=123');
    await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(3);
    const state = await snapshot(page);
    expect(state.renderedVehicles).toBe(3);
    expect(state.artAtlas?.frames).toBe(MAIN_FRAMES);
    expect(state.vehicleAtlas?.vehicleIds).toEqual(
      expect.arrayContaining(['steam_local', 'cargo_box', 'fun_balloons']),
    );
    const vehicles = [...locomotives, ...wagons].filter((v) =>
      ['steam_local', 'cargo_box', 'fun_balloons'].includes(v.id),
    );
    expect(state.vehicleAtlas?.frames).toBe(
      journeyArtKeys(vehicles, npcFleetFor(123, { locomotives, wagons }))
        .length,
    );
    expect(state.vehicleAtlas?.vehicleIds).not.toContain('electric_retro');
    expect(state.vehicleAtlas?.vehicleIds).not.toContain('magic_stars');
    for (const atlas of [state.artAtlas, state.vehicleAtlas]) {
      expect(atlas?.width).toBeLessThanOrEqual(2048);
      expect(atlas?.height).toBeLessThanOrEqual(2048);
    }
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
    expect(state.vehicleAtlas).toBeUndefined();
    expect(state.artAtlas?.frames).toBe(MAIN_FRAMES);
    expect(state.renderedChunks).toBeGreaterThan(0);
    expect(state.artVehicles).toBe(0);
    // The parts that did load are released too (D-011): the fallback must
    // not keep the whole decoded art set in memory.
    expect(state.backdropAtlas).toBeDefined();
    expect(state.artSourceTextures).toBe(0);
  });

  test('PWA-10: an atlas that fails to rasterise falls back instead of stopping the ride', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Drawing a loaded SVG part into a canvas fails (as when the browser
    // cannot allocate the atlas canvas); only the atlases do that.
    await page.addInitScript(() => {
      // Re-applied below with the context as `this`, so it stays bound.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<typeof draw>
      ) {
        const [source] = args;
        if (
          source instanceof HTMLImageElement &&
          /^(data:image\/svg|blob:)/.test(source.src)
        )
          throw new Error('atlas canvas lost (test)');
        return draw.apply(this, args);
      } as typeof draw;
    });
    await startRide(page, ['cargo_box']);
    const tick = (await snapshot(page)).simulationTick;
    await expect
      .poll(async () => (await snapshot(page)).simulationTick)
      .toBeGreaterThan(tick + 30);
    const state = await snapshot(page);
    expect(errors).toEqual([]);
    expect(state.artAtlas).toBeUndefined();
    expect(state.backdropAtlas).toBeUndefined();
    expect(state.vehicleAtlas).toBeUndefined();
    expect(state.artVehicles).toBe(0);
    expect(state.renderedVehicles).toBe(2);
  });

  test('PWA-10: without its art the ride still shows the wire, the crossing and the tunnel', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.route(/track\.tile-a-[^/]*\.svg$/, (route) => route.abort());
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
    // Zoom 0.60 × 1280 / 2000 = 0.384 game px per u → raster step 0.5.
    await expect
      .poll(async () => (await snapshot(page)).vehicleAtlas?.pxPerU)
      .toBe(0.5);
    await page.setViewportSize({ width: 1920, height: 1080 });
    // 0.60 × 1920 / 2000 = 0.576 → 0.75.
    await expect
      .poll(async () => (await snapshot(page)).vehicleAtlas?.pxPerU)
      .toBe(0.75);
    const state = await snapshot(page);
    expect(state.artVehicles).toBe(2);
    expect(state.trainBox).toBeDefined();
    expect(errors).toEqual([]);
  });
});

test('H0: mixed groups rebuild the vehicle atlas on depot exit and restore while the world atlas stays', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const sourceRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.svg')) sourceRequests.push(request.url());
  });
  await startRide(
    page,
    ['passenger_classic', 'cargo_box', 'service_crane', 'fun_balloons'],
    '?debug=1&seed=123',
  );
  await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(5);
  const first = await snapshot(page);
  expect(first.artVehicles).toBe(first.vehicles);
  expect(first.vehicleAtlas?.vehicleIds).toEqual(
    expect.arrayContaining([
      'steam_local',
      'passenger_classic',
      'cargo_box',
      'service_crane',
      'fun_balloons',
    ]),
  );
  const worldTexture = first.artAtlas?.textureKey;
  const vehicleTexture = first.vehicleAtlas?.textureKey;
  expect(worldTexture).toBeDefined();
  expect(vehicleTexture).toBeDefined();
  await tapAction(page, 'pause');
  await tapAction(page, 'open-depot');
  await tapAction(page, 'add:cargo_container');
  const loadedSources = sourceRequests.length;
  await tapAction(page, 'depart');
  await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(6);
  const next = await snapshot(page);
  expect(next.artVehicles).toBe(next.vehicles);
  expect(next.vehicleAtlas?.vehicleIds).toContain('cargo_container');
  expect(next.vehicleAtlas?.textureKey).not.toBe(vehicleTexture);
  expect(next.artAtlas?.textureKey).toBe(worldTexture);
  expect(sourceRequests.length).toBe(loadedSources);
  await page.reload();
  await tapAction(page, 'continue');
  await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(6);
  const restored = await snapshot(page);
  expect(restored.artVehicles).toBe(restored.vehicles);
  expect(restored.vehicleAtlas?.vehicleIds).toContain('cargo_container');
  expect(restored.artSourceTextures).toBe(0);
  expect(errors).toEqual([]);
});

test('H0: a failed world atlas leaves the journey vehicle atlas working', async ({
  page,
}) => {
  await page.route(/track\.tile-a-[^/]*\.svg$/, (route) => route.abort());
  await startRide(page, ['cargo_box']);
  await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(2);
  const state = await snapshot(page);
  expect(state.artAtlas).toBeUndefined();
  expect(state.vehicleAtlas).toBeDefined();
  expect(state.artVehicles).toBe(state.vehicles);
  expect(state.backdropAtlas).toBeDefined();
  expect(state.artSourceTextures).toBe(0);
});

// A scale failure must be isolated just like a failed download (D-011 §6).
test('H0: vehicle rasterisation failure keeps world art and is attempted only once', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let attempts = 0;
    Object.assign(window, { atlasFailureAttempts: () => attempts });
    // Reapplied with the original context via draw.apply below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof draw>
    ) {
      const [source] = args;
      // steam_local's loaded body/overlay frame at the authoritative 2 px/u;
      // no world source has this frame size.
      if (
        source instanceof HTMLImageElement &&
        source.width === 312 &&
        source.height === 200
      ) {
        attempts += 1;
        throw new Error('vehicle atlas canvas lost (test)');
      }
      return draw.apply(this, args);
    } as typeof draw;
  });
  await startRide(page, ['cargo_box']);
  const tick = (await snapshot(page)).simulationTick;
  await expect
    .poll(async () => (await snapshot(page)).simulationTick)
    .toBeGreaterThan(tick + 30);
  const state = await snapshot(page);
  expect(state.vehicleAtlas).toBeUndefined();
  expect(state.artAtlas?.frames).toBe(MAIN_FRAMES);
  expect(state.backdropAtlas).toBeDefined();
  expect(state.artVehicles).toBe(0);
  expect(state.renderedVehicles).toBe(2);
  expect(state.renderedChunks).toBeGreaterThan(0);
  expect(state.artSourceTextures).toBe(0);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { atlasFailureAttempts(): number }
      ).atlasFailureAttempts(),
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});
