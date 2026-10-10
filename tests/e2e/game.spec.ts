import { expect, test } from '@playwright/test';
import {
  buildLongestTrain,
  driveUntilMoving,
  expectWholeTrainInView,
  snapshot,
  startRide,
  tapAction,
  trainBoxesOverFrames,
} from './helpers.ts';

test.describe('user path', () => {
  test('UI-01/02: select, build, edit and depart', async ({ page }) => {
    await page.goto('./?debug=1');
    await expect(page.locator('h1')).toHaveText('Vyber mašinku');
    await tapAction(page, 'loco:diesel_mainline');
    await expect(
      page.locator('[data-action="loco:diesel_mainline"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await tapAction(page, 'to-depot');
    for (const wagon of ['cargo_box', 'cargo_coal', 'fun_balloons'])
      await tapAction(page, `add:${wagon}`);
    await expect(page.locator('.count')).toHaveText('3');
    const strip = page.locator('.strip-item[data-action^="wagon:"]');
    await strip.nth(1).click();
    await expect(strip.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.count')).toHaveText('3');
    await tapAction(page, 'move-forward');
    await tapAction(page, 'remove');
    await expect(page.locator('.count')).toHaveText('2');
    await tapAction(page, 'undo');
    await expect(page.locator('.count')).toHaveText('3');
    await tapAction(page, 'depart');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    const state = await snapshot(page);
    expect(state.vehicles).toBe(4);
    expect(state.speedUPerSec).toBe(0);
  });

  test('doc 14 §1: the locomotive leads on the right, new wagons join at the left end', async ({
    page,
  }) => {
    await page.goto('./?debug=1');
    await tapAction(page, 'loco:steam_local');
    await tapAction(page, 'to-depot');
    await tapAction(page, 'add:cargo_box');
    await tapAction(page, 'add:fun_balloons');
    await tapAction(page, 'add:passenger_classic');
    const left = async (selector: string) => {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new Error(`${selector} is not visible`);
      return box.x;
    };
    const loco = await left('.strip-item.loco');
    const first = await left('[data-action="wagon:w1"]');
    const second = await left('[data-action="wagon:w2"]');
    const third = await left('[data-action="wagon:w3"]');
    // [w3]—[w2]—[w1]—[loco →]: the order of choosing, read from the front.
    expect(third).toBeLessThan(second);
    expect(second).toBeLessThan(first);
    expect(first).toBeLessThan(loco);
    // "Closer to the locomotive" moves the tail wagon one place right.
    await tapAction(page, 'wagon:w3');
    await tapAction(page, 'move-forward');
    expect(await left('[data-action="wagon:w3"]')).toBeGreaterThan(
      await left('[data-action="wagon:w2"]'),
    );
    expect(await left('[data-action="wagon:w3"]')).toBeLessThan(
      await left('[data-action="wagon:w1"]'),
    );
  });

  test('doc 14 §2: the depot fills to the length limit, then nothing more fits', async ({
    page,
  }) => {
    await page.goto('./?debug=1');
    await tapAction(page, 'loco:steam_local');
    await tapAction(page, 'to-depot');
    // 156 u locomotive + 7 × (8 u coupler + 188 u container) = 1528 u of
    // 1600 u; the shortest wagon (144 u) no longer fits.
    const container = page.locator('[data-action="add:cargo_container"]');
    while (await container.isEnabled()) await container.click();
    await expect(page.locator('.count')).toHaveText('7');
    for (const card of await page.locator('[data-action^="add:"]').all())
      await expect(card).toBeDisabled();
    await expect(page.locator('.full-text')).toBeVisible();
    await expect(page.locator('.length-meter')).toHaveAttribute(
      'aria-valuenow',
      '96',
    );
    // Removing one makes room again; nothing was dropped.
    await tapAction(page, 'wagon:w7');
    await tapAction(page, 'remove');
    await expect(page.locator('.count')).toHaveText('6');
    await expect(container).toBeEnabled();
  });

  for (const [width, height] of [
    [844, 390],
    [667, 375],
    [568, 320],
  ] as const) {
    test(`the locomotive picker fits a phone held sideways (${width}×${height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('./?debug=1');
      const cards = page.locator('[data-action^="loco:"]');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(4);
      const inView = (
        box: { x: number; y: number; width: number; height: number },
        what: string,
      ) => {
        expect(box.x, what).toBeGreaterThanOrEqual(0);
        expect(box.y, what).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, what).toBeLessThanOrEqual(width);
        expect(box.y + box.height, what).toBeLessThanOrEqual(height);
      };
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        // Only the row of cards may scroll (sideways, by finger); the
        // screen itself cannot, so it must not have moved.
        await card.evaluate((node) =>
          node.scrollIntoView({ block: 'nearest', inline: 'center' }),
        );
        const scrolled = await page.evaluate(() => ({
          screen: document.querySelector('.screen.select')?.scrollTop ?? 0,
          page: window.scrollY,
        }));
        expect(scrolled, `card ${i}`).toEqual({ screen: 0, page: 0 });
        const box = await card.boundingBox();
        const next = await page
          .locator('[data-action="to-depot"]')
          .first()
          .boundingBox();
        if (!box || !next) throw new Error(`card ${i} or the next button`);
        inView(box, `card ${i}`);
        inView(next, 'to-depot');
        // Above the bottom buttons, never behind them.
        expect(box.y + box.height, `card ${i}`).toBeLessThanOrEqual(next.y);
        await card.click({ timeout: 5_000 });
        await expect(card).toHaveAttribute('aria-pressed', 'true');
      }
    });

    test(`doc 14 §1: the depot fits a phone held sideways (${width}×${height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('./?debug=1');
      await tapAction(page, 'loco:steam_local');
      await tapAction(page, 'to-depot');
      await tapAction(page, 'add:cargo_box');
      const selectors = [
        '[data-action="back"]',
        '[data-action="strip-start"]',
        '[data-action="change-loco"]',
        '[data-action="move-back"]',
        '[data-action="move-forward"]',
        '[data-action="remove"]',
        '[data-action="undo"]',
        '[data-action="depart"]',
        '.strip-item.loco',
      ];
      const boxes = [];
      for (const selector of selectors) {
        const box = await page.locator(selector).first().boundingBox();
        if (!box) throw new Error(`${selector} is not visible`);
        // Fully on screen.
        expect(box.x, selector).toBeGreaterThanOrEqual(0);
        expect(box.y, selector).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(width);
        expect(box.y + box.height, selector).toBeLessThanOrEqual(height);
        boxes.push({ selector, ...box });
      }
      // No control covers another one.
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          const overlap =
            a.x < b.x + b.width - 1 &&
            b.x < a.x + a.width - 1 &&
            a.y < b.y + b.height - 1 &&
            b.y < a.y + a.height - 1;
          expect(overlap, `${a.selector} overlaps ${b.selector}`).toBe(false);
        }
      }
      // Every catalog card stays reachable: the row scrolls instead of
      // spilling past the screen edge.
      await page
        .locator('[data-action="add:fun_balloons"]')
        .click({ timeout: 5_000 });
      await expect(page.locator('.count')).toHaveText('2');
    });
  }

  test('INP-01/02: holding drives, releasing coasts to a stop', async ({
    page,
  }) => {
    await startRide(page);
    await driveUntilMoving(page, 100);
    await page.mouse.up();
    await expect
      .poll(async () => (await snapshot(page)).speedUPerSec, {
        timeout: 10_000,
      })
      .toBe(0);
  });

  test('INP-04/keyboard: the brake wins over held throttle', async ({
    page,
  }) => {
    await startRide(page);
    await driveUntilMoving(page);
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await snapshot(page)).intent).toBe('BRAKE');
    await expect
      .poll(async () => (await snapshot(page)).speedUPerSec, { timeout: 4_000 })
      .toBe(0);
    await page.keyboard.up('ArrowLeft');
    await expect
      .poll(async () => (await snapshot(page)).intent)
      .toBe('THROTTLE');
    await page.mouse.up();
  });

  test('INP-06/11: pause freezes; Pokračovat resumes stopped; a new touch drives', async ({
    page,
  }) => {
    await startRide(page);
    await driveUntilMoving(page);
    await page.mouse.up();
    await tapAction(page, 'pause');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    const tick = (await snapshot(page)).simulationTick;
    await page.waitForTimeout(500);
    expect((await snapshot(page)).simulationTick).toBe(tick);
    // Press and keep holding Pokračovat: it must not drive.
    const resume = page.locator('[data-action="resume"]');
    const box = await resume.boundingBox();
    if (!box) throw new Error('no resume button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    await page.waitForTimeout(400);
    expect((await snapshot(page)).speedUPerSec).toBe(0);
    await driveUntilMoving(page, 10);
    await page.mouse.up();
  });

  test('pausing from the HUD suspends sound; resuming needs a new gesture', async ({
    page,
  }) => {
    await startRide(page);
    await driveUntilMoving(page, 10);
    await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).audio).toBe('running');
    await tapAction(page, 'pause');
    await expect
      .poll(async () => (await snapshot(page)).audio)
      .toBe('suspended');
    // Taps and keys that do not leave the pause keep it silent.
    await page.mouse.click(40, 360);
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(300);
    expect((await snapshot(page)).screen).toBe('PAUSED');
    expect((await snapshot(page)).audio).toBe('suspended');
    await tapAction(page, 'resume');
    await expect.poll(async () => (await snapshot(page)).audio).toBe('running');
  });

  test('Space on a keyboard-focused HUD button activates it instead of driving', async ({
    page,
  }) => {
    await startRide(page);
    await page.locator('[data-action="pause"]').focus();
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    expect((await snapshot(page)).speedUPerSec).toBe(0);
  });

  test('INP-10: losing focus pauses and clears input', async ({ page }) => {
    await startRide(page);
    await driveUntilMoving(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    expect((await snapshot(page)).pointers).toBe(0);
    await page.mouse.up();
  });

  test('DATA-01/08: reload offers Pokračovat and restores the stopped journey', async ({
    page,
  }) => {
    await startRide(page, ['cargo_box', 'fun_balloons']);
    await driveUntilMoving(page, 100);
    await page.mouse.up();
    await tapAction(page, 'pause');
    const before = await snapshot(page);
    await page.reload();
    await expect(page.locator('[data-action="continue"]')).toBeVisible();
    await tapAction(page, 'continue');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    const restored = await snapshot(page);
    expect(restored.seed).toBe(before.seed);
    expect(restored.simulationTick).toBe(before.simulationTick);
    expect(restored.vehicles).toBe(3);
    await tapAction(page, 'resume');
    await page.waitForTimeout(500);
    expect((await snapshot(page)).speedUPerSec).toBe(0);
  });

  test('doc 14 §2/TRN-07: Vyjet shows the whole longest train from the first frames', async ({
    page,
  }) => {
    await buildLongestTrain(page);
    await tapAction(page, 'depart');
    await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 20));
    const state = await snapshot(page);
    expect(state.renderedVehicles).toBe(state.vehicles);
    // The track already exists under the whole train (TRN-07).
    expect(state.trackStartS).toBeLessThanOrEqual(state.tailS);
  });

  test('doc 14 §2: the whole train stays in view over hills and after a resize', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await buildLongestTrain(page, '?debug=1&seed=77');
    await tapAction(page, 'depart');
    await driveUntilMoving(page, 60);
    // ~8 s at full speed crosses several grade changes of seed 77.
    const boxes = [];
    for (let i = 0; i < 32; i++) {
      boxes.push((await snapshot(page)).trainBox);
      await page.waitForTimeout(250);
    }
    await page.mouse.up();
    await expectWholeTrainInView(page, boxes);
    const vehicles = (await snapshot(page)).vehicles;
    await page.setViewportSize({ width: 1024, height: 600 });
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    await tapAction(page, 'resume');
    await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 10));
    expect((await snapshot(page)).vehicles).toBe(vehicles);
  });

  test('doc 14 §2: after a reload Pokračovat shows the whole train at once', async ({
    page,
  }) => {
    await buildLongestTrain(page);
    await tapAction(page, 'depart');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    await tapAction(page, 'pause');
    await page.reload();
    await tapAction(page, 'continue');
    await tapAction(page, 'resume');
    await expectWholeTrainInView(page, await trainBoxesOverFrames(page, 10));
  });

  test('UI-04: a depot copy from pause keeps the journey until Vyjet', async ({
    page,
  }) => {
    await startRide(page);
    await tapAction(page, 'pause');
    const seed = (await snapshot(page)).seed;
    await tapAction(page, 'open-depot');
    await tapAction(page, 'add:fun_balloons');
    await tapAction(page, 'back');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    expect((await snapshot(page)).seed).toBe(seed);
    expect((await snapshot(page)).vehicles).toBe(2);
  });

  test('?seed pins the world of new journeys; pause shows the world number', async ({
    page,
  }) => {
    await startRide(page, ['cargo_box'], '?debug=1&seed=123');
    expect((await snapshot(page)).seed).toBe(123);
    await tapAction(page, 'pause');
    await expect(page.locator('.world-id')).toHaveText('Svět 123');
    // A new journey from the depot stays in the pinned world (doc 04 §11).
    await tapAction(page, 'open-depot');
    await tapAction(page, 'add:fun_balloons');
    await tapAction(page, 'depart');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    expect((await snapshot(page)).seed).toBe(123);
  });

  test('without ?seed the pause screen names the random world', async ({
    page,
  }) => {
    await startRide(page);
    await tapAction(page, 'pause');
    const seed = (await snapshot(page)).seed;
    await expect(page.locator('.world-id')).toHaveText(`Svět ${seed}`);
  });

  test('INP-13/UI-06: portrait shows the rotate prompt and pauses the ride', async ({
    page,
  }) => {
    await startRide(page);
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.locator('.overlay.rotate')).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
  });

  test('the Canvas renderer draws chunk ground without seams', async ({
    page,
  }) => {
    // Abutting chunk grounds used to leave a lighter anti-aliased column at
    // every chunk boundary on Canvas. Sample frames while moving so the
    // boundary crosses sub-pixel positions; seed 123 keeps the world fixed.
    // Only the columns at chunk boundaries count: thin stems of meadow
    // plants elsewhere look like a seam to the column detector.
    await startRide(page, ['cargo_box'], '?debug=1&renderer=canvas&seed=123');
    await driveUntilMoving(page, 60);
    const seams = await page.evaluate(async () => {
      const canvas =
        document.querySelector<HTMLCanvasElement>('#game-root canvas');
      const context = canvas?.getContext('2d');
      const api = (
        window as unknown as {
          __vlacek?: { snapshot(): { chunkEdges: number[] } };
        }
      ).__vlacek;
      if (!canvas || !context || !api) throw new Error('no 2D game canvas');
      // A seam is a one-pixel column that differs from its two identical
      // neighbours; compositing two anti-aliased edges of the same colour
      // may round by one level, the seam was 4–7 levels lighter.
      const isSeam = (data: Uint8ClampedArray, x: number) => {
        const same = [0, 1, 2].every(
          (c) => data[4 * (x - 1) + c] === data[4 * (x + 1) + c],
        );
        return (
          same &&
          [0, 1, 2].some(
            (c) =>
              Math.abs((data[4 * x + c] ?? 0) - (data[4 * (x - 1) + c] ?? 0)) >
              2,
          )
        );
      };
      const found: string[] = [];
      let edgesChecked = 0;
      for (let frame = 0; frame < 30; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const rect = canvas.getBoundingClientRect();
        const toCanvas = canvas.width / Math.max(1, rect.width);
        const edges = api
          .snapshot()
          .chunkEdges.map((x) => Math.round((x - rect.left) * toCanvas));
        for (const fraction of [0.8, 0.9]) {
          const y = Math.round(canvas.height * fraction);
          const row = context.getImageData(0, y, canvas.width, 1).data;
          for (const edge of edges) {
            for (let x = edge - 2; x <= edge + 2; x++) {
              if (x < 1 || x >= canvas.width - 1) continue;
              edgesChecked += 1;
              if (isSeam(row, x))
                found.push(
                  `frame ${frame} x ${x} y ${y}: ${row.slice(4 * x, 4 * x + 3).join()}`,
                );
            }
          }
        }
      }
      return { found, edgesChecked };
    });
    await page.mouse.up();
    expect(seams.edgesChecked).toBeGreaterThan(0);
    expect(seams.found).toEqual([]);
  });

  for (const renderer of ['auto', 'canvas'] as const) {
    test(`no line across the sky at a fractional zoom (${renderer})`, async ({
      page,
    }) => {
      // Phone landscape: zoom 390/720. A repeating hills texture once
      // wrapped its solid bottom row onto its top edge as a full-width line.
      await page.setViewportSize({ width: 844, height: 390 });
      await startRide(
        page,
        ['cargo_box'],
        `?debug=1&seed=123${renderer === 'canvas' ? '&renderer=canvas' : ''}`,
      );
      const png = await page.locator('#game-root canvas').screenshot({
        style: '#ui-layer, #diagnostics { visibility: hidden; }',
      });
      const box = (await snapshot(page)).trainBox;
      if (!box) throw new Error('no train box');
      const canvasTop = await page
        .locator('#game-root canvas')
        .evaluate((canvas) => canvas.getBoundingClientRect().top);
      const lines = await page.evaluate(
        async ({ base64, skyBottom }) => {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const bitmap = await createImageBitmap(
            new Blob([bytes], { type: 'image/png' }),
          );
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('no 2D context');
          context.drawImage(bitmap, 0, 0);
          const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
          // A line is a row that differs from the rows above and below,
          // which match each other: the gradient sky changes smoothly and
          // hill outlines vary along x, a wrapped edge is one row for all.
          const linesIn = ({ data, width }: ImageData) => {
            const at = (x: number, y: number, c: number) =>
              data[4 * (y * width + x) + c] ?? 0;
            const differ = (x: number, y1: number, y2: number) =>
              Math.max(
                ...[0, 1, 2].map((c) => Math.abs(at(x, y1, c) - at(x, y2, c))),
              );
            const rows: string[] = [];
            for (let y = 1; y < Math.min(skyBottom, bitmap.height - 1); y++) {
              let columns = 0;
              for (let x = 0; x < width; x++)
                if (
                  differ(x, y, y - 1) > 10 &&
                  differ(x, y, y + 1) > 10 &&
                  differ(x, y - 1, y + 1) <= 4
                )
                  columns += 1;
              if (columns > width / 2)
                rows.push(`row ${y}: ${columns}/${width} columns`);
            }
            return rows;
          };
          const found = linesIn(image);
          // The detector itself must see a line drawn into the sky.
          const probe = context.getImageData(0, 0, bitmap.width, bitmap.height);
          const y = Math.floor(skyBottom / 2);
          for (let x = 0; x < probe.width; x++)
            probe.data.set([170, 210, 160, 255], 4 * (y * probe.width + x));
          return { found, probe: linesIn(probe) };
        },
        {
          base64: png.toString('base64'),
          // Sky and backdrop: everything well above the train.
          skyBottom: Math.floor(box.top - canvasTop - 20),
        },
      );
      expect(lines.probe.length).toBeGreaterThan(0);
      expect(lines.found).toEqual([]);
    });
  }

  test('the Canvas renderer path plays the same ride', async ({ page }) => {
    await startRide(page, ['cargo_box'], '?debug=1&renderer=canvas');
    expect((await snapshot(page)).renderer).toBe('canvas');
    await driveUntilMoving(page, 20);
    await page.mouse.up();
  });
});

test.describe('multi-touch (tablet)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'needs a touch-enabled context');

  test('INP-04/14: touches anywhere drive, a second finger on the brake wins', async ({
    page,
  }) => {
    await startRide(page);
    const cdp = await page.context().newCDPSession(page);
    const brake = await page.locator('[data-action="brake"]').boundingBox();
    if (!brake) throw new Error('no brake');
    const world = { x: 150, y: 300, id: 1 };
    const onBrake = {
      x: brake.x + brake.width / 2,
      y: brake.y + brake.height / 2,
      id: 2,
    };
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [world],
    });
    await expect
      .poll(async () => (await snapshot(page)).intent)
      .toBe('THROTTLE');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [world, onBrake],
    });
    await expect.poll(async () => (await snapshot(page)).intent).toBe('BRAKE');
    // CDP touchEnd releases exactly the listed fingers: lift the brake one.
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [onBrake],
    });
    await expect
      .poll(async () => (await snapshot(page)).intent)
      .toBe('THROTTLE');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect.poll(async () => (await snapshot(page)).intent).toBe('COAST');
  });

  test('INP-07: a quick left swipe latches the brake until lifted', async ({
    page,
  }) => {
    await startRide(page);
    const cdp = await page.context().newCDPSession(page);
    // Explicit timestamps make the gesture timing independent of the
    // delivery delay of the automation channel.
    const t0 = Date.now() / 1000;
    type TouchType = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';
    type Point = { x: number; y: number; id: number };
    const touch = (type: TouchType, touchPoints: Point[], at: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints,
        timestamp: t0 + at,
      });
    await touch('touchStart', [{ x: 800, y: 300, id: 1 }], 0);
    await touch('touchMove', [{ x: 700, y: 305, id: 1 }], 0.2);
    await expect.poll(async () => (await snapshot(page)).intent).toBe('BRAKE');
    await touch('touchMove', [{ x: 900, y: 300, id: 1 }], 0.4);
    expect((await snapshot(page)).intent).toBe('BRAKE');
    await touch('touchEnd', [], 0.6);
    await expect.poll(async () => (await snapshot(page)).intent).toBe('COAST');
    // Below the threshold the same finger keeps driving.
    await touch('touchStart', [{ x: 800, y: 300, id: 2 }], 1);
    await touch('touchMove', [{ x: 760, y: 300, id: 2 }], 1.2);
    await expect
      .poll(async () => (await snapshot(page)).intent)
      .toBe('THROTTLE');
    await touch('touchEnd', [], 1.4);
  });

  test('INP-08: a driving finger dragged onto the brake keeps braking', async ({
    page,
  }) => {
    await startRide(page);
    const cdp = await page.context().newCDPSession(page);
    const brake = await page.locator('[data-action="brake"]').boundingBox();
    if (!brake) throw new Error('no brake');
    const t0 = Date.now() / 1000;
    const send = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      x: number,
      y: number,
      at: number,
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: [{ x, y, id: 1 }],
        timestamp: t0 + at,
      });
    await send('touchStart', 700, 300, 0);
    await expect
      .poll(async () => (await snapshot(page)).intent)
      .toBe('THROTTLE');
    // A slow drag (not a swipe) onto the brake's enlarged area.
    await send(
      'touchMove',
      brake.x + brake.width / 2,
      brake.y + brake.height / 2,
      2,
    );
    await expect.poll(async () => (await snapshot(page)).intent).toBe('BRAKE');
    await send('touchMove', 700, 300, 2.5);
    expect((await snapshot(page)).intent).toBe('BRAKE');
    await send('touchEnd', 700, 300, 3);
    await expect.poll(async () => (await snapshot(page)).intent).toBe('COAST');
  });

  test('INP-09: a cancelled touch leaves no throttle behind', async ({
    page,
  }) => {
    await startRide(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 700, y: 300, id: 1 }],
    });
    await expect
      .poll(async () => (await snapshot(page)).intent)
      .toBe('THROTTLE');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await expect.poll(async () => (await snapshot(page)).intent).toBe('COAST');
  });
});
