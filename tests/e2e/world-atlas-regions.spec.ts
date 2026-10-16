import { npcFleetFor } from '../../src/domain/interaction/npcFleet.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import {
  journeyArtKeys,
  artAtlasItems,
  profileArtScale,
  profileBackdropScale,
} from '../../src/render/atlasPacking.ts';
import { trainZoom } from '../../src/render/cameraFraming.ts';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { atlasLifetimePeak } from '../../src/render/TextureMemory.ts';
import { artParts } from '../../src/content/artManifest.ts';
import { integratedCatalogue } from '../helpers/atlasResidency.ts';
import { worldParts, isBackdropPart } from '../../src/content/worldArt.ts';
import { worldAtlasWindowKeys } from '../../src/content/worldAtlasGroups.ts';
import type { AtlasProofSources } from '../../src/app/debugSnapshot.ts';
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { DebugSnapshot } from '../../src/app/debugSnapshot.ts';
import { regionAt } from '../../src/domain/world/Regions.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { startRide, snapshot, tapAction } from './helpers.ts';

// Dedicated PNGs prove pixels; continuous trace readbacks distort atlas timings.
test.use({
  trace: {
    mode: 'retain-on-failure',
    screenshots: false,
    snapshots: false,
    sources: true,
  },
});

for (const renderer of ['canvas', 'webgl']) {
  test(`D-030: ${renderer} long ride across three regions and two seasons`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(360_000);
    const seed = 1;
    const first = regionAt(seed, 0),
      second = regionAt(seed, first.toXU),
      third = regionAt(seed, second.toXU);
    const startXU = first.toXU - 20_000;
    const consist = {
      locomotiveId: 'steam_local',
      wagons: [{ instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 0 }],
    };
    await page.addInitScript(
      (save) => localStorage.setItem('vlacek.save.v1', JSON.stringify(save)),
      {
        schemaVersion: 1,
        contentVersion: 1,
        savedAtIso: '2026-10-13T00:00:00.000Z',
        appBuildId: 'atlas-regions-fixture',
        settings: {
          sfxEnabled: false,
          musicEnabled: false,
          reducedEffects: false,
          maxSpeedFactor: 1,
          quality: 'auto',
        },
        lastConsist: consist,
        journey: {
          seed,
          generatorVersion: TRACK_GENERATOR_VERSION,
          consist,
          head: {
            chunkIndex: Math.floor(startXU / 1024),
            arcOffsetU: startXU % 1024,
          },
          simulationTick: 0,
          activeEntities: [],
        },
      },
    );
    await page.addInitScript(() => {
      const counts = { draws: 0, textureBinds: 0 };
      Object.assign(window, { __atlasGpu: counts });
      for (const proto of [
        WebGLRenderingContext.prototype,
        WebGL2RenderingContext.prototype,
      ]) {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Each captured native method is called with apply(this, args) below.
        const { drawElements, drawArrays, bindTexture } = proto;
        proto.drawElements = function (
          ...args: Parameters<typeof drawElements>
        ) {
          counts.draws++;
          return drawElements.apply(this, args);
        };
        proto.drawArrays = function (...args: Parameters<typeof drawArrays>) {
          counts.draws++;
          return drawArrays.apply(this, args);
        };
        proto.bindTexture = function (...args: Parameters<typeof bindTexture>) {
          counts.textureBinds++;
          return bindTexture.apply(this, args);
        };
      }
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('Texture'))
        errors.push(message.text());
    });
    await page.goto(
      `./?debug=1&renderer=${renderer}&quality=${renderer === 'canvas' ? 'low' : 'standard'}`,
    );
    await tapAction(page, 'continue');
    await tapAction(page, 'resume');
    const initial = await snapshot(page);
    expect(initial.renderer).toBe(renderer);
    await testInfo.attach('initial-atlas.json', {
      body: JSON.stringify(initial, null, 2),
      contentType: 'application/json',
    });
    expect(initial.worldAtlases, 'active-window diagnostics').toBeDefined();
    await expect
      .poll(async () => (await snapshot(page)).worldAtlases.pending)
      .toBe(false);
    await expect
      .poll(async () => (await snapshot(page)).backdrop?.world?.worldXU)
      .toBeDefined();
    await page.evaluate(() => {
      const api = (
        window as unknown as { __vlacek: { resetAtlasMetrics(): void } }
      ).__vlacek;
      api.resetAtlasMetrics();
    });
    await page.mouse.move(700, 250);
    await page.mouse.down();
    const result = await page.evaluate(
      async ({ endXU, boundaries }) => {
        const api = (
          window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
        ).__vlacek;
        const regions = new Set<number>();
        const missing = new Set<string>();
        let maxBytes = 0,
          maxPages = 0,
          maxTextures = 0,
          minDrawnParts = Infinity,
          lastSwap = -1,
          swapWorstMs = 0,
          lastNow = performance.now();
        let swaps = 0;
        const gpu = (
          window as unknown as {
            __atlasGpu: { draws: number; textureBinds: number };
          }
        ).__atlasGpu;
        let previousDraws = gpu.draws,
          previousBinds = gpu.textureBinds;
        const batches: {
          swaps: number;
          draws: number;
          textureBinds: number;
        }[] = [];
        const swapStats: {
          swaps: number;
          p95FrameMs: number;
          worstFrameMs: number;
        }[] = [];
        while ((api.snapshot().backdrop?.world?.worldXU ?? -Infinity) < endXU) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const now = performance.now(),
            state = api.snapshot(),
            world = state.worldAtlases;
          for (const frame of world.missingFrames) missing.add(frame);
          maxBytes = Math.max(maxBytes, world.textureBytes);
          maxPages = Math.max(maxPages, world.pages.length);
          maxTextures = Math.max(maxTextures, world.liveTextures);
          minDrawnParts = Math.min(minDrawnParts, world.drawnParts);
          const worldXU = state.backdrop?.world?.worldXU;
          if (worldXU === undefined)
            throw new Error('world-coordinate diagnostics missing');
          const region = boundaries.filter((x) => worldXU >= x).length;
          regions.add(region);
          if (world.swaps !== lastSwap) {
            if (lastSwap >= 0) {
              swapWorstMs = Math.max(swapWorstMs, now - lastNow);
              swapStats.push({
                swaps: world.swaps,
                p95FrameMs: state.p95FrameMs,
                worstFrameMs: state.worstFrameMs,
              });
              swaps++;
            }
            batches.push({
              swaps: world.swaps,
              draws: gpu.draws - previousDraws,
              textureBinds: gpu.textureBinds - previousBinds,
            });
            lastSwap = world.swaps;
          }
          if (world.failure) throw new Error(world.failure);
          lastNow = now;
          previousDraws = gpu.draws;
          previousBinds = gpu.textureBinds;
        }
        return {
          batches,
          regions: [...regions],
          missing: [...missing],
          maxBytes,
          maxPages,
          maxTextures,
          minDrawnParts,
          swaps,
          swapWorstMs,
          swapStats,
          final: api.snapshot(),
        };
      },
      { endXU: third.fromXU + 15000, boundaries: [first.toXU, second.toXU] },
    );
    await page.mouse.up();
    writeFileSync(
      testInfo.outputPath('world-atlas-regions.json'),
      JSON.stringify(result, null, 2),
    );
    await testInfo.attach('world-atlas-regions.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    await page.screenshot({
      path: testInfo.outputPath('world-atlas-regions.png'),
    });
    expect(result.regions.sort()).toEqual([0, 1, 2]);
    expect(result.final.scenery.biome).toBe(third.landscape);
    expect(
      result.final.worldAtlases.regions.some(
        (region) => region.season === third.season,
      ),
    ).toBe(true);
    expect(
      new Set([first.season, second.season, third.season]).size,
    ).toBeGreaterThan(1);
    expect(result.swaps).toBeGreaterThanOrEqual(3);
    expect(result.missing).toEqual([]);
    expect(result.minDrawnParts).toBeGreaterThan(0);
    expect(result.maxTextures).toBeLessThanOrEqual(6);
    expect(result.swapWorstMs).toBeLessThan(250);
    const measured = result.final.worldAtlases.performance;
    expect(measured.baseline.count).toBeGreaterThan(30);
    expect(measured.stages.prepare.count).toBeGreaterThan(0);
    expect(measured.stages.register.count).toBeGreaterThan(0);
    if (renderer === 'webgl')
      expect(measured.stages.upload.count).toBeGreaterThan(0);
    expect(measured.stages.worldActivate.count).toBeGreaterThanOrEqual(3);
    expect(measured.stages.backdropActivate.count).toBeGreaterThanOrEqual(1);
    expect(measured.violations).toEqual([]);
    expect(measured.overheadP95Ms).toBeLessThanOrEqual(
      1000 / (renderer === 'canvas' ? 30 : 60),
    );
    expect(measured.affected.maxMs).toBeLessThan(250);
    expect(result.final.worldAtlases.memory.highWaterBytes).toBeLessThan(
      (renderer === 'canvas' ? 96 : 192) * 1048576,
    );
    expect(result.maxBytes).toBeLessThan(
      (renderer === 'canvas' ? 96 : 192) * 1024 * 1024,
    );
    expect(result.maxPages).toBeLessThanOrEqual(4);
    expect(
      result.final.worldAtlases.pages.every(
        (p) => p.width <= 2048 && p.height <= 2048,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('D-030: delayed raster work fails the gate before either atlas activation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { atlasDelay: false, atlasDelayCount: 0 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Native method is reapplied to the captured context.
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof draw>
    ) {
      const state = window as unknown as {
        atlasDelay: boolean;
        atlasDelayCount: number;
      };
      const source = args[0];
      if (
        state.atlasDelay &&
        (source instanceof ImageBitmap || source instanceof HTMLImageElement) &&
        (source instanceof ImageBitmap ||
          (source.width >= 49 &&
            source.width <= 132 &&
            Math.abs(source.width / source.height - 66 / 24) < 0.1))
      ) {
        state.atlasDelay = false;
        state.atlasDelayCount++;
        const until = performance.now() + 80;
        while (performance.now() < until) {
          /* Deliberate injected main-thread regression. */
        }
      }
      return draw.apply(this, args);
    } as typeof draw;
  });
  await startRide(page, ['cargo_box'], '?debug=1&renderer=canvas');
  await page.evaluate(() => {
    const api = (
      window as unknown as { __vlacek: { resetAtlasMetrics?: () => void } }
    ).__vlacek;
    api.resetAtlasMetrics?.();
    Object.assign(window, { atlasDelay: true });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
  await tapAction(page, 'resume');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { atlasDelayCount: number }).atlasDelayCount,
      ),
    )
    .toBe(1);
  const state = await snapshot(page);
  expect(state.worldAtlases.performance?.violations).toContain('prepare');
});

for (const renderer of ['canvas', 'webgl'])
  test(`D-030: ${renderer} forced two world and two backdrop pages survive ten ownership cycles`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      const gpu = { draws: 0, binds: 0, canvasDraws: 0 };
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Native draw retains its context through apply.
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<typeof draw>
      ) {
        gpu.canvasDraws++;
        return draw.apply(this, args);
      } as typeof draw;
      Object.assign(window, { atlasProofGpu: gpu });
      for (const proto of [
        WebGLRenderingContext.prototype,
        WebGL2RenderingContext.prototype,
      ]) {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Each native method keeps its original this through apply.
        const { drawElements, drawArrays, bindTexture } = proto;
        proto.drawElements = function (
          ...args: Parameters<typeof drawElements>
        ) {
          gpu.draws++;
          return drawElements.apply(this, args);
        };
        proto.drawArrays = function (...args: Parameters<typeof drawArrays>) {
          gpu.draws++;
          return drawArrays.apply(this, args);
        };
        proto.bindTexture = function (...args: Parameters<typeof bindTexture>) {
          gpu.binds++;
          return bindTexture.apply(this, args);
        };
      }
    });
    await startRide(page, ['cargo_box'], `?debug=1&renderer=${renderer}`);
    await tapAction(page, 'pause');
    const proof = await page.evaluate(async () => {
      type Proof = {
        cycles: {
          pages: number[];
          liveTextures: number;
          overlaps: number[];
          memory: { bytes: number; highWaterBytes: number };
          frames: { expected: unknown; drawn: string; texture: string }[];
        }[];
        performance: DebugSnapshot['worldAtlases']['performance'];
      };
      const globals = window as unknown as {
        __vlacek: { atlasProof(): Promise<Proof> };
        atlasProofGpu: { draws: number; binds: number; canvasDraws: number };
      };
      const before = { ...globals.atlasProofGpu };
      const result = await globals.__vlacek.atlasProof();
      const total = { ...globals.atlasProofGpu };
      await new Promise(requestAnimationFrame);
      const from = { ...globals.atlasProofGpu };
      while (
        globals.atlasProofGpu.draws === from.draws &&
        globals.atlasProofGpu.canvasDraws === from.canvasDraws
      )
        await new Promise(requestAnimationFrame);
      const frame = {
        draws: globals.atlasProofGpu.draws - from.draws,
        binds: globals.atlasProofGpu.binds - from.binds,
        canvasDraws: globals.atlasProofGpu.canvasDraws - from.canvasDraws,
      };
      return {
        ...result,
        frame,
        gpu: {
          draws: total.draws - before.draws,
          binds: total.binds - before.binds,
          canvasDraws: total.canvasDraws - before.canvasDraws,
        },
      };
    });
    await page.addStyleTag({
      content: '#ui-layer,#diagnostics,.ride-curtain{display:none!important}',
    });
    const screenshot = await page.screenshot({
      path: testInfo.outputPath('forced-multipage.png'),
    });
    const pixels = await page.evaluate(
      async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('screenshot context missing');
        context.drawImage(image, 0, 0);
        return Array.from({ length: 4 }, (_, i) => {
          const r = 0.03 * (i - 1),
            dx = -0.25 * 0.19 * canvas.width;
          const sample = (dy: number) =>
            Array.from(
              context.getImageData(
                Math.round(
                  (canvas.width * (i + 0.5)) / 4 +
                    dx * Math.cos(r) -
                    dy * Math.sin(r),
                ),
                Math.round(
                  canvas.height * 0.5 + dx * Math.sin(r) + dy * Math.cos(r),
                ),
                1,
                1,
              ).data,
            );
          return {
            diagonal: sample(-0.25 * 0.4 * canvas.height),
            color: sample(0.25 * 0.4 * canvas.height),
          };
        });
      },
      `data:image/png;base64,${screenshot.toString('base64')}`,
    );
    const colors = [
      [219, 151, 84],
      [221, 89, 89],
      [69, 143, 217],
      [70, 155, 101],
    ];
    pixels.forEach((pixel, i) => {
      expect(pixel.diagonal.slice(0, 3).every((value) => value > 240)).toBe(
        true,
      );
      pixel.color
        .slice(0, 3)
        .forEach((value, c) =>
          expect(
            Math.abs(value - (colors[i]?.[c] ?? -999)),
          ).toBeLessThanOrEqual(3),
        );
    });
    writeFileSync(
      testInfo.outputPath('forced-multipage.json'),
      JSON.stringify(proof, null, 2),
    );
    expect(proof.cycles).toHaveLength(10);
    for (const cycle of proof.cycles) {
      expect(cycle.pages).toEqual([2, 2]);
      expect(cycle.liveTextures).toBe(4);
      expect(Math.max(...cycle.overlaps)).toBeLessThanOrEqual(6);
      expect(
        cycle.frames.every((frame) => frame.expected === frame.drawn),
      ).toBe(true);
    }
    expect(proof.performance.baseline.count).toBeGreaterThan(30);
    expect(proof.performance.violations).toEqual([]);
    expect(proof.performance.overheadP95Ms).toBeLessThanOrEqual(1000 / 30);
    if (renderer === 'canvas') expect(proof.frame.canvasDraws).toBe(4);
    else expect(proof.frame.draws).toBeGreaterThanOrEqual(4);
    if (renderer === 'webgl') {
      expect(proof.gpu.draws).toBeGreaterThan(40);
      expect(proof.gpu.binds).toBeGreaterThan(40);
    }
    await page.evaluate(() =>
      (
        window as unknown as { __vlacek: { closeAtlasProof(): void } }
      ).__vlacek.closeAtlasProof(),
    );
    await expect
      .poll(async () => (await snapshot(page)).worldAtlases.memory.bytes)
      .toBeLessThan(96 * 1048576);
  });

for (const renderer of ['canvas', 'webgl'])
  test(`D-030: ${renderer} integrated catalogue union at 4096 CSS px low profile fits with live ride textures`, async ({
    page,
  }, testInfo) => {
    // Real integrated metadata (snapshot ∪ registered), the reviewed worst backdrop union.
    const parts = integratedCatalogue(worldParts);
    const keys = worldAtlasWindowKeys(parts, [
      { landscape: 'town', season: 'spring' },
      { landscape: 'foothills', season: 'winter' },
    ]);
    // D-028 camera zoom of a short train at 4096 CSS px, low profile (DPR 1).
    const zoom = trainZoom(
      { widthPx: 4096, heightPx: 600, reservedTopPx: 0, reservedBottomPx: 0 },
      0,
      { ...gameConfig.camera, vehicleHeightU: 0 },
    );
    const catalogue: AtlasProofSources = {
      world: [],
      backdrop: [],
      pxPerU: {
        world: profileArtScale(zoom, 'low'),
        backdrop: profileBackdropScale(zoom, 'low'),
      },
    };
    for (const key of keys) {
      const part = parts[key];
      if (!part) throw new Error(`missing ${key}`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${part.widthU}" height="${part.heightU}"><rect width="100%" height="100%" fill="#609760"/></svg>`;
      catalogue[isBackdropPart(key) ? 'backdrop' : 'world'].push({
        key,
        widthU: part.widthU,
        heightU: part.heightU,
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      });
    }
    await page.setViewportSize({ width: 4096, height: 600 });
    await page.goto(`./?debug=1&quality=low&renderer=${renderer}`);
    await tapAction(page, 'loco:steam_local');
    await tapAction(page, 'to-depot');
    await tapAction(page, 'add:cargo_box');
    await tapAction(page, 'depart');
    await page.evaluate(async () => {
      const api = (
        window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
      ).__vlacek;
      while (
        api.snapshot().worldAtlases.pending ||
        api.snapshot().artAtlas?.pxPerU !== 1.25
      )
        await new Promise(requestAnimationFrame);
    });
    await tapAction(page, 'pause');
    const before = await snapshot(page);
    expect(before.renderProfile.effects).toBe('low');
    expect(before.artAtlas?.pxPerU).toBe(1.25);
    expect(before.backdropAtlas?.pxPerU).toBe(0.75);
    expect(catalogue.pxPerU).toEqual({ world: 1.25, backdrop: 0.75 });
    expect(
      before.worldAtlases.memory.allocations.filter(
        (a) => a.key === 'vehicle@:sources',
      ),
    ).toEqual([]);
    expect(before.worldAtlases.memory.bytes).toBeLessThan(96 * 1048576);

    const proof = await page.evaluate(
      async (catalogue) =>
        (
          window as unknown as {
            __vlacek: {
              atlasProof(catalogue: AtlasProofSources): Promise<{
                cycles: {
                  memory: DebugSnapshot['worldAtlases']['memory'];
                  pages: number[];
                }[];
              }>;
            };
          }
        ).__vlacek.atlasProof(catalogue),
      catalogue,
    );
    writeFileSync(
      testInfo.outputPath('complete-catalogue-memory.json'),
      JSON.stringify({ before: before.worldAtlases, proof }, null, 2),
    );
    for (const cycle of proof.cycles)
      expect(cycle.memory.highWaterBytes).toBeLessThan(96 * 1048576);
    await page.evaluate(() =>
      (
        window as unknown as { __vlacek: { closeAtlasProof(): void } }
      ).__vlacek.closeAtlasProof(),
    );
  });

test('D-030: WebGL restores immutable atlas pixels and ground after context loss', async ({
  page,
}) => {
  await startRide(page, ['cargo_box'], '?debug=1&renderer=webgl');
  const before = await snapshot(page);
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('canvas missing');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL missing');
    const loss = gl.getExtension('WEBGL_lose_context');
    if (!loss) throw new Error('context-loss extension missing');
    await new Promise<void>((resolve) => {
      canvas.addEventListener('webglcontextrestored', () => resolve(), {
        once: true,
      });
      canvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          requestAnimationFrame(() => loss.restoreContext());
        },
        { once: true },
      );
      loss.loseContext();
    });
  });
  await expect
    .poll(async () => (await snapshot(page)).artAtlas?.textureKey)
    .not.toBe(before.artAtlas?.textureKey);
  await expect
    .poll(async () => (await snapshot(page)).worldAtlases.pending)
    .toBe(false);
  const after = await snapshot(page);
  expect(after.worldAtlases.missingFrames).toEqual([]);
  expect(after.artVehicles).toBe(after.vehicles);
  expect(after.worldAtlases.memory.highWaterBytes).toBeLessThan(96 * 1048576);
});

test('D-030: a world failure after backdrop preparation releases the curtain into fallback', async ({
  page,
}) => {
  await page.route(/track\.tile-a-[^/]*\.svg$/, async (route) => {
    await page.evaluate(async () => {
      const api = (
        window as unknown as { __vlacek: { snapshot(): DebugSnapshot } }
      ).__vlacek;
      while (!api.snapshot().backdropAtlas)
        await new Promise(requestAnimationFrame);
    });
    await route.abort();
  });
  await startRide(page, ['cargo_box'], '?debug=1&renderer=canvas');
  const state = await snapshot(page);
  expect(state.worldAtlases.failure).toBeDefined();
  expect(state.worldAtlases.pending).toBe(false);
  expect(state.artAtlas).toBeUndefined();
  expect(state.renderedChunks).toBeGreaterThan(0);
  expect(state.artVehicles).toBe(state.vehicles);
});

test('D-030: seed 1 legal 1544 u journey resize charges its NPC atlas and retained ground by lifetime', async ({
  page,
}, testInfo) => {
  // D-030, owner decisions 2026-10-16: a restore and two resizes each
  // re-decode the window (15 s publication polls below), so this test alone
  // gets the tripled test timeout.
  test.slow();
  const ids = [
    'passenger_double',
    'cargo_excavator',
    'passenger_panorama',
    'fun_balloons',
    'cargo_tractor',
    'fun_windmill',
    'service_crane',
  ];
  const consist = {
    locomotiveId: 'steam_express',
    wagons: ids.map((definitionId, i) => ({
      instanceId: `w${i}`,
      definitionId,
      visualSeed: 0,
    })),
  };
  await page.addInitScript(
    ({ consist, generatorVersion }) =>
      localStorage.setItem(
        'vlacek.save.v1',
        JSON.stringify({
          schemaVersion: 1,
          contentVersion: 1,
          savedAtIso: '2026-10-14T00:00:00.000Z',
          appBuildId: 'atlas-resize-fixture',
          settings: {
            sfxEnabled: false,
            musicEnabled: false,
            reducedEffects: false,
            maxSpeedFactor: 1,
            quality: 'low',
          },
          lastConsist: consist,
          journey: {
            seed: 1,
            generatorVersion,
            consist,
            head: { chunkIndex: 0, arcOffsetU: 800 },
            simulationTick: 0,
            activeEntities: [],
          },
        }),
      ),
    { consist, generatorVersion: TRACK_GENERATOR_VERSION },
  );
  // D-030, owner decision 2026-10-16: after a restore or resize the window
  // re-decodes its SVGs; publication may take up to 15 s instead of 5 s.
  const publication = { timeout: 15_000 };
  await page.setViewportSize({ width: 3840, height: 600 });
  await page.goto('./?debug=1&quality=low&renderer=webgl');
  await tapAction(page, 'continue');
  await expect
    .poll(async () => (await snapshot(page)).worldAtlases.pending, publication)
    .toBe(false);
  await expect
    .poll(async () => (await snapshot(page)).vehicleAtlas?.pxPerU)
    .toBe(1.25);
  const at3840 = await snapshot(page);
  await page.setViewportSize({ width: 4096, height: 600 });
  await expect.poll(async () => (await snapshot(page)).screen).toBe('PAUSED');
  const at4096 = await snapshot(page);
  // D-028 holds the same 1.25 raster step on these two CSS widths.
  expect(at4096.vehicleAtlas?.textureKey).toBe(at3840.vehicleAtlas?.textureKey);
  await page.setViewportSize({ width: 3200, height: 600 });
  await expect
    .poll(async () => (await snapshot(page)).vehicleAtlas?.pxPerU)
    .toBe(1);
  await expect
    .poll(async () => (await snapshot(page)).worldAtlases.pending, publication)
    .toBe(false);
  const before = await snapshot(page);
  await page.setViewportSize({ width: 4096, height: 600 });
  await expect
    .poll(async () => (await snapshot(page)).vehicleAtlas?.pxPerU)
    .toBe(1.25);
  await expect
    .poll(async () => (await snapshot(page)).worldAtlases.pending, publication)
    .toBe(false);
  const after = await snapshot(page);
  const bytes = (s: DebugSnapshot, prefix: string) =>
    s.worldAtlases.memory.allocations
      .filter((a) => a.key.startsWith(prefix))
      .reduce((sum, a) => sum + a.canvas + a.imageData + a.sources + a.gpu, 0);
  const atlasBytes = (s: DebugSnapshot) =>
    (s.vehicleAtlas?.width ?? 0) * (s.vehicleAtlas?.height ?? 0) * 4;
  const oldGround = bytes(before, 'texture:ground:');
  const newGround = bytes(after, 'texture:ground:');
  const sources = 0;
  expect(
    after.worldAtlases.memory.allocations.filter(
      (a) => a.key.startsWith('decode:') || a.key === 'vehicle@:sources',
    ),
  ).toEqual([]);
  const window = (s: DebugSnapshot, prefix: string) =>
    s.worldAtlases.pages
      .filter((p) => p.textureKey.startsWith(prefix))
      .reduce((sum, p) => sum + p.width * p.height * 4, 0);
  const auxiliary = Math.max(
    ...[before, after].map(
      (s) =>
        s.worldAtlases.memory.bytes -
        bytes(s, 'texture:ground:') -
        bytes(s, 'texture:vehicle@') -
        bytes(s, 'texture:art@') -
        bytes(s, 'texture:backdrop@') -
        sources,
    ),
  );
  const keys = worldAtlasWindowKeys(worldParts, after.worldAtlases.regions);
  const sourceBytes = (background: boolean) =>
    Math.max(
      ...artAtlasItems(
        Object.fromEntries(
          keys
            .filter((k) => isBackdropPart(k) === background)
            .map((k) => [k, worldParts[k as keyof typeof worldParts]]),
        ),
        background ? 1 : 2,
      ).map((p) => p.width * p.height * 4),
    );
  const plan = {
    sourcesBytes: sources,
    auxiliaryBytes: auxiliary,
    gpu: true,
    vehicle: {
      oldBytes: atlasBytes(before),
      newBytes: atlasBytes(after),
      releaseOldFirst: false,
      decodeBytes: journeyArtKeys(
        [...locomotives, ...wagons].filter(
          (v) => v.id === 'steam_express' || ids.includes(v.id),
        ),
        npcFleetFor(1, { locomotives, wagons }),
      )
        .map((k) => artParts[k].widthU * artParts[k].heightU * 16)
        .sort((a, b) => b - a)
        .slice(0, 4)
        .reduce((a, b) => a + b, 0),
    },
    ground: {
      oldBytes: oldGround,
      newBytes: newGround,
      largestNewBytes: Math.max(
        ...after.worldAtlases.memory.allocations
          .filter((a) => a.key.startsWith('texture:ground:'))
          .map((a) => a.gpu),
      ),
    },
    world: {
      oldBytes: window(before, 'art@'),
      newBytes: window(after, 'art@'),
      decodeBytes: sourceBytes(false),
    },
    backdrop: {
      oldBytes: window(before, 'backdrop@'),
      newBytes: window(after, 'backdrop@'),
      decodeBytes: sourceBytes(true) * 4,
    },
  };
  const model = atlasLifetimePeak(plan);
  writeFileSync(
    testInfo.outputPath('resize-memory.json'),
    JSON.stringify({ at3840, at4096, before, after, plan, model }, null, 2),
  );
  expect(after.worldAtlases.memory.highWaterBytes).toBeLessThanOrEqual(
    model.peakBytes,
  );
  expect(model.peakBytes).toBeLessThan(96 * 1048576);
  expect(after.worldAtlases.missingFrames).toEqual([]);
  // Low's residency cap also holds on ultrawide screens, independently of DPR/camera zoom.
  await page.setViewportSize({ width: 5120, height: 600 });
  await expect
    .poll(() =>
      page
        .locator('canvas')
        .first()
        .evaluate((canvas) =>
          canvas instanceof HTMLCanvasElement ? canvas.width : 0,
        ),
    )
    .toBe(5120);
  await expect
    .poll(async () => (await snapshot(page)).worldAtlases.pending)
    .toBe(false);
  const wide = await snapshot(page);
  expect(wide.vehicleAtlas?.textureKey).toBe(after.vehicleAtlas?.textureKey);
  expect(wide.vehicleAtlas?.pxPerU).toBe(1.25);
  expect(wide.artAtlas?.pxPerU).toBe(1.25);
  expect(wide.worldAtlases.memory.highWaterBytes).toBeLessThan(96 * 1048576);
});
