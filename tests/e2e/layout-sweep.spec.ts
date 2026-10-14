import { expect, test, type Locator, type Page } from '@playwright/test';
import { buildLongestTrain } from './helpers.ts';

async function insideViewport(button: Locator, minimum = 64) {
  await expect(button).toBeInViewport({ ratio: 1 });
  expect(
    await button.evaluate((node, minimum) => {
      const rect = node.getBoundingClientRect();
      return {
        targetSize: rect.width >= minimum && rect.height >= minimum,
        inside:
          rect.x >= 0 &&
          rect.y >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight,
        tappable: node.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        ),
      };
    }, minimum),
  ).toEqual({ targetSize: true, inside: true, tappable: true });
}

async function reachableCards(cards: Locator) {
  expect(
    await cards.evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const rect = node.getBoundingClientRect();
          if (
            rect.width < 64 ||
            rect.height < 64 ||
            rect.x < 0 ||
            rect.y < 0 ||
            rect.right > innerWidth ||
            rect.bottom > innerHeight
          )
            return true;
          for (
            let parent = node.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent);
            const box = parent.getBoundingClientRect();
            if (
              style.overflowX !== 'visible' &&
              (rect.x < box.x || rect.right > box.right)
            )
              return true;
            if (
              style.overflowY !== 'visible' &&
              (rect.y < box.y || rect.bottom > box.bottom)
            )
              return true;
          }
          return !node.contains(
            document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            ),
          );
        })
        .map((node) => node.getAttribute('aria-label')),
    ),
  ).toEqual([]);
}

async function tapVisible(page: Page, target: Locator) {
  await insideViewport(target);
  const box = await target.boundingBox();
  if (!box) throw new Error('touch target missing');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function swipe(
  page: Page,
  area: Locator,
  direction: 'up' | 'down' | 'left',
) {
  const box = await area.boundingBox();
  if (!box) throw new Error('scroll area missing');
  const cdp = await page.context().newCDPSession(page);
  const horizontal = direction === 'left';
  const x = box.x + (horizontal ? box.width - 24 : box.width / 2);
  const y =
    box.y +
    (direction === 'up' ? box.height - 8 : horizontal ? box.height / 2 : 8);
  const endX = horizontal ? box.x + 24 : x;
  const endY = horizontal
    ? y
    : y + (direction === 'up' ? -1 : 1) * (box.height + 32);
  const t0 = Date.now() / 1000;
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
      timestamp: t0,
    });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: x + ((endX - x) * step) / 6,
            y: y + ((endY - y) * step) / 6,
            id: 1,
          },
        ],
        timestamp: t0 + step / 10,
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    // Stop the drag before lifting so a fling cannot move the coordinate tap.
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: endX, y: endY, id: 1 }],
      timestamp: t0 + 1,
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
      timestamp: t0 + 1.1,
    });
  } finally {
    await cdp.detach();
  }
}

test.describe('Native vertical touch scrolling', () => {
  test.use({
    viewport: { width: 1140, height: 512 },
    isMobile: true,
    hasTouch: true,
  });

  test('UI-05/06: swiping the wrapped picker reveals the last locomotive without moving actions', async ({
    page,
  }) => {
    await page.goto('./');
    const content = page.locator('.select .screen-content');
    await swipe(page, content, 'up');
    await expect
      .poll(() => content.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await insideViewport(page.locator('[data-action="to-depot"]'), 80);
    const last = page.locator('[data-action^="loco:"]').last();
    await expect(last).toHaveAttribute('aria-pressed', 'false');
    await insideViewport(last);
    await tapVisible(page, last);
    await expect(page.locator('.scroll-cue')).toBeHidden();
    await expect(last).toHaveAttribute('aria-pressed', 'true');
  });

  test('UI-05/06: swiping over the train reveals the whole wagon row in a short depot', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 761, height: 320 });
    await page.goto('./');
    await page.locator('[data-action="to-depot"]').tap();
    const content = page.locator('.builder-content');
    await swipe(page, page.locator('.strip'), 'up');
    await expect
      .poll(() => content.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await expect(page.locator('.catalog')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.count')).toHaveText('0');
    await insideViewport(page.locator('[data-action="depart"]'), 80);
    const row = page.locator('.catalog');
    const card = page.locator('[data-action^="add:"]').last();
    for (let attempt = 0; attempt < 20; attempt++) {
      const visible = await card.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const row = node.closest('.catalog')?.getBoundingClientRect();
        return row !== undefined && rect.x >= row.x && rect.right <= row.right;
      });
      if (visible) break;
      const before = await row.evaluate((node) => node.scrollLeft);
      await swipe(page, row, 'left');
      await expect
        .poll(() => row.evaluate((node) => node.scrollLeft))
        .toBeGreaterThan(before);
    }
    await insideViewport(card);
    await tapVisible(page, card);
    await expect(page.locator('.count')).toHaveText('1');
  });

  test('UI-05/06: plné depo 761×320 dovoluje vybrat a odebrat vagónek', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 761, height: 320 });
    await buildLongestTrain(page);
    await expect(page.locator('.full-text')).toHaveText('Vláček je plný');
    await expect(page.locator('.full-text')).toBeVisible();
    const count = Number(await page.locator('.count').textContent());
    const depart = page.locator('[data-action="depart"]');
    await insideViewport(depart, 80);
    await swipe(page, page.locator('.builder-content'), 'down');
    const wagon = page.locator('.strip-item[data-action^="wagon:"]').last();
    await insideViewport(wagon);
    await tapVisible(page, wagon);
    await expect(wagon).toHaveAttribute('aria-pressed', 'true');
    await tapVisible(page, page.locator('[data-action="remove"]'));
    await expect(page.locator('.count')).toHaveText(String(count - 1));
    await insideViewport(depart, 80);
  });

  test('UI-05/06: úvodní výběr 1140×512 ukazuje další mašinky dole', async ({
    page,
  }) => {
    await page.goto('./');
    const cue = page.getByLabel('Další mašinky dole');
    await expect(cue).toBeVisible();
    await expect(cue).toBeInViewport({ ratio: 1 });
    expect(
      await page
        .locator('.select .screen-content')
        .evaluate((node) => node.scrollTop),
    ).toBe(0);
    await insideViewport(page.locator('[data-action="to-depot"]'), 80);
  });

  test('UI-05/06: otevřené obrazovky přežijí zmenšení a zvětšení přes 500 px', async ({
    page,
  }) => {
    await page.goto('./');
    const action = (name: string) => page.locator(`[data-action="${name}"]`);
    const resize = async (screen: string, primary: string, cards?: Locator) => {
      for (const height of [390, 600, 448, 512]) {
        await page.setViewportSize({ width: 1140, height });
        await expect(page.locator('#ui-layer')).toHaveAttribute(
          'data-screen',
          screen,
        );
        await insideViewport(action(primary), 80);
        if (cards) await reachableCards(cards);
        await insideViewport(action(primary), 80);
      }
    };
    await resize(
      'SELECT_LOCO',
      'to-depot',
      page.locator('[data-action^="loco:"]'),
    );
    await action('to-depot').tap();
    await resize(
      'BUILD_TRAIN',
      'depart',
      page.locator('[data-action^="add:"]'),
    );
    await action('depart').tap();
    await action('pause').tap();
    await resize('PAUSED', 'resume');
    await insideViewport(action('resume'), 150);
    await action('resume').tap();
    await expect(page.locator('#ui-layer')).toHaveAttribute(
      'data-screen',
      'RIDING',
    );
    await page.reload();
    await expect(page.locator('#ui-layer')).toHaveAttribute(
      'data-screen',
      'HOME',
    );
    await insideViewport(action('continue'), 150);
    await insideViewport(action('build-new'), 150);
  });
});

for (const [width, height] of [
  [568, 320],
  [667, 375],
  [800, 320],
  [761, 320],
  [760, 320],
  [568, 501],
  [844, 390],
  [915, 412],
  [998, 448],
  [1140, 512],
  [960, 540],
  [1024, 600],
  [800, 600],
  [1280, 720],
  [1280, 800],
  [1366, 1024],
  [1920, 1080],
  [1920, 1200],
] as const) {
  test.describe(`${width}×${height}`, () => {
    test.use({
      viewport: { width, height },
      screen: { width, height: height + 96 },
      isMobile: width <= 1280,
      hasTouch: true,
      deviceScaleFactor: width === 1140 ? 2.625 : 1,
    });

    test('UI-05/06: actions and complete catalogs stay reachable', async ({
      page,
    }) => {
      await page.goto('./');
      const action = (name: string) => page.locator(`[data-action="${name}"]`);
      const screenIs = async (name: string) =>
        expect(page.locator('#ui-layer')).toHaveAttribute('data-screen', name);
      await screenIs('SELECT_LOCO');
      await insideViewport(action('to-depot'), 80);
      const locomotives = page.locator('[data-action^="loco:"]');
      await expect(locomotives).toHaveCount(10);
      await reachableCards(locomotives);
      await insideViewport(action('to-depot'), 80);
      await locomotives.last().tap();
      await expect(locomotives.last()).toHaveAttribute('aria-pressed', 'true');
      await action('to-depot').tap();
      await screenIs('BUILD_TRAIN');
      await insideViewport(action('depart'), 80);
      const wagons = page.locator('[data-action^="add:"]');
      await expect(wagons).toHaveCount(32);
      await reachableCards(wagons);
      await insideViewport(action('depart'), 80);
      await wagons.last().tap();
      await expect(page.locator('.count')).toHaveText('1');
      await action('depart').tap();
      await screenIs('RIDING');
      await action('pause').tap();
      await screenIs('PAUSED');
      for (const name of ['resume', 'open-depot', 'fullscreen'])
        await insideViewport(action(name), name === 'resume' ? 80 : 64);
      await action('resume').tap();
      await screenIs('RIDING');
    });

    test('UI-05/06: home and parent panel actions stay reachable', async ({
      page,
    }) => {
      await page.goto('./');
      const action = (name: string) => page.locator(`[data-action="${name}"]`);
      const screenIs = async (name: string) =>
        expect(page.locator('#ui-layer')).toHaveAttribute('data-screen', name);
      await action('to-depot').tap();
      await action('depart').tap();
      await action('pause').tap();
      await screenIs('PAUSED');
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
      const build = await action('dev-build').boundingBox();
      if (!build) throw new Error('build line missing');
      for (let i = 0; i < 5; i++)
        await page.touchscreen.tap(
          build.x + build.width / 2,
          build.y + build.height / 2,
        );
      await page.clock.resume();
      await expect(page.locator('.dev-menu')).toBeVisible();
      for (const name of ['dev-apply', 'dev-defaults', 'dev-close'])
        await insideViewport(action(name), name === 'dev-apply' ? 80 : 64);
      await action('dev-close').tap();
      await action('resume').tap();
      await screenIs('RIDING');
      await page.reload();
      await screenIs('HOME');
      await insideViewport(action('continue'), 80);
      await insideViewport(action('build-new'), 80);
      await insideViewport(action('fullscreen'));
      await action('continue').tap();
      await screenIs('PAUSED');
      await insideViewport(action('resume'), 80);
      await action('resume').tap();
      await screenIs('RIDING');
    });

    test('UI-08: parent tools and diagnostic copy keep their action rows visible', async ({
      page,
    }) => {
      await page.clock.install();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined });
      });
      await page.goto('./?debug=1&renderer=canvas&quality=low&seed=123');
      const action = (name: string) => page.locator(`[data-action="${name}"]`);
      await action('to-depot').tap();
      await action('depart').tap();
      await action('pause').tap();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
      const build = await action('dev-build').boundingBox();
      if (!build) throw new Error('build line missing');
      for (let i = 0; i < 5; i++)
        await page.touchscreen.tap(
          build.x + build.width / 2,
          build.y + build.height / 2,
        );
      await page.clock.resume();
      // The gate's final touch can leave a native details section open.
      // Exercise mixed states independently of native click timing.
      const overlays = page
        .getByText('Svět — překryvy', { exact: true })
        .locator('..');
      if ((await overlays.getAttribute('open')) === null)
        await overlays.locator('summary').click();
      for (const summary of await page
        .locator('.dev-menu details > summary')
        .all()) {
        const section = summary.locator('..');
        if ((await section.getAttribute('open')) === null)
          await summary.click();
        await expect(section).toHaveJSProperty('open', true);
        const control = section.locator('button, input').last();
        await control.scrollIntoViewIfNeeded();
        await insideViewport(control);
        for (const fixed of ['dev-apply', 'dev-defaults', 'dev-close'])
          await insideViewport(action(fixed), fixed === 'dev-apply' ? 80 : 64);
      }
      for (const name of ['dev-copy-seed', 'dev-restart', 'dev-random-world']) {
        await action(name).scrollIntoViewIfNeeded();
        await insideViewport(action(name));
        for (const fixed of ['dev-apply', 'dev-defaults', 'dev-close'])
          await insideViewport(action(fixed), fixed === 'dev-apply' ? 80 : 64);
      }
      await action('dev-copy-seed').tap();
      await expect(page.getByLabel('Text k ručnímu kopírování')).toHaveValue(
        '123',
      );
      for (const name of ['dev-apply', 'dev-defaults', 'dev-close'])
        await insideViewport(action(name), name === 'dev-apply' ? 80 : 64);
      await action('dev-details').tap();
      const content = page.locator('.diagnostics-detail .screen-content');
      await expect(content).toBeVisible();
      for (const title of [
        'Výkon',
        'Svět',
        'Vlak',
        'Přejezdy',
        'Atlasy',
        'Tunely',
        'Trolejové vedení',
        'Zvuk',
      ]) {
        const heading = content.getByRole('heading', {
          name: title,
          exact: true,
        });
        // Minimal native scrolling can leave a subpixel of a heading clipped.
        await heading.evaluate((node) =>
          node.scrollIntoView({ block: 'center' }),
        );
        await expect(heading).toBeInViewport({ ratio: 1 });
        await insideViewport(action('dev-copy-json'));
        await insideViewport(action('dev-details-close'));
      }
      await action('dev-copy-json').tap();
      const fallback = content.getByLabel('Text k ručnímu kopírování');
      await expect(fallback).toBeVisible();
      expect(JSON.parse(await fallback.inputValue())).toMatchObject({
        seed: 123,
      });
      await insideViewport(action('dev-copy-json'));
      await insideViewport(action('dev-details-close'));
      await content.evaluate((node) => {
        node.scrollTop = 0;
      });
      await insideViewport(action('dev-copy-json'));
      await insideViewport(action('dev-details-close'));
      await action('dev-details-close').tap();
      for (const name of ['dev-apply', 'dev-defaults', 'dev-close'])
        await insideViewport(action(name), name === 'dev-apply' ? 80 : 64);
    });
  });
}

for (const viewport of [
  { width: 568, height: 320 },
  { width: 1140, height: 512 },
  { width: 1024, height: 600 },
]) {
  test(`UI-05/06: notices and portrait parent panel keep actions visible at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await page.addInitScript(() => {
      localStorage.setItem('vlacek.save.v1', '{"schemaVersion":999}');
      Object.defineProperty(Element.prototype, 'requestFullscreen', {
        value: () => Promise.reject(new Error('fullscreen denied')),
      });
    });
    await page.goto('./');
    const action = (name: string) => page.locator(`[data-action="${name}"]`);
    await action('fullscreen').click();
    await expect(action('fullscreen')).toBeDisabled();
    await expect(page.locator('.notices')).toContainText('novější verze');
    await insideViewport(action('to-depot'), 80);
    await action('to-depot').click();
    await page.locator('[data-action^="add:"]').last().scrollIntoViewIfNeeded();
    await insideViewport(page.locator('[data-action^="add:"]').last());
    await insideViewport(action('depart'), 80);
    await action('depart').click();
    await action('pause').click();
    await insideViewport(action('resume'), 80);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
    const build = await action('dev-build').boundingBox();
    if (!build) throw new Error('build line missing');
    for (let i = 0; i < 5; i++)
      await page.mouse.click(
        build.x + build.width / 2,
        build.y + build.height / 2,
      );
    await page.clock.resume();
    await action('dev-apply').click();
    await expect(page.locator('[data-dev-error]')).not.toBeEmpty();
    for (const summary of await page
      .locator('.dev-menu details > summary')
      .all()) {
      const section = summary.locator('..');
      if ((await section.getAttribute('open')) === null) await summary.click();
      await expect(section).toHaveJSProperty('open', true);
    }
    for (const size of [viewport, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      await expect(page.locator('.rotate')).toHaveCount(0);
      for (const name of ['dev-apply', 'dev-defaults', 'dev-close'])
        await insideViewport(action(name), name === 'dev-apply' ? 80 : 64);
      for (const field of await page
        .locator('.dev-fields input, .dev-fields select')
        .all()) {
        await field.scrollIntoViewIfNeeded();
        await insideViewport(field);
      }
    }
    await action('dev-close').click();
    await expect(page.locator('.rotate')).toBeVisible();
  });

  test(`UI-05: startup error retry stays tappable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('layout-error-tested')) return;
      sessionStorage.setItem('layout-error-tested', '1');
      Object.defineProperty(window, 'ResizeObserver', {
        value: class {
          constructor() {
            throw new Error('test startup failure');
          }
        },
      });
    });
    await page.goto('./');
    const retry = page.getByRole('button', { name: 'Zkusit znovu' });
    await insideViewport(retry, 80);
    await retry.click();
    await expect(page.locator('#ui-layer')).toHaveAttribute(
      'data-screen',
      'SELECT_LOCO',
    );
    await insideViewport(page.locator('[data-action="to-depot"]'), 80);
  });
}
