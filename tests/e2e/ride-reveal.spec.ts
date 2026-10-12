import { expect, test, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import {
  defaultSettings,
  type SaveEnvelopeV1,
} from '../../src/platform/SaveValidation.ts';
import { snapshot, startRide, tapAction } from './helpers.ts';

async function savedProfile(
  page: Page,
  quality: 'standard' | 'low',
  journey = false,
): Promise<void> {
  const consist = { locomotiveId: 'steam_local', wagons: [] };
  const save: SaveEnvelopeV1 = {
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-12T00:00:00.000Z',
    appBuildId: 'ride-reveal-test',
    settings: { ...defaultSettings, sfxEnabled: false, quality },
    lastConsist: consist,
  };
  if (journey) {
    save.journey = {
      seed: 123,
      generatorVersion: TRACK_GENERATOR_VERSION,
      consist,
      head: { chunkIndex: 7, arcOffsetU: 100 },
      simulationTick: 0,
      activeEntities: [],
    };
  }
  await page.addInitScript((save) => {
    if (!localStorage.getItem('vlacek.save.v1'))
      localStorage.setItem('vlacek.save.v1', JSON.stringify(save));
  }, save);
}

/** Includes every browser RAF, even the ones the 30 FPS Phaser loop skips. */
async function observeReveal(
  page: Page,
  action?: string,
  waitForLandscape = false,
) {
  return page.evaluate(
    async ({ action, waitForLandscape }) => {
      const api = (
        window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
      ).__vlacek;
      const before = api.snapshot().rideFramesDrawn;
      const samples: { screen: string; covered: boolean; drawn: number }[] = [];
      const record = () => {
        const state = api.snapshot();
        const covered = [
          ...document.querySelectorAll(
            '.screen, .overlay.rotate, .ride-curtain',
          ),
        ].some((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.width >= innerWidth &&
            rect.height >= innerHeight &&
            getComputedStyle(node).visibility !== 'hidden'
          );
        });
        samples.push({
          screen: state.screen,
          covered,
          drawn: state.rideFramesDrawn,
        });
      };
      if (action) {
        const button = document.querySelector<HTMLButtonElement>(
          `[data-action="${action}"]`,
        );
        if (!button) throw new Error('reveal button missing');
        // Native activation through the real DOM adapter; record synchronously
        // before any returning Phaser frame can remove the cover.
        button.click();
        record();
      }
      if (waitForLandscape)
        document.documentElement.dataset['rideRevealObserving'] = 'true';
      let landscapeObserved = !waitForLandscape;
      let observationFrames = 0;
      while (observationFrames < 30) {
        await new Promise(requestAnimationFrame);
        record();
        if (innerWidth >= innerHeight) landscapeObserved = true;
        if (landscapeObserved) observationFrames++;
      }
      return { before, samples };
    },
    { action, waitForLandscape },
  );
}

function expectReady(
  result: Awaited<ReturnType<typeof observeReveal>>,
  screen: string,
): void {
  const visible = result.samples.filter((sample) => !sample.covered);
  expect(
    visible.length,
    'the returning world must be uncovered',
  ).toBeGreaterThan(0);
  for (const sample of visible) {
    expect(sample.screen).toBe(screen);
    expect(
      sample.drawn,
      'an opaque cover must remain until the returning world draws',
    ).toBeGreaterThan(result.before);
  }
}

for (const quality of ['standard', 'low'] as const) {
  test.describe(`opaque reveal (${quality})`, () => {
    test.beforeEach(async ({ page }) => savedProfile(page, quality));

    test('Vyjet never exposes a cleared canvas between menu and drawn ride', async ({
      page,
    }) => {
      await page.goto('./?debug=1&seed=123');
      await tapAction(page, 'to-depot');
      expectReady(await observeReveal(page, 'depart'), 'RIDING');
    });

    test('depot Zpět keeps coverage until the frozen ride is drawn', async ({
      page,
    }) => {
      await startRide(page, []);
      await tapAction(page, 'pause');
      await tapAction(page, 'open-depot');
      expectReady(await observeReveal(page, 'back'), 'PAUSED');
    });

    test('Pokračovat keeps coverage until the restored ride is drawn', async ({
      page,
    }) => {
      await startRide(page, []);
      await page.reload();
      await expect(page.locator('.screen.home')).toBeVisible();
      expectReady(await observeReveal(page, 'continue'), 'PAUSED');
    });

    test('removing rotate coverage never exposes a cleared canvas', async ({
      page,
    }) => {
      await startRide(page, []);
      const landscape = page.viewportSize();
      if (!landscape) throw new Error('viewport missing');
      await page.setViewportSize({ width: 600, height: 900 });
      await expect(page.locator('.overlay.rotate')).toBeVisible();
      const observed = observeReveal(page, undefined, true);
      // Keep portrait for a full observation window before delivering resize.
      await page.evaluate(async () => {
        while (
          document.documentElement.dataset['rideRevealObserving'] !== 'true'
        )
          await new Promise(requestAnimationFrame);
        for (let i = 0; i < 30; i++) await new Promise(requestAnimationFrame);
      });
      await page.setViewportSize(landscape);
      expectReady(await observed, 'PAUSED');
    });
  });
}

test('same journey preserves a paused mid-biome crossfade through the depot', async ({
  page,
}) => {
  await savedProfile(page, 'standard', true);
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await expect
    .poll(async () => (await snapshot(page)).backdrop?.currentBiome)
    .toBe('countryside');
  await tapAction(page, 'resume');
  await page.keyboard.down('ArrowRight');
  // Pause from the browser RAF that observes the midpoint, so automation
  // channel latency cannot let the 1.2 s crossfade finish before the pause.
  const paused = await page.evaluate(async () => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    for (let i = 0; i < 600; i++) {
      await new Promise(requestAnimationFrame);
      const state = api.snapshot();
      if (
        state.backdrop &&
        state.backdrop.fade >= 0.4 &&
        state.backdrop.fade < 0.8
      ) {
        const button = document.querySelector<HTMLButtonElement>(
          '[data-action="pause"]',
        );
        if (!button) throw new Error('pause button missing');
        button.click();
        return api.snapshot();
      }
    }
    throw new Error('mid-biome crossfade did not appear');
  });
  await page.keyboard.up('ArrowRight');
  expect(paused.backdrop?.incomingBiome).toBeDefined();
  await tapAction(page, 'open-depot');
  await observeReveal(page, 'back');
  const returned = await snapshot(page);
  expect(returned.simulationTick).toBe(paused.simulationTick);
  expect(
    returned.backdrop,
    'the frozen blend must survive the same-journey reveal',
  ).toEqual(paused.backdrop);
});

test('reveal observation works after the frame statistics buffer saturates', async ({
  page,
}) => {
  await savedProfile(page, 'standard');
  await startRide(page, []);
  await tapAction(page, 'pause');
  await tapAction(page, 'open-depot');
  await page.evaluate(() => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    const snapshot = api.snapshot.bind(api);
    // Only the rolling statistics boundary is saturated; the real loop and
    // monotonic draw counter keep running without waiting ten seconds.
    api.snapshot = () => ({ ...snapshot(), frameSamples: 600 });
  });
  expectReady(await observeReveal(page, 'back'), 'PAUSED');
});

test('WebGL context loss keeps the reveal curtain until rendering is restored', async ({
  page,
}) => {
  await savedProfile(page, 'low');
  await startRide(page, []);
  await tapAction(page, 'pause');
  await tapAction(page, 'open-depot');
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!canvas || !extension)
      throw new Error('WEBGL_lose_context unavailable');
    (window as unknown as { restoreRideContext(): void }).restoreRideContext =
      () => extension.restoreContext();
    await new Promise<void>((resolve) => {
      canvas.addEventListener('webglcontextlost', () => resolve(), {
        once: true,
      });
      extension.loseContext();
    });
  });
  const lost = await observeReveal(page, 'back');
  expect(lost.samples.every((sample) => sample.covered)).toBe(true);
  expect(lost.samples.at(-1)?.drawn).toBeGreaterThan(lost.before);
  await expect(page.locator('.ride-curtain')).toBeVisible();
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('canvas missing');
    await new Promise<void>((resolve) => {
      canvas.addEventListener('webglcontextrestored', () => resolve(), {
        once: true,
      });
      (
        window as unknown as { restoreRideContext(): void }
      ).restoreRideContext();
    });
  });
  await expect(page.locator('.ride-curtain')).toBeHidden();
});
