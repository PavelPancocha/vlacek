import { expect, test, type Page } from '@playwright/test';
import { gameConfig } from '../../src/config/gameConfig.ts';
import type { RideSimulation } from '../../src/domain/ride/RideSimulation.ts';
import {
  expectWholeTrainInView,
  snapshot,
  restoredTrain,
  trainBoxesOverFrames,
} from './helpers.ts';

async function expectProjectionAndView(
  page: Page,
  geometry: RideSimulation,
): Promise<void> {
  const s = await snapshot(page);
  const view = page.viewportSize();
  const box = s.trainBox;
  const first = s.chunkEdges[0];
  const second = s.chunkEdges[1];
  if (!view || !box || first === undefined || second === undefined)
    throw new Error('drawn camera missing');
  const widthU = gameConfig.world.chunkWidthU;
  const pxPerU = (second - first) / widthU;
  // Independent reference: the actual drawn locomotive front identifies the
  // first world chunk edge; SVG overhang is far smaller than a chunk here.
  const leftWorldX = geometry.sample(geometry.frontS).x - box.right / pxPerU;
  const firstChunk = Math.ceil(leftWorldX / widthU);
  const crossing = s.crossings.find((c) =>
    c.id.endsWith(`chunk:${geometry.headCursor().chunkIndex}:crossing:0`),
  );
  if (!crossing) throw new Error('reference crossing missing');
  const crossingChunk = Math.floor(crossing.worldX / widthU);
  const edge = s.chunkEdges[crossingChunk - firstChunk];
  if (edge === undefined) throw new Error('crossing chunk edge outside view');
  expect(crossing.screenX).toBeCloseTo(
    edge + (crossing.worldX - crossingChunk * widthU) * pxPerU,
    6,
  );
  await expectWholeTrainInView(page, [box]);
  expect(Math.abs((box.left + box.right) / 2 / view.width - 0.46)).toBeLessThan(
    0.01,
  );
  expect(box.left / view.width).toBeGreaterThanOrEqual(0.15);
  expect((view.width - box.right) / view.width).toBeGreaterThanOrEqual(0.23);
  expect(geometry.sample(s.trackStartS).x).toBeLessThanOrEqual(leftWorldX);
  expect(geometry.sample(s.trackEndS).x).toBeGreaterThanOrEqual(
    leftWorldX + view.width / pxPerU,
  );
}

for (const [width, height] of [
  [1280, 800],
  [1140, 512],
  [844, 390],
  [568, 320],
] as const)
  for (const longest of [false, true])
    test(`camera-1: ${longest ? 'longest' : 'short'} on ${width}x${height} is centred with surroundings and exact snapshot projection`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      const geometry = await restoredTrain(page, longest);
      await expectProjectionAndView(page, geometry);
      await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 10));
    });

test('camera-1: snapshot projection matches the rebased camera at capped DPR', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1140, height: 512 },
    deviceScaleFactor: 2,
    baseURL: testInfo.project.use.baseURL ?? 'http://localhost:4173/',
  });
  try {
    const page = await context.newPage();
    const geometry = await restoredTrain(page, true, 19);
    await expectProjectionAndView(page, geometry);
  } finally {
    await context.close();
  }
});

for (const longest of [false, true])
  test(`camera-1: ${longest ? 'longest' : 'short'} train and station stay in view on the smallest phone`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    // World 123's first real station is in chunk 57, not chunk 2.
    await restoredTrain(page, longest, 57);
    const state = await snapshot(page);
    expect(state.scenery.localities).toContain('station');
    expect(state.scenery.nearPropOverlaps).toEqual([]);
    expect(state.artVehicles).toBe(longest ? 13 : 4);
    await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 10));
  });
