import { expect, test, type Page } from '@playwright/test';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { soundTones, type Tone } from '../../src/content/soundTones.ts';
import { locomotives } from '../../src/content/vehicles.ts';
import {
  generateTrackProfile,
  TRACK_GENERATOR_VERSION,
} from '../../src/domain/world/TrackProfile.ts';
import { TrackWindow } from '../../src/domain/world/TrackWindow.ts';
import { snapshot } from './helpers.ts';

interface Voice {
  type: OscillatorType;
  frequencyHz: number;
  startSec: number;
  stopSec: number;
  state: AudioContextState;
  glideHz: number | null;
}

declare global {
  interface Window {
    __hornVoices: Voice[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__hornVoices = [];
    // Observe native Web Audio; DOM input, unlock, selection and synthesis stay real.
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      override createOscillator(): OscillatorNode {
        const oscillator = super.createOscillator();
        let startSec = 0;
        let frequencyHz = 0;
        let glideHz: number | null = null;
        const set = oscillator.frequency.setValueAtTime.bind(
          oscillator.frequency,
        );
        oscillator.frequency.setValueAtTime = (value, time) => {
          frequencyHz = value;
          return set(value, time);
        };
        const ramp = oscillator.frequency.exponentialRampToValueAtTime.bind(
          oscillator.frequency,
        );
        oscillator.frequency.exponentialRampToValueAtTime = (value, time) => {
          glideHz = value;
          return ramp(value, time);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when = 0) => {
          startSec = when;
          start(when);
        };
        const stop = oscillator.stop.bind(oscillator);
        oscillator.stop = (when = 0) => {
          window.__hornVoices.push({
            type: oscillator.type,
            frequencyHz,
            startSec,
            stopSec: when,
            state: this.state,
            glideHz,
          });
          stop(when);
        };
        return oscillator;
      }
    };
  });
});

async function gesture(page: Page, action: string): Promise<void> {
  const control = page.locator(`[data-action="${action}"]`).first();
  if (test.info().project.use.hasTouch) await control.tap();
  else await control.click();
  // Feedback is drained by the real application frame, including muted events.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

async function voices(page: Page): Promise<Voice[]> {
  return page.evaluate(() => window.__hornVoices);
}

async function clearVoices(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__hornVoices = [];
  });
}

function expectTone(actual: Voice[], tone: Tone | undefined): void {
  if (!tone) throw new Error('Chybí očekávaný tón');
  expect(actual.map((voice) => voice.frequencyHz)).toEqual(tone.frequencies);
  for (const voice of actual) {
    expect(voice.type).toBe(tone.type);
    expect(voice.state).toBe('running');
    expect(voice.startSec).toBe(actual[0]?.startSec);
    expect(voice.stopSec - voice.startSec).toBeCloseTo(
      tone.durationSec + 0.02,
      6,
    );
    expect(voice.glideHz).toBe(tone.glideTo ?? null);
  }
}

async function depart(page: Page, id: string): Promise<void> {
  await page.goto('./?debug=1&seed=123');
  expect((await snapshot(page)).audio).toBe('locked');
  await gesture(page, `loco:${id}`);
  await gesture(page, 'to-depot');
  await gesture(page, 'depart');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  await clearVoices(page);
}

for (const locomotive of locomotives) {
  const tone = soundTones[locomotive.hornAudio];
  if (!tone) throw new Error(`Chybí tón ${locomotive.hornAudio}`);

  test(`H1: náhled ${locomotive.id} odemkne a přehraje vlastní píšťalu`, async ({
    page,
  }) => {
    await page.goto('./?debug=1');
    expect((await snapshot(page)).audio).toBe('locked');
    expect(await voices(page)).toEqual([]);
    await gesture(page, `loco:${locomotive.id}`);
    await expect
      .poll(async () => (await voices(page)).length)
      .toBe(tone.frequencies.length);
    expectTone(await voices(page), tone);
  });

  test(`H1: hráč ${locomotive.id} houká původním tónem po změně návrhu a obnovení gestem`, async ({
    page,
  }) => {
    await depart(page, locomotive.id);
    await gesture(page, 'pause');
    await expect
      .poll(async () => (await snapshot(page)).audio)
      .toBe('suspended');
    await gesture(page, 'open-depot');
    await gesture(page, 'change-loco');
    const otherId =
      locomotive.id === 'steam_local' ? 'diesel_mainline' : 'steam_local';
    await gesture(page, `loco:${otherId}`);
    await gesture(page, 'back');
    await expect
      .poll(async () => (await snapshot(page)).audio)
      .toBe('suspended');
    await gesture(page, 'resume');
    await expect.poll(async () => (await snapshot(page)).audio).toBe('running');
    await clearVoices(page);
    await gesture(page, 'horn');
    await expect
      .poll(async () => (await voices(page)).length)
      .toBe(tone.frequencies.length);
    expectTone(await voices(page), tone);
  });
}

for (const muted of [false, true]) {
  test(`H1: protijedoucí vlak ${muted ? 'při vypnutých zvucích mlčí' : 'odpoví vlastní parní píšťalou hráčově elektrické'}`, async ({
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
        savedAtIso: '2026-10-12T00:00:00.000Z',
        appBuildId: 'horn-test',
        settings: {
          sfxEnabled: true,
          musicEnabled: false,
          reducedEffects: false,
          maxSpeedFactor: 1,
          quality: 'auto',
        },
        lastConsist: consist,
        journey: {
          seed: 123,
          generatorVersion: TRACK_GENERATOR_VERSION,
          consist,
          head: { chunkIndex: 11, arcOffsetU: 100 },
          simulationTick: 0,
          activeEntities: [],
        },
      }),
    );
    await page.goto('./?debug=1');
    await gesture(page, 'continue');
    await gesture(page, 'resume');
    const track = new TrackWindow(
      (index) => generateTrackProfile(123, index),
      11,
      gameConfig.world,
    );
    await page.mouse.move(700, 300);
    await page.mouse.down();
    // Stop before meeting it so button actionability cannot race its greeting.
    await expect
      .poll(
        async () => {
          const state = await snapshot(page);
          track.ensureRange(state.frontS, state.frontS);
          const frontX = track.sample(state.frontS).x;
          const train = state.oncoming.trains[0];
          return train && train.minX > frontX && train.minX - frontX < 1200;
        },
        { timeout: 15_000, intervals: [50] },
      )
      .toBe(true);
    await page.keyboard.down('ArrowLeft');
    await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).speedUPerSec).toBe(0);
    await expect
      .poll(async () => {
        const state = await snapshot(page);
        const train = state.oncoming.trains[0];
        const gap = train && train.minX - track.sample(state.frontS).x;
        return gap !== undefined && gap > 0 && gap < 700;
      })
      .toBe(true);
    expect(await voices(page)).toEqual([]);
    if (muted) await gesture(page, 'sound');
    await gesture(page, 'horn');
    const afterHorn = await snapshot(page);
    await page.keyboard.up('ArrowLeft');
    track.ensureRange(afterHorn.frontS, afterHorn.frontS);
    expect(afterHorn.oncoming.trains[0]?.minX).toBeGreaterThan(
      track.sample(afterHorn.frontS).x,
    );
    if (muted) {
      expect(await voices(page)).toEqual([]);
      return;
    }
    const scheduled = await voices(page);
    expect(scheduled).toHaveLength(4);
    expectTone(scheduled.slice(0, 2), soundTones['audio.horn.electric_retro']);
    // World 123 / g1:block:1 chooses steam_local from the real catalog fleet.
    expectTone(scheduled.slice(2), soundTones['audio.horn.steam_local']);
  });
}

test('H1: vypnutí zvuků umlčí hráče i náhled a zapnutí obnoví přehrávání', async ({
  page,
}) => {
  await depart(page, 'electric_retro');
  await gesture(page, 'sound');
  await gesture(page, 'horn');
  expect(await voices(page)).toEqual([]);
  await gesture(page, 'pause');
  await gesture(page, 'open-depot');
  await gesture(page, 'change-loco');
  await gesture(page, 'loco:diesel_mainline');
  expect(await voices(page)).toEqual([]);
  await gesture(page, 'to-depot');
  await gesture(page, 'depart');
  await gesture(page, 'sound');
  await gesture(page, 'horn');
  await expect.poll(async () => (await voices(page)).length).toBe(3);
  expectTone(await voices(page), soundTones['audio.horn.diesel_mainline']);
});
