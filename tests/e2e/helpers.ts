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
