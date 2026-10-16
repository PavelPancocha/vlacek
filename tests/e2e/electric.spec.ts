import { expect, test, type Page } from '@playwright/test';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { trainZoom } from '../../src/render/cameraFraming.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { vehicleArt } from '../../src/content/artManifest.ts';
import { snapshot, tapAction, waitForWorldAtlases } from './helpers.ts';

/** First run in world 123 with this locomotive and two wagons. */
async function departWith(page: Page, locomotive: string): Promise<void> {
  await page.goto('./?debug=1&seed=123');
  await tapAction(page, `loco:${locomotive}`);
  await tapAction(page, 'to-depot');
  for (const wagon of ['passenger_open', 'cargo_box'])
    await tapAction(page, `add:${wagon}`);
  await tapAction(page, 'depart');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  // D-019 drew contact synchronously on depart; D-030 must publish the art first.
  await waitForWorldAtlases(page);
}

/** Restore world 123 before its chunk 4 bridge and chunk 6 tunnel. */
async function continueBeforeBridge(
  page: Page,
  locomotive: string,
): Promise<void> {
  const consist = {
    locomotiveId: locomotive,
    wagons: [{ instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 0 }],
  };
  const save = JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'electric-test',
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
      head: { chunkIndex: 4, arcOffsetU: 100 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('electric-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('electric-seeded', '1');
    }
  }, save);
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  // D-019 drew contact synchronously on resume; D-030 must publish the art first.
  await waitForWorldAtlases(page);
}

test.describe('electric locomotive and catenary (doc 03 §9, TRN-08, D-016)', () => {
  for (const locomotive of [
    'electric_retro',
    'electric_modern',
    'electric_mountain',
  ]) {
    for (const renderer of ['canvas', 'webgl']) {
      test(`TRN-08 compact contact: ${locomotive}, ${renderer}`, async ({
        page,
      }) => {
        await page.goto(`./?debug=1&seed=123&renderer=${renderer}`);
        await tapAction(page, `loco:${locomotive}`);
        await tapAction(page, 'to-depot');
        await tapAction(page, 'add:passenger_double');
        await tapAction(page, 'depart');
        await expect
          .poll(async () => (await snapshot(page)).screen)
          .toBe('RIDING');
        await expect
          .poll(async () => (await snapshot(page)).artVehicles)
          .toBe(2);
        const state = await snapshot(page);
        expect(state.renderer).toBe(renderer);
        expect(state.catenary).toHaveProperty('outOfRange', 0);
        expect(state.catenary.pantographGapU ?? Infinity).toBeLessThan(0.5);
        const box = state.trainBox;
        if (!box) throw new Error('train box missing');
        // Flat start: camera includes the wire plus 8 u and 4 u below rail.
        const heightLimitU =
          1.25 *
            Math.max(
              ...Object.values(vehicleArt).map((art) => {
                if (!art) throw new Error('Catalog art missing');
                return art.heightU;
              }),
            ) +
          12;
        const viewport = page.viewportSize();
        if (!viewport) throw new Error('viewport missing');
        const zoom = trainZoom(
          {
            widthPx: viewport.width,
            heightPx: viewport.height,
            reservedTopPx: 0,
            reservedBottomPx: 0,
          },
          state.consistLengthU,
          { ...gameConfig.camera, vehicleHeightU: heightLimitU },
        );
        const [firstEdge, secondEdge] = state.chunkEdges;
        if (firstEdge === undefined || secondEdge === undefined)
          throw new Error('camera chunk edges missing');
        expect(zoom).toBeCloseTo(
          (secondEdge - firstEdge) / gameConfig.world.chunkWidthU,
          9,
        );
        expect((box.bottom - box.top) / zoom).toBeLessThanOrEqual(heightLimitU);
        await page.screenshot({
          path: test.info().outputPath(`${locomotive}-${renderer}-contact.png`),
        });
      });
    }
    test(`TRN-08: ${locomotive} touches the wire over the bridge, tunnel and chunk seam`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await continueBeforeBridge(page, locomotive);
      await page.mouse.move(700, 300);
      await page.mouse.down();
      const chunks = new Set<number>();
      let enteredTunnel = false;
      let exitedTunnel = false;
      const tunnelId = `g${TRACK_GENERATOR_VERSION}:chunk:6:tunnel:0`;
      for (let i = 0; i < 300; i++) {
        const state = await snapshot(page);
        expect(state.catenary.electrified).toBe(true);
        // Masts in every rendered chunk, across chunk seams.
        expect(state.catenary.poles).toBeGreaterThanOrEqual(
          4 * (state.renderedChunks - 1),
        );
        expect(state.catenary.pantographGapU).toBeDefined();
        expect(state.catenary.pantographGapU ?? Infinity).toBeLessThan(0.5);
        // The whole train, pantograph included, stays in view.
        expect(state.scenery.nearPropsOverTrain).toBe(0);
        if (state.headChunk !== undefined) chunks.add(state.headChunk);
        const tunnel = state.tunnels.find((t) => t.id === tunnelId);
        if (tunnel && tunnel.train !== 'outside') enteredTunnel = true;
        if (enteredTunnel && tunnel?.train === 'outside') {
          exitedTunnel = true;
          break;
        }
        if (i === 20)
          await page.screenshot({
            path: test.info().outputPath('electric-ride.png'),
          });
        await page.waitForTimeout(50);
      }
      await page.mouse.up();
      expect([...chunks]).toEqual(expect.arrayContaining([4, 5, 6]));
      expect(enteredTunnel).toBe(true);
      expect(exitedTunnel).toBe(true);
      const state = await snapshot(page);
      expect(state.artVehicles).toBe(2);
      expect(state.artVehicles).toBe(state.vehicles);
      expect(state.vehicleAtlas?.vehicleIds).toContain(locomotive);
      // The electric locomotive does not smoke (doc 14 §4).
      const { kinds } = state.effects;
      expect(kinds['smoke'] ?? 0).toBe(0);
      expect(kinds['diesel'] ?? 0).toBe(0);
    });
  }

  test('a steam journey has no catenary', async ({ page }) => {
    await departWith(page, 'steam_local');
    const { catenary } = await snapshot(page);
    expect(catenary).toEqual({
      electrified: false,
      poles: 0,
      pantographGapU: undefined,
      outOfRange: 0,
    });
  });

  for (const renderer of ['canvas', 'webgl']) {
    test(`TRN-08: fallback wire meets the electric head at the same compact height, ${renderer}`, async ({
      page,
    }) => {
      await page.route(/track\.tile-a-[^/]*\.svg$/, (route) => route.abort());
      await page.goto(`./?debug=1&seed=123&renderer=${renderer}`);
      await tapAction(page, 'loco:electric_modern');
      await tapAction(page, 'to-depot');
      await tapAction(page, 'add:passenger_double');
      await tapAction(page, 'depart');
      await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(2);
      const state = await snapshot(page);
      expect(state.renderer).toBe(renderer);
      expect(state.artAtlas).toBeUndefined();
      expect(state.catenary.poles).toBeGreaterThan(0);
      expect(state.catenary.pantographGapU ?? Infinity).toBeLessThan(0.5);
      await page.screenshot({
        path: test.info().outputPath(`fallback-wire-${renderer}.png`),
      });
    });
  }

  test('a restored electric journey keeps its catenary', async ({ page }) => {
    await continueBeforeBridge(page, 'electric_retro');
    await expect
      .poll(async () => (await snapshot(page)).catenary.poles)
      .toBeGreaterThan(0);
    expect((await snapshot(page)).catenary.electrified).toBe(true);
  });
});
