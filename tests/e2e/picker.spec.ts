import { expect, test, type Locator, type Page } from '@playwright/test';
import { tapAction } from './helpers.ts';

test('UI-05/07: locomotive selection retains cards and SVG images', async ({
  page,
}) => {
  await page.goto('./');
  const nodes = await page.evaluateHandle(() => [
    ...document.querySelectorAll('.cards, .cards .card, .cards svg image'),
  ]);
  expect(await nodes.evaluate((retained) => retained.length)).toBeGreaterThan(
    10,
  );
  await tapAction(page, 'loco:steam_express');
  await expect(
    page.locator('[data-action="loco:steam_express"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await nodes.evaluate((retained) =>
      retained.every((node) => node.isConnected),
    ),
  ).toBe(true);
  await nodes.dispose();
});

test('UI-02/05/07: depot draft changes retain catalog and existing train previews', async ({
  page,
}) => {
  await page.goto('./');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'add:cargo_box');
  const nodes = await page.evaluateHandle(() => [
    ...document.querySelectorAll(
      '.catalog, .catalog .card, .catalog svg image, .strip, .strip-item, .strip svg image',
    ),
  ]);
  expect(await nodes.evaluate((retained) => retained.length)).toBeGreaterThan(
    32,
  );
  await tapAction(page, 'add:passenger_classic');
  await expect(page.locator('.count')).toHaveText('2');
  expect(
    await nodes.evaluate((retained) =>
      retained.every((node) => node.isConnected),
    ),
  ).toBe(true);
  await page.locator('.strip-item[data-action^="wagon:"]').last().click();
  await tapAction(page, 'remove');
  await expect(page.locator('.count')).toHaveText('1');
  expect(
    await nodes.evaluate((retained) =>
      retained.every((node) => node.isConnected),
    ),
  ).toBe(true);
  await tapAction(page, 'undo');
  await expect(page.locator('.count')).toHaveText('2');
  expect(
    await nodes.evaluate((retained) =>
      retained.every((node) => node.isConnected),
    ),
  ).toBe(true);
  await tapAction(page, 'back');
  expect(
    await nodes.evaluate((retained) =>
      retained.every((node) => !node.isConnected),
    ),
  ).toBe(true);
  await tapAction(page, 'to-depot');
  await expect(page.locator('.catalog .card')).toHaveCount(32);
  await expect(page.locator('.strip-item[data-action^="wagon:"]')).toHaveCount(
    2,
  );
  await expect(page.locator('.count')).toHaveText('2');
  await nodes.dispose();
});

async function expectReachableCard(
  page: Page,
  card: Locator,
  screen: string,
  controls: string,
  minWidth: number,
  minHeight: number,
): Promise<{ x: number; y: number }> {
  await card.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const { box, controlBoxes, scroll } = await card.evaluate(
    (node, selectors) => {
      const rectangle = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const screenNode = document.querySelector(selectors.screen);
      if (!screenNode) throw new Error('screen missing');
      return {
        box: rectangle(node),
        controlBoxes: [...document.querySelectorAll(selectors.controls)].map(
          rectangle,
        ),
        scroll: {
          top: screenNode.scrollTop,
          left: screenNode.scrollLeft,
          pageX: window.scrollX,
          pageY: window.scrollY,
        },
      };
    },
    { screen, controls },
  );
  if (!viewport) throw new Error('viewport missing');
  expect(box.width).toBeGreaterThanOrEqual(minWidth);
  expect(box.height).toBeGreaterThanOrEqual(minHeight);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  for (const other of controlBoxes) {
    expect(other.width).toBeGreaterThan(0);
    expect(other.height).toBeGreaterThan(0);
    expect(other.x).toBeGreaterThanOrEqual(0);
    expect(other.y).toBeGreaterThanOrEqual(0);
    expect(other.x + other.width).toBeLessThanOrEqual(viewport.width);
    expect(other.y + other.height).toBeLessThanOrEqual(viewport.height);
    expect(
      box.x < other.x + other.width &&
        other.x < box.x + box.width &&
        box.y < other.y + other.height &&
        other.y < box.y + box.height,
      'card overlaps a control',
    ).toBe(false);
  }
  expect(scroll, 'only the card row may scroll horizontally').toEqual({
    top: 0,
    left: 0,
    pageX: 0,
    pageY: 0,
  });
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const viewport of [
  undefined,
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
]) {
  const size = viewport
    ? `${viewport.width}×${viewport.height}`
    : 'project viewport';

  test(`UI-05/06: all 10 locomotive cards select without overlap (${size})`, async ({
    page,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await page.goto('./');
    const cards = page.locator('[data-action^="loco:"]');
    await expect(cards).toHaveCount(10);
    for (const card of await cards.all()) {
      const point = await expectReachableCard(
        page,
        card,
        '.screen.select',
        '.select .row.bottom button',
        200,
        viewport ? 110 : 140,
      );
      await page.mouse.click(point.x, point.y);
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.locator('[data-action^="loco:"][aria-pressed="true"]'),
      ).toHaveCount(1);
    }
    await tapAction(page, 'to-depot');
    await expect(page.locator('.builder')).toBeVisible();
  });

  for (const [first, last] of [
    [1, 8],
    [9, 16],
    [17, 24],
    [25, 32],
  ] as const) {
    test(`UI-02/05/06: cards ${first}–${last} add without overlap (${size})`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport);
      await page.goto('./');
      await tapAction(page, 'to-depot');
      const cards = page.locator('[data-action^="add:"]');
      await expect(cards).toHaveCount(32);
      await expect(page.locator('.catalog .group')).toHaveCount(4);
      for (const card of (await cards.all()).slice(first - 1, last)) {
        const point = await expectReachableCard(
          page,
          card,
          '.screen.builder',
          '.builder .row button, .strip-item.loco',
          112,
          64,
        );
        await page.mouse.click(point.x, point.y);
        await expect(page.locator('.count')).toHaveText('1');
        await expect(
          page.locator('.strip-item[data-action^="wagon:"]'),
        ).toHaveCount(1);
        // Keep space for the next type; the train length limit remains in force.
        const item = await centerOfVisible(
          page,
          page.locator('.strip-item[data-action^="wagon:"]'),
        );
        await page.mouse.click(item.x, item.y);
        const remove = await centerOfVisible(
          page,
          page.locator('[data-action="remove"]'),
        );
        await page.mouse.click(remove.x, remove.y);
        await expect(page.locator('.count')).toHaveText('0');
      }
      if (last === 32) {
        await tapAction(page, 'depart');
        await expect(page.locator('.hud')).toBeVisible();
      }
    });
  }
}

async function centerOfVisible(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('control or viewport missing');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function swipeOnRow(
  page: Page,
  row: Locator,
  cards: string,
  backwards = false,
) {
  const point = await row.evaluate(
    (node, { selector, backwards }) => {
      const bounds = node.getBoundingClientRect();
      const positions = [...node.querySelectorAll(selector)]
        .map((card) => card.getBoundingClientRect())
        .filter(
          (box) =>
            box.x + box.width / 2 > bounds.x + (backwards ? 8 : 80) &&
            box.x + box.width / 2 < bounds.right - (backwards ? 80 : 8),
        );
      const box = positions.sort((a, b) =>
        backwards ? a.x - b.x : b.x - a.x,
      )[0];
      if (!box) throw new Error('no card to start the swipe on');
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        endX: backwards ? bounds.right - 24 : bounds.x + 24,
      };
    },
    { selector: cards, backwards },
  );
  expect(
    await page.evaluate(
      ({ x, y, selector }) =>
        Boolean(document.elementFromPoint(x, y)?.closest(selector)),
      { ...point, selector: cards },
    ),
  ).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now() / 1000;
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
      timestamp: t0,
    });
    for (let step = 1; step <= 4; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: point.x + ((point.endX - point.x) * step) / 4,
            y: point.y,
            id: 1,
          },
        ],
        timestamp: t0 + step / 10,
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    // Stop at the end of the drag so a fling cannot move the subsequent tap.
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.endX, y: point.y, id: 1 }],
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

async function userScrollToLast(page: Page, row: Locator, touch: boolean) {
  const last = row.locator('.card').last();
  for (let attempt = 0; attempt < 20; attempt++) {
    const visible = await last.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const rowBox = node.closest('.cards, .catalog')?.getBoundingClientRect();
      return (
        rowBox !== undefined && box.x >= rowBox.x && box.right <= rowBox.right
      );
    });
    if (visible) return last;
    const before = await row.evaluate((node) => node.scrollLeft);
    if (touch) await swipeOnRow(page, row, '.card');
    else {
      const box = await row.boundingBox();
      if (!box) throw new Error('scroll row missing');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(600, 0);
    }
    await expect
      .poll(() => row.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(before);
  }
  throw new Error('last card was not reached by user input');
}

async function expectScreenStill(page: Page) {
  expect(
    await page.locator('.screen').evaluate((node) => ({
      x: node.scrollLeft,
      y: node.scrollTop,
      pageX: window.scrollX,
      pageY: window.scrollY,
    })),
  ).toEqual({ x: 0, y: 0, pageX: 0, pageY: 0 });
}

async function expectKeyboardCard(page: Page, card: Locator) {
  await expect(card).toBeFocused();
  await expect(card).toBeInViewport({ ratio: 1 });
  const state = await card.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const screen = node.closest('.screen');
    if (!screen) throw new Error('screen missing');
    return {
      box: { x: box.x, y: box.y, right: box.right, bottom: box.bottom },
      ring: {
        visible: node.matches(':focus-visible'),
        width: style.outlineWidth,
        style: style.outlineStyle,
        color: style.outlineColor,
      },
      scroll: {
        x: screen.scrollLeft,
        y: screen.scrollTop,
        pageX: window.scrollX,
        pageY: window.scrollY,
      },
    };
  });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport missing');
  expect(state.box.x).toBeGreaterThanOrEqual(0);
  expect(state.box.y).toBeGreaterThanOrEqual(0);
  expect(state.box.right).toBeLessThanOrEqual(viewport.width);
  expect(state.box.bottom).toBeLessThanOrEqual(viewport.height);
  expect(state.ring).toEqual({
    visible: true,
    width: '4px',
    style: 'solid',
    color: 'rgb(21, 101, 192)',
  });
  expect(state.scroll).toEqual({ x: 0, y: 0, pageX: 0, pageY: 0 });
}

test.describe('Nativní dotykové ovládání', () => {
  test.use({ hasTouch: true });
  for (const viewport of [
    undefined,
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 568, height: 320 },
  ]) {
    const size = viewport
      ? `${viewport.width}×${viewport.height}`
      : 'project viewport';
    test(`UI-05/06: tažení z karet dosáhne lokomotivy 10 a vagonku 32 (${size})`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport);
      await page.goto('./');
      const locoRow = page.locator('.select .cards');
      await swipeOnRow(page, locoRow, '.card');
      const lastLoco = await userScrollToLast(page, locoRow, true);
      await expect(
        page.locator('[data-action="loco:steam_local"]'),
      ).toHaveAttribute('aria-pressed', 'true');
      await expectScreenStill(page);
      const locoPoint = await centerOfVisible(page, lastLoco);
      await page.touchscreen.tap(locoPoint.x, locoPoint.y);
      await expect(lastLoco).toHaveAttribute('aria-pressed', 'true');
      const next = await centerOfVisible(
        page,
        page.locator('[data-action="to-depot"]'),
      );
      await page.touchscreen.tap(next.x, next.y);
      const strip = page.locator('.strip');
      const stripBefore = await strip.evaluate((node) => node.scrollLeft);
      const catalog = page.locator('.catalog');
      const lastWagon = await userScrollToLast(page, catalog, true);
      await expect(page.locator('.count')).toHaveText('0');
      expect(await strip.evaluate((node) => node.scrollLeft)).toBe(stripBefore);
      await expectScreenStill(page);
      const point = await centerOfVisible(page, lastWagon);
      const scrollLeft = await catalog.evaluate((node) => node.scrollLeft);
      await page.touchscreen.tap(point.x, point.y);
      await expect(page.locator('.count')).toHaveText('1');
      expect(await catalog.evaluate((node) => node.scrollLeft)).toBe(
        scrollLeft,
      );
      await page.touchscreen.tap(point.x, point.y);
      await expect(
        page.locator('.strip-item[data-action^="wagon:"]'),
      ).toHaveCount(2);
      for (const item of await page
        .locator('.strip-item[data-action^="wagon:"]')
        .all())
        await expect(item).toHaveAttribute('aria-label', 'Vagónek s kostkami');
      // Make the strip scrollable on phones while the catalog stays at its end.
      for (let i = 2; i < 7; i++) await page.touchscreen.tap(point.x, point.y);
      await expect(page.locator('.count')).toHaveText('7');
      const stripOverflows = await strip.evaluate(
        (node) => node.scrollWidth > node.clientWidth,
      );
      expect(stripOverflows).toBe(viewport !== undefined);
      if (stripOverflows) {
        await swipeOnRow(page, strip, '.strip-item');
        await expect
          .poll(() => strip.evaluate((node) => node.scrollLeft))
          .toBeGreaterThan(0);
        expect(await catalog.evaluate((node) => node.scrollLeft)).toBe(
          scrollLeft,
        );
        await expect(page.locator('.count')).toHaveText('7');
      }
      const stripAfter = await strip.evaluate((node) => node.scrollLeft);
      await swipeOnRow(page, catalog, '.card', true);
      await expect
        .poll(() => catalog.evaluate((node) => node.scrollLeft))
        .toBeLessThan(scrollLeft);
      expect(await strip.evaluate((node) => node.scrollLeft)).toBe(stripAfter);
      await expect(page.locator('.count')).toHaveText('7');
      await expectScreenStill(page);
      const depart = await centerOfVisible(
        page,
        page.locator('[data-action="depart"]'),
      );
      await page.touchscreen.tap(depart.x, depart.y);
      await expect(page.locator('.hud')).toBeVisible();
    });
  }
});

for (const viewport of [undefined, { width: 844, height: 390 }]) {
  const size = viewport
    ? `${viewport.width}×${viewport.height}`
    : 'project viewport';
  test(`UI-02/05: vodorovné kolečko dosáhne posledních karet a přidá stejný druh dvakrát (${size})`, async ({
    page,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await page.goto('./');
    const loco = await userScrollToLast(
      page,
      page.locator('.select .cards'),
      false,
    );
    const locoPoint = await centerOfVisible(page, loco);
    await page.mouse.click(locoPoint.x, locoPoint.y);
    await expect(loco).toHaveAttribute('aria-pressed', 'true');
    const next = await centerOfVisible(
      page,
      page.locator('[data-action="to-depot"]'),
    );
    await page.mouse.click(next.x, next.y);
    const catalog = page.locator('.catalog');
    const wagon = await userScrollToLast(page, catalog, false);
    const point = await centerOfVisible(page, wagon);
    const before = await catalog.evaluate((node) => node.scrollLeft);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('.count')).toHaveText('1');
    expect(await catalog.evaluate((node) => node.scrollLeft)).toBe(before);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('.count')).toHaveText('2');
    for (const item of await page
      .locator('.strip-item[data-action^="wagon:"]')
      .all())
      await expect(item).toHaveAttribute('aria-label', 'Vagónek s kostkami');
    await expectScreenStill(page);
    const depart = await centerOfVisible(
      page,
      page.locator('[data-action="depart"]'),
    );
    await page.mouse.click(depart.x, depart.y);
    await expect(page.locator('.hud')).toBeVisible();
  });
}

for (const viewport of [
  undefined,
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
]) {
  const size = viewport
    ? `${viewport.width}×${viewport.height}`
    : 'project viewport';
  test(`UI-05/06/07: lokomotivy — Tab odkryje celé karty s fokusem; Enter a mezerník aktivují (${size})`, async ({
    page,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await page.goto('./');
    const locomotives = page.locator('[data-action^="loco:"]');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const card = locomotives.nth(i);
      await expectKeyboardCard(page, card);
      await page.keyboard.press(i % 2 === 0 ? 'Enter' : 'Space');
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(card).toBeFocused();
      await expectScreenStill(page);
    }
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-action="to-depot"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.builder')).toBeVisible();
  });

  test(`UI-05/06/07: vagonky — Tab odkryje celé karty s fokusem; Enter a mezerník aktivují (${size})`, async ({
    page,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await page.goto('./');
    await tapAction(page, 'to-depot');
    await expect(page.locator('.builder')).toBeVisible();
    await expect(page.locator('body')).toBeFocused();
    let wagonIndex = 0;
    for (let i = 0; i < 40 && wagonIndex < 32; i++) {
      await page.keyboard.press('Tab');
      const action = await page.locator(':focus').getAttribute('data-action');
      if (!action?.startsWith('add:')) continue;
      const card = page.locator('[data-action^="add:"]').nth(wagonIndex++);
      await expectKeyboardCard(page, card);
    }
    expect(wagonIndex).toBe(32);
    const last = page.locator('[data-action^="add:"]').last();
    await page.keyboard.press('Space');
    await expect(page.locator('.count')).toHaveText('1');
    await expect(last).toBeFocused();
    await centerOfVisible(page, last);
    await page.keyboard.press('Enter');
    await expect(page.locator('.count')).toHaveText('2');
    for (const item of await page
      .locator('.strip-item[data-action^="wagon:"]')
      .all())
      await expect(item).toHaveAttribute('aria-label', 'Vagónek s kostkami');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-action="depart"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.hud')).toBeVisible();
  });
}
