import { expect, test, type Page } from '@playwright/test';
import {
  roadStretchCars,
  roadStretchesInChunk,
} from '../../src/domain/world/RoadStretches.ts';
import type { RoadMotionSnapshot } from '../../src/render/roadVehicleSnapshot.ts';
import {
  expectWholeTrainInView,
  snapshot,
  startRide,
  tapAction,
} from './helpers.ts';

type MeasuredFrame = RoadMotionSnapshot;
type RoadObservationApi = { roadMotion(): MeasuredFrame };

// Seed 123, chunk 3: the paired patrols reverse at tick 128. Derive the
// fixture time from their descriptors, never from the heading under test.
const road = roadStretchesInChunk(123, 3).find(
  (r) => r.kind === 'parallel-road',
);
if (!road) throw new Error('parallel patrol fixture road missing');
const patrol = roadStretchCars(road, 3)[1];
if (!patrol?.motion) throw new Error('parallel patrol fixture car missing');
const reversalTick = Math.ceil(
  ((1 - 2 * patrol.phase) * patrol.motion.rangeU * 60) /
    patrol.motion.speedUPerSec,
);

async function headingFixture(page: Page, renderer: string) {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: [{ instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 0 }],
  };
  const save = {
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-14T00:00:00.000Z',
    appBuildId: 'roads-heading-test',
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
      generatorVersion: 2,
      consist,
      head: { chunkIndex: 2, arcOffsetU: 640 },
      simulationTick: reversalTick - 48,
      activeEntities: [],
    },
  };
  await page.clock.install();
  await page.addInitScript(
    (json) => localStorage.setItem('vlacek.save.v1', json),
    JSON.stringify(save),
  );
  await page.goto(`./?debug=1&renderer=${renderer}`);
  await tapAction(page, 'continue');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await page.getByText('Svět — překryvy', { exact: true }).click();
  await tapAction(page, 'dev-world-overlay:roads');
  // Present the hidden menu state once while simulation time is stopped.
  // On resume the camera snaps to the ride HUD instead of easing from pause.
  await page.clock.runFor(16);
  expect((await snapshot(page)).simulationTick).toBe(reversalTick - 48);
  await tapAction(page, 'dev-close');
  await tapAction(page, 'resume');
  expect(
    await page.evaluate(
      () =>
        typeof (window as unknown as { __vlacek: RoadObservationApi }).__vlacek
          .roadMotion,
    ),
  ).toBe('function');
  await page.clock.runFor(50);
  expect((await snapshot(page)).renderer).toBe(renderer);
}

async function measuredFrames(page: Page, frames: number) {
  await page.evaluate((frames) => {
    const api = (window as unknown as { __vlacek: RoadObservationApi })
      .__vlacek;
    const target = window as unknown as { __roadsFrames?: MeasuredFrame[] };
    const result: MeasuredFrame[] = [];
    target.__roadsFrames = result;
    const frame = () => {
      const observation = api.roadMotion();
      result.push({
        simulationTick: observation.simulationTick,
        cars: observation.cars.filter(
          (c) => c.kind === 'back.car' || c.kind.startsWith('road.car-'),
        ),
      });
      if (result.length < frames) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, frames);
  await page.clock.runFor(Math.ceil(((frames + 2) * 1000) / 60));
  const recorded = await page.evaluate(() => {
    const target = window as unknown as { __roadsFrames?: MeasuredFrame[] };
    const result = target.__roadsFrames;
    delete target.__roadsFrames;
    return result;
  });
  expect(recorded).toHaveLength(frames);
  if (!recorded) throw new Error('frame recorder missing');
  return recorded;
}

function expectFrontLeads(frames: Awaited<ReturnType<typeof measuredFrames>>) {
  const variants = new Set<string>(),
    directions = new Set<number>(),
    reversalIds = new Set<string>();
  let moving = 0,
    slopes = 0,
    reversals = 0;
  for (let i = 2; i < frames.length - 1; i++) {
    const before = frames[i - 1],
      after = frames[i];
    if (!before || !after) throw new Error('frame missing');
    for (const car of after.cars) {
      const old = before.cars.find((c) => c.id === car.id);
      if (!old) continue;
      const dx = car.worldXU - old.worldXU,
        dy = car.worldYU - old.worldYU,
        len = Math.hypot(dx, dy);
      if (len < 1e-6) {
        if (
          Math.abs(car.frontX - old.frontX) > 1e-8 ||
          Math.abs(car.frontY - old.frontY) > 1e-8
        )
          throw new Error(`stopped front changed ${car.id}`);
        continue;
      }
      if (old.frontX * car.frontX + old.frontY * car.frontY < 0) {
        // A chord across an instantaneous patrol reversal mixes two legs.
        // Require independent motion before AND after; never accept a run of skipped samples.
        let priorIndex = i - 2,
          nextIndex = i + 1;
        // RAF can present the same fixed simulation tick twice. Prove those
        // observations are identical, then bracket with adjacent simulation steps.
        while (frames[priorIndex]?.simulationTick === before.simulationTick) {
          expect(frames[priorIndex]?.cars.find((c) => c.id === car.id)).toEqual(
            old,
          );
          priorIndex--;
        }
        while (frames[nextIndex]?.simulationTick === after.simulationTick) {
          expect(frames[nextIndex]?.cars.find((c) => c.id === car.id)).toEqual(
            car,
          );
          nextIndex++;
        }
        const prior = frames[priorIndex]?.cars.find((c) => c.id === car.id),
          next = frames[nextIndex]?.cars.find((c) => c.id === car.id);
        expect(car.roadKind).not.toBe('crossing');
        if (!prior || !next) throw new Error(`unbracketed reversal ${car.id}`);
        const px = old.worldXU - prior.worldXU,
          py = old.worldYU - prior.worldYU,
          nx = next.worldXU - car.worldXU,
          ny = next.worldYU - car.worldYU;
        expect(
          px * old.frontX + py * old.frontY,
          `before reversal ${car.id}`,
        ).toBeGreaterThan(0);
        expect(
          nx * next.frontX + ny * next.frontY,
          `after reversal ${car.id}`,
        ).toBeGreaterThan(0);
        expect(px * nx + py * ny).toBeLessThan(0);
        reversals++;
        reversalIds.add(car.id);
        continue;
      }
      const alignment = (dx * car.frontX + dy * car.frontY) / len;
      if (alignment <= 0.9)
        throw new Error(
          `front versus measured displacement ${car.id}: ${alignment}`,
        );
      if (car.parentScaleX <= 0)
        throw new Error(`negative parent scale ${car.id}`);
      variants.add(car.kind);
      directions.add(Math.sign(car.roadKind === 'crossing' ? dy : dx));
      moving++;
      if (car.roadKind !== 'crossing' && Math.abs(dy) > Math.abs(dx) * 0.02)
        slopes++;
    }
  }
  expect(moving).toBeGreaterThan(100);
  return { moving, variants, directions, slopes, reversals, reversalIds };
}

async function roadScene(page: Page, kind: string, renderer: string) {
  await page.clock.install();
  await startRide(
    page,
    ['cargo_box'],
    `?debug=1&seed=${kind === 'highway' ? 1 : 123}&renderer=${renderer}`,
  );
  await tapAction(page, 'pause');
  // Freeze virtual time for the five-tap activation window.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await page.getByText('Svět — překryvy', { exact: true }).click();
  await tapAction(page, 'dev-world-overlay:roads');
  await page.getByText('Testovací scény', { exact: true }).click();
  await expect(
    page.locator(`[data-action="dev-world-scene:${kind}"]`),
  ).toHaveCount(1);
  await tapAction(page, `dev-world-scene:${kind}`);
  await page.clock.resume();
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  await expect.poll(async () => (await snapshot(page)).renderer).toBe(renderer);
}
for (const renderer of ['canvas', 'webgl']) {
  test(`SCN-RD02/03/04: still camera, world/front arrows and both lanes (${renderer})`, async ({
    page,
  }) => {
    await headingFixture(page, renderer);
    const before = await snapshot(page);
    expect(before.roadVehicles.length).toBeGreaterThan(0);
    expect(before.roadVehicles.every((car) => car.arrows)).toBe(true);
    const ordinary = await measuredFrames(page, 36);
    expect(ordinary.every((f) => f.simulationTick < reversalTick)).toBe(true);
    const reversal = await measuredFrames(page, 36);
    expect(reversal[0]?.simulationTick).toBeLessThan(reversalTick);
    expect(reversal.at(-1)?.simulationTick).toBeGreaterThan(reversalTick);
    // Check each window separately so a gap between them is never a motion chord.
    const proof = expectFrontLeads(reversal);
    const ordinaryProof = expectFrontLeads(ordinary);
    expect(ordinaryProof.reversalIds.has(patrol.id)).toBe(false);
    expect(ordinaryProof.directions.size).toBe(2);
    expect(ordinaryProof.slopes).toBeGreaterThan(0);
    expect(proof.directions.size).toBe(2);
    expect(proof.slopes).toBeGreaterThan(0);
    expect(proof.reversals).toBeGreaterThan(0);
    for (const car of roadStretchCars(road, 3))
      expect(
        proof.reversalIds.has(car.id),
        `known paired reversal ${car.id}`,
      ).toBe(true);
    await test.info().attach('motion-observations.json', {
      body: JSON.stringify({
        reversalTick,
        ordinary: {
          moving: ordinaryProof.moving,
          ticks: ordinary.map((f) => f.simulationTick),
        },
        reversal: {
          moving: proof.moving,
          slopes: proof.slopes,
          ids: [...proof.reversalIds],
          ticks: reversal.map((f) => f.simulationTick),
        },
      }),
      contentType: 'application/json',
    });
    const after = await snapshot(page);
    expect(after.headS).toBe(before.headS);
    expect(after.trainBox).toEqual(before.trainBox);
    expect(after.speedUPerSec).toBe(0);
    const moving = after.roadVehicles.filter(
      (car) => car.kind === 'back.car' && car.velocityXUPerSec !== 0,
    );
    expect(
      new Set(moving.map((car) => Math.sign(car.velocityXUPerSec))).size,
    ).toBe(2);
    for (const car of moving) {
      const initial = before.roadVehicles.find((c) => c.id === car.id);
      expect(initial).toBeDefined();
      expect(car.parentScaleX).toBeGreaterThan(0);
      expect(car.wheelAngleRad).not.toBe(initial?.wheelAngleRad);
    }
    expect(after.crossings.length).toBeGreaterThan(0);
    await tapAction(page, 'pause');
    const paused = await snapshot(page);
    await page.clock.runFor(500);
    expect((await snapshot(page)).roadVehicles).toEqual(paused.roadVehicles);
  });
  test(`SCN-RD04: parallel-road locator, menu and arrows (${renderer})`, async ({
    page,
  }) => {
    await roadScene(page, 'parallel-road', renderer);
    const state = await snapshot(page);
    expect(state.worldDebug.location?.kind).toBe('parallel-road');
    expect(state.crossings.some((c) => c.worldX === 3328)).toBe(true);
    expect(state.roadVehicles.some((c) => c.roadKind === 'parallel-road')).toBe(
      true,
    );
    expect(state.roadVehicles.every((c) => c.arrows)).toBe(true);
    expect(state.worldDebug.overlayPrimitives).toBeGreaterThan(0);
  });
  test(`SCN-RD05/06/07: highway locator, traffic and cleanup (${renderer})`, async ({
    page,
  }) => {
    await roadScene(page, 'highway', renderer);
    const state = await snapshot(page);
    expect(state.worldDebug.location?.kind).toBe('highway');
    expect(state.worldDebug.location?.worldXU).toBe(16896);
    expect(state.roadVehicles.some((car) => car.roadKind === 'highway')).toBe(
      true,
    );
    await tapAction(page, 'pause');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
    for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
    await page.getByText('Testovací scény', { exact: true }).click();
    await tapAction(page, 'dev-world-return');
    await page.clock.resume();
    await expect
      .poll(async () =>
        (await snapshot(page)).roadVehicles.some(
          (car) => car.roadKind === 'highway',
        ),
      )
      .toBe(false);
  });
  test(`SCN-RD05: road-end scene stays in the world with a clear train (${renderer})`, async ({
    page,
  }) => {
    await roadScene(page, 'road-ends', renderer);
    const state = await snapshot(page);
    expect(state.worldDebug.location?.kind).toBe('road-ends');
    expect(
      state.roadVehicles.some((car) => car.roadKind === 'parallel-road'),
    ).toBe(true);
    expect(state.scenery.nearPropsOverTrain).toBe(0);
    expect(state.worldDebug.overlayPrimitives).toBeGreaterThan(0);
    await expectWholeTrainInView(page, [state.trainBox]);
  });
}
