import { expect, test, type Page } from '@playwright/test';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/** A stopped journey with this locomotive at the start, as a v1 save. */
function journeySave(
  locomotiveId: string,
  settings: { reducedEffects?: boolean } = {},
): string {
  const consist = {
    locomotiveId,
    wagons: ['cargo_box', 'passenger_open'].map((definitionId, i) => ({
      instanceId: `w${i + 1}`,
      definitionId,
      visualSeed: i,
    })),
  };
  return JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'effects-test',
    settings: {
      sfxEnabled: false,
      musicEnabled: false,
      reducedEffects: settings.reducedEffects ?? false,
      maxSpeedFactor: 1,
      quality: 'auto',
    },
    lastConsist: consist,
    journey: {
      seed: 123,
      generatorVersion: TRACK_GENERATOR_VERSION,
      consist,
      head: { chunkIndex: 1, arcOffsetU: 300 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
}

async function continueJourney(page: Page, save: string): Promise<void> {
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('effects-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('effects-seeded', '1');
    }
  }, save);
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

test.describe('particles and small animations (doc 14 §4, D-014)', () => {
  test('the steam locomotive smokes while riding, within the particle budget', async ({
    page,
  }) => {
    await continueJourney(page, journeySave('steam_local'));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    let smoke = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const { effects } = await snapshot(page);
      expect(effects.live).toBeLessThanOrEqual(effects.capacity);
      expect(effects.capacity).toBe(240);
      smoke = Math.max(smoke, effects.kinds['smoke'] ?? 0);
    }
    await page.mouse.up();
    expect(smoke).toBeGreaterThan(5);
  });

  test('pause freezes the particles; resuming sets them moving again', async ({
    page,
  }) => {
    await continueJourney(page, journeySave('steam_local'));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await tapAction(page, 'pause');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    const frozen = (await snapshot(page)).effects;
    expect(frozen.live).toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    expect((await snapshot(page)).effects).toEqual(frozen);
    await tapAction(page, 'resume');
    await expect
      .poll(async () => (await snapshot(page)).effects.checksum)
      .not.toBe(frozen.checksum);
  });

  test('the diesel gives light exhaust and never steam-engine smoke', async ({
    page,
  }) => {
    await continueJourney(page, journeySave('diesel_mainline'));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    let diesel = 0;
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(250);
      const { kinds } = (await snapshot(page)).effects;
      diesel = Math.max(diesel, kinds['diesel'] ?? 0);
      expect(kinds['smoke'] ?? 0).toBe(0);
      expect(kinds['steam'] ?? 0).toBe(0);
    }
    await page.mouse.up();
    expect(diesel).toBeGreaterThan(0);
  });

  test('reduced effects lower the particle budget (doc 07 §9, doc 13)', async ({
    page,
  }) => {
    await continueJourney(
      page,
      journeySave('steam_local', { reducedEffects: true }),
    );
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    const { effects } = await snapshot(page);
    await page.mouse.up();
    expect(effects.capacity).toBe(96);
    expect(effects.live).toBeLessThanOrEqual(96);
  });
});
