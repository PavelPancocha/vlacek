import { expect, test } from '@playwright/test';
import { snapshot, tapAction } from './helpers.ts';
async function openWorldMenu(page: import('@playwright/test').Page) {
  await page.clock.install();
  await page.goto('./?debug=1&seed=1');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  await tapAction(page, 'pause');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await expect(
    page.getByRole('region', { name: 'Vývojářské volby' }),
  ).toBeVisible();
  await page.clock.resume();
}
test('DEV-01: Build gate has a 44px tap target and unchanged five-tap activation', async ({
  page,
}) => {
  await page.goto('./');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  await tapAction(page, 'pause');
  expect(
    (await page.locator('.build-id').boundingBox())?.height,
  ).toBeGreaterThanOrEqual(44);
});
test('DEV-02/03: scene menu and overlays work, temporary ride preserves save across pause/reload', async ({
  page,
}) => {
  await openWorldMenu(page);
  const before = await page.evaluate(() => ({
    save: localStorage.getItem('vlacek.save.v1'),
    backup: localStorage.getItem('vlacek.save.backup.v1'),
  }));
  await page.getByText('Svět — překryvy', { exact: true }).click();
  await tapAction(page, 'dev-world-overlay:areas');
  await expect(
    page.locator('[data-action="dev-world-overlay:areas"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByText('Testovací scény', { exact: true }).click();
  for (const kind of [
    'tunnel',
    'crossing',
    'station',
    'town',
    'autumn',
    'winter',
    'coast',
    'fishponds',
    'dunes',
    'mountains',
    'forest-work',
  ])
    await expect(
      page.locator(`[data-action="dev-world-scene:${kind}"]`),
    ).toHaveCount(1);
  await tapAction(page, 'dev-world-scene:dunes');
  await expect(page.locator('#ui-layer')).toHaveAttribute(
    'data-screen',
    'RIDING',
  );
  await expect
    .poll(async () => (await snapshot(page)).worldDebug.location?.kind)
    .toBe('dunes');
  expect((await snapshot(page)).worldDebug.temporaryRide).toBe(true);
  expect((await snapshot(page)).worldDebug.overlayPrimitives).toBeGreaterThan(
    0,
  );
  await tapAction(page, 'pause');
  expect(
    await page.evaluate(() => ({
      save: localStorage.getItem('vlacek.save.v1'),
      backup: localStorage.getItem('vlacek.save.backup.v1'),
    })),
  ).toEqual(before);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await expect(
    page.locator('[data-action="dev-world-overlay:areas"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.clock.resume();
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeVisible();
  await tapAction(page, 'continue');
  expect((await snapshot(page)).headChunk).toBeLessThan(3);
});
test('DEV-04: placement trace is requested on demand and leaves the seeded scene unchanged', async ({
  page,
}) => {
  await openWorldMenu(page);
  await page.getByText('Umístění — stopa', { exact: true }).click();
  await page.getByLabel('Objekt nebo worldXU', { exact: true }).fill('512');
  await tapAction(page, 'dev-world-trace');
  await expect(page.locator('[data-world-trace]')).toContainText('admissible');
  await expect(page.locator('[data-world-trace]')).toContainText('candidate');
});
test('DEV-03: explicit render preferences end the temporary ride before saving ordinary settings', async ({
  page,
}) => {
  await openWorldMenu(page);
  const ordinary = await snapshot(page);
  await page.getByText('Testovací scény', { exact: true }).click();
  await tapAction(page, 'dev-world-scene:dunes');
  await tapAction(page, 'pause');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await page.clock.resume();
  await page.getByLabel('Kvalita', { exact: true }).selectOption('low');
  await Promise.all([
    page.waitForEvent('framenavigated', {
      predicate: (f) => f === page.mainFrame(),
    }),
    tapAction(page, 'dev-apply'),
  ]);
  await expect(page.locator('[data-action="continue"]')).toBeVisible();
  await tapAction(page, 'continue');
  const restored = await snapshot(page);
  expect(restored.renderProfile.quality).toBe('low');
  expect(restored.worldDebug.temporaryRide).toBe(false);
  expect(restored.seed).toBe(ordinary.seed);
  expect(restored.headS).toBe(ordinary.headS);
  expect(restored.simulationTick).toBe(ordinary.simulationTick);
  expect(restored.vehicles).toBe(ordinary.vehicles);
});
