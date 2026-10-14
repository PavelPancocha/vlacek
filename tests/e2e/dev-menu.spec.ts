import { expect, test, type Page } from '@playwright/test';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import {
  buildArcLengthTable,
  sampleArcLengthTable,
} from '../../src/domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../../src/domain/world/TrackProfile.ts';
import { parseSave, saveRules } from '../../src/platform/SaveValidation.ts';
import { driveUntilMoving, snapshot, startRide, tapAction } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

async function storedSave(page: Page) {
  const raw = await page.evaluate(() => localStorage.getItem('vlacek.save.v1'));
  if (!raw) throw new Error('save missing');
  const parsed = parseSave(raw, saveRules(gameConfig, locomotives, wagons));
  if (parsed.status !== 'valid') throw new Error('invalid saved journey');
  return parsed.save;
}

async function activate(page: Page, action: string) {
  const button = page.locator(`[data-action="${action}"]`);
  if (test.info().project.name === 'tablet-touch') await button.tap();
  else await button.click();
}

async function paused(page: Page, query = '') {
  await page.goto(`./${query}`);
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  await tapAction(page, 'pause');
  await expect(page.locator('#ui-layer')).toHaveAttribute(
    'data-screen',
    'PAUSED',
  );
}

async function openMenu(page: Page, key?: 'Enter' | 'Space') {
  // Jump while paused, then hold gate time constant across browser commands.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  const box = await page.locator('[data-action="dev-build"]').boundingBox();
  if (!box) throw new Error('build line missing');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (key) await page.locator('.build-id').focus();
  for (let i = 0; i < 5; i++) {
    if (key) await page.keyboard.press(key);
    else if (test.info().project.name === 'tablet-touch')
      await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  }
  await expect(
    page.getByRole('region', { name: 'Vývojářské volby' }),
  ).toBeVisible();
  await page.clock.resume();
}

for (const input of ['pointer', 'Enter', 'Space'] as const) {
  test(`gate activations share frozen time and the game loop resumes: ${input}`, async ({
    page,
  }) => {
    await paused(page, '?debug=1');
    await page.evaluate((mode) => {
      const times: number[] = [];
      document.addEventListener(
        mode === 'pointer' ? 'pointerdown' : 'keydown',
        (event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('.build-id')
          ) {
            times.push(performance.now());
            document.body.dataset['gateFirst'] = String(times[0]);
            document.body.dataset['gateLast'] = String(times.at(-1));
            document.body.dataset['gateCount'] = String(times.length);
          }
        },
      );
    }, input);
    await openMenu(page, input === 'pointer' ? undefined : input);
    const times = await page.evaluate(() => ({
      first: document.body.dataset['gateFirst'],
      last: document.body.dataset['gateLast'],
      count: document.body.dataset['gateCount'],
    }));
    expect(times.count).toBe('5');
    expect(times.last).toBe(times.first);
    await tapAction(page, 'dev-close');
    await tapAction(page, 'resume');
    const tick = (await snapshot(page)).simulationTick;
    await expect
      .poll(async () => (await snapshot(page)).simulationTick)
      .toBeGreaterThan(tick);
  });
}

test('gate window expires after 3 seconds and counts a fresh five activations', async ({
  page,
}) => {
  await paused(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  const box = await page.locator('.build-id').boundingBox();
  if (!box) throw new Error('build line missing');
  const activateBuild = async () => {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (test.info().project.name === 'tablet-touch')
      await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const menu = page.getByRole('region', { name: 'Vývojářské volby' });
  for (let i = 0; i < 4; i++) await activateBuild();
  await expect(menu).toHaveCount(0);
  await page.clock.fastForward(3001);
  await activateBuild();
  await expect(menu).toHaveCount(0);
  for (let i = 0; i < 4; i++) await activateBuild();
  await expect(menu).toBeVisible();
  await page.clock.resume();
});

async function reloadWith(page: Page, action: string) {
  await Promise.all([
    page.waitForEvent('framenavigated', {
      predicate: (frame) => frame === page.mainFrame(),
    }),
    activate(page, action),
  ]);
  await expect(page.locator('[data-action="continue"]')).toBeVisible();
}

for (const action of [
  'dev-apply',
  'dev-defaults',
  'dev-restart',
  'dev-random-world',
]) {
  for (const failure of ['newer-save', 'primary-write']) {
    test(`${action} keeps the journey, edits and dev key when saving fails: ${failure}`, async ({
      page,
    }) => {
      await page.addInitScript((mode) => {
        localStorage.setItem(
          'vlacek.dev.v1',
          JSON.stringify({ debug: false, renderer: 'auto', seed: 789 }),
        );
        if (mode === 'newer-save')
          localStorage.setItem(
            'vlacek.save.v1',
            JSON.stringify({ schemaVersion: 999 }),
          );
      }, failure);
      await paused(page, '?debug=1&seed=1000');
      const before = await snapshot(page);
      const storedBefore = await page.evaluate(() => ({
        dev: localStorage.getItem('vlacek.dev.v1'),
        save: localStorage.getItem('vlacek.save.v1'),
      }));
      if (failure === 'primary-write')
        await page.evaluate(() => {
          // Kept unbound deliberately; call(this, ...) below preserves the Storage receiver.
          // eslint-disable-next-line @typescript-eslint/unbound-method
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (key === 'vlacek.save.v1')
              throw new DOMException('Storage full', 'QuotaExceededError');
            write.call(this, key, value);
          };
          // Dev storage still works while the primary-save write fails.
          localStorage.setItem(
            'vlacek.dev.v1',
            localStorage.getItem('vlacek.dev.v1') ?? '',
          );
        });
      await openMenu(page);
      await page.getByLabel('Kvalita', { exact: true }).selectOption('low');
      await page.getByLabel('Číslo světa', { exact: true }).fill('123');
      let reloads = 0;
      page.on('framenavigated', () => reloads++);
      await activate(page, action);
      await expect(
        page.getByRole('region', { name: 'Vývojářské volby' }),
      ).toBeVisible();
      await expect(page.locator('[data-dev-error]')).toHaveText(
        'Volby nelze použít, protože hra nyní nemůže uložit cestu a nastavení. Zůstaň na této stránce; cesta je pouze v paměti.',
      );
      expect(reloads).toBe(0);
      await expect(page.getByLabel('Kvalita', { exact: true })).toHaveValue(
        'low',
      );
      await expect(page.getByLabel('Číslo světa', { exact: true })).toHaveValue(
        '123',
      );
      expect((await snapshot(page)).seed).toBe(before.seed);
      expect(
        await page.evaluate(() => ({
          dev: localStorage.getItem('vlacek.dev.v1'),
          save: localStorage.getItem('vlacek.save.v1'),
        })),
      ).toEqual(storedBefore);
    });
  }
}

test('dev-apply keeps the journey and saved settings when only the dev write fails', async ({
  page,
}) => {
  await paused(page, '?debug=1&seed=1000');
  await openMenu(page);
  await page.getByLabel('Kvalita', { exact: true }).selectOption('low');
  await page.getByLabel('Číslo světa', { exact: true }).fill('123');
  await page.evaluate(() => {
    // Kept unbound deliberately; call(this, ...) below preserves the Storage receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'vlacek.dev.v1')
        throw new DOMException('Storage full', 'QuotaExceededError');
      write.call(this, key, value);
    };
  });
  await activate(page, 'dev-apply');
  await expect(page.locator('[data-dev-error]')).toHaveText(
    'Vývojářské volby se nepodařilo uložit. Cesta a nastavení jsou uložené; stránka se znovu nenačetla.',
  );
  await expect(page.getByLabel('Číslo světa', { exact: true })).toHaveValue(
    '123',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('vlacek.dev.v1')),
  ).toBeNull();
  const stored = await storedSave(page);
  expect(stored.settings.quality).toBe('low');
  expect(stored.journey?.seed).toBe(1000);
  expect((await snapshot(page)).seed).toBe(1000);
});

test('UI-07: child pause keeps its controls and one to four build taps do nothing', async ({
  page,
}) => {
  await paused(page);
  const build = page.locator('.build-id');
  await expect(build).not.toContainText('· dev');
  await expect(page.getByRole('button')).toHaveCount(4);
  await expect(
    page.getByRole('region', { name: 'Vývojářské volby' }),
  ).toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    await activate(page, 'dev-build');
    await expect(
      page.getByRole('region', { name: 'Vývojářské volby' }),
    ).toHaveCount(0);
    await expect(page.locator('#ui-layer')).toHaveAttribute(
      'data-screen',
      'PAUSED',
    );
  }
});

test('developer menu applies Canvas, diagnostics, low and seed after reload', async ({
  page,
}) => {
  await paused(page, '?keep=yes#here');
  await openMenu(page);
  await page.getByLabel('Diagnostika', { exact: true }).selectOption('on');
  await page.getByLabel('Vykreslování', { exact: true }).selectOption('canvas');
  await page.getByLabel('Kvalita', { exact: true }).selectOption('low');
  await page.getByLabel('Číslo světa', { exact: true }).fill('123');
  const journey = (await storedSave(page)).journey;
  await reloadWith(page, 'dev-apply');
  expect((await snapshot(page)).seed).toBe(journey?.seed);
  expect(new URL(page.url()).search).toBe('?keep=yes');
  expect(new URL(page.url()).hash).toBe('#here');
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    'canvas',
  );
  expect((await snapshot(page)).renderProfile).toEqual({
    quality: 'low',
    maxDpr: 1,
    fpsLimit: 30,
    effects: 'low',
  });
  await tapAction(page, 'build-new');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  expect((await snapshot(page)).seed).toBe(123);
  await tapAction(page, 'pause');
  await expect(page.locator('.build-id')).toContainText('· dev');
});

test('Výchozí clears stored dev values, quality and reduced effects after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dev-test-initialized')) return;
    sessionStorage.setItem('dev-test-initialized', '1');
    localStorage.setItem(
      'vlacek.dev.v1',
      JSON.stringify({ debug: true, renderer: 'canvas', seed: 123 }),
    );
    localStorage.setItem(
      'vlacek.save.v1',
      JSON.stringify({
        schemaVersion: 1,
        contentVersion: 1,
        savedAtIso: '2026-10-12T12:00:00.000Z',
        appBuildId: '0.1.0+test',
        settings: {
          sfxEnabled: true,
          musicEnabled: false,
          maxSpeedFactor: 1,
          quality: 'low',
          reducedEffects: true,
        },
        lastConsist: { locomotiveId: 'steam_local', wagons: [] },
      }),
    );
  });
  await paused(page);
  expect((await snapshot(page)).renderProfile.quality).toBe('low');
  await expect(page.locator('.build-id')).toContainText('· dev');
  await openMenu(page);
  const savedJourney = (await storedSave(page)).journey;
  await reloadWith(page, 'dev-defaults');
  expect((await storedSave(page)).journey).toEqual(savedJourney);
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  expect(await page.evaluate(() => '__vlacek' in window)).toBe(false);
  expect(
    await page.evaluate(() => localStorage.getItem('vlacek.dev.v1')),
  ).toBeNull();
  await tapAction(page, 'continue');
  await expect(page.locator('.build-id')).not.toContainText('· dev');
  await openMenu(page);
  await expect(page.getByLabel('Kvalita', { exact: true })).toHaveValue('auto');
  await expect(page.getByLabel('Omezené efekty', { exact: true })).toHaveValue(
    'off',
  );
  await expect(page.getByLabel('Číslo světa', { exact: true })).toHaveValue('');
});

test('UI-07: Enter and Space open the menu and focus stays in the panel; close discards edits', async ({
  page,
}) => {
  await paused(page);
  for (const key of ['Enter', 'Space'] as const) {
    await openMenu(page, key);
    const menu = page.getByRole('region', { name: 'Vývojářské volby' });
    await expect(menu).toBeVisible();
    await expect(page.getByLabel('Diagnostika', { exact: true })).toBeFocused();
    await page.getByLabel('Kvalita', { exact: true }).selectOption('low');
    await tapAction(page, 'dev-close');
    await expect(menu).toHaveCount(0);
    await expect(page.locator('.build-id')).toBeFocused();
    await expect(page.locator('.build-id')).not.toContainText('· dev');
  }
  await openMenu(page);
  await expect(page.getByLabel('Kvalita', { exact: true })).toHaveValue('auto');
});

test('URL still wins over saved dev values and apply removes all four dev parameters', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('vlacek.dev.v1'))
      localStorage.setItem(
        'vlacek.dev.v1',
        JSON.stringify({ debug: false, renderer: 'canvas', seed: 123 }),
      );
  });
  await paused(
    page,
    '?debug=1&renderer=auto&quality=standard&seed=456&keep=yes',
  );
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  const current = await snapshot(page);
  expect(current.seed).toBe(456);
  expect(current.renderProfile.quality).toBe('standard');
  await openMenu(page);
  await expect(page.getByLabel('Diagnostika', { exact: true })).toHaveValue(
    'on',
  );
  await expect(page.getByLabel('Vykreslování', { exact: true })).toHaveValue(
    'auto',
  );
  await expect(page.getByLabel('Číslo světa', { exact: true })).toHaveValue(
    '456',
  );
  await reloadWith(page, 'dev-apply');
  expect(new URL(page.url()).search).toBe('?keep=yes');
  expect((await snapshot(page)).renderProfile.quality).toBe('standard');
});

test('menu rejects out-of-range worlds and persists reduced effects through the normal save', async ({
  page,
}) => {
  await paused(page);
  await openMenu(page);
  await page.getByLabel('Číslo světa', { exact: true }).fill('4294967296');
  await activate(page, 'dev-apply');
  await expect(
    page.getByRole('region', { name: 'Vývojářské volby' }),
  ).toBeVisible();
  await page.getByLabel('Číslo světa', { exact: true }).fill('0');
  await page.getByLabel('Omezené efekty', { exact: true }).selectOption('on');
  await page.getByLabel('Diagnostika', { exact: true }).selectOption('on');
  await reloadWith(page, 'dev-apply');
  expect((await snapshot(page)).renderProfile).toEqual({
    quality: 'auto',
    maxDpr: 1.5,
    fpsLimit: 0,
    effects: 'low',
  });
  await tapAction(page, 'continue');
  await expect(page.locator('.build-id')).toContainText('· dev');
});

test('developer menu targets fit a small landscape phone and stay accessible after rotation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await paused(page);
  await openMenu(page);
  // Every expandable parent section is opened before measuring its controls.
  for (const summary of await page.locator('.dev-menu details > summary').all())
    await summary.click();
  for (const control of await page
    .locator('.dev-menu select, .dev-menu input, .dev-menu button')
    .all()) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 1 });
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(64);
    expect(box?.height).toBeGreaterThanOrEqual(64);
  }
  await page.getByLabel('Kvalita', { exact: true }).selectOption('low');
  await page.getByLabel('Číslo světa', { exact: true }).fill('456');
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.locator('.rotate')).toHaveCount(0);
  await expect(page.getByLabel('Kvalita', { exact: true })).toHaveValue('low');
  await expect(page.getByLabel('Číslo světa', { exact: true })).toHaveValue(
    '456',
  );
  await page.getByLabel('Číslo světa', { exact: true }).fill('123');
  await tapAction(page, 'dev-close');
  await expect(page.locator('.rotate')).toBeVisible();
});

for (const viewport of [
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1140, height: 512 },
  { width: 1280, height: 800 },
]) {
  test(`HUD: two lines clear of controls and hold drives at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await startRide(page, ['cargo_box'], '?debug=1&seed=4294967295');
    const hud = page.locator('#diagnostics');
    await expect(hud).toContainText('Svět 4294967295');
    const text = await hud.innerText();
    expect(text.split('\n')).toHaveLength(2);
    expect(text).not.toContain('{');
    const box = await hud.boundingBox();
    if (!box) throw new Error('HUD missing');
    const lineHeight = await hud.evaluate((element) =>
      parseFloat(getComputedStyle(element).lineHeight),
    );
    expect(box.height).toBeLessThanOrEqual(lineHeight * 2 + 8);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    for (const button of await page.locator('.hud button').all()) {
      const control = await button.boundingBox();
      if (!control) throw new Error('control missing');
      expect(
        box.x + box.width <= control.x ||
          box.x >= control.x + control.width ||
          box.y + box.height <= control.y ||
          box.y >= control.y + control.height,
      ).toBe(true);
    }
    const at = { x: box.x + 10, y: box.y + 10 };
    if (test.info().project.name === 'tablet-touch') {
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [at],
      });
      await expect
        .poll(async () => (await snapshot(page)).speedUPerSec)
        .toBeGreaterThan(20);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await client.detach();
    } else {
      await driveUntilMoving(page, 20, at);
      await page.mouse.up();
    }
  });
}

for (const clipboard of ['available', 'missing', 'denied']) {
  test(`details: Czech groups and copy JSON with clipboard ${clipboard}`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          mode === 'missing'
            ? undefined
            : {
                writeText: (value: string) => {
                  if (mode === 'denied')
                    return Promise.reject(new Error('denied'));
                  sessionStorage.setItem('copied', value);
                  return Promise.resolve();
                },
              },
      });
    }, clipboard);
    await paused(page, '?debug=1');
    await openMenu(page);
    await tapAction(page, 'dev-details');
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
      const heading = page.getByRole('heading', { name: title, exact: true });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeInViewport({ ratio: 1 });
    }
    await page
      .getByRole('button', { name: 'Kopírovat JSON', exact: true })
      .click();
    let copied: string | null;
    if (clipboard === 'available') {
      await expect(page.locator('[data-copy-status]').last()).toHaveText(
        'Zkopírováno.',
      );
      copied = await page.evaluate(() => sessionStorage.getItem('copied'));
    } else {
      const fallback = page.getByLabel('Text k ručnímu kopírování');
      await expect(fallback).toBeVisible();
      copied = await fallback.inputValue();
      expect(
        await fallback.evaluate((field: HTMLTextAreaElement) => {
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
          });
          return {
            start: field.selectionStart,
            end: field.selectionEnd,
            nativeMenu: field.dispatchEvent(event),
            cancelled: event.defaultPrevented,
          };
        }),
      ).toEqual({
        start: 0,
        end: copied.length,
        nativeMenu: true,
        cancelled: false,
      });
      expect(
        await page.locator('#app').evaluate((root) =>
          root.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
            }),
          ),
        ),
      ).toBe(false);
    }
    if (!copied) throw new Error('copy empty');
    expect(JSON.parse(copied)).toMatchObject({
      buildId: (await snapshot(page)).buildId,
      seed: (await snapshot(page)).seed,
      worldDebug: { temporaryRide: false },
      audioDetails: { pending: 0 },
      catenary: { outOfRange: 0 },
    });
    await tapAction(page, 'dev-details-close');
    await expect(page.locator('[data-action="dev-details"]')).toBeFocused();
    await page
      .getByRole('button', { name: 'Kopírovat číslo', exact: true })
      .click();
    if (clipboard === 'available')
      expect(await page.evaluate(() => sessionStorage.getItem('copied'))).toBe(
        String((await snapshot(page)).seed),
      );
    else
      await expect(page.getByLabel('Text k ručnímu kopírování')).toHaveValue(
        String((await snapshot(page)).seed),
      );
  });
}

for (const action of ['dev-restart', 'dev-random-world']) {
  test(`restart: ${action} preserves the consist and saves a stopped new journey`, async ({
    page,
  }) => {
    await startRide(
      page,
      ['cargo_box', 'cargo_coal'],
      '?debug=1&seed=123&quality=low&renderer=canvas&keep=yes#here',
    );
    const start = await storedSave(page);
    await driveUntilMoving(page, 20);
    await page.mouse.up();
    await tapAction(page, 'pause');
    const before = await snapshot(page);
    expect(before.headS).toBeGreaterThan(gameConfig.world.spawnLocalXU);
    await openMenu(page);
    await expect(page.locator('.dev-current-world')).toHaveText('Svět 123');
    await activate(page, action);
    await expect(page.locator('.dev-menu')).toHaveCount(0);
    const after = await snapshot(page);
    expect(after.screen).toBe('PAUSED');
    expect(after.speedUPerSec).toBe(0);
    expect(after.simulationTick).toBe(0);
    expect(after.vehicles).toBe(before.vehicles);
    if (action === 'dev-restart') expect(after.seed).toBe(before.seed);
    else expect(after.seed).not.toBe(before.seed);
    const save = await storedSave(page);
    expect(save.journey?.consist).toEqual(start.journey?.consist);
    const world = gameConfig.world;
    const table = buildArcLengthTable(
      generateTrackProfile(after.seed ?? 0, world.spawnChunkIndex),
      world.spawnChunkIndex,
      world.chunkWidthU,
      world.arcSampleSpacingU,
    );
    expect(save.journey?.head.chunkIndex).toBe(world.spawnChunkIndex);
    expect(
      sampleArcLengthTable(table, save.journey?.head.arcOffsetU ?? -1).x,
    ).toBeCloseTo(
      world.spawnChunkIndex * world.chunkWidthU + world.spawnLocalXU,
      8,
    );
    if (action === 'dev-restart')
      expect(save.journey?.head).toEqual(start.journey?.head);
    expect(save.journey?.simulationTick).toBe(0);
    expect(save.journey?.seed).toBe(after.seed);
    expect(new URL(page.url()).search).toBe('?keep=yes');
    expect(new URL(page.url()).hash).toBe('#here');
    await tapAction(page, 'resume');
    await driveUntilMoving(page, 20);
    await page.mouse.up();
    await page.reload();
    await tapAction(page, 'continue');
    await expect(page.locator('#ui-layer')).toHaveAttribute(
      'data-screen',
      'PAUSED',
    );
    await expect(page.locator('.world-id')).toHaveText(`Svět ${after.seed}`);
  });
}

interface RestartVoice {
  stops: number[];
  disconnected: boolean;
}

declare global {
  interface Window {
    __restartVoices: RestartVoice[];
  }
}

for (const action of ['dev-restart', 'dev-random-world']) {
  for (const fails of [false, true]) {
    test(`restart audio: ${action}, save ${fails ? 'fails' : 'succeeds'}, with an unfinished horn`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.__restartVoices = [];
        const NativeAudioContext = window.AudioContext;
        window.AudioContext = class extends NativeAudioContext {
          override createBufferSource(): AudioBufferSourceNode {
            const oscillator = super.createBufferSource();
            const voice: RestartVoice = { stops: [], disconnected: false };
            window.__restartVoices.push(voice);
            const stop = oscillator.stop.bind(oscillator);
            oscillator.loop = true;
            oscillator.stop = (when = 0) => {
              voice.stops.push(when);
              // Keep the real source unfinished through the menu interaction.
              stop(when === 0 ? 0 : this.currentTime + 1000);
            };
            const disconnect = oscillator.disconnect.bind(oscillator);
            oscillator.disconnect = () => {
              voice.disconnected = true;
              disconnect();
            };
            return oscillator;
          }
        };
      });
      await paused(page, '?debug=1&seed=123');
      await tapAction(page, 'resume');
      await activate(page, 'horn');
      await expect
        .poll(() => page.evaluate(() => window.__restartVoices.length))
        .toBeGreaterThan(0);
      await tapAction(page, 'pause');
      await expect
        .poll(async () => (await snapshot(page)).audio)
        .toBe('suspended');
      await openMenu(page);
      await page.getByText('Zvuky', { exact: true }).click();
      await activate(page, 'dev-sound:audio.horn.steam_local');
      await expect
        .poll(async () => (await snapshot(page)).audioDetails.active.length)
        .toBe(1);
      const previous = await page.evaluate(() => window.__restartVoices);
      if (fails)
        await page.evaluate(() => {
          // Keep the caller's Storage receiver with call(this, ...) below.
          // eslint-disable-next-line @typescript-eslint/unbound-method
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (key === 'vlacek.save.v1')
              throw new DOMException('Storage full', 'QuotaExceededError');
            write.call(this, key, value);
          };
        });
      await activate(page, action);
      expect((await snapshot(page)).audio).toBe(
        fails ? 'running' : 'suspended',
      );
      if (fails) {
        await expect(page.locator('[data-dev-error]')).toBeVisible();
        expect(await page.evaluate(() => window.__restartVoices)).toEqual(
          previous,
        );
        await tapAction(page, 'dev-close');
      } else {
        await expect(page.locator('.dev-menu')).toHaveCount(0);
        expect(await page.evaluate(() => window.__restartVoices)).toEqual(
          previous.map((voice) => ({
            stops: voice.disconnected ? voice.stops : [...voice.stops, 0],
            disconnected: true,
          })),
        );
      }
      await tapAction(page, 'resume');
      await expect
        .poll(async () => (await snapshot(page)).audio)
        .toBe('running');
      if (fails) {
        expect(
          (await snapshot(page)).audioDetails.active.map((voice) => voice.id),
        ).not.toContain('audio.horn.steam_local');
        expect(
          await page.evaluate(
            (count) => window.__restartVoices.slice(0, count),
            previous.length,
          ),
        ).toEqual(
          previous.map((voice) => ({
            stops: voice.disconnected ? voice.stops : [...voice.stops, 0],
            disconnected: true,
          })),
        );
      } else {
        await activate(page, 'horn');
        await expect
          .poll(() => page.evaluate(() => window.__restartVoices.length))
          .toBeGreaterThan(previous.length);
      }
    });
  }
}

test('restart effects: active ambient life starts again after the initial delay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await paused(page, '?debug=1&seed=123&quality=low&renderer=canvas');
  await tapAction(page, 'resume');
  await page.clock.runFor(8000);
  expect((await snapshot(page)).effects.kinds['bird'] ?? 0).toBeGreaterThan(0);
  await tapAction(page, 'pause');
  await openMenu(page);
  await activate(page, 'dev-restart');
  await expect.poll(async () => (await snapshot(page)).effects.live).toBe(0);
  await tapAction(page, 'resume');
  await page.clock.runFor(7600);
  expect((await snapshot(page)).effects.kinds['bird'] ?? 0).toBeGreaterThan(0);
});
