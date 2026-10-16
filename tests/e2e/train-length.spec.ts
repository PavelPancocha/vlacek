import { expect, test, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import {
  expectWholeTrainInView,
  snapshot,
  tapAction,
  trainBoxesOverFrames,
} from './helpers.ts';

async function buildExactLongestTrain(page: Page): Promise<void> {
  await page.goto('./?debug=1&seed=123');
  await tapAction(page, 'loco:steam_local');
  await tapAction(page, 'to-depot');
  for (let i = 0; i < 11; i++) await tapAction(page, 'add:passenger_open');
  await tapAction(page, 'add:cargo_box');
  await expect(page.locator('.length-meter')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.locator('.count')).toHaveText('12');
  for (const card of await page.locator('[data-action^="add:"]').all())
    await expect(card).toBeDisabled();
}

test('D-028/TRN-07: build, ride and restore the exact 2000 u train through crossing 3 and tunnel 6', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await buildExactLongestTrain(page);
  const order = await page.locator('.strip-item').evaluateAll((items) =>
    items.map((item) => ({
      action: item.getAttribute('data-action'),
      x: item.getBoundingClientRect().x,
    })),
  );
  for (let i = 1; i < order.length; i++)
    expect(order[i]?.x).toBeLessThan(order[i - 1]?.x ?? -Infinity);
  await tapAction(page, 'depart');
  // D-019 drew synchronously; D-030's hidden curtain marks the first presented frame.
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('.ride-curtain')?.hidden === true,
  );
  await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 20));
  expect((await snapshot(page)).consistLengthU).toBe(2000);
  await page.mouse.move(700, 200);
  await page.mouse.down();
  const result = await page.evaluate(async (version) => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    let occupiedFrames = 0;
    let crossingCleared = false;
    let tunnelEntered = false;
    let tunnelCleared = false;
    let allDrawn = true;
    let retained = true;
    let barriersClosed = true;
    let allInView = true;
    for (let frame = 0; frame < 3600; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const s = api.snapshot();
      allDrawn &&= s.artVehicles === 13 && s.renderedVehicles === 13;
      retained &&=
        s.trackStartS <= s.tailS - 1600 && s.trackEndS >= s.frontS + 2048;
      allInView &&=
        !!s.trainBox && s.trainBox.left >= 0 && s.trainBox.right <= innerWidth;
      const c = s.crossings.find(
        (c) => c.id === `g${version}:chunk:3:crossing:0`,
      );
      if (c?.occupied) {
        occupiedFrames++;
        barriersClosed &&= c.barrier === 1;
      }
      if (occupiedFrames && c?.phase === 'OPEN') crossingCleared = true;
      const t = s.tunnels.find((t) => t.id === `g${version}:chunk:6:tunnel:0`);
      if (t && t.train !== 'outside') tunnelEntered = true;
      if (tunnelEntered && t?.train === 'outside') tunnelCleared = true;
      if (crossingCleared && tunnelCleared) break;
    }
    return {
      occupiedFrames,
      crossingCleared,
      tunnelEntered,
      tunnelCleared,
      allDrawn,
      retained,
      barriersClosed,
      allInView,
    };
  }, TRACK_GENERATOR_VERSION);
  await page.mouse.up();
  expect(result.occupiedFrames).toBeGreaterThan(0);
  expect(result).toMatchObject({
    crossingCleared: true,
    tunnelEntered: true,
    tunnelCleared: true,
    allDrawn: true,
    retained: true,
    barriersClosed: true,
    allInView: true,
  });
  await tapAction(page, 'pause');
  await page.reload();
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  // D-019 drew synchronously; D-030's hidden curtain marks the first presented frame.
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('.ride-curtain')?.hidden === true,
  );
  await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 20));
  const restored = await snapshot(page);
  expect(restored.vehicles).toBe(13);
  expect(restored.artVehicles).toBe(13);
  expect(restored.speedUPerSec).toBe(0);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [844, 390],
  [667, 375],
  [568, 320],
] as const) {
  test(`D-028: full depot and all 32 cards remain reachable on ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await buildExactLongestTrain(page);
    const meter = await page.locator('.length-meter').boundingBox();
    const depart = await page.locator('[data-action="depart"]').boundingBox();
    if (!meter || !depart) throw new Error('depot controls missing');
    for (const box of [meter, depart]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    const cards = page.locator('[data-action^="add:"]');
    await expect(cards).toHaveCount(32);
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      if (!box) throw new Error('wagon card missing');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      // On 568 px the existing grid places Vyjet beside the top row.
      const overlapsDeparture =
        box.x < depart.x + depart.width &&
        box.x + box.width > depart.x &&
        box.y < depart.y + depart.height &&
        box.y + box.height > depart.y;
      expect(overlapsDeparture).toBe(false);
      expect(box.width).toBeGreaterThanOrEqual(112);
      expect(box.height).toBeGreaterThanOrEqual(64);
    }
    await tapAction(page, 'depart');
    // D-019 drew synchronously; D-030's hidden curtain marks the first presented frame.
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('.ride-curtain')?.hidden === true,
    );
    await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 20));
    expect((await snapshot(page)).artVehicles).toBe(13);
  });
}
