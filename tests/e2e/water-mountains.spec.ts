import { expect, test, type Page } from '@playwright/test';
import {
  waitForWorldAtlases,
  tapAction,
  snapshot,
  expectWholeTrainInView,
  trainBoxesOverFrames,
} from './helpers.ts';
import { longestMixedConsist } from './perfConsist.ts';
import { probeFarmScene } from './farmCompositionProbe.ts';
function waterSave(chunkIndex: number, long: boolean) {
  const consist = long
    ? longestMixedConsist('steam_local')
    : {
        locomotiveId: 'steam_local',
        wagons: [
          { instanceId: 'w1', definitionId: 'cargo_box', visualSeed: 1 },
        ],
      };
  return {
    schemaVersion: 1,
    contentVersion: 1,
    savedAtIso: '2026-10-15T00:00:00.000Z',
    appBuildId: 'water-mountains-2',
    settings: {
      sfxEnabled: false,
      musicEnabled: false,
      reducedEffects: false,
      maxSpeedFactor: 1,
      quality: 'standard',
    },
    lastConsist: consist,
    journey: {
      seed: 1,
      generatorVersion: 2,
      consist,
      head: { chunkIndex, arcOffsetU: 512 },
      simulationTick: 0,
      activeEntities: [],
    },
  };
}
for (const renderer of ['canvas', 'webgl'])
  for (const long of [false, true]) {
    test.describe(`${renderer} ${long ? 'longest' : 'short'}`, () => {
      let page: Page;
      const errors: string[] = [];
      test.beforeAll(async ({ browser }, info) => {
        page = await browser.newPage({
          ...(info.project.use.baseURL
            ? { baseURL: info.project.use.baseURL }
            : {}),
          viewport: { width: 1140, height: 512 },
        });
        page.on('pageerror', (e) => errors.push(e.message));
        const save = waterSave(0, long);
        await page.addInitScript(
          (json) => localStorage.setItem('vlacek.save.v1', json),
          JSON.stringify(save),
        );
        await page.goto(`./?debug=1&renderer=${renderer}`);
        await tapAction(page, 'continue');
        await tapAction(page, 'resume');
        await waitForWorldAtlases(page);
        expect((await snapshot(page)).renderer).toBe(renderer);
        await page.clock.install();
      });
      test.afterAll(async () => page?.close());
      for (const kind of ['coast', 'fishponds', 'dunes', 'mountains'])
        test(`LA/CO/DU/MO ${kind} real locator, control and pause`, async () => {
          await tapAction(page, 'pause');
          await page.clock.pauseAt(
            await page.evaluate(() => Date.now() + 60000),
          );
          for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
          await page.getByText('Testovací scény', { exact: true }).click();
          await tapAction(page, `dev-world-scene:${kind}`);
          await page.clock.resume();
          await waitForWorldAtlases(page);
          await page.clock.pauseAt(
            await page.evaluate(() => Date.now() + 60000),
          );
          await page.clock.fastForward(80);
          expect((await snapshot(page)).worldDebug.location?.kind).toBe(kind);
          expect((await snapshot(page)).scenery.nearPropsOverTrain).toBe(0);
          const before = await snapshot(page);
          await page.mouse.move(750, 250);
          await page.mouse.down();
          for (let i = 0; i < 30; i++) await page.clock.fastForward(80);
          const held = await snapshot(page);
          expect(held.intent).toBe('THROTTLE');
          expect(held.headS).toBeGreaterThan(before.headS);
          expect(held.speedUPerSec).toBeGreaterThan(0);
          await page.mouse.up();
          for (let i = 0; i < 6; i++) await page.clock.fastForward(80);
          const released = await snapshot(page);
          expect(released.intent).toBe('COAST');
          expect(released.headS).toBeGreaterThan(held.headS);
          expect(released.speedUPerSec).toBeGreaterThan(0);
          expect(released.speedUPerSec).toBeLessThan(held.speedUPerSec);
          await tapAction(page, 'pause');
          const paused = await snapshot(page);
          await page.clock.fastForward(800);
          expect((await snapshot(page)).simulationTick).toBe(
            paused.simulationTick,
          );
          expect((await snapshot(page)).headS).toBe(paused.headS);
          await tapAction(page, 'resume');
          await page.clock.resume();
          await waitForWorldAtlases(page);
          await expect
            .poll(async () => (await snapshot(page)).trainBox)
            .toBeDefined();
          await expectWholeTrainInView(
            page,
            await trainBoxesOverFrames(page, 3),
          );
          expect(errors).toEqual([]);
          const diagnostic = await page.evaluate(() =>
            Object.hasOwn(
              (
                window as unknown as {
                  __vlacek: {
                    snapshot(): import('../../src/app/debugSnapshot.ts').DebugSnapshot;
                  };
                }
              ).__vlacek.snapshot().scenery,
              'waterMountains',
            ),
          );
          expect(diagnostic, 'rendered compound diagnostics').toBe(true);
        });
    });
  }

import { chunkScenery } from '../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../src/content/worldPlacementCatalog.ts';
import { waterMountainParts } from '../../src/content/world-modules/water-mountains.art.ts';
for (const renderer of ['canvas', 'webgl'])
  for (const witness of [
    {
      kind: 'back.watermill',
      k: 288,
      frames: ['life.watermill-body', 'life.watermill-wheel'],
    },
    { kind: 'back.ferry', k: 312, frames: ['back.ferry', 'back.ferryman-arm'] },
    { kind: 'back.ferry', k: 293, frames: ['back.ferry', 'back.ferryman-arm'] },
    {
      kind: 'back.excavator',
      k: 108,
      frames: [
        'back.excavator',
        'back.excavator-boom',
        'back.excavator-stick',
        'back.excavator-bucket',
      ],
    },
    {
      kind: 'back.cableway-tower',
      k: 100,
      frames: [
        'back.cableway-tower',
        'back.cableway-cabin',
        'back.cableway-station',
      ],
    },
  ])
    test(`rendered compound cycle ${witness.kind} chunk ${witness.k} ${renderer}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1140, height: 512 });
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const save = waterSave(witness.k, true);
      await page.addInitScript(
        (json) => localStorage.setItem('vlacek.save.v1', json),
        JSON.stringify(save),
      );
      await page.goto(`./?debug=1&renderer=${renderer}`);
      await tapAction(page, 'continue');
      await tapAction(page, 'resume');
      await waitForWorldAtlases(page);
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
      expect(pageErrors).toEqual([]);
      const model = chunkScenery(
        1,
        witness.k,
        worldPlacementCatalog,
      ).props.find((p) => p.kind === witness.kind);
      if (!model) throw new Error('missing compound witness');
      const read = async () => {
        const state = (await snapshot(page)).scenery.waterMountains.find(
          (p) => p.id === model.id,
        );
        if (!state) throw new Error('rendered compound missing');
        return state;
      };
      const initial = await snapshot(page),
        poses = [await read()];
      for (const frame of witness.frames)
        expect(poses[0]?.frames).toContain(frame);
      for (let sample = 0; sample < 3; sample++) {
        for (let frame = 0; frame < 75; frame++)
          await page.clock.fastForward(80);
        poses.push(await read());
      }
      expect((await snapshot(page)).simulationTick).toBeGreaterThan(
        initial.simulationTick,
      );
      const values = poses.map((p) =>
        witness.kind === 'back.watermill'
          ? p.wheelAngleRad
          : witness.kind === 'back.ferry'
            ? p.ferryRatio
            : witness.kind === 'back.excavator'
              ? p.armAngleRad
              : p.cabinXU,
      );
      expect(
        new Set(values).size,
        'normal render loop must animate the compound',
      ).toBeGreaterThan(1);
      await tapAction(page, 'pause');
      const paused = await snapshot(page),
        frozen = await read();
      await page.clock.fastForward(800);
      expect((await snapshot(page)).simulationTick).toBe(paused.simulationTick);
      expect(
        await read(),
        'pause freezes the actual rendered compound',
      ).toEqual(frozen);
      await tapAction(page, 'resume');
      await page.clock.fastForward(80);
      expect((await snapshot(page)).simulationTick).toBeGreaterThan(
        paused.simulationTick,
      );
      expect((await snapshot(page)).scenery.nearPropsOverTrain).toBe(0);
      expect(pageErrors).toEqual([]);
    });

for (const long of [false, true])
  test(`WM2-4 heather forms visible pink-violet mats ${long ? 'longest' : 'short'}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1140, height: 512 });
    await page.addInitScript(
      (json) => localStorage.setItem('vlacek.save.v1', json),
      JSON.stringify(waterSave(364, long)),
    );
    await page.goto('./?debug=1&renderer=canvas');
    await tapAction(page, 'continue');
    await tapAction(page, 'resume');
    await waitForWorldAtlases(page);
    await expect
      .poll(async () => (await snapshot(page)).artVehicles)
      .toBe((await snapshot(page)).vehicles);
    const pink = await page
      .locator('canvas')
      .first()
      .evaluate((canvas) => {
        if (!(canvas instanceof HTMLCanvasElement))
          throw new Error('game canvas missing');
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        const ctx = copy.getContext('2d');
        if (!ctx) throw new Error('no pixel context');
        ctx.drawImage(canvas, 0, 0);
        const pixels = ctx.getImageData(
          0,
          Math.floor(canvas.height * 0.59),
          canvas.width,
          Math.ceil(canvas.height * 0.41),
        ).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i] ?? 0,
            g = pixels[i + 1] ?? 0,
            b = pixels[i + 2] ?? 0;
          if (r - g > 25 && b - g > 15 && r + b > 220 && g > 45 && r < 225)
            count++;
        }
        return count;
      });
    expect(
      pink,
      'heather must read as flower mats at phone size',
    ).toBeGreaterThanOrEqual(150);
  });

for (const renderer of ['canvas', 'webgl'])
  for (const long of [false, true])
    test(`WM3 SCN-FH05 cableway remains legible at endpoints and mid-span ${renderer} ${long ? 'longest' : 'short'}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1140, height: 512 });
      await probeFarmScene(page);
      await page.addInitScript(
        (json) => localStorage.setItem('vlacek.save.v1', json),
        JSON.stringify(waterSave(112, long)),
      );
      await page.goto(`./?debug=1&renderer=${renderer}`);
      await tapAction(page, 'continue');
      await tapAction(page, 'resume');
      await waitForWorldAtlases(page);
      await expect
        .poll(async () => (await snapshot(page)).artVehicles)
        .toBe((await snapshot(page)).vehicles);
      const model = chunkScenery(1, 112, worldPlacementCatalog).props.find(
        (p) => p.kind === 'back.cableway-tower',
      );
      if (!model) throw new Error('missing cableway witness');
      const tower = waterMountainParts['back.cableway-tower'];
      const anchor = tower?.anchorsU?.['cable'];
      if (!tower || !anchor) throw new Error('missing cable anchor');
      // Exact render poses; normal-loop animation/pause is covered above.
      for (const ratio of [0, 0.5, 1]) {
        const pose = await page.evaluate(
          ({ id, ratio, cableYU }) => {
            const scene = window.__farmScene;
            scene.sys.setActive(false);
            type Object = (typeof scene.children.list)[number];
            const find = (objects: Object[]): Object | undefined => {
              for (const o of objects) {
                if (o.name === id) return o;
                const nested = o.list && find(o.list);
                if (nested) return nested;
              }
              return undefined;
            };
            const root = find(scene.children.list);
            if (!root?.list) throw new Error('missing cableway assembly');
            const camera = scene.cameras.main;
            const screen = (object: Object) => {
              const b = object.getBounds();
              return {
                x: (b.x - camera.scrollX - 570) * camera.zoom + 570,
                y: (b.y - camera.scrollY - 256) * camera.zoom + 256,
                width: b.width * camera.zoom,
                height: b.height * camera.zoom,
              };
            };
            const cabin = root.list.find(
              (o) => o.frame?.name === 'back.cableway-cabin',
            );
            if (!cabin) throw new Error('missing cabin');
            const towers = root.list.filter(
              (o) => o.frame?.name === 'back.cableway-tower',
            );
            const [left, right] = towers;
            if (!left || !right) throw new Error('missing towers');
            cabin.x = left.x + (right.x - left.x) * ratio;
            cabin.y = cableYU + left.y + (right.y - left.y) * ratio;
            return {
              ratio: (cabin.x - left.x) / (right.x - left.x),
              cabin: screen(cabin),
              towers: root.list
                .filter((o) => o.frame?.name === 'back.cableway-tower')
                .map(screen),
              stations: root.list
                .filter((o) => o.frame?.name === 'back.cableway-station')
                .map(screen),
            };
          },
          {
            id: model.id,
            ratio,
            cableYU: anchor.y - tower.pivotU.y,
          },
        );
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        expect(pose.ratio).toBeCloseTo(ratio);
        expect
          .soft(pose.cabin.width, 'recognizable cabin width in CSS pixels')
          .toBeGreaterThanOrEqual(14);
        expect
          .soft(pose.cabin.height, 'recognizable cabin height in CSS pixels')
          .toBeGreaterThanOrEqual(12);
        expect(pose.towers).toHaveLength(2);
        expect(pose.stations).toHaveLength(2);
        for (const box of [pose.cabin, ...pose.towers, ...pose.stations]) {
          expect(box.x).toBeGreaterThan(0);
          expect(box.x + box.width).toBeLessThan(1140);
          expect(box.y).toBeGreaterThan(80);
          expect(box.y + box.height).toBeLessThan(390);
        }
        const png = await page.locator('#game-root canvas').screenshot();
        const red = await page.evaluate(
          async ({ png, box }) => {
            const image = new Image();
            image.src = `data:image/png;base64,${png}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('missing pixel context');
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(
              Math.floor(box.x),
              Math.floor(box.y),
              Math.ceil(box.width),
              Math.ceil(box.height),
            ).data;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i] ?? 0,
                g = data[i + 1] ?? 0,
                b = data[i + 2] ?? 0;
              if (r > 140 && r - g > 65 && r - b > 65) count++;
            }
            return count;
          },
          { png: png.toString('base64'), box: pose.cabin },
        );
        expect
          .soft(red, `visible red cabin at ratio=${ratio}`)
          .toBeGreaterThanOrEqual(40);
      }
    });

import { probeScene, restore } from './seasonalVisual.helpers.ts';
for (const renderer of ['canvas', 'webgl'])
  for (const [season, chunk] of [
    ['summer', 288],
    ['winter', 776],
  ] as const)
    test(`WM4 one canonical mill wheel ${season} ${renderer}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1140, height: 512 });
      await probeScene(page);
      await restore(page, renderer, chunk, 512, [], 1);
      await waitForWorldAtlases(page);
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
      const read = async () => {
        const frames = await page.evaluate(() => {
          const frames: string[] = [];
          function walk(
            objects: typeof window.__seasonalProbe.scene.children.list,
          ) {
            for (const o of objects) {
              if (
                o.frame &&
                (String(o.frame.name) === 'back.watermill' ||
                  /watermill-(body|wheel)$/.test(String(o.frame.name)))
              )
                frames.push(String(o.frame.name));
              if (o.list) walk(o.list);
            }
          }
          walk(window.__seasonalProbe.scene.children.list);
          return frames;
        });
        const state = await snapshot(page);
        return {
          frames,
          tick: state.simulationTick,
          wheels: state.scenery.waterMountains.filter(
            (p) => p.kind === 'back.watermill',
          ),
        };
      };
      const before = await read();
      expect(before.frames).not.toContain('back.watermill');
      expect(before.frames.filter((k) => k.endsWith('-wheel'))).toEqual([
        'life.watermill-wheel',
      ]);
      expect(before.frames.filter((k) => k.endsWith('-body'))).toEqual([
        'life.watermill-body',
      ]);
      for (let i = 0; i < 12; i++) await page.clock.fastForward(80);
      const after = await read();
      expect(after.frames).toEqual(before.frames);
      expect(after.tick).toBeGreaterThan(before.tick);
      expect(
        after.wheels[0]?.wheelAngleRad !== before.wheels[0]?.wheelAngleRad,
      ).toBe(season === 'summer');
      expect((await snapshot(page)).worldAtlases.missingFrames).toEqual([]);
    });
