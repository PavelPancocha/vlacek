import { expect, test } from '@playwright/test';
import { snapshot, startRide, tapAction } from './helpers.ts';

test('quality address override reports the effective low profile and leaves the save alone', async ({
  page,
}) => {
  await startRide(page, [], '?debug=1&quality=low');
  await expect
    .poll(async () => (await snapshot(page)).renderProfile)
    .toEqual({
      quality: 'low',
      maxDpr: 1,
      fpsLimit: 30,
      effects: 'low',
    });
  await tapAction(page, 'pause');
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('vlacek.save.v1');
    if (!raw) throw new Error('save missing');
    const save: unknown = JSON.parse(raw);
    if (
      typeof save !== 'object' ||
      save === null ||
      !('settings' in save) ||
      typeof save.settings !== 'object' ||
      save.settings === null ||
      !('quality' in save.settings)
    )
      throw new Error('invalid saved settings');
    return save.settings.quality;
  });
  expect(saved).toBe('auto');
  await page.goto('./?debug=1');
  expect((await snapshot(page)).renderProfile).toEqual({
    quality: 'auto',
    maxDpr: 1.5,
    fpsLimit: 0,
    effects: 'standard',
  });
  await page.addInitScript(() => {
    const raw = localStorage.getItem('vlacek.save.v1');
    if (!raw) throw new Error('save missing');
    const save: unknown = JSON.parse(raw);
    if (
      typeof save !== 'object' ||
      save === null ||
      !('settings' in save) ||
      typeof save.settings !== 'object' ||
      save.settings === null ||
      !('quality' in save.settings)
    )
      throw new Error('invalid saved settings');
    save.settings.quality = 'low';
    localStorage.setItem('vlacek.save.v1', JSON.stringify(save));
  });
  await page.reload();
  expect((await snapshot(page)).renderProfile).toEqual({
    quality: 'low',
    maxDpr: 1,
    fpsLimit: 30,
    effects: 'low',
  });
});
