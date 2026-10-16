import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

/** Collects console errors and requests leaving the page origin. */
function watchPage(page: Page, origin: string) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.protocol !== 'data:' &&
      url.protocol !== 'blob:' &&
      url.origin !== origin
    ) {
      problems.push(`external request: ${request.url()}`);
    }
  });
  return problems;
}

/** Wait outside a controlled page, which deliberately pins its original build. */
async function waitForDeployedBuild(
  request: APIRequestContext,
): Promise<string | undefined> {
  const expectedCommit = process.env['E2E_EXPECT_COMMIT']?.slice(0, 7);
  if (expectedCommit) {
    // Poll the server before opening a controlled document. An old active SW
    // deliberately keeps old HTML until every old tab closes (D-031).
    await expect
      .poll(
        async () => {
          const response = await request.get('./', {
            headers: { 'Cache-Control': 'no-cache' },
          });
          return (await response.text()).match(
            /name="vlacek-build" content="([^"]+)"/,
          )?.[1];
        },
        { timeout: 120_000, intervals: [2_000] },
      )
      .toContain(expectedCommit);
  }
  return expectedCommit;
}

test('boots the renderer with a build ID and no external requests', async ({
  page,
  baseURL,
  request,
}) => {
  const problems = watchPage(page, new URL(baseURL ?? '').origin);
  const expectedCommit = await waitForDeployedBuild(request);
  await page.goto('./');
  await expect(page.locator('meta[name="vlacek-build"]')).toHaveAttribute(
    'content',
    new RegExp(expectedCommit ?? '[+]'),
  );
  const root = page.locator('#game-root');
  await expect(root).toHaveAttribute('data-renderer', /^(webgl|canvas)$/);
  await expect(root.locator('canvas')).toBeVisible();
  await expect(page.locator('meta[name="vlacek-build"]')).toHaveAttribute(
    'content',
    /^\d+\.\d+\.\d+\+[0-9a-z]+/,
  );
  expect(problems).toEqual([]);
});

test('runs through the forced Canvas path', async ({ page }) => {
  await page.goto('./?renderer=canvas');
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    'canvas',
  );
  await expect(page.locator('#game-root canvas')).toBeVisible();
});

test('canvas fills the game area in CSS pixels at any device pixel ratio', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    /.+/,
  );
  const sizes = await page.evaluate(() => {
    const root = document.getElementById('game-root');
    const canvas = root?.querySelector('canvas');
    if (!root || !canvas) return null;
    const a = root.getBoundingClientRect();
    const b = canvas.getBoundingClientRect();
    return { root: [a.width, a.height], canvas: [b.width, b.height] };
  });
  expect(sizes).not.toBeNull();
  expect(sizes?.canvas[0]).toBeCloseTo(sizes?.root[0] ?? -1, 0);
  expect(sizes?.canvas[1]).toBeCloseTo(sizes?.root[1] ?? -1, 0);
});

for (const [deviceScaleFactor, density] of [
  [1, 1],
  [2, 1.5],
] as const)
  test.describe(`at device pixel ratio ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test('the canvas follows a resize of the game area', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('#game-root')).toHaveAttribute(
        'data-renderer',
        /.+/,
      );
      const canvasSize = () =>
        page.evaluate(() => {
          const canvas = document.querySelector('#game-root canvas');
          if (!(canvas instanceof HTMLCanvasElement)) return null;
          const box = canvas.getBoundingClientRect();
          return {
            css: [Math.round(box.width), Math.round(box.height)],
            buffer: [canvas.width, canvas.height],
          };
        });
      // Phone rotation and window resizes: the picture must not stretch.
      for (const size of [
        { width: 1024, height: 560 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(size);
        await expect.poll(canvasSize).toEqual({
          css: [size.width, size.height],
          buffer: [size.width * density, size.height * density],
        });
      }
    });
  });

test.describe('quality profile (doc 13 quality, D-014)', () => {
  test.use({ deviceScaleFactor: 2 });

  for (const [quality, density] of [
    ['auto', 1.5],
    ['low', 1],
  ] as const)
    test(`the ${quality} profile renders at density ${density} on a 2x screen`, async ({
      page,
    }) => {
      const save = JSON.stringify({
        schemaVersion: 1,
        contentVersion: 1,
        savedAtIso: '2026-10-10T00:00:00.000Z',
        appBuildId: 'quality-test',
        settings: {
          sfxEnabled: false,
          musicEnabled: false,
          reducedEffects: false,
          maxSpeedFactor: 1,
          quality,
        },
        lastConsist: { locomotiveId: 'steam_local', wagons: [] },
      });
      await page.addInitScript((json) => {
        localStorage.setItem('vlacek.save.v1', json);
      }, save);
      await page.goto('./');
      await expect(page.locator('#game-root')).toHaveAttribute(
        'data-renderer',
        /.+/,
      );
      const ratio = await page.evaluate(() => {
        const canvas = document.querySelector('#game-root canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return 0;
        return canvas.width / canvas.getBoundingClientRect().width;
      });
      expect(ratio).toBeCloseTo(density, 1);
    });
});

test('PWA: the complete live bundle survives an offline reload', async ({
  page,
  context,
  request,
}) => {
  const expectedCommit = await waitForDeployedBuild(request);
  await page.goto('./');
  // Resolve only on activation; first install intentionally does not claim this tab.
  const complete = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) throw new Error('active worker missing');
    const channel = new MessageChannel();
    const result = new Promise<unknown>((resolve) => {
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        channel.port1.close();
        resolve(event.data);
      };
    });
    worker.postMessage('offline-status', [channel.port2]);
    return result;
  });
  expect(complete).toMatchObject({ ready: true });
  const build = await page
    .locator('meta[name="vlacek-build"]')
    .getAttribute('content');
  expect(complete).toMatchObject({ buildId: build });
  if (expectedCommit) expect(build).toContain(expectedCommit);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#game-root canvas')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Vyber mašinku');
});
