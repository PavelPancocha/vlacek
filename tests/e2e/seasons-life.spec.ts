import { expect, test, type Page } from '@playwright/test';
import { snapshot, startRide, tapAction, driveUntilMoving } from './helpers.ts';
async function scene(page: Page, kind: 'autumn' | 'winter', renderer: string) {
  await startRide(
    page,
    ['cargo_box'],
    `?debug=1&seed=${kind === 'winter' ? 2 : 3}&renderer=${renderer}&quality=standard`,
  );
  await tapAction(page, 'pause');
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await page.clock.resume();
  await page.getByText('Testovací scény', { exact: true }).click();
  await tapAction(page, `dev-world-scene:${kind}`);
  await expect
    .poll(async () => (await snapshot(page)).worldDebug.location?.kind)
    .toBe(kind);
}
for (const renderer of ['canvas', 'webgl']) {
  test(`SEA-03: autumn local leaves and bounded life (${renderer})`, async ({
    page,
  }) => {
    await scene(page, 'autumn', renderer);
    await expect
      .poll(
        async () => (await snapshot(page)).effects.kinds['leaf-fall'] ?? 0,
        { timeout: 8000 },
      )
      .toBeGreaterThan(0);
    const s = await snapshot(page);
    expect(s.effects.seasonalSources).toBeLessThanOrEqual(32);
    expect(s.effects.live).toBeLessThanOrEqual(240);
    expect(s.speedUPerSec).toBe(0);
    const climate = s.backdrop?.world?.season;
    await tapAction(page, 'pause');
    const frozen = (await snapshot(page)).effects;
    await expect
      .poll(async () => (await snapshot(page)).effects.checksum)
      .toBe(frozen.checksum);
    expect((await snapshot(page)).backdrop?.world?.season).toBe(climate);
  });
  test(`SEA-04: stopped snowfall, moving bogie snow, stopped fade (${renderer})`, async ({
    page,
  }) => {
    await scene(page, 'winter', renderer);
    await expect
      .poll(async () => (await snapshot(page)).effects.kinds['snow-mid'] ?? 0, {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
    expect((await snapshot(page)).effects.kinds['snow'] ?? 0).toBe(0);
    await driveUntilMoving(page, 100);
    await expect
      .poll(async () => (await snapshot(page)).effects.kinds['snow'] ?? 0, {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
    await page.mouse.up();
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await snapshot(page)).speedUPerSec).toBe(0);
    await page.keyboard.up('ArrowLeft');
    await expect
      .poll(async () => (await snapshot(page)).effects.kinds['snow'] ?? 0)
      .toBe(0);
    expect(
      (await snapshot(page)).effects.kinds['snow-mid'] ?? 0,
    ).toBeGreaterThan(0);
  });
}
