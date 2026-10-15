import { expect, test, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { CROSSING_ZONE_HALF_U } from '../../src/domain/interaction/LevelCrossing.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/**
 * A stopped journey in world 123 before the v2 crossing of chunk 3 (x 3328),
 * outside its closing distance, in save schema 1.
 */
function journeySave(
  onCrossing = false,
  longest = false,
  closerApproach = false,
): string {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: (longest
      ? [...Array.from({ length: 11 }, () => 'passenger_open'), 'cargo_box']
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
        : closerApproach
          ? { chunkIndex: 1, arcOffsetU: 450 }
          : { chunkIndex: 0, arcOffsetU: 800 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
}

async function continueJourney(
  page: Page,
  onCrossing = false,
  longest = false,
  renderer?: string,
  closerApproach = false,
): Promise<void> {
  await page.addInitScript(
    (json) => {
      if (!sessionStorage.getItem('crossing-seeded')) {
        localStorage.setItem('vlacek.save.v1', json);
        sessionStorage.setItem('crossing-seeded', '1');
      }
    },
    journeySave(onCrossing, longest, closerApproach),
  );
  await page.goto(`./?debug=1${renderer ? `&renderer=${renderer}` : ''}`);
  await test.step('restore seeded ride', () => tapAction(page, 'continue'));
  await test.step('resume stopped fixture', () => tapAction(page, 'resume'));
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
      await continueJourney(
        page,
        false,
        scenario.longest,
        undefined,
        scenario.halfSpeed,
      );
      // The closer half-speed fixture still starts outside the conservative
      // closing horizon. It cannot pass by restoring an already closed road.
      if (scenario.halfSpeed) {
        const initial = await snapshot(page);
        expect(initial.speedUPerSec).toBe(0);
        expect(initial.crossings.find((c) => c.id === CROSSING)?.phase).toBe(
          'OPEN',
        );
        expect(initial.crossings.find((c) => c.id === CROSSING)?.barrier).toBe(
          0,
        );
      }
      if (scenario.longest)
        expect((await snapshot(page)).consistLengthU).toBe(2000);
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
      // Camera-1 shows more ahead: even the longest train must show the
      // start of lowering, rather than first seeing an already closed crossing.
      expect(result.lowering).toBeDefined();
      expect(result.lowering?.x).toBeGreaterThan(0);
      expect(result.lowering?.x).toBeLessThan(page.viewportSize()?.width ?? 0);
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

  for (const renderer of ['canvas', 'webgl']) {
    test(`SCN-RD02/03: road traffic waits, fronts follow displacement and restart after the last wagon (${renderer})`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await continueJourney(page, true, false, renderer);
      expect((await snapshot(page)).renderer).toBe(renderer);
      // Restore a stopped train over the road: runner latency cannot coast it past.
      const stopped = (await snapshot(page)).crossings.find(
        (c) => c.id === CROSSING,
      );
      expect(stopped?.occupied).toBe(true);
      expect((await snapshot(page)).speedUPerSec).toBe(0);
      await expect
        .poll(
          async () =>
            new Set(
              (await snapshot(page)).roadVehicles
                .filter(
                  (c) =>
                    c.roadKind === 'crossing' &&
                    c.kind.startsWith('road.car-') &&
                    c.velocityXUPerSec === 0 &&
                    c.velocityYUPerSec === 0,
                )
                .map((c) => (c.kind.endsWith('front') ? 'front' : 'back')),
            ).size,
          { timeout: 20_000 },
        )
        .toBe(2);
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
      const beforeDrive = await snapshot(page);
      const droveOn = await page.evaluate(
        async ({ id, crossedBefore, zoneHalfU }) => {
          const api = (
            window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
          ).__vlacek;
          let braked = false;
          let previous = api.snapshot();
          const waited = new Set(
            previous.roadVehicles
              .filter(
                (c) =>
                  c.roadKind === 'crossing' &&
                  c.kind.startsWith('road.car-') &&
                  c.velocityXUPerSec === 0 &&
                  c.velocityYUPerSec === 0,
              )
              .map((c) => c.id),
          );
          const restarted = new Set<string>(),
            directions = new Set<number>(),
            variants = new Set<string>();
          let measured = 0,
            stationary = 0,
            cameraMovedWhileWaiting = false;
          try {
            for (let frame = 0; frame < 1200; frame++) {
              await new Promise((resolve) => requestAnimationFrame(resolve));
              const state = api.snapshot();
              const crossing = state.crossings.find((c) => c.id === id);
              if (!crossing) return false;
              for (const car of state.roadVehicles.filter(
                (c) =>
                  c.roadKind === 'crossing' && c.kind.startsWith('road.car-'),
              )) {
                const old = previous.roadVehicles.find((c) => c.id === car.id);
                if (!old) continue;
                const dx = car.worldXU - old.worldXU,
                  dy = car.worldYU - old.worldYU,
                  len = Math.hypot(dx, dy);
                if (len > 1e-6) {
                  if ((dx * car.frontX + dy * car.frontY) / len <= 0.9)
                    throw new Error(
                      `front opposes measured crossing displacement ${car.id}/${car.kind}`,
                    );
                  measured++;
                  directions.add(Math.sign(dy));
                  variants.add(car.kind);
                  if (waited.has(car.id)) restarted.add(car.id);
                } else if (waited.has(car.id)) {
                  if (
                    Math.abs(old.frontX - car.frontX) > 1e-8 ||
                    Math.abs(old.frontY - car.frontY) > 1e-8
                  )
                    throw new Error(`stopped front changed ${car.id}`);
                  stationary++;
                  if (state.headS !== previous.headS)
                    cameraMovedWhileWaiting = true;
                }
              }
              previous = state;
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
                crossing.crossed > crossedBefore &&
                restarted.size >= 2 &&
                directions.size === 2
              )
                return {
                  open: crossing.barrier === 0 && !crossing.occupied,
                  measured,
                  stationary,
                  restarted: restarted.size,
                  directions: [...directions],
                  variants: [...variants],
                  cameraMovedWhileWaiting,
                  headS: state.headS,
                };
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
      expect(droveOn).not.toBe(false);
      if (!droveOn) throw new Error('crossing motion proof missing');
      expect(droveOn.open).toBe(true);
      expect(droveOn.measured).toBeGreaterThan(10);
      expect(droveOn.stationary).toBeGreaterThan(0);
      expect(droveOn.restarted).toBeGreaterThanOrEqual(2);
      expect(droveOn.directions.sort()).toEqual([-1, 1]);
      expect(droveOn.cameraMovedWhileWaiting).toBe(true);
      expect(droveOn.headS).toBeGreaterThan(beforeDrive.headS);
      await page.mouse.up();
    });
  }
});
