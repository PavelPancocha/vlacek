import { pwaServer } from './pwaServer.ts';
import { expect, test, type Page } from '@playwright/test';
import { driveUntilMoving, snapshot, startRide, tapAction } from './helpers.ts';

async function parentMenu(page: Page) {
  await page.bringToFront();
  if (await page.locator('[data-action="pause"]').isVisible())
    await tapAction(page, 'pause');
  await expect(page.locator('#ui-layer')).toHaveAttribute(
    'data-screen',
    'PAUSED',
  );
  await page.locator('[data-action="dev-build"]').focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
  await expect(page.locator('.dev-menu')).toBeVisible();
}

async function updateWorker(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('Registration missing');
    await registration.update();
    const installing = registration.installing;
    if (installing)
      await new Promise<void>((resolve) => {
        const changed = () => {
          if (
            ['installed', 'activated', 'redundant'].includes(installing.state)
          ) {
            installing.removeEventListener('statechange', changed);
            resolve();
          }
        };
        installing.addEventListener('statechange', changed);
        changed();
      });
    return registration.waiting?.state;
  });
}

async function prepareWorker(page: Page, base: string) {
  await page.goto(`${base}__pwa_test_bootstrap__.html`);
  await page.evaluate(async (base) => {
    await navigator.serviceWorker.register(`${base}sw.js`, {
      scope: base,
      updateViaCache: 'none',
    });
    await navigator.serviceWorker.ready;
  }, base);
}

test('PWA-03/11: rollback A with failed asset downloads preserves active A while B waits', async ({
  browser,
}) => {
  const server = await pwaServer();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await prepareWorker(page, server.url);
    await page.goto(`${server.url}?debug=1&renderer=canvas`);
    await expect(page.locator('#game-root')).toHaveAttribute(
      'data-renderer',
      'canvas',
    );
    const cacheA = await page.evaluate(
      async (id) =>
        (await caches.keys()).find((name) => name.includes(`:${id}:`)),
      server.build,
    );
    if (!cacheA) throw new Error('A cache missing');
    const marker = new URL('__offline_complete__', server.url).href;
    const completedA = await page.evaluate(
      async ({ name, marker }) =>
        (await (await caches.open(name)).match(marker))?.text(),
      { name: cacheA, marker },
    );
    server.update();
    expect(await updateWorker(page)).toBe('installed');
    server.rollback(true);
    await updateWorker(page);
    expect(await page.evaluate((name) => caches.has(name), cacheA)).toBe(true);
    expect(
      await page.evaluate(
        async ({ name, marker }) =>
          (await (await caches.open(name)).match(marker))?.text(),
        { name: cacheA, marker },
      ),
    ).toBe(completedA);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('meta[name="vlacek-build"]')).toHaveAttribute(
      'content',
      server.build,
    );
    await expect(page.locator('#game-root canvas')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Vyber mašinku');
  } finally {
    await context.close();
    await server.close();
  }
});

test('PWA-11: A → B → C cleanup retains current and previous complete bundles', async ({
  browser,
}) => {
  const server = await pwaServer();
  const context = await browser.newContext();
  try {
    let page = await context.newPage();
    await prepareWorker(page, server.url);
    await page.reload();
    await page.evaluate(async () => {
      const cache = await caches.open('another-app');
      await cache.put('/foreign.txt', new Response('keep'));
    });
    const builds = [server.build];
    for (let i = 0; i < 2; i++) {
      builds.push(server.update());
      const candidate = context.waitForEvent('serviceworker');
      expect(await updateWorker(page)).toBe('installed');
      const waiting = await candidate;
      await page.close();
      await expect
        .poll(() =>
          waiting.evaluate<boolean>(
            'self.registration.waiting === null && self.registration.active?.state === "activated"',
          ),
        )
        .toBe(true);
      page = await context.newPage();
      await page.goto(`${server.url}__pwa_test_bootstrap__.html`);
      const retained = await page.evaluate(async (marker) => {
        const builds: unknown[] = [];
        for (const name of await caches.keys()) {
          if (!name.startsWith('vlacek:')) continue;
          const response = await (await caches.open(name)).match(marker);
          builds.push(response ? await response.json() : undefined);
        }
        return builds;
      }, new URL('__offline_complete__', server.url).href);
      expect(retained).toEqual(
        expect.arrayContaining(
          builds
            .slice(-2)
            .map((buildId) => expect.objectContaining({ buildId })),
        ),
      );
      expect(retained).toHaveLength(2);
    }
    expect(
      await page.evaluate(async () =>
        (
          await (await caches.open('another-app')).match('/foreign.txt')
        )?.text(),
      ),
    ).toBe('keep');
    await context.setOffline(true);
    await page.goto(`${server.url}?debug=1&renderer=canvas`);
    await expect(page.locator('meta[name="vlacek-build"]')).toHaveAttribute(
      'content',
      builds.at(-1) ?? 'missing release',
    );
    await expect(page.locator('#game-root canvas')).toBeVisible();
  } finally {
    await context.close();
    await server.close();
  }
});

test('PWA-01: first online ride prepares the complete bundle in the parent menu', async ({
  page,
}) => {
  await startRide(page);
  await parentMenu(page);
  await expect(page.locator('[data-pwa-state]')).toHaveText(
    'offline připraveno',
  );
  const build = await page
    .locator('meta[name="vlacek-build"]')
    .getAttribute('content');
  await expect(page.locator('[data-pwa-build]')).toHaveText(`Balík: ${build}`);
  const cdp = await page.context().newCDPSession(page);
  expect(await cdp.send('Page.getInstallabilityErrors')).toEqual({
    installabilityErrors: [],
  });
  await cdp.detach();
});

test('PWA-02: offline reload runs picker, depot, ride and the complete asset/audio bundle', async ({
  page,
  context,
}) => {
  const failures: string[] = [];
  page.on('requestfailed', (request) => failures.push(request.url()));
  page.on('pageerror', (error) => failures.push(error.message));
  await startRide(page, ['cargo_box'], '?debug=1&renderer=canvas');
  await expect(page.locator('#game-root')).toHaveAttribute(
    'data-renderer',
    'canvas',
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await tapAction(page, 'build-new');
  await tapAction(page, 'loco:steam_local');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'add:cargo_box');
  await tapAction(page, 'depart');
  await driveUntilMoving(page);
  await page.mouse.up();
  await tapAction(page, 'horn');
  expect((await snapshot(page)).screen).toBe('RIDING');
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const name = names.find((key) => key.startsWith('vlacek:'));
    if (!name) throw new Error('bundle cache missing');
    const cache = await caches.open(name);
    const keys = await cache.keys();
    const mp3s = keys.filter((key) => key.url.endsWith('.mp3'));
    for (const key of mp3s) {
      const response = await fetch(key.url);
      if (!response.ok || (await response.arrayBuffer()).byteLength === 0)
        throw new Error('offline MP3 missing');
    }
    return keys.map((key) => key.url);
  });
  expect(cached.some((url) => url.endsWith('/credits.txt'))).toBe(true);
  expect(cached.filter((url) => url.endsWith('.svg')).length).toBeGreaterThan(
    42,
  );
  expect(failures).toEqual([]);
});

test('PWA-07: unavailable SW API leaves the online game playable without errors', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'serviceWorker', {
      value: undefined,
    }),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await startRide(page);
  await driveUntilMoving(page);
  await page.mouse.up();
  await parentMenu(page);
  await expect(page.locator('[data-pwa-state]')).toHaveText(
    'offline není dostupné',
  );
  expect(errors).toEqual([]);
});

for (const interrupted of [false, true])
  test(`PWA-03/04/05/06: ${interrupted ? 'failed download keeps the old complete bundle' : 'new build waits for both tabs while a ride is open'}`, async ({
    browser,
  }) => {
    const server = await pwaServer();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      // Prepare the real bundle without starting a duplicate Phaser renderer.
      // First-load registration itself is covered by PWA-01/02.
      await page.goto(`${server.url}__pwa_test_bootstrap__.html`);
      await page.evaluate(async (base) => {
        await navigator.serviceWorker.register(`${base}sw.js`, {
          scope: base,
          updateViaCache: 'none',
        });
        await navigator.serviceWorker.ready;
      }, server.url);
      await page.goto(`${server.url}?debug=1&renderer=canvas`);
      await tapAction(page, 'to-depot');
      await tapAction(page, 'depart');
      await driveUntilMoving(page);
      await page.mouse.up();
      const second = await context.newPage();
      await second.goto(`${server.url}__pwa_test_bootstrap__.html`);
      const next = server.update(interrupted);
      const candidate = interrupted
        ? undefined
        : context.waitForEvent('serviceworker');
      await page.evaluate(async (expectFailure) => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw new Error('registration missing');
        await registration.update();
        const installing = registration.installing;
        if (installing)
          await new Promise<void>((resolve, reject) => {
            const changed = () => {
              if (
                installing.state === 'installed' ||
                installing.state === 'activated'
              ) {
                installing.removeEventListener('statechange', changed);
                resolve();
              } else if (installing.state === 'redundant') {
                installing.removeEventListener('statechange', changed);
                if (expectFailure) resolve();
                else reject(new Error('Update installation failed'));
              }
            };
            installing.addEventListener('statechange', changed);
            changed();
          });
      }, interrupted);
      const nextWorker = await candidate;
      if (interrupted) {
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const registration =
                await navigator.serviceWorker.getRegistration();
              return registration?.installing === null;
            }),
          )
          .toBe(true);
        const cachesAfter = await page.evaluate(() => caches.keys());
        expect(
          cachesAfter.filter((name) => name.startsWith('vlacek:')),
        ).toHaveLength(1);
      } else {
        await expect
          .poll(() =>
            page.evaluate(
              async () =>
                (await navigator.serviceWorker.getRegistration())?.waiting
                  ?.state,
            ),
          )
          .toBe('installed');
      }
      await expect
        .poll(async () => (await snapshot(page)).simulationTick)
        .toBeGreaterThan(0);
      const controller = await page.evaluate(
        () => navigator.serviceWorker.controller?.state,
      );
      expect(controller).toBe('activated');
      await parentMenu(page);
      await expect(page.locator('[data-pwa-build]')).toHaveText(
        `Balík: ${server.build}`,
      );
      if (!interrupted)
        await expect(page.locator('[data-pwa-update]')).toBeVisible();
      await page.close();
      if (!interrupted) {
        expect(
          await second.evaluate(
            async () =>
              (await navigator.serviceWorker.getRegistration())?.waiting?.state,
          ),
        ).toBe('installed');
      }
      await second.close();
      if (nextWorker)
        await expect
          .poll(() =>
            nextWorker.evaluate<boolean>(
              'self.registration.waiting === null && self.registration.active?.state === "activated"',
            ),
          )
          .toBe(true);
      const relaunched = await context.newPage();
      if (interrupted) await context.setOffline(true);
      await relaunched.goto(`${server.url}?debug=1&renderer=canvas`);
      await expect(
        relaunched.locator('meta[name="vlacek-build"]'),
      ).toHaveAttribute('content', interrupted ? server.build : next);
      await tapAction(relaunched, 'continue');
      await tapAction(relaunched, 'resume');
      await driveUntilMoving(relaunched);
      await relaunched.mouse.up();
      await parentMenu(relaunched);
      await expect(relaunched.locator('[data-pwa-build]')).toHaveText(
        `Balík: ${interrupted ? server.build : next}`,
      );
      await expect(relaunched.locator('[data-pwa-state]')).toHaveText(
        'offline připraveno',
      );
    } finally {
      await context.close();
      await server.close();
    }
  });

test('PWA-03/04: an old controller pins matching HTML after a new deployment', async ({
  browser,
}) => {
  const server = await pwaServer();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.url}__pwa_test_bootstrap__.html`);
    await page.evaluate(async (base) => {
      await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
      await navigator.serviceWorker.ready;
    }, server.url);
    server.update();
    const navigation = await page.goto(`${server.url}?debug=1&renderer=canvas`);
    if (!navigation) throw new Error('Navigation response missing');
    expect(await navigation.text()).toContain(
      `name="vlacek-build" content="${server.build}"`,
    );
    await expect(page.locator('#game-root')).toHaveAttribute(
      'data-renderer',
      'canvas',
    );
  } finally {
    await context.close();
    await server.close();
  }
});

test('PWA-12: cache eviction is rechecked on returning to the page', async ({
  page,
}) => {
  await startRide(page);
  await parentMenu(page);
  await expect(page.locator('[data-pwa-state]')).toHaveText(
    'offline připraveno',
  );
  await page.evaluate(async () => {
    for (const name of await caches.keys())
      if (name.startsWith('vlacek:')) await caches.delete(name);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-pwa-state]')).toHaveText(
    'offline není dostupné',
  );
});

test('install prompt belongs only to the hidden parent section', async ({
  page,
}) => {
  await startRide(page);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: () => {
        document.body.dataset['installAsked'] = 'yes';
        return Promise.resolve();
      },
    });
    window.dispatchEvent(event);
  });
  await expect(page.locator('[data-action="pwa-install"]')).toHaveCount(0);
  await parentMenu(page);
  await page.getByRole('button', { name: 'Instalovat aplikaci' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-install-asked',
    'yes',
  );
  await expect(page.locator('[data-action="pwa-install"]')).toBeHidden();
});

test('PWA-01/04: a release between HTML load and registration does not claim this page is offline-ready', async ({
  browser,
}) => {
  const server = await pwaServer();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const register = navigator.serviceWorker.register.bind(
        navigator.serviceWorker,
      );
      const released = new Promise<void>((resolve) =>
        document.addEventListener('register-release', () => resolve(), {
          once: true,
        }),
      );
      navigator.serviceWorker.register = async (
        ...args: Parameters<ServiceWorkerContainer['register']>
      ) => {
        document.body.dataset['registerWaiting'] = 'yes';
        await released;
        return register(...args);
      };
    });
    await page.goto(`${server.url}?debug=1`);
    await tapAction(page, 'to-depot');
    await tapAction(page, 'depart');
    await expect(page.locator('body')).toHaveAttribute(
      'data-register-waiting',
      'yes',
    );
    const next = server.update();
    await page.evaluate(() =>
      document.dispatchEvent(new Event('register-release')),
    );
    await parentMenu(page);
    await expect(page.locator('[data-pwa-build]')).toHaveText(`Balík: ${next}`);
    await expect(page.locator('[data-pwa-state]')).toHaveText(
      'offline není dostupné',
    );
  } finally {
    await context.close();
    await server.close();
  }
});
