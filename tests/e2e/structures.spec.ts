import { expect, test, type Page } from '@playwright/test';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/**
 * A stopped electric journey in world 123 just before the bridge of
 * chunk 4 and the tunnel of chunk 6 (biome block 0 always has both,
 * doc 04 §6), as a v1 save.
 */
async function continueBeforeBridge(
  page: Page,
  head = { chunkIndex: 4, arcOffsetU: 100 },
  resume = true,
): Promise<void> {
  const consist = {
    locomotiveId: 'electric_retro',
    wagons: [
      { instanceId: 'w1', definitionId: 'passenger_open', visualSeed: 0 },
      { instanceId: 'w2', definitionId: 'cargo_box', visualSeed: 0 },
    ],
  };
  const save = JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'structures-test',
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
      head,
      simulationTick: 0,
      activeEntities: [],
    },
  });
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('structures-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('structures-seeded', '1');
    }
  }, save);
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  if (!resume) return;
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

test.describe('bridge and tunnel (doc 03 §8, doc 14 §2 and §5, D-018)', () => {
  test('TRN-06 and TRN-08: over the bridge and through the tunnel the train stays visible under the wire', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await continueBeforeBridge(page);
    const tunnelId = `g${TRACK_GENERATOR_VERSION}:chunk:6:tunnel:0`;
    await page.mouse.move(700, 300);
    await page.mouse.down();
    const chunks = new Set<number>();
    let partlySeeThrough = false;
    let wasIn = false;
    let shot = false;
    for (let i = 0; i < 300; i++) {
      const state = await snapshot(page);
      if (state.headChunk !== undefined) chunks.add(state.headChunk);
      // The wire runs over the bridge and through the tunnel (TRN-08).
      expect(state.catenary.pantographGapU ?? Infinity).toBeLessThan(0.5);
      expect(state.scenery.nearPropsOverTrain).toBe(0);
      const tunnel = state.tunnels.find((t) => t.id === tunnelId);
      if (tunnel && tunnel.train !== 'outside') {
        wasIn = true;
        // The hill never hides the train going in or coming out.
        if (tunnel.train === 'partly' && tunnel.alpha < 0.5) {
          partlySeeThrough = true;
          if (!shot) {
            shot = true;
            await page.screenshot({
              path: test.info().outputPath('tunnel-entering.png'),
            });
          }
        }
      }
      if (wasIn && tunnel?.train === 'outside') break;
      await page.waitForTimeout(50);
    }
    await page.mouse.up();
    expect([...chunks]).toEqual(expect.arrayContaining([4, 5, 6]));
    expect(partlySeeThrough).toBe(true);
    // Out of the tunnel, the hill turns opaque again.
    await expect
      .poll(
        async () =>
          (await snapshot(page)).tunnels.find((t) => t.id === tunnelId)
            ?.alpha ?? 0,
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0.95);
  });

  test('a journey restored inside the tunnel shows the train at once, even while paused', async ({
    page,
  }) => {
    // The front deep in the chunk 6 tunnel (world 6272 to 6720).
    await continueBeforeBridge(page, { chunkIndex: 6, arcOffsetU: 520 }, false);
    expect((await snapshot(page)).screen).toBe('PAUSED');
    const tunnelId = `g${TRACK_GENERATOR_VERSION}:chunk:6:tunnel:0`;
    await expect
      .poll(async () => {
        const tunnel = (await snapshot(page)).tunnels.find(
          (t) => t.id === tunnelId,
        );
        return tunnel && tunnel.train !== 'outside' ? tunnel.alpha : 1;
      })
      .toBeLessThan(0.5);
  });
});
