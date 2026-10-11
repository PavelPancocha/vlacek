import { expect, test, type Page } from '@playwright/test';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/**
 * A stopped journey in world 123 before the crossing of chunk 3 (x 3808),
 * outside its closing distance, as a v1 save.
 */
function journeySave(): string {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: ['cargo_box', 'passenger_open', 'cargo_coal'].map(
      (definitionId, i) => ({
        instanceId: `w${i + 1}`,
        definitionId,
        visualSeed: i,
      }),
    ),
  };
  return JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'crossing-test',
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
      head: { chunkIndex: 1, arcOffsetU: 100 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
}

async function continueJourney(page: Page): Promise<void> {
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('crossing-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('crossing-seeded', '1');
    }
  }, journeySave());
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

const CROSSING = `g${TRACK_GENERATOR_VERSION}:chunk:3:crossing:0`;

test.describe('level crossings (doc 05 §4, doc 14 §5, D-015)', () => {
  test('the barriers are down before the train arrives and rise only after the last wagon', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await continueJourney(page);
    const find = async () => {
      const state = await snapshot(page);
      return {
        state,
        crossing: state.crossings.find((c) => c.id === CROSSING),
      };
    };
    const first = (await find()).crossing;
    expect(first?.phase).toBe('OPEN');
    expect(first?.barrier).toBe(0);
    await page.mouse.move(700, 300);
    await page.mouse.down();
    let phases: string[] = [];
    let occupiedSamples = 0;
    for (let i = 0; i < 200; i++) {
      const { state, crossing } = await find();
      // The app records every phase each frame; polling here could miss
      // the short OPENING phase on a slow machine.
      if (crossing) phases = crossing.phases;
      if (crossing?.occupied) {
        occupiedSamples += 1;
        expect(crossing.barrier).toBe(1);
        // Nothing of the crossing in front of the track hides the train.
        expect(state.scenery.nearPropsOverTrain).toBe(0);
        if (occupiedSamples === 3)
          await page.screenshot({
            path: test.info().outputPath('crossing-closed.png'),
          });
      }
      if (occupiedSamples > 0 && crossing?.phase === 'OPEN') break;
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
    expect(occupiedSamples).toBeGreaterThan(0);
    // In this order, other phases (such as CLEARING) may come between.
    const order = ['WARNING', 'CLOSED', 'OPENING', 'OPEN'];
    let from = 0;
    for (const phase of order) {
      const at = phases.indexOf(phase, from);
      expect(
        at,
        `${phase} after ${phases.slice(0, from).join(', ')}`,
      ).toBeGreaterThanOrEqual(from);
      from = at + 1;
    }
  });

  test('road traffic waits at the closed crossing and drives on after the train', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await continueJourney(page);
    // Let traffic gather, then stop with the crossing under the train.
    await page.waitForTimeout(6000);
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await expect
      .poll(
        async () =>
          (await snapshot(page)).crossings.find((c) => c.id === CROSSING)
            ?.occupied,
        { timeout: 20_000, intervals: [50] },
      )
      .toBe(true);
    // Brake to a stop with the crossing under the train.
    await page.mouse.up();
    const brake = (await snapshot(page)).brakeRect;
    if (!brake) throw new Error('no brake on screen');
    await page.mouse.move(
      brake.left + brake.width / 2,
      brake.top + brake.height / 2,
    );
    await page.mouse.down();
    await expect.poll(async () => (await snapshot(page)).speedUPerSec).toBe(0);
    await page.mouse.up();
    expect(
      (await snapshot(page)).crossings.find((c) => c.id === CROSSING)?.occupied,
    ).toBe(true);
    await expect
      .poll(
        async () =>
          (await snapshot(page)).crossings.find((c) => c.id === CROSSING)
            ?.waiting ?? 0,
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    const waiting = (await snapshot(page)).crossings.find(
      (c) => c.id === CROSSING,
    );
    expect(waiting?.barrier).toBe(1);
    const crossedBefore = waiting?.crossed ?? 0;
    // Drive on: once the last wagon is clear the queue moves across.
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await expect
      .poll(
        async () =>
          (await snapshot(page)).crossings.find((c) => c.id === CROSSING)
            ?.crossed ?? Infinity,
        { timeout: 30_000 },
      )
      .toBeGreaterThan(crossedBefore);
    await page.mouse.up();
  });
});
