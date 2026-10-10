import { expect, test, type Browser } from '@playwright/test';
import { gameConfig } from '../../src/config/gameConfig.ts';
import {
  generateTrackProfile,
  profileGrade,
  TRACK_GENERATOR_VERSION,
} from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

const SEED = 123;
const WAGONS = [
  'cargo_box',
  'cargo_coal',
  'cargo_container',
  'service_crane',
  'passenger_open',
  'cargo_box',
];

/** First head position whose whole train stands on a straight climb or descent. */
function headOnLongSlope(): { chunkIndex: number; arcOffsetU: number } {
  const width = gameConfig.world.chunkWidthU;
  const gradeAt = (worldX: number) => {
    const k = Math.floor(worldX / width);
    return profileGrade(generateTrackProfile(SEED, k), worldX - k * width);
  };
  for (let x = 2000; x < 200_000; x += 32) {
    const grade = gradeAt(x);
    if (Math.abs(grade) < 0.03) continue;
    let straight = true;
    for (let back = 0; back <= 1500 && straight; back += 32)
      straight = Math.abs(gradeAt(x - back) - grade) < 1e-12;
    if (straight) {
      const k = Math.floor(x / width);
      return { chunkIndex: k, arcOffsetU: x - k * width };
    }
  }
  throw new Error(`no long slope for seed ${SEED}`);
}

/** A stopped journey on that slope, as a schema 1 save. */
function slopeSave(): string {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: WAGONS.map((definitionId, i) => ({
      instanceId: `w${i + 1}`,
      definitionId,
      visualSeed: i,
    })),
  };
  return JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'render-test',
    settings: {
      sfxEnabled: false,
      musicEnabled: false,
      reducedEffects: false,
      maxSpeedFactor: 1,
      quality: 'auto',
    },
    lastConsist: consist,
    journey: {
      seed: SEED,
      generatorVersion: TRACK_GENERATOR_VERSION,
      consist,
      head: headOnLongSlope(),
      simulationTick: 0,
      activeEntities: [],
    },
  });
}

/**
 * Screenshot of the standing train with one renderer, plus its box. With
 * `placeholders` the art files are blocked, so the train is drawn from the
 * fallback silhouettes: several textures interleaved in one frame.
 */
async function standingTrain(
  browser: Browser,
  renderer: 'auto' | 'canvas',
  placeholders = false,
) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  if (placeholders)
    await page.route(/\/assets\/[^/]*\.svg$/, (route) => route.abort());
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('render-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('render-seeded', '1');
    }
  }, slopeSave());
  await page.goto(
    `./?debug=1${renderer === 'canvas' ? '&renderer=canvas' : ''}`,
  );
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  // Let the camera settle on the standing train.
  await page.waitForTimeout(1500);
  const state = await snapshot(page);
  const png = await page.locator('#game-root canvas').screenshot({
    style: '#ui-layer, #diagnostics { visibility: hidden; }',
  });
  return { page, png: png.toString('base64'), box: state.trainBox, state };
}

/** Share of pixels inside the WebGL train box that differ from Canvas. */
async function differingPixels(placeholders: boolean, browser: Browser) {
  const webgl = await standingTrain(browser, 'auto', placeholders);
  const canvas = await standingTrain(browser, 'canvas', placeholders);
  expect(webgl.state.renderer).toBe('webgl');
  expect(canvas.state.renderer).toBe('canvas');
  expect(webgl.state.artVehicles).toBe(placeholders ? 0 : WAGONS.length + 1);
  const box = webgl.box;
  if (!box) throw new Error('no train box');
  // Same deterministic standing frame: compare pixels inside the train box.
  return webgl.page.evaluate(
    async ({ a, b, box }) => {
      const decode = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: 'image/png' }),
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no 2D context');
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [first, second] = [await decode(a), await decode(b)];
      let total = 0;
      let different = 0;
      for (let y = Math.floor(box.top); y < Math.ceil(box.bottom); y++) {
        for (let x = Math.floor(box.left); x < Math.ceil(box.right); x++) {
          const i = 4 * (y * first.width + x);
          total += 1;
          let delta = 0;
          for (let c = 0; c < 3; c++)
            delta = Math.max(
              delta,
              Math.abs((first.data[i + c] ?? 0) - (second.data[i + c] ?? 0)),
            );
          if (delta > 80) different += 1;
        }
      }
      return different / Math.max(1, total);
    },
    { a: webgl.png, b: canvas.png, box },
  );
}

test('WebGL draws rotated vehicles like Canvas (no sheared quads)', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  // Identical renderers give 0; Phaser's multi-texture batching sheared
  // quads into wedges (1–2 % of the box differed, D-010).
  expect(await differingPixels(false, browser)).toBeLessThan(0.002);
});

test('D-010: interleaved textures (art fallback) draw like Canvas too', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  // With the vehicle atlas the train is one texture; the fallback
  // silhouettes and wheels interleave textures, which still sheared quads
  // under Phaser 4.2.1's default batching (≈ 1 % of the box).
  expect(await differingPixels(true, browser)).toBeLessThan(0.002);
});
