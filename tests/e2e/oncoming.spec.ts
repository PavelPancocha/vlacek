import { expect, test, type Page } from '@playwright/test';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/**
 * A stopped journey in world 123 just before the second track of biome
 * block 1 (always there, doc 04 §6), as a v1 save.
 */
async function continueBeforeSecondTrack(page: Page): Promise<void> {
  const consist = {
    locomotiveId: 'diesel_mainline',
    wagons: [{ instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 0 }],
  };
  const save = JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'oncoming-test',
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
      head: { chunkIndex: 11, arcOffsetU: 100 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('oncoming-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('oncoming-seeded', '1');
    }
  }, save);
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

test.describe('the oncoming train (doc 05 §6, SCN-09, D-017)', () => {
  test('SCN-09: comes out of its tunnel, passes in the open and hides vehicle by vehicle', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await continueBeforeSecondTrack(page);
    expect((await snapshot(page)).oncoming.trains).toEqual([]);
    // Drive up to the second track; the train sets off once.
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await expect
      .poll(async () => (await snapshot(page)).oncoming.trains.length, {
        timeout: 15_000,
        intervals: [50],
      })
      .toBe(1);
    await page.mouse.up();
    const start = (await snapshot(page)).oncoming;
    const first = start.trains[0];
    if (!first) throw new Error('no oncoming train');
    // It has just come out of the right portal (it started whole inside,
    // see the unit test), far from the open stretch in view.
    expect(first.minX).toBeGreaterThan(first.toX - 200);
    expect(start.drawnInOpen).toBe(0);
    // Stop and watch it pass.
    const brake = (await snapshot(page)).brakeRect;
    if (!brake) throw new Error('no brake');
    await page.mouse.move(
      brake.left + brake.width / 2,
      brake.top + brake.height / 2,
    );
    await page.mouse.down();
    let previous = 0;
    let most = 0;
    let lastDrawn = -1;
    let shot = false;
    for (let i = 0; i < 400; i++) {
      const { oncoming } = await snapshot(page);
      const train = oncoming.trains[0];
      if (!train) break;
      // Vehicles appear and disappear one by one, never all at once.
      expect(Math.abs(oncoming.drawnInOpen - previous)).toBeLessThanOrEqual(1);
      previous = oncoming.drawnInOpen;
      lastDrawn = oncoming.drawnInOpen;
      most = Math.max(most, oncoming.drawnInOpen);
      if (!shot && oncoming.drawnInOpen >= 2) {
        shot = true;
        await page.screenshot({
          path: test.info().outputPath('oncoming-train.png'),
        });
      }
      await page.waitForTimeout(150);
    }
    await page.mouse.up();
    expect(most).toBeGreaterThanOrEqual(2);
    // It is removed only once its last vehicle has gone into the portal.
    expect(lastDrawn).toBe(0);
    expect((await snapshot(page)).oncoming.trains).toEqual([]);
  });
});
