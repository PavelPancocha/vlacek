import { expect, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { RideSimulation } from '../../src/domain/ride/RideSimulation.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';

// Owner decision 2026-10-16 (D-030): allow up to 15 s for the start curtain.
const RIDE_START_TIMEOUT_MS = 15_000;

export async function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => {
    const api = (
      window as unknown as { __vlacek?: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    if (!api) throw new Error('debug API missing: open the page with ?debug=1');
    return api.snapshot();
  });
}

/**
 * D-030: a new ride or a diagnostic jump prepares its region/season atlases
 * asynchronously (decode on demand). Waits until they are published and every
 * drawn world part is resident; bounded by the test timeout.
 */
export async function waitForWorldAtlases(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const state = (
      window as unknown as { __vlacek?: { snapshot(): DebugSnapshot } }
    ).__vlacek?.snapshot();
    return (
      state !== undefined &&
      !state.worldAtlases.pending &&
      state.artAtlas !== undefined &&
      state.vehicleAtlas !== undefined &&
      state.worldAtlases.missingFrames.length === 0
    );
  });
}

export async function waitForWorldAtlasesWithoutVehicleArt(
  page: Page,
): Promise<void> {
  // D-019 loaded world art before the ride; D-030 publishes it even after vehicle art fails.
  await page.waitForFunction(() => {
    const state = (
      window as unknown as { __vlacek?: { snapshot(): DebugSnapshot } }
    ).__vlacek?.snapshot();
    return (
      state !== undefined &&
      !state.worldAtlases.pending &&
      state.artAtlas !== undefined &&
      state.worldAtlases.missingFrames.length === 0
    );
  });
}

export async function tapAction(page: Page, action: string): Promise<void> {
  await page.locator(`[data-action="${action}"]`).first().click();
}

export async function waitForRideStart(page: Page): Promise<void> {
  await expect(page.locator('.ride-curtain')).toBeHidden({
    timeout: RIDE_START_TIMEOUT_MS,
  });
}

/** First run: choose a locomotive, add wagons and depart. */
export async function startRide(
  page: Page,
  wagons: string[] = ['cargo_box'],
  query = '?debug=1',
): Promise<void> {
  await page.goto(`./${query}`);
  await tapAction(page, 'loco:steam_local');
  await tapAction(page, 'to-depot');
  for (const wagon of wagons) await tapAction(page, `add:${wagon}`);
  await tapAction(page, 'depart');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  await waitForRideStart(page);
}

/** Holds the mouse in the world until the train is clearly moving. */
export async function driveUntilMoving(
  page: Page,
  minSpeed = 60,
  at = { x: 700, y: 300 },
): Promise<void> {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect
    .poll(async () => (await snapshot(page)).speedUPerSec, { timeout: 8_000 })
    .toBeGreaterThan(minSpeed);
}

/** Steam locomotive and containers until no wagon fits (doc 14 §2). */
export async function buildLongestTrain(
  page: Page,
  query = '?debug=1',
): Promise<void> {
  await page.goto(`./${query}`);
  await tapAction(page, 'loco:steam_local');
  await tapAction(page, 'to-depot');
  const container = page.locator('[data-action="add:cargo_container"]');
  while (await container.isEnabled()) await container.click();
}

type Box = DebugSnapshot['trainBox'];

/** The train box (CSS px) on each of the next animation frames. */
export async function trainBoxesOverFrames(
  page: Page,
  frames: number,
): Promise<Box[]> {
  return page.evaluate(async (count) => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    const boxes: Box[] = [];
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      boxes.push(api.snapshot().trainBox);
    }
    return boxes;
  }, frames);
}

/** Inside the viewport, below the corner buttons and above the brake. */
export async function expectWholeTrainInView(
  page: Page,
  boxes: readonly Box[],
): Promise<void> {
  const viewport = page.viewportSize();
  const brake = await page.locator('[data-action="brake"]').boundingBox();
  const corner = await page.locator('.corner').boundingBox();
  if (!viewport || !brake || !corner) throw new Error('HUD controls missing');
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box, 'train box').toBeDefined();
    if (!box) return;
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
    expect(box.top).toBeGreaterThanOrEqual(corner.y + corner.height - 1);
    expect(box.bottom).toBeLessThanOrEqual(brake.y + 1);
  }
}

/** A real saved ride in world 123; camera tests share the exact 2000 u consist. */
export async function restoredTrain(
  page: Page,
  longest: boolean,
  chunkIndex = 3,
): Promise<RideSimulation> {
  const ids = longest
    ? [...Array.from({ length: 11 }, () => 'passenger_open'), 'cargo_box']
    : ['cargo_box', 'passenger_open', 'cargo_coal'];
  const consist = {
    locomotiveId: 'steam_local',
    wagons: ids.map((definitionId, i) => ({
      instanceId: `w${i + 1}`,
      definitionId,
      visualSeed: i,
    })),
  };
  const head = { chunkIndex, arcOffsetU: 650 };
  const save = {
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-13T00:00:00.000Z',
    appBuildId: 'camera-test',
    settings: {
      sfxEnabled: false,
      musicEnabled: false,
      reducedEffects: false,
      maxSpeedFactor: 1,
      quality: 'standard',
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
  };
  await page.addInitScript((json) => {
    if (localStorage.getItem('vlacek.save.v1') === null)
      localStorage.setItem('vlacek.save.v1', json);
  }, JSON.stringify(save));
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await waitForRideStart(page);
  await expect
    .poll(async () => (await snapshot(page)).artVehicles)
    .toBe(ids.length + 1);
  const vehicles = [consist.locomotiveId, ...ids].map((id) => {
    const vehicle = [...locomotives, ...wagons].find((v) => v.id === id);
    if (!vehicle) throw new Error(id);
    return vehicle;
  });
  return new RideSimulation({
    seed: 123,
    vehicles,
    speedFactor: 1,
    config: gameConfig,
    head,
  });
}
