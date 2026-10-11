import { expect, test, type Page } from '@playwright/test';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/** First run in world 123 with this locomotive and two wagons. */
async function departWith(page: Page, locomotive: string): Promise<void> {
  await page.goto('./?debug=1&seed=123');
  await tapAction(page, `loco:${locomotive}`);
  await tapAction(page, 'to-depot');
  for (const wagon of ['passenger_open', 'cargo_box'])
    await tapAction(page, `add:${wagon}`);
  await tapAction(page, 'depart');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

test.describe('electric locomotive and catenary (doc 03 §9, TRN-08, D-016)', () => {
  test('TRN-08: the wire runs along the whole ride and the pantograph touches it', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await departWith(page, 'electric_retro');
    await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(3);
    await page.mouse.move(700, 300);
    await page.mouse.down();
    const chunks = new Set<number>();
    for (let i = 0; i < 40; i++) {
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
      if (i === 20)
        await page.screenshot({
          path: test.info().outputPath('electric-ride.png'),
        });
      await page.waitForTimeout(200);
    }
    await page.mouse.up();
    expect(chunks.size).toBeGreaterThan(2);
    // The electric locomotive does not smoke (doc 14 §4).
    const { kinds } = (await snapshot(page)).effects;
    expect(kinds['smoke'] ?? 0).toBe(0);
    expect(kinds['diesel'] ?? 0).toBe(0);
  });

  test('a steam journey has no catenary', async ({ page }) => {
    await departWith(page, 'steam_local');
    const { catenary } = await snapshot(page);
    expect(catenary).toEqual({
      electrified: false,
      poles: 0,
      pantographGapU: undefined,
    });
  });

  test('a restored electric journey keeps its catenary', async ({ page }) => {
    const consist = {
      locomotiveId: 'electric_retro',
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
        seed: 7,
        generatorVersion: TRACK_GENERATOR_VERSION,
        consist,
        head: { chunkIndex: 5, arcOffsetU: 200 },
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
    await expect
      .poll(async () => (await snapshot(page)).catenary.poles)
      .toBeGreaterThan(0);
    expect((await snapshot(page)).catenary.electrified).toBe(true);
  });
});
