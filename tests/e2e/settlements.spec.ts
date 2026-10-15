import { expect, test } from '@playwright/test';
import { snapshot, tapAction } from './helpers.ts';

for (const renderer of ['webgl', 'canvas'])
  for (const kind of [
    'village',
    'village-bus',
    'suburb',
    'town',
    'halt',
    'large-station',
    'big-station',
  ]) {
    test(`D-024: ${kind}, 2000 u train and immediate departure (${renderer})`, async ({
      page,
    }) => {
      await page.clock.install();
      await page.goto(`./?debug=1&seed=1&renderer=${renderer}`);
      await tapAction(page, 'to-depot');
      for (let i = 0; i < 11; i++) await tapAction(page, 'add:passenger_open');
      await tapAction(page, 'add:cargo_box');
      await tapAction(page, 'depart');
      expect((await snapshot(page)).consistLengthU).toBe(2000);
      await tapAction(page, 'pause');
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
      for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
      await page.clock.resume();
      await page.getByText('Testovací scény', { exact: true }).click();
      await expect(
        page.locator(`[data-action="dev-world-scene:${kind}"]`),
      ).toHaveCount(1);
      await tapAction(page, `dev-world-scene:${kind}`);
      await expect
        .poll(async () => (await snapshot(page)).worldDebug.location?.kind)
        .toBe(kind);
      const state = await snapshot(page);
      expect(state.renderer).toBe(renderer);
      expect(state.worldDebug.temporaryRide).toBe(true);
      expect(state.speedUPerSec).toBe(0);
      expect(state.artAtlas).toBeDefined();
      const view = page.viewportSize(),
        box = state.trainBox;
      if (!view || !box) throw Error('missing drawn train');
      // Match camera-1's actual SVG bounds, including the existing art overhang.
      expect(
        Math.abs((box.left + box.right) / 2 / view.width - 0.46),
      ).toBeLessThan(0.01);
      expect(box.left / view.width).toBeGreaterThanOrEqual(0.15);
      expect((view.width - box.right) / view.width).toBeGreaterThanOrEqual(
        0.23,
      );
      // A new input after opening the scene still drives; no station blocks it.
      await page.keyboard.down('ArrowRight');
      await expect
        .poll(async () => (await snapshot(page)).speedUPerSec)
        .toBeGreaterThan(0);
      await page.keyboard.up('ArrowRight');
    });
  }
