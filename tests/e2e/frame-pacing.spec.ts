import { expect, test } from '@playwright/test';
import { snapshot, startRide, tapAction } from './helpers.ts';

test('frame pacing exports ordered samples, causal events and a graph without blocking drive', async ({
  page,
}) => {
  await startRide(page, ['cargo_box'], '?debug=1&perfgraph=1&seed=20261009');
  await expect(page.locator('#frame-time-graph')).toBeVisible();
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => {
    const api = (
      window as unknown as {
        __vlacek: {
          snapshot(): {
            framePacing?: { summary: { frames: number } };
            speedUPerSec: number;
          };
        };
      }
    ).__vlacek;
    const state = api.snapshot();
    return (
      (state.framePacing?.summary.frames ?? 0) >= 30 && state.speedUPerSec > 0
    );
  });
  await page.keyboard.up('ArrowRight');
  const state = await snapshot(page),
    pacing = state.framePacing;
  expect(pacing?.summary.frames).toBeGreaterThanOrEqual(30);
  expect(pacing?.frames.some((row) => (row[4] ?? 0) > 0)).toBe(true);
  expect(
    pacing?.frames.every(
      (row, i, rows) => i === 0 || (row[0] ?? 0) > (rows[i - 1]?.[0] ?? 0),
    ),
  ).toBe(true);
  expect(pacing?.device.canvasWidth).toBeGreaterThan(0);
  expect(pacing?.summary.estimatedRefreshHz).toBeGreaterThan(0);
  await expect(page.locator('#diagnostics')).toContainText('dlouhé');
  await tapAction(page, 'pause');
  const build = page.locator('.build-id');
  for (let i = 0; i < 5; i++) await build.press('Enter');
  await expect(
    page.getByLabel('Graf času snímků', { exact: true }),
  ).toHaveValue('on');
  await tapAction(page, 'dev-details');
  await tapAction(page, 'dev-copy-json');
  // Clipboard may succeed or fall back; both export the complete current snapshot.
  await expect(page.locator('.diagnostics-detail')).toBeVisible();
});

test('hidden graph selection survives reload and releases the URL override', async ({
  page,
}) => {
  await startRide(page, [], '?debug=1&perfgraph=0&keep=yes');
  await expect(page.locator('#frame-time-graph')).toHaveCount(0);
  await tapAction(page, 'pause');
  const build = page.locator('.build-id');
  for (let i = 0; i < 5; i++) await build.press('Enter');
  await page.getByLabel('Graf času snímků', { exact: true }).selectOption('on');
  await Promise.all([page.waitForEvent('load'), tapAction(page, 'dev-apply')]);
  expect(new URL(page.url()).searchParams.has('perfgraph')).toBe(false);
  expect(new URL(page.url()).searchParams.get('keep')).toBe('yes');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect(page.locator('#frame-time-graph')).toBeVisible();
});
