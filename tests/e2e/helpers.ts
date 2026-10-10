import { expect, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';

export async function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => {
    const api = (
      window as unknown as { __vlacek?: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    if (!api) throw new Error('debug API missing: open the page with ?debug=1');
    return api.snapshot();
  });
}

export async function tapAction(page: Page, action: string): Promise<void> {
  await page.locator(`[data-action="${action}"]`).first().click();
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
}

/** Holds the mouse in the world until the train is clearly moving. */
export async function driveUntilMoving(
  page: Page,
  minSpeed = 60,
): Promise<void> {
  await page.mouse.move(700, 300);
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
