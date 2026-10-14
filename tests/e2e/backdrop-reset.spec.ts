import { regionAt } from '../../src/domain/world/Regions.ts';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { biomeAt } from '../../src/domain/world/Biomes.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';

test('R10: the first frame of a second journey shows its biome without crossfade', async ({
  page,
}) => {
  const firstChunk = regionAt(123, 0).toXU / 1024 + 1;
  const firstBiome = biomeAt(123, firstChunk).biome;
  expect(firstBiome).not.toBe('countryside');
  const consist = { locomotiveId: 'diesel_mainline', wagons: [] };
  await page.addInitScript(
    (save) => {
      localStorage.setItem('vlacek.save.v1', JSON.stringify(save));
    },
    {
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: '2026-10-10T00:00:00.000Z',
      appBuildId: 'backdrop-reset-test',
      settings: {
        sfxEnabled: false,
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
        head: { chunkIndex: firstChunk, arcOffsetU: 100 },
        simulationTick: 0,
        activeEntities: [],
      },
    },
  );
  await page.goto('./?debug=1&seed=123');
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect
    .poll(async () => (await snapshot(page)).scenery.biome)
    .toBe(firstBiome);
  expect((await snapshot(page)).backdrop).toEqual({
    currentBiome: firstBiome,
    incomingBiome: undefined,
    fade: 1,
    world: expect.objectContaining({
      generatorVersion: TRACK_GENERATOR_VERSION,
      seed: 123,
    }),
  });
  await tapAction(page, 'pause');
  await tapAction(page, 'open-depot');
  // Observe each render frame before the depart tap, so even a short
  // crossfade cannot finish before the assertion reads the first frame.
  const firstFrame = page.evaluate(async () => {
    const api = (
      window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
    ).__vlacek;
    for (let frame = 0; frame < 300; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const state = api.snapshot();
      if (state.screen === 'RIDING' && state.scenery.biome === 'countryside') {
        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error('no game canvas');
        return { state, image: canvas.toDataURL('image/png') };
      }
    }
    throw new Error('the second journey did not render');
  });
  await tapAction(page, 'depart');
  const { state, image } = await firstFrame;
  expect(state.headChunk).toBe(0);
  expect(state.scenery.biome).not.toBe(firstBiome);
  expect(state.backdrop).toEqual({
    currentBiome: 'countryside',
    incomingBiome: undefined,
    fade: 1,
    world: expect.objectContaining({
      generatorVersion: TRACK_GENERATOR_VERSION,
      seed: state.seed,
    }),
  });
  await writeFile(
    test.info().outputPath('second-journey-first-frame.png'),
    Buffer.from(image.replace('data:image/png;base64,', ''), 'base64'),
  );
});
