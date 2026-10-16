import { expect, test } from '@playwright/test';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction, startRide, driveUntilMoving } from './helpers.ts';
import { soundManifest } from '../../src/content/soundManifest.ts';

test('recordings load only after unlock from the same origin; failures leave driving playable', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('.mp3')) requests.push(request.url());
  });
  await page.route('**/*steam-local*.mp3', (route) => route.abort());
  await page.goto('./?debug=1');
  expect(requests).toEqual([]);
  await tapAction(page, 'loco:steam_local');
  await expect
    .poll(async () =>
      (await snapshot(page)).audioDetails.failures.map((f) => f.file),
    )
    .toContain('steam-local.mp3');
  await tapAction(page, 'to-depot');
  await tapAction(page, 'depart');
  await driveUntilMoving(page, 20);
  await page.mouse.up();
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests)
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  await tapAction(page, 'sound');
  await expect
    .poll(async () => (await snapshot(page)).audioDetails.active.length)
    .toBe(0);
  expect((await snapshot(page)).screen).toBe('RIDING');
});

test('a nearby warning crossing rings one bell and stops it when barriers rise', async ({
  page,
}) => {
  const consist = { locomotiveId: 'electric_retro', wagons: [] };
  await page.addInitScript(
    (save) => {
      localStorage.setItem('vlacek.save.v1', save);
    },
    JSON.stringify({
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: '2026-10-13T00:00:00.000Z',
      appBuildId: 'audio-test',
      settings: {
        sfxEnabled: true,
        musicEnabled: false,
        reducedEffects: true,
        maxSpeedFactor: 1,
        quality: 'auto',
      },
      lastConsist: consist,
      journey: {
        seed: 123,
        generatorVersion: TRACK_GENERATOR_VERSION,
        consist,
        head: { chunkIndex: 3, arcOffsetU: 200 },
        simulationTick: 0,
        activeEntities: [],
      },
    }),
  );
  await page.goto('./?debug=1');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await driveUntilMoving(page, 20);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).audioDetails.active.filter(
          (v) => v.id === 'crossing-bell',
        ).length,
    )
    .toBe(1);
  await expect
    .poll(
      async () => {
        const state = await snapshot(page);
        return state.crossings.some((c) => c.phase === 'OPENING');
      },
      { timeout: 20_000, intervals: [50] },
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).audioDetails.active.filter(
          (v) => v.id === 'crossing-bell',
        ).length,
    )
    .toBe(0);
  await page.mouse.up();
});

test('hidden developer Zvuky list auditions every manifest id while keeping the game paused', async ({
  page,
}) => {
  await startRide(page, []);
  await tapAction(page, 'pause');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  const build = page.locator('[data-action="dev-build"]');
  const box = await build.boundingBox();
  if (!box) throw new Error('missing build gate');
  for (let i = 0; i < 5; i++)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(
    page.getByRole('region', { name: 'Vývojářské volby' }),
  ).toBeVisible();
  await page.clock.resume();
  await page.getByText('Zvuky', { exact: true }).click();
  const credits = page.getByRole('link', {
    name: 'O zvucích — autoři a licence',
  });
  await expect(credits).toBeVisible();
  const href = await credits.getAttribute('href');
  if (!href) throw new Error('missing shipped audio credits URL');
  expect(new URL(href, page.url()).origin).toBe(new URL(page.url()).origin);
  const response = await page.request.get(href);
  expect(response.ok()).toBe(true);
  const text = await response.text();
  expect(text).toContain('diesel-idle.mp3');
  expect(text).toContain('diesel-running.mp3');
  expect(text).toContain('Dušan Oblak');
  expect(text).toContain('Boštjan Troha');
  expect(text).toContain('https://creativecommons.org/licenses/by/4.0/');
  expect(await page.locator('[data-action^="dev-sound:"]').count()).toBe(
    Object.keys(soundManifest).length,
  );
  await tapAction(page, 'dev-sound:sheep');
  await expect
    .poll(async () => (await snapshot(page)).audioDetails.played.at(-1))
    .toBe('sheep');
  await tapAction(page, 'dev-sound:cow');
  await expect
    .poll(async () =>
      (await snapshot(page)).audioDetails.active.map((voice) => voice.id),
    )
    .toEqual(['cow']);
  expect((await snapshot(page)).audio).toBe('running');
  expect((await snapshot(page)).screen).toBe('PAUSED');
  await tapAction(page, 'dev-sound-stop');
  await expect.poll(async () => (await snapshot(page)).audio).toBe('suspended');
  expect((await snapshot(page)).audioDetails.active).toEqual([]);
  await tapAction(page, 'dev-sound:sheep');
  await expect
    .poll(async () => (await snapshot(page)).audioDetails.active.length)
    .toBe(1);
  await tapAction(page, 'dev-close');
  await expect.poll(async () => (await snapshot(page)).audio).toBe('suspended');
  expect((await snapshot(page)).audioDetails.active).toEqual([]);
});
