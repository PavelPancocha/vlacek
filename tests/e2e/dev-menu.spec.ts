import { expect, test, type Page } from '@playwright/test';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { parseSave, saveRules } from '../../src/platform/SaveValidation.ts';
import { snapshot, tapAction } from './helpers.ts';

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

for (const action of ['dev-apply', 'dev-defaults']) {
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
