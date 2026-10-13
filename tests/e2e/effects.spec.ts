import { expect, test, type Page } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

/** A stopped journey with this locomotive at the start, as a v1 save. */
function journeySave(
  locomotiveId: string,
  settings: { reducedEffects?: boolean } = {},
): string {
  const consist = {
    locomotiveId,
    wagons: ['cargo_box', 'passenger_open'].map((definitionId, i) => ({
      instanceId: `w${i + 1}`,
      definitionId,
      visualSeed: i,
    })),
  };
  return JSON.stringify({
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-10T00:00:00.000Z',
    appBuildId: 'effects-test',
    settings: {
      sfxEnabled: false,
      musicEnabled: false,
      reducedEffects: settings.reducedEffects ?? false,
      maxSpeedFactor: 1,
      quality: 'auto',
    },
    lastConsist: consist,
    journey: {
      seed: 123,
      generatorVersion: TRACK_GENERATOR_VERSION,
      consist,
      head: { chunkIndex: 1, arcOffsetU: 300 },
      simulationTick: 0,
      activeEntities: [],
    },
  });
}

async function continueJourney(page: Page, save: string): Promise<void> {
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('effects-seeded')) {
      localStorage.setItem('vlacek.save.v1', json);
      sessionStorage.setItem('effects-seeded', '1');
    }
  }, save);
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
}

test.describe('particles and small animations (doc 14 §4, D-014)', () => {
  test('the steam locomotive smokes while riding, within the particle budget', async ({
    page,
  }) => {
    await continueJourney(page, journeySave('steam_local'));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    let smoke = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const { effects } = await snapshot(page);
      expect(effects.live).toBeLessThanOrEqual(effects.capacity);
      expect(effects.capacity).toBe(240);
      smoke = Math.max(smoke, effects.kinds['smoke'] ?? 0);
    }
    await page.mouse.up();
    expect(smoke).toBeGreaterThan(5);
  });

  test('pause freezes the particles; resuming sets them moving again', async ({
    page,
  }) => {
    await continueJourney(page, journeySave('steam_local'));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await tapAction(page, 'pause');
    await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
    const frozen = (await snapshot(page)).effects;
    expect(frozen.live).toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    expect((await snapshot(page)).effects).toEqual(frozen);
    await tapAction(page, 'resume');
    await expect
      .poll(async () => (await snapshot(page)).effects.checksum)
      .not.toBe(frozen.checksum);
  });

  test('the diesel gives light exhaust and never steam-engine smoke', async ({
    page,
  }) => {
    await continueJourney(page, journeySave('diesel_mainline'));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    let diesel = 0;
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(250);
      const { kinds } = (await snapshot(page)).effects;
      diesel = Math.max(diesel, kinds['diesel'] ?? 0);
      expect(kinds['smoke'] ?? 0).toBe(0);
      expect(kinds['steam'] ?? 0).toBe(0);
    }
    await page.mouse.up();
    expect(diesel).toBeGreaterThan(0);
  });

  test('reduced effects lower the particle budget (doc 07 §9, doc 13)', async ({
    page,
  }) => {
    await continueJourney(
      page,
      journeySave('steam_local', { reducedEffects: true }),
    );
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    const { effects } = await snapshot(page);
    await page.mouse.up();
    expect(effects.capacity).toBe(96);
    expect(effects.live).toBeLessThanOrEqual(96);
  });
});

for (const smallViewport of [false, true])
  test(
    smallViewport
      ? 'camera-1: a readable bubble has a 64px touch target on 568x320 and still drives'
      : 'a bubble touch pops once while throttle keeps the train moving (H3, INP-05)',
    async ({ page }, testInfo) => {
      if (smallViewport)
        await page.setViewportSize({ width: 568, height: 320 });
      await page.goto('./?debug=1&seed=123');
      await tapAction(page, 'loco:magic_bubbles');
      await tapAction(page, 'to-depot');
      await tapAction(page, 'depart');
      await expect
        .poll(async () => (await snapshot(page)).screen)
        .toBe('RIDING');
      await expect
        .poll(async () => (await snapshot(page)).bubbles.length)
        .toBeGreaterThan(1);
      // Read and press in the same browser task: the small drifting target
      // must not move between the diagnostic sample and the DOM input event.
      const { before, bubble } = await page.evaluate(
        ({ hasTouch, offsetCssPx }) => {
          const api = (
            window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
          ).__vlacek;
          const before = api.snapshot();
          // Either side keeps the 20px offset in an earlier bubble's own target.
          const bubble = before.bubbles
            .slice(0, -1)
            .flatMap((candidate) =>
              [offsetCssPx, -offsetCssPx].map((offset) => ({
                ...candidate,
                x: candidate.x + offset,
              })),
            )
            .find((candidate) =>
              before.bubbles.every(
                (other) =>
                  other.id === candidate.id ||
                  Math.hypot(candidate.x - other.x, candidate.y - other.y) >
                    Math.abs(offsetCssPx),
              ),
            );
          if (!bubble) throw new Error('earlier nearest bubble missing');
          const clickX = bubble.x;
          const target = document.elementFromPoint(clickX, bubble.y);
          if (!target) throw new Error('bubble outside the viewport');
          target.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              pointerId: 101,
              pointerType: hasTouch ? 'touch' : 'mouse',
              isPrimary: true,
              button: 0,
              buttons: 1,
              clientX: clickX,
              clientY: bubble.y,
            }),
          );
          return { before, bubble };
        },
        {
          hasTouch: testInfo.project.use.hasTouch ?? false,
          offsetCssPx: smallViewport ? 20 : 0,
        },
      );
      expect(bubble.id).not.toBe(before.bubbles.at(-1)?.id);
      if (smallViewport)
        expect(bubble.radiusCssPx).toBeGreaterThanOrEqual(6 - 1e-9);
      const after = await snapshot(page);
      expect(
        after.bubbles.some((candidate) => candidate.id === bubble.id),
      ).toBe(false);
      expect(after.effects.bubblePops).toBe(before.effects.bubblePops + 1);
      expect(after.intent).toBe('THROTTLE');
      expect(after.pointers).toBe(1);
      await expect
        .poll(async () => (await snapshot(page)).headS)
        .toBeGreaterThan(before.headS);
      expect((await snapshot(page)).speedUPerSec).toBeGreaterThan(0);
      await page.evaluate(({ x, y }) => {
        document.elementFromPoint(x, y)?.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            pointerId: 101,
            button: 0,
            buttons: 0,
            clientX: x,
            clientY: y,
          }),
        );
      }, bubble);
      expect((await snapshot(page)).intent).toBe('COAST');
    },
  );
