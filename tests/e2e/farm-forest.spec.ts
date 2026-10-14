import { expect, test, type Page } from '@playwright/test';
// Dedicated PNG proofs cover the 32s cycle; trace keeps API/source without render readbacks.
test.use({
  trace: {
    mode: 'retain-on-failure',
    screenshots: false,
    snapshots: false,
    sources: true,
  },
});
import { longestMixedConsist } from './perfConsist.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { farmForestParts } from '../../src/content/world-modules/farm-forest.art.ts';
import { propScale } from '../../src/domain/world/SceneryGeometry.ts';
import { chunkScenery } from '../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../src/content/worldPlacementCatalog.ts';
import { gameConfig } from '../../src/config/gameConfig.ts';
import {
  tapAction,
  snapshot,
  expectWholeTrainInView,
  trainBoxesOverFrames,
} from './helpers.ts';
async function locate(page: import('@playwright/test').Page, kind: string) {
  await tapAction(page, 'pause');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await page.getByText('Testovací scény', { exact: true }).click();
  await tapAction(page, `dev-world-scene:${kind}`);
  await page.clock.fastForward(80);
}
/** Keep real Phaser/input/fixed-step updates without rendering 60 redundant frames/s. */
async function advanceRide(
  page: import('@playwright/test').Page,
  durationMs: number,
) {
  const before = (await snapshot(page)).simulationTick;
  for (let elapsed = 0; elapsed < durationMs; elapsed += 80)
    await page.clock.fastForward(Math.min(80, durationMs - elapsed));
  expect((await snapshot(page)).simulationTick - before).toBeGreaterThanOrEqual(
    Math.floor((durationMs * gameConfig.simulation.fixedHz) / 1000) - 1,
  );
}
for (const renderer of ['canvas', 'webgl'])
  for (const long of [false, true])
    test.describe(`${renderer}, ${long ? 'longest' : 'short'} train`, () => {
      let page: Page;
      const errors: string[] = [];
      // Cold boot is a shared environment fixture; each locator starts a fresh scene.
      // Hook and tests retain their default 30s deadlines independently.
      test.beforeAll(async ({ browser }, info) => {
        page = await browser.newPage({
          ...(info.project.use.baseURL
            ? { baseURL: info.project.use.baseURL }
            : {}),
          ...(info.project.use.viewport
            ? { viewport: info.project.use.viewport }
            : {}),
          ...(info.project.use.hasTouch !== undefined
            ? { hasTouch: info.project.use.hasTouch }
            : {}),
          ...(info.project.use.deviceScaleFactor !== undefined
            ? { deviceScaleFactor: info.project.use.deviceScaleFactor }
            : {}),
        });
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (message) => {
          if (/setMask|GeometryMask|not supported/i.test(message.text()))
            errors.push(message.text());
        });
        await probeFarmScene(page);
        await page.clock.install();
        const query = `?debug=1&seed=1&renderer=${renderer}`;
        const consist = long
          ? longestMixedConsist('steam_local')
          : { locomotiveId: 'steam_local', wagons: [] };
        const save = {
          schemaVersion: 1,
          contentVersion: 1,
          savedAtIso: '2026-10-13T00:00:00.000Z',
          appBuildId: 'farm-forest-e2e',
          settings: {
            sfxEnabled: false,
            musicEnabled: false,
            reducedEffects: false,
            maxSpeedFactor: 1,
            quality: 'auto',
          },
          lastConsist: consist,
          journey: {
            seed: 1,
            generatorVersion: TRACK_GENERATOR_VERSION,
            consist,
            head: { chunkIndex: 0, arcOffsetU: 800 },
            simulationTick: 0,
            activeEntities: [],
          },
        };
        await page.addInitScript(
          (json) =>
            localStorage.setItem('vlacek.save.v1', JSON.stringify(json)),
          save,
        );
        await page.goto(`./${query}`);
        await tapAction(page, 'continue');
        await tapAction(page, 'resume');
        await expect
          .poll(async () => (await snapshot(page)).artVehicles)
          .toBe(consist.wagons.length + 1);
        expect((await snapshot(page)).artAtlas).toBeDefined();
        expect((await snapshot(page)).backdropAtlas).toBeDefined();
      });
      test.afterAll(async () => {
        await page?.close();
      });
      for (const kind of ['fields', 'forest-work', 'forest-dense'])
        test(`SCN-CR03/FO03/05: ${kind} with ${long ? 'longest' : 'short'} train in ${renderer}`, async () => {
          await locate(page, kind);
          const before = await snapshot(page);
          expect(before.artAtlas).toBeDefined();
          expect(before.backdropAtlas).toBeDefined();
          expect(before.artVehicles).toBe(before.vehicles);
          if (kind === 'forest-dense') {
            expect(before.scenery.localities).toContain('farm-forest-dense');
            expect(before.backdrop?.currentBiome).toBe('forest');
          } else {
            const machine = before.scenery.work.find(
              (p) =>
                p.kind ===
                  (kind === 'fields'
                    ? 'back.tractor-work'
                    : 'back.forwarder') && p.layer === 'near',
            );
            expect(machine).toBeDefined();
            if (!machine) throw new Error('missing rendered machine');
            if (kind === 'forest-work') {
              const k = Number(machine.id.match(/chunk:(-?\d+)/)?.[1]);
              const prop = chunkScenery(1, k, worldPlacementCatalog).props.find(
                (p) => p.id === machine.id,
              );
              if (!prop?.motion) throw new Error('missing authored trajectory');
              const stops = new Set<number>(),
                headings = new Set<boolean>(),
                holding = new Set<boolean>(),
                arms = new Set<number>();
              for (let sample = 0; sample < 8; sample++) {
                await advanceRide(page, 4000);
                const state = await snapshot(page),
                  next = state.scenery.work.find((p) => p.id === machine.id);
                if (!next) throw new Error('work actor lost during cycle');
                const seconds = state.simulationTick / 60,
                  at = (seconds + prop.phase * 32) % 32;
                const smooth = (v: number) => v * v * (3 - 2 * v);
                const ratio =
                  at < 26
                    ? smooth(Math.max(0, Math.min(1, (at - 4) / 16)))
                    : 1 - smooth((at - 26) / 6);
                expect(next.xU).toBeCloseTo(
                  k * 1024 + prop.xU + (ratio - 0.5) * prop.motion.rangeU,
                  5,
                );
                expect(next.flip).toBe(at <= 4 || at > 26);
                headings.add(next.flip);
                const distance =
                  (Math.floor((seconds + prop.phase * 32) / 32) * 2 +
                    (at < 26 ? ratio : 2 - ratio)) *
                  prop.motion.rangeU;
                for (const angle of next.wheelAngles) {
                  expect(Math.cos(angle)).toBeCloseTo(
                    Math.cos(
                      distance /
                        (((farmForestParts['wheel.forest']?.heightU ?? 0) / 2) *
                          propScale(prop)),
                    ),
                    5,
                  );
                  expect(Math.sin(angle)).toBeCloseTo(
                    Math.sin(
                      distance /
                        (((farmForestParts['wheel.forest']?.heightU ?? 0) / 2) *
                          propScale(prop)),
                    ),
                    5,
                  );
                }
                if (next.holding !== undefined) holding.add(next.holding);
                if (at <= 4 || (at >= 20 && at <= 26)) {
                  const end = at <= 4 ? 0 : 1,
                    bed = next.bedsU[end],
                    grip = next.gripU;
                  if (!bed || !grip)
                    throw new Error('missing rendered handoff anchors');
                  expect(
                    Math.hypot(grip.xU - bed.xU, grip.yU - bed.yU),
                  ).toBeLessThan(0.01);
                  stops.add(end);
                }
                const harvester = state.scenery.work.find(
                  (p) => p.kind === 'back.harvester',
                );
                if (harvester?.armAngleRad !== undefined)
                  arms.add(harvester.armAngleRad);
                expect(state.scenery.nearPropsOverTrain).toBe(0);
              }
              expect([...stops].sort()).toEqual([0, 1]);
              expect(headings.size).toBe(2);
              expect(holding.size).toBe(2);
              expect(arms.size).toBeGreaterThan(3);
              expect(
                (await snapshot(page)).scenery.work.find(
                  (p) => p.id === machine.id,
                )?.xU,
              ).toBeCloseTo(machine.xU, 5);
            } else {
              await advanceRide(page, 5000);
              const next = (await snapshot(page)).scenery.work.find(
                (p) => p.id === machine.id,
              );
              expect(next).toBeDefined();
              if (!next) throw new Error('tractor disappeared during movement');
              expect(next.xU).not.toBe(machine.xU);
              expect(next.wheelAngles).not.toEqual(machine.wheelAngles);
            }
            await tapAction(page, 'pause');
            const paused = (await snapshot(page)).scenery.work;
            await page.clock.fastForward(1000);
            expect((await snapshot(page)).scenery.work).toEqual(paused);
            await tapAction(page, 'resume');
          }
          if (kind !== 'forest-work') {
            await page.mouse.move(800, 250);
            await page.mouse.down();
            await advanceRide(page, 6500);
            await page.mouse.up();
          }
          const after = await snapshot(page);
          expect(after.scenery.nearPropsOverTrain).toBe(0);
          expect(new Set(after.scenery.work.map((p) => p.id)).size).toBe(
            after.scenery.work.length,
          );
          await page.clock.resume();
          await expectWholeTrainInView(
            page,
            await trainBoxesOverFrames(page, 3),
          );
          expect(errors).toEqual([]);
          await expectCompositionResources(page);
        });
    });

import {
  bakedLayerOrder,
  compositionPixels,
  probeFarmScene,
  expectCompositionResources,
} from './farmCompositionProbe.ts';
for (const renderer of ['canvas', 'webgl']) {
  for (const witness of [
    { name: 'stream', seed: 1, k: 60, layer: 'back' as const, depth: 0.12 },
    { name: 'clearing', seed: 1, k: 61, layer: 'back' as const, depth: 0.12 },
    {
      name: 'crossing-field',
      seed: 0,
      k: 83,
      layer: 'near' as const,
      depth: 0.53,
    },
  ])
    test(`FO02/CR01 rendered clipping ${witness.name} ${renderer}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: 1140, height: 512 });
      const png = await compositionPixels(
        page,
        renderer,
        witness.seed,
        witness.k,
        witness.layer,
        witness.depth,
      );
      await info.attach(`${witness.name}-${renderer}`, {
        body: png,
        contentType: 'image/png',
      });
    });
}

// A baked layer keeps its painter position among individual near props.
for (const renderer of ['canvas', 'webgl']) {
  for (const witness of [
    {
      name: 'crop rows under a nearer hay bale',
      seed: 1,
      k: 36,
      depth: 0.66,
      propId: 'g2:chunk:36:prop:rule:18:candidate:1',
    },
    {
      name: 'forest edge under a nearer young spruce',
      seed: 4,
      k: 129,
      depth: 0.28,
      propId: 'g2:chunk:129:prop:rule:18:candidate:1',
    },
  ])
    test(`FO02/CR01 baked depth order: ${witness.name} in ${renderer}`, async ({
      page,
    }) => {
      const props = chunkScenery(
        witness.seed,
        witness.k,
        worldPlacementCatalog,
      ).props;
      const prop = props.find((p) => p.id === witness.propId);
      expect(prop?.layer).toBe('near');
      expect(prop?.depth).toBeGreaterThan(witness.depth);
      expect(
        props.some(
          (p) => p.clip && p.layer === 'near' && p.depth === witness.depth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1140, height: 512 });
      const result = await bakedLayerOrder(
        page,
        renderer,
        witness.seed,
        witness.k,
        witness.depth,
        witness.propId,
      );
      expect(
        result.overlap,
        'opaque prop pixels over the baked layer',
      ).toBeGreaterThan(100);
      expect({
        propDrawnAfterLayer: result.propIndex > result.layerIndex,
        coveredPropPixels: result.covered,
      }).toEqual({ propDrawnAfterLayer: true, coveredPropPixels: 0 });
    });
}
