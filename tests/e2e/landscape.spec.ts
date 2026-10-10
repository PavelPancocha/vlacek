import { expect, test } from '@playwright/test';
import { artParts } from '../../src/content/artManifest.ts';
import { isBackdropPart, worldParts } from '../../src/content/worldArt.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
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

  for (const [width, height] of [
    [844, 390],
    [568, 320],
  ] as const)
    test(`doc 02: on a phone, animals stay above the brake and the horn (${width}×${height})`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height });
      await buildLongestTrain(page, '?debug=1&seed=123');
      await tapAction(page, 'depart');
      await expect
        .poll(async () => (await snapshot(page)).screen)
        .toBe('RIDING');
      // Hold the world above the train, inside this small screen.
      await driveUntilMoving(page, 200, { x: width / 2, y: height / 4 });
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

  test('the distant hills glide on smoothly when the render origin moves (every 4096 u)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const consist = {
      locomotiveId: 'steam_local',
      wagons: [{ instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 0 }],
    };
    const save = JSON.stringify({
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: '2026-10-10T00:00:00.000Z',
      appBuildId: 'parallax-test',
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
        // The front just before x 4096, where the render origin moves.
        head: { chunkIndex: 3, arcOffsetU: 700 },
        simulationTick: 0,
        activeEntities: [],
      },
    });
    await page.addInitScript((json) => {
      if (!sessionStorage.getItem('parallax-seeded')) {
        localStorage.setItem('vlacek.save.v1', json);
        sessionStorage.setItem('parallax-seeded', '1');
      }
    }, save);
    await page.goto('./?debug=1');
    await tapAction(page, 'continue');
    await tapAction(page, 'resume');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    await page.mouse.move(700, 300);
    await page.mouse.down();
    // Every frame: the mid hills' tile offset and the chunk of the front.
    const samples = await page.evaluate(async () => {
      const api = (
        window as unknown as {
          __vlacek: {
            snapshot(): { backdropMidOffsetU: number; headChunk?: number };
          };
        }
      ).__vlacek;
      const out: { offset: number; chunk: number }[] = [];
      for (let i = 0; i < 240; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const state = api.snapshot();
        out.push({
          offset: state.backdropMidOffsetU,
          chunk: state.headChunk ?? -1,
        });
      }
      return out;
    });
    await page.mouse.up();
    // The ride crossed x 4096 (chunk 4) while sampling.
    expect(samples.some((sample) => sample.chunk <= 3)).toBe(true);
    expect(samples.some((sample) => sample.chunk >= 4)).toBe(true);
    // Tile width 1020 u: compare offsets modulo the tile, never a jump.
    const TILE = 1020;
    let worst = 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]?.offset ?? 0;
      const b = samples[i]?.offset ?? 0;
      const d = ((((b - a) % TILE) + TILE * 1.5) % TILE) - TILE / 2;
      worst = Math.max(worst, Math.abs(d));
    }
    expect(worst).toBeLessThan(40);
  });
});
