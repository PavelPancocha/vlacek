import { expect, test } from '@playwright/test';
import { snapshot, tapAction } from './helpers.ts';

test('PERF: debug probe records a real departure without exposing writable game state', async ({
  page,
}) => {
  await page.goto('./?debug=1&renderer=canvas&seed=123');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  await expect
    .poll(async () => (await snapshot(page)).perf?.ride?.artReadyMs)
    .toBeGreaterThan(0);
  const state = await snapshot(page);
  expect(state.perf?.startInteractiveMs).toBeGreaterThan(0);
  expect(state.perf?.svg.fetchCount).toBeGreaterThan(0);
  const publishedFrames =
    state.worldAtlases.pages.reduce((sum, page) => sum + page.frames, 0) +
    (state.vehicleAtlas?.frames ?? 0);
  expect(state.perf?.svg.decodeCount).toBe(publishedFrames);
  expect(state.perf?.svg.fetchCount).toBe(publishedFrames);
  expect(state.perf?.svg.fetchMs).toBeGreaterThan(0);
  expect(state.perf?.atlas.count).toBe(3);
  expect(state.perf?.chunks.length).toBeGreaterThan(0);
  expect(state.perf?.chunks.length).toBeLessThanOrEqual(12);
  expect(state.perf?.ride?.firstFrameMs).toBeLessThanOrEqual(
    state.perf?.ride?.artReadyMs ?? 0,
  );
  expect(state.speedUPerSec).toBe(0);
  await page.evaluate(() => {
    const api = (
      window as unknown as {
        __vlacek: { snapshot(): { perf: { svg: { fetchCount: number } } } };
      }
    ).__vlacek;
    api.snapshot().perf.svg.fetchCount = -1;
  });
  expect((await snapshot(page)).perf?.svg.fetchCount).toBe(
    state.perf?.svg.fetchCount,
  );
});

test('PERF: the public debug API is absent without debug enabled', async ({
  page,
}) => {
  await page.goto('./?renderer=canvas');
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    'canvas',
  );
  expect(await page.evaluate(() => '__vlacek' in window)).toBe(false);
});
