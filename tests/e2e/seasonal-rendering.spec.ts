import { gameConfig } from '../../src/config/gameConfig.ts';
import { longestMixedConsist } from './perfConsist.ts';
import { expect, test } from '@playwright/test';
import {
  probeScene,
  restore,
  renderedFrame,
  pixelChanges,
} from './seasonalVisual.helpers.ts';
import { regionAt } from '../../src/domain/world/Regions.ts';

// The probe must intercept bundles on both visits of the replay regression.
test.use({ serviceWorkers: 'block' });

function winterVillage() {
  for (let seed = 1; seed < 10; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 40; i++) {
      if (r.season === 'winter' && r.landscape === 'countryside')
        return { seed, chunk: Math.ceil((r.fromXU + 3500) / 1024) };
      r = regionAt(seed, r.toXU);
    }
  }
  throw new Error('winter witness missing');
}
for (const renderer of ['canvas', 'webgl']) {
  test(`winter backdrop selects snowy far/mid artwork (${renderer})`, async ({
    page,
  }) => {
    const w = winterVillage();
    await probeScene(page);
    await restore(page, renderer, w.chunk, 300, [], w.seed);
    const frames = await page.evaluate(() =>
      window.__seasonalProbe.scene.children.list
        .flatMap((o) =>
          o instanceof Object && o.frame !== undefined
            ? [String(o.frame.name)]
            : [],
        )
        .filter((k) => k.startsWith('backdrop.')),
    );
    expect(frames.filter((k) => k.endsWith('-winter')).length).toBeGreaterThan(
      2,
    );
  });
  for (const length of ['short', 'long'])
    test(`phone roof planes retain snow across every house (${renderer}, ${length})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1140, height: 512 });
      await probeScene(page);
      await restore(
        page,
        renderer,
        length === 'long' ? 505 : 504,
        length === 'long' ? 660 : 824,
        length === 'long'
          ? longestMixedConsist('steam_local').wagons.map((w) => w.definitionId)
          : ['cargo_box'],
        2,
        'low',
        true,
      );
      expect((await snapshot(page)).simulationTick).toBe(0);
      const coverage = await roofCoverage(page);
      expect(coverage.length).toBeGreaterThanOrEqual(3);
      expect(new Set(coverage.map((c) => c.key))).toEqual(
        new Set(['back.house-a', 'back.house-b', 'back.house-c']),
      );
      for (const house of coverage)
        for (const [band, fraction] of house.bands.entries())
          expect(
            fraction,
            `${house.key} at ${house.x}: roof band ${band}`,
          ).toBeGreaterThan(0.65);
    });
  test(`phone settlement roof planes cover new gable and hip houses (${renderer})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1140, height: 512 });
    await probeScene(page);
    await restore(page, renderer, 490, 750, ['cargo_box'], 2, 'low', true);
    expect((await snapshot(page)).simulationTick).toBe(0);
    const scrollY = await page.evaluate(
      () => window.__seasonalProbe.scene.cameras.main.scrollY,
    );
    // Freeze the scene, then cover both pixel-grid alignments without advancing
    // simulation, waiting, retries or relaxing the snow-coverage contract.
    for (const offsetPx of [0, 0.5]) {
      await page.evaluate(
        ({ scrollY, offsetPx }) => {
          const camera = window.__seasonalProbe.scene.cameras.main;
          camera.setScroll(camera.scrollX, scrollY + offsetPx / camera.zoom);
        },
        { scrollY, offsetPx },
      );
      const roofs = (await roofCoverage(page)).filter((roof) =>
        ['back.house-gable', 'back.house-hip'].includes(roof.key),
      );
      expect(new Set(roofs.map((roof) => roof.key))).toEqual(
        new Set(['back.house-gable', 'back.house-hip']),
      );
      for (const roof of roofs)
        for (const [band, fraction] of roof.bands.entries())
          expect(
            fraction,
            `${roof.key} at ${roof.x}: roof band ${band}, offset ${offsetPx}px`,
          ).toBeGreaterThan(0.65);
    }
  });
}

import {
  framePixels,
  snowRegions,
  advanceSeasonalFrames,
  roofCoverage,
  worldCrop,
  imageCrop,
} from './seasonalVisual.helpers.ts';
import { snapshot, tapAction } from './helpers.ts';
import {
  secondarySiteOfChunk,
  SecondaryLine,
  PORTAL_HILL_U,
} from '../../src/domain/world/SecondaryTrack.ts';

function winterSecondary() {
  let best:
    | {
        seed: number;
        site: NonNullable<ReturnType<typeof secondarySiteOfChunk>>;
      }
    | undefined;
  for (let seed = 1; seed < 10; seed++)
    for (let k = 32; k < 900; k++) {
      const site = secondarySiteOfChunk(seed, k);
      if (
        site &&
        site.fromX === k * 1024 &&
        regionAt(seed, site.fromX).weather === 'snow' &&
        (!best || k < best.site.fromX / 1024)
      )
        best = { seed, site };
    }
  if (!best) throw new Error('winter secondary missing');
  return best;
}
const weatherFrames = [
  'fx.snow-far',
  'fx.snow-mid',
  'fx.snow-near',
  'fx.season-rain',
];
test('seasonal particles replay identically from the restored simulation tick', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1140, height: 512 });
  await probeScene(page);
  const runs = [];
  for (let run = 0; run < 2; run++) {
    await restore(page, 'canvas', 487, 824, ['cargo_box'], 2, 'low', true);
    expect((await snapshot(page)).simulationTick).toBe(0);
    await page.mouse.move(700, 300);
    await page.mouse.down();
    await advanceSeasonalFrames(page, 180);
    runs.push(
      await page.evaluate(() => ({
        tick: window.__seasonalProbe.ride.simulationTick,
        particles: window.__seasonalProbe.field.particles(),
      })),
    );
    await page.mouse.up();
  }
  expect(runs[0]?.particles.length).toBeGreaterThan(0);
  expect(runs[0]?.tick).toBe(360);
  expect(runs[1]).toEqual(runs[0]);
});
for (const renderer of ['canvas', 'webgl']) {
  for (const length of ['short', 'long'])
    for (const quality of ['low', 'standard'] as const)
      test(`snowfall and wheel spray contribute visible pixels across consecutive moving frames (${renderer}, ${length}, ${quality})`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width: 1140, height: 512 });
        await probeScene(page);
        await restore(
          page,
          renderer,
          487,
          824,
          length === 'long'
            ? longestMixedConsist('steam_local').wagons.map(
                (w) => w.definitionId,
              )
            : ['cargo_box'],
          2,
          quality,
          true,
        );
        expect((await snapshot(page)).simulationTick).toBe(0);
        await page.mouse.move(700, 300);
        await page.mouse.down();
        await advanceSeasonalFrames(page, 180);
        expect((await snapshot(page)).speedUPerSec).toBeGreaterThan(
          gameConfig.train.maxSpeedUPerSec * (400 / 480),
        );
        for (let frame = 0; frame < 3; frame++) {
          const regions = await snowRegions(page, false);
          const simulationTick = (await snapshot(page)).simulationTick;
          expect(simulationTick).toBe(360 + frame * 2);
          console.log(
            JSON.stringify({
              project: testInfo.project.name,
              repeat: testInfo.repeatEachIndex,
              renderer,
              length,
              quality,
              frame,
              simulationTick,
              regions,
            }),
          );
          // At least 24 RGB levels: barely altered antialias pixels never count.
          // Independent regions prevent sky flakes from hiding absent wheel spray.
          expect(regions.fall.pixels).toBeGreaterThan(160);
          expect(regions.fall.tiles).toBeGreaterThanOrEqual(10);
          expect(regions.bogies.pixels).toBeGreaterThan(75);
          expect(regions.bogies.tiles).toBeGreaterThanOrEqual(
            length === 'long' ? 6 : 2,
          );
          expect(regions.trail.pixels).toBeGreaterThan(45);
          expect(regions.trail.tiles).toBeGreaterThanOrEqual(2);
          await advanceSeasonalFrames(page, 1);
        }
        await page.mouse.up();
        await page.keyboard.down('ArrowLeft');
        await advanceSeasonalFrames(page, 90);
        expect((await snapshot(page)).speedUPerSec).toBe(0);
        await page.keyboard.up('ArrowLeft');
        await expect
          .poll(async () => framePixels(page, ['fx.snow-kick']))
          .toBe(0);
        expect(await framePixels(page, weatherFrames)).toBeGreaterThan(30);
      });
  for (const side of ['left', 'right'] as const)
    test(`secondary ${side} mouth hides whole weather sprites, outdoors stays visible (${renderer})`, async ({
      page,
    }) => {
      const w = winterSecondary(),
        px = side === 'left' ? w.site.fromX : w.site.toX;
      const k = Math.floor(px / 1024);
      const line = new SecondaryLine(w.seed, w.site, PORTAL_HILL_U),
        rail = line.sample(line.sAtX(px));
      await probeScene(page);
      await restore(page, renderer, k, side === 'left' ? 100 : 0, [], w.seed);
      const point = { x: px + (side === 'left' ? -46 : 46), y: -rail.y - 115 };
      await page.evaluate(
        ({ point }) => {
          const { ride, field } = window.__seasonalProbe;
          ride.step = () => {};
          field.clear();
          field.emit(17, point.x, point.y, 1, { depth: 7.55, sizeScale: 3 });
          const p = field.particles()[0];
          if (p) {
            p.age = 0.4;
            p.vx = 0;
            p.vy = 0;
            p.rotation = 0;
          }
        },
        { point },
      );
      await renderedFrame(page);
      const clip = await worldCrop(page, {
        x: point.x - 8,
        y: point.y - 8,
        width: 16,
        height: 16,
      });
      await page.evaluate(() => {
        window.__seasonalProbe.scene.sys.setActive(false);
      });
      const before = await page.screenshot({ clip });
      await page.evaluate(() => {
        for (const o of window.__seasonalProbe.scene.children.list)
          if (o.type === 'Image' && o.frame?.name === 'fx.snow-near')
            o.setVisible(false);
      });
      await renderedFrame(page);
      expect(
        await pixelChanges(page, before, await page.screenshot({ clip })),
      ).toBe(0);
      // Explicit outdoor control on the same frozen camera and climate.
      await page.evaluate(
        ({ point }) => {
          const { field, scene } = window.__seasonalProbe;
          field.clear();
          // A 3x near flake has a ~60 u radius: put its whole bounds
          // above the mirrored hill, not just its centre outside the edge.
          field.emit(17, point.x + 160, point.y - 180, 1, {
            depth: 7.55,
            sizeScale: 3,
          });
          const p = field.particles()[0];
          if (p) {
            p.age = 0.4;
            p.vx = 0;
            p.vy = 0;
          }
          scene.sys.setActive(true);
        },
        { point },
      );
      await renderedFrame(page);
      expect(await framePixels(page, ['fx.snow-near'])).toBeGreaterThan(5);
    });
  test(`mill wheel visibly moves and pause holds through a controlled clock advance (${renderer})`, async ({
    page,
  }) => {
    await probeScene(page);
    await restore(page, renderer, 287, 857, [], 1, 'low');
    await page.evaluate(() => {
      window.__seasonalProbe.ride.resetMotion();
      window.__seasonalProbe.step = window.__seasonalProbe.ride.step.bind(
        window.__seasonalProbe.ride,
      );
      window.__seasonalProbe.ride.step = () => {};
      window.__seasonalProbe.scene.sys.setActive(false);
    });
    const wheelClip = await imageCrop(page, 'life.watermill-wheel');
    const before = await page.screenshot({ clip: wheelClip });
    await page.evaluate(() => {
      const { ride, scene } = window.__seasonalProbe;
      ride.simulationTick += 30;
      scene.sys.setActive(true);
    });
    await renderedFrame(page);
    await page.evaluate(() => {
      window.__seasonalProbe.scene.sys.setActive(false);
    });
    expect(
      await pixelChanges(
        page,
        before,
        await page.screenshot({ clip: wheelClip }),
      ),
    ).toBeGreaterThan(10);
    await page.evaluate(() => {
      window.__seasonalProbe.scene.sys.setActive(true);
    });
    await tapAction(page, 'pause');
    await page.clock.install();
    const frozen = (await snapshot(page)).simulationTick;
    await page.clock.fastForward(10000);
    expect((await snapshot(page)).simulationTick).toBe(frozen);
    await page.evaluate(() => {
      const { ride } = window.__seasonalProbe;
      const step = window.__seasonalProbe.step;
      if (!step) throw new Error('step missing');
      ride.step = step;
    });
    await tapAction(page, 'resume');
    await page.clock.runFor(500);
    expect((await snapshot(page)).simulationTick - frozen).toBeLessThan(60);
    expect((await snapshot(page)).simulationTick).toBeGreaterThan(frozen);
  });
}

for (const renderer of ['canvas', 'webgl'])
  test(`midpoint solid crowns stay opaque and autumn leaves contribute readable pixels (${renderer})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1140, height: 512 });
    await probeScene(page);
    await restore(page, renderer, 1203, 424, ['cargo_box'], 1);
    const alphas = await page.evaluate(() =>
      window.__seasonalProbe.scene.children.list
        .flatMap((o) => o.list ?? [])
        .filter((o) => String(o.frame?.name).startsWith('tree.'))
        .map((o) => o.alpha),
    );
    expect(alphas.length).toBeGreaterThan(0);
    expect(alphas.every((a) => a === 1)).toBe(true);
    await page.evaluate(() => {
      const { ride } = window.__seasonalProbe;
      ride.track.ensureRange(ride.track.startS, ride.track.endS + 15000);
      ride.headS = ride.track.sFromLocalX(1209, 824);
      ride.resetMotion();
    });
    await renderedFrame(page);
    await expect
      .poll(async () => (await snapshot(page)).effects.kinds['leaf-fall'] ?? 0)
      .toBeGreaterThan(3);
    expect(
      await framePixels(page, [
        'fx.leaf-oak-amber',
        'fx.leaf-birch-gold',
        'fx.leaf-linden-orange',
        'fx.leaf-plum-red',
        'fx.leaf-willow-ochre',
      ]),
    ).toBeGreaterThan(30);
  });

function incomingWinter(progress: number) {
  let best: { seed: number; k: number; offset: number } | undefined;
  for (let seed = 1; seed < 10; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 40; i++) {
      if (r.season !== 'winter' && regionAt(seed, r.toXU).season === 'winter') {
        const target = r.toXU - 8192 + 8192 * progress;
        for (let dx = 0; dx < 600; dx += 20) {
          const x = target + dx,
            k = Math.floor(x / 1024);
          if (
            x - k * 1024 > 320 &&
            x - k * 1024 < 800 &&
            !tunnelSite(seed, k) &&
            !bridgeSite(seed, k)
          ) {
            if (!best || k < best.k) best = { seed, k, offset: x - k * 1024 };
            break;
          }
        }
      }
      r = regionAt(seed, r.toXU);
    }
  }
  if (best) return best;
  throw new Error('incoming winter scenery missing');
}
for (const renderer of ['canvas', 'webgl'])
  for (const progress of [0.1, 0.5, 0.9])
    test(`real scenery draws wheel snow before the incoming winter boundary: ${progress} (${renderer})`, async ({
      page,
    }) => {
      const w = incomingWinter(progress);
      await probeScene(page);
      await restore(page, renderer, w.k, w.offset, [], w.seed);
      await page.evaluate(() => {
        const { ride } = window.__seasonalProbe;
        ride.resetMotion();
        ride.step = () => {
          ride.simulationTick++;
          ride.speedUPerSec = 240;
        };
      });
      await expect
        .poll(async () => framePixels(page, ['fx.snow-kick']), {
          timeout: 8000,
        })
        .toBeGreaterThan(5);
    });
import { tunnelSite, bridgeSite } from '../../src/domain/world/Structures.ts';

for (const renderer of ['canvas', 'webgl'])
  for (const witness of [
    { name: 'town', seed: 4, chunk: 998, offset: 512 },
    { name: 'station', seed: 2, chunk: 489, offset: 700 },
    { name: 'street', seed: 4, chunk: 994, offset: 512 },
  ])
    test(`i3: combined winter ${witness.name} keeps its seasonal art (${renderer})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 1140, height: 512 });
      await probeScene(page);
      await restore(
        page,
        renderer,
        witness.chunk,
        witness.offset,
        [],
        witness.seed,
      );
      expect((await snapshot(page)).artAtlas).toBeDefined();
      await page.evaluate(() =>
        window.__seasonalProbe.scene.sys.setActive(false),
      );
      await renderedFrame(page);
      const frames = await page.evaluate(() => {
        const result: string[] = [];
        const walk = (
          objects: typeof window.__seasonalProbe.scene.children.list,
        ) => {
          for (const object of objects) {
            if (object.visible === false) continue;
            if (object.frame) result.push(String(object.frame.name));
            if (object.list) walk(object.list);
          }
        };
        walk(window.__seasonalProbe.scene.children.list);
        return result;
      });
      if (witness.name === 'town') {
        expect(frames).toContain('backdrop.town-sparse-winter');
        expect(frames).toContain('backdrop.town-dense-winter');
      } else {
        expect(frames).toContain('near.bush-winter');
        expect(frames).not.toContain('near.bush');
      }
      await page.screenshot({
        path: testInfo.outputPath(`i3-winter-${witness.name}-${renderer}.png`),
      });
    });
