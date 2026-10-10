import { expect, test, type Page } from '@playwright/test';

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

test('boots the renderer with a build ID and no external requests', async ({
  page,
  baseURL,
}) => {
  const problems = watchPage(page, new URL(baseURL ?? '').origin);
  // Deployed-site check: wait until the CDN serves the expected commit.
  const expectedCommit = process.env['E2E_EXPECT_COMMIT']?.slice(0, 7);
  await expect
    .poll(
      async () => {
        await page.goto('./');
        return page
          .locator('meta[name="vlacek-build"]')
          .getAttribute('content');
      },
      { timeout: expectedCommit ? 120_000 : 10_000, intervals: [2_000] },
    )
    .toContain(expectedCommit ?? '+');
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
