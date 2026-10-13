import { expect, test, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { CROSSING_ZONE_HALF_U } from '../../src/domain/interaction/LevelCrossing.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/**
 * A stopped journey in world 123 before the crossing of chunk 3 (x 3808),
 * outside its closing distance, as a v1 save.
 */
function journeySave(onCrossing = false, longest = false): string {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: (longest
      ? [
          'cargo_cars',
          'cargo_cars',
          'cargo_cars',
          'cargo_cars',
          'passenger_panorama',
          'passenger_panorama',
          'cargo_container',
        ]
      : ['cargo_box', 'passenger_open', 'cargo_coal']
    ).map((definitionId, i) => ({
      instanceId: `w${i + 1}`,
      definitionId,
      visualSeed: i,
    })),
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
      head: onCrossing
        ? { chunkIndex: 3, arcOffsetU: 800 }
        : { chunkIndex: 1, arcOffsetU: 100 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
}

async function continueJourney(
  page: Page,
  onCrossing = false,
  longest = false,
): Promise<void> {
  await page.addInitScript(
    (json) => {
      if (!sessionStorage.getItem('crossing-seeded')) {
        localStorage.setItem('vlacek.save.v1', json);
        sessionStorage.setItem('crossing-seeded', '1');
      }
    },
    journeySave(onCrossing, longest),
  );
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

const CROSSING = `g${TRACK_GENERATOR_VERSION}:chunk:3:crossing:0`;

test.describe('level crossings (doc 05 §4, doc 14 §5, D-015)', () => {
  for (const scenario of [
    { name: 'short full speed', longest: false, halfSpeed: false },
    { name: 'short half speed', longest: false, halfSpeed: true },
    { name: 'longest full speed', longest: true, halfSpeed: false },
  ]) {
    test(`${scenario.name}: barriers lower in view before arrival`, async ({
      page,
    }) => {
      await continueJourney(page, false, scenario.longest);
      if (scenario.longest)
        expect((await snapshot(page)).consistLengthU).toBe(1600);
      const result = await page.evaluate(
        async ({ crossingId, halfSpeed }) => {
          const api = (
            window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
          ).__vlacek;
          let throttle = false;
          const setThrottle = (down: boolean) => {
            if (throttle === down) return;
            throttle = down;
            window.dispatchEvent(
              new KeyboardEvent(down ? 'keydown' : 'keyup', {
                key: 'ArrowRight',
                code: 'ArrowRight',
                bubbles: true,
              }),
            );
          };
          let lowering: { x: number; speed: number } | undefined;
          let entering: { barrier: number; phase: string } | undefined;
          setThrottle(true);
          try {
            for (let frame = 0; frame < 2400; frame++) {
              await new Promise((resolve) => requestAnimationFrame(resolve));
              const state = api.snapshot();
              if (halfSpeed) {
                if (state.speedUPerSec > 245) setThrottle(false);
                if (state.speedUPerSec < 235) setThrottle(true);
              }
              const crossing = state.crossings.find((c) => c.id === crossingId);
              if (!crossing) continue;
              if (
                !entering &&
                crossing.screenX <= innerWidth &&
                crossing.screenX >= 0
              )
                entering = { barrier: crossing.barrier, phase: crossing.phase };
              if (!lowering && crossing.phase === 'CLOSING')
                lowering = { x: crossing.screenX, speed: state.speedUPerSec };
              if (crossing.occupied)
                return { lowering, entering, barrier: crossing.barrier };
            }
            throw new Error('train did not reach the crossing');
          } finally {
            setThrottle(false);
          }
        },
        { crossingId: CROSSING, halfSpeed: scenario.halfSpeed },
      );
      expect(result.barrier).toBe(1);
      if (scenario.halfSpeed) {
        expect(result.lowering?.speed).toBeGreaterThan(220);
        expect(result.lowering?.speed).toBeLessThan(270);
      } else expect(result.lowering?.speed).toBeGreaterThanOrEqual(430);
      if (scenario.longest) {
        expect(['CLOSING', 'CLOSED']).toContain(result.entering?.phase);
        expect(result.entering?.barrier).toBeGreaterThan(0);
      } else {
        expect(result.lowering).toBeDefined();
        expect(result.lowering?.x).toBeGreaterThan(0);
        expect(result.lowering?.x).toBeLessThan(
          page.viewportSize()?.width ?? 0,
        );
      }
    });
  }

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

  test('road traffic waits at the closed crossing and crosses after the last wagon', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await continueJourney(page, true);
    // Restore a stopped train over the road: runner latency cannot coast it past.
    const stopped = (await snapshot(page)).crossings.find(
      (c) => c.id === CROSSING,
    );
    expect(stopped?.occupied).toBe(true);
    expect((await snapshot(page)).speedUPerSec).toBe(0);
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
    if (!waiting) throw new Error('Waiting crossing disappeared');
    const crossedBefore = waiting.crossed;
    expect(Number.isFinite(crossedBefore)).toBe(true);
    // Observe every frame: a removed crossing is not evidence of departing traffic.
    await page.mouse.move(700, 300);
    await page.mouse.down();
    const droveOn = await page.evaluate(
      async ({ id, crossedBefore, zoneHalfU }) => {
        const api = (
          window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
        ).__vlacek;
        let braked = false;
        try {
          for (let frame = 0; frame < 1200; frame++) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const state = api.snapshot();
            const crossing = state.crossings.find((c) => c.id === id);
            if (!crossing) return false;
            // Stop once the last wagon clears the extended zone, before streaming removes this instance.
            if (!braked && crossing.tailX > crossing.worldX + zoneHalfU) {
              window.dispatchEvent(
                new KeyboardEvent('keydown', {
                  code: 'ArrowLeft',
                  key: 'ArrowLeft',
                  bubbles: true,
                }),
              );
              braked = true;
            }
            if (
              braked &&
              state.speedUPerSec === 0 &&
              crossing.phase === 'OPEN' &&
              crossing.crossed > crossedBefore
            )
              return crossing.barrier === 0 && !crossing.occupied;
          }
          return false;
        } finally {
          window.dispatchEvent(
            new KeyboardEvent('keyup', {
              code: 'ArrowLeft',
              key: 'ArrowLeft',
              bubbles: true,
            }),
          );
        }
      },
      { id: CROSSING, crossedBefore, zoneHalfU: CROSSING_ZONE_HALF_U },
    );
    expect(droveOn).toBe(true);
    await page.mouse.up();
  });
});
