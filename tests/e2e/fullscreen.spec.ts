import { expect, test } from '@playwright/test';
import {
  buildLongestTrain,
  expectWholeTrainInView,
  snapshot,
  startRide,
  tapAction,
  trainBoxesOverFrames,
} from './helpers.ts';

test('PWA-07 / UI-05: missing fullscreen hides the button and online play works', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: undefined });
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      value: undefined,
    });
  });
  await page.goto('./?debug=1');
  await expect(page.locator('[data-action="fullscreen"]')).toHaveCount(0);
  await startRide(page);
  await expect(page.locator('[data-action="fullscreen"]')).toHaveCount(0);
  await tapAction(page, 'pause');
  await expect(page.locator('[data-action="fullscreen"]')).toHaveCount(0);
  await tapAction(page, 'resume');
  expect((await snapshot(page)).screen).toBe('RIDING');
});

test('fullscreen: a start tap enters and a second tap exits using the real Chromium API', async ({
  page,
  isMobile,
}) => {
  await page.goto('./?debug=1');
  const enter = page.getByRole('button', {
    name: 'Celá obrazovka',
    exact: true,
  });
  await expect(enter).toBeVisible();
  if (isMobile || test.info().project.name === 'tablet-touch')
    await enter.tap();
  else await enter.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.fullscreenElement === document.documentElement,
      ),
    )
    .toBe(true);
  const exit = page.getByRole('button', {
    name: 'Ukončit celou obrazovku',
    exact: true,
  });
  await expect(exit).toHaveAttribute('aria-pressed', 'true');
  await exit.click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await expect(enter).toBeVisible();
  expect((await snapshot(page)).screen).toBe('SELECT_LOCO');
});

test('fullscreen: pause stays paused, external exit updates the button, D-008 keeps the longest train in view', async ({
  page,
}) => {
  await buildLongestTrain(page);
  await tapAction(page, 'depart');
  await expect(page.locator('[data-action="fullscreen"]')).toHaveCount(0);
  await tapAction(page, 'pause');
  const before = await snapshot(page);
  await tapAction(page, 'fullscreen');
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  expect((await snapshot(page)).screen).toBe('PAUSED');
  expect((await snapshot(page)).headS).toBe(before.headS);
  expect((await snapshot(page)).pointers).toBe(0);
  await tapAction(page, 'resume');
  await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 3));
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
  // Chromium cannot resize its native window while fullscreen is active.
  await page.setViewportSize({ width: 960, height: 540 });
  expect((await snapshot(page)).screen).toBe('PAUSED');
  await expect(
    page.getByRole('button', { name: 'Celá obrazovka', exact: true }),
  ).toBeVisible();
  await tapAction(page, 'fullscreen');
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await tapAction(page, 'fullscreen');
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  expect((await snapshot(page)).screen).toBe('PAUSED');
  await tapAction(page, 'resume');
  await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 3));
});

test('PWA-08: denial leaves a playable window without another request', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      value: () => {
        document.documentElement.dataset['fullscreenRequests'] = String(
          Number(document.documentElement.dataset['fullscreenRequests'] ?? 0) +
            1,
        );
        return Promise.reject(new Error('fullscreen denied'));
      },
    });
  });
  await page.goto('./?debug=1');
  await tapAction(page, 'fullscreen');
  await expect(page.locator('[data-action="fullscreen"]')).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Hra pokračuje v okně');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  expect((await snapshot(page)).screen).toBe('RIDING');
  await tapAction(page, 'pause');
  await expect(page.locator('[data-action="fullscreen"]')).toBeDisabled();
  await expect(page.locator('html')).toHaveAttribute(
    'data-fullscreen-requests',
    '1',
  );
  expect(errors).toEqual([]);
});

test('UI-05: fullscreen and the other start/pause actions fit a small landscape phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await startRide(page);
  await tapAction(page, 'pause');
  for (const action of ['fullscreen', 'resume', 'open-depot']) {
    const button = page.locator(`[data-action="${action}"]`);
    await expect(button).toBeInViewport({ ratio: 1 });
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(64);
    expect(box?.height).toBeGreaterThanOrEqual(64);
  }
  await tapAction(page, 'open-depot');
  await tapAction(page, 'change-loco');
  for (const action of ['fullscreen', 'back', 'to-depot']) {
    await expect(page.locator(`[data-action="${action}"]`)).toBeInViewport({
      ratio: 1,
    });
  }
});

test('fullscreen: Enter and Space toggle the focused button without losing focus', async ({
  page,
}) => {
  await page.goto('./?debug=1');
  const button = page.locator('[data-action="fullscreen"]');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await expect(button).toBeFocused();
  await page.keyboard.press('Space');
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await expect(button).toBeFocused();
});
