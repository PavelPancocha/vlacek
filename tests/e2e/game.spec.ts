import { expect, test } from '@playwright/test';
import { driveUntilMoving, snapshot, startRide, tapAction } from './helpers.ts';

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
    await expect(page.locator('.count')).toHaveText('3 / 100');
    const strip = page.locator('.strip-item[data-action^="wagon:"]');
    await strip.nth(1).click();
    await expect(strip.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.count')).toHaveText('3 / 100');
    await tapAction(page, 'move-forward');
    await tapAction(page, 'remove');
    await expect(page.locator('.count')).toHaveText('2 / 100');
    await tapAction(page, 'undo');
    await expect(page.locator('.count')).toHaveText('3 / 100');
    await tapAction(page, 'depart');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    const state = await snapshot(page);
    expect(state.vehicles).toBe(4);
    expect(state.speedUPerSec).toBe(0);
  });

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

  test('UI-03/TRN-07: 100 wagons, the 101st refused, track behind the whole train', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto('./?debug=1');
    await tapAction(page, 'loco:steam_local');
    await tapAction(page, 'to-depot');
    const add = page.locator('[data-action="add:cargo_container"]');
    for (let i = 0; i < 100; i++) await add.click();
    await expect(page.locator('.count')).toHaveText('100 / 100');
    await expect(page.locator('.full-text')).toHaveText('Vláček je plný');
    await expect(add).toBeDisabled();
    expect(await page.locator('.strip-item').count()).toBeLessThan(40);
    await tapAction(page, 'depart');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
    const state = await snapshot(page);
    expect(state.vehicles).toBe(101);
    expect(state.trackStartS).toBeLessThanOrEqual(state.tailS - 1024);
    expect(state.renderedVehicles).toBeLessThan(101);
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

  test('INP-13/UI-06: portrait shows the rotate prompt and pauses the ride', async ({
    page,
  }) => {
    await startRide(page);
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.locator('.overlay.rotate')).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
  });

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
