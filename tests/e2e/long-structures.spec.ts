import {
  buildArcLengthTable,
  arcAtX,
} from '../../src/domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../../src/domain/world/TrackProfile.ts';
import { expect, test, type Page } from '@playwright/test';
import { snapshot, tapAction, waitForWorldAtlases } from './helpers.ts';
import { longestMixedConsist } from './perfConsist.ts';
import {
  electric2000uWagons,
  probeScene,
  restore,
  renderedFrame,
  worldCrop,
  expectCoveredPixels,
  pixelChanges,
} from './tunnelHelpers.ts';
import { tunnelSite, bridgeSite } from '../../src/domain/world/Structures.ts';
import {
  catenaryPoleXs,
  catenarySupport,
} from '../../src/domain/world/Catenary.ts';
import { railYUpU } from '../../src/domain/world/SceneryGeometry.ts';
import { bankHeightU } from '../../src/domain/world/Terrain.ts';
import { worldParts, TRACK_BED_DEPTH_U } from '../../src/content/worldArt.ts';
import { regionAt } from '../../src/domain/world/Regions.ts';

async function restoreLocatedLongTunnel(page: Page, renderer: string) {
  await probeScene(page);
  const consist = longestMixedConsist('steam_local');
  await restore(
    page,
    renderer,
    0,
    200,
    consist.wagons.map((w) => w.definitionId),
    1,
  );
  // Exercise the real temporary diagnostic journey, not a second scene fixture.
  await page.clock.install();
  await tapAction(page, 'pause');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  for (let i = 0; i < 5; i++) await tapAction(page, 'dev-build');
  await page.getByText('Testovací scény', { exact: true }).click();
  await tapAction(page, 'dev-world-scene:tunnel');
  await page.clock.resume();
  await expect
    .poll(async () => (await snapshot(page)).worldDebug.location?.kind)
    .toBe('tunnel');
  const location = (await snapshot(page)).worldDebug.location;
  if (!location) throw new Error('locator missing');
  await page.waitForFunction((x) => {
    const ride = window.__tunnelProbe.ride;
    return Math.abs(ride.sample(ride.headS).x - (x - 640)) < 2;
  }, location.worldXU);
  const k = Math.floor(location.worldXU / 1024),
    site = tunnelSite(1, k);
  if (!site) throw new Error('long tunnel missing');
  expect(site.toX - site.fromX).toBeGreaterThanOrEqual(3072);
  expect((await snapshot(page)).consistLengthU).toBe(2000);
  const from = k * 1024 + site.fromX,
    to = k * 1024 + site.toX;
  return { from, to };
}

for (const renderer of ['canvas', 'webgl'])
  test(`SCN-TB04 D-030 ${renderer}: art-enabled long tunnel publishes immutable rock`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await probeScene(page);
    try {
      await restore(page, renderer, 213, 208, ['passenger_open'], 7);
      await waitForWorldAtlases(page);
      await renderedFrame(page);
    } finally {
      expect(
        errors,
        'long tunnel must compose before immutable upload',
      ).toEqual([]);
    }
    const state = await snapshot(page);
    expect(state.worldAtlases.missingFrames).toEqual([]);
    expect(state.worldAtlases.pending).toBe(false);
    expect(
      await page.evaluate(() =>
        window.__tunnelProbe.scene.children.list
          .flatMap((root) => root.list ?? [])
          .some((image) => image.frame?.name === 'tunnel.rock-portal-mouth'),
      ),
    ).toBe(true);
  });

for (const renderer of ['canvas', 'webgl'])
  test(`SCN-TB04 ${renderer}: dune mound flank differs from adjacent sand`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1140, height: 512 });
    await probeScene(page);
    const k = 382;
    const site = tunnelSite(0, k);
    if (!site || site.rock) throw new Error('short dunes tunnel missing');
    await restore(
      page,
      renderer,
      k,
      site.fromX + 40,
      ['passenger_open', 'passenger_open'],
      0,
    );
    await page.evaluate(
      ({ k, x }) => {
        const { ride } = window.__tunnelProbe;
        ride.step = () => {};
        ride.headS = ride.track.sFromLocalX(k, x);
        ride.resetMotion();
      },
      { k, x: site.fromX + 40 },
    );
    await renderedFrame(page);
    const shot = await page.screenshot();
    const colours = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no pixel context');
      context.drawImage(image, 0, 0);
      // Review witness: filled right flank and open ground, away from art/strokes.
      return [750, 780].map((x) => {
        const pixels = context.getImageData(x - 2, 228, 5, 5).data;
        return [0, 1, 2].map((channel) => {
          const values: number[] = [];
          for (let i = channel; i < pixels.length; i += 4)
            values.push(pixels[i] ?? 0);
          // Median excludes the edge of a nearby pine from the ground sample.
          return values.sort((a, b) => a - b)[12] ?? 0;
        });
      });
    }, shot.toString('base64'));
    const [flank, ground] = colours;
    if (!flank || !ground) throw new Error('pixel samples missing');
    expect(ground).toEqual([240, 220, 170]);
    const contrast = Math.hypot(
      ...flank.map((value, i) => value - (ground[i] ?? 0)),
    );
    expect(contrast, JSON.stringify({ flank, ground })).toBeGreaterThan(18);
  });

for (const renderer of ['canvas', 'webgl'])
  for (const mouth of ['entry', 'exit'])
    test(`SCN-TB04–09 ${renderer}: locator, 2000u train through half cover, both mouths and chunk seams (${mouth})`, async ({
      page,
    }) => {
      const { from, to } = await restoreLocatedLongTunnel(page, renderer);
      const positions =
        mouth === 'entry' ? [from + 80, from + 2500] : [to + 80, to + 2100];
      for (const headX of positions) {
        await page.evaluate((x) => {
          const { ride } = window.__tunnelProbe;
          ride.step = () => {};
          while (ride.track.lastChunkIndex < Math.floor(x / 1024) + 3)
            ride.track.ensureRange(ride.track.startS, ride.track.endS + 1);
          ride.headS = ride.track.sFromLocalX(
            Math.floor(x / 1024),
            x - Math.floor(x / 1024) * 1024,
          );
          ride.resetMotion();
          ride.simulationTick += 120; // Explicit simulation ticks, not a wall-time wait.
        }, headX);
        await renderedFrame(page);
        await waitForWorldAtlases(page);
        const state = await snapshot(page);
        const expectedCover = await page.evaluate(
          ({ from, to }) => {
            const { ride } = window.__tunnelProbe,
              front = ride.sample(ride.frontS).x,
              tail = ride.sample(ride.tailS).x;
            return (
              Math.max(0, Math.min(front, to) - Math.max(tail, from)) /
              (front - tail)
            );
          },
          { from, to },
        );
        expect(state.audioDetails.covered).toBeCloseTo(expectedCover, 5);
        const tunnels = state.tunnels;
        if (headX === from + 2500) {
          expect(
            tunnels.some(
              (t) =>
                t.train === 'inside' && t.vehicles.every((v) => v === 'inside'),
            ),
          ).toBe(true);
          // Old smoke/spark particles straddle a technical seam in the half-transparent core.
          await page.evaluate(
            (x) => {
              const { ride, field } = window.__tunnelProbe;
              const s = ride.track.sFromLocalX(Math.floor(x / 1024), x % 1024);
              field.emit(0, x, -ride.sample(s).y - 80, 1, { depth: 7.55 });
            },
            Math.ceil((from + 700) / 1024) * 1024,
          );
          const box = state.trainBox;
          if (!box) throw new Error('whole train bounds missing');
          await expectCoveredPixels(
            page,
            {
              x: Math.floor(box.left),
              y: Math.floor(box.top),
              width: Math.ceil(box.right - box.left),
              height: Math.ceil(box.bottom - box.top),
            },
            7,
            false,
          );
        } else if (headX === from + 80 || headX === to + 80) {
          expect(tunnels.some((t) => t.train === 'partly')).toBe(true);
          const portal = headX === from + 80 ? from : to;
          const box = await page.evaluate((x) => {
            const { ride } = window.__tunnelProbe;
            const rail = ride.sample(
              ride.track.sFromLocalX(Math.floor(x / 1024), x % 1024),
            );
            return { x: x - 12, y: -rail.y - 70, width: 24, height: 30 };
          }, portal);
          await expectCoveredPixels(page, await worldCrop(page, box), 7, false);
        } else expect(tunnels.every((t) => t.train === 'outside')).toBe(true);
      }
    });

for (const renderer of ['canvas', 'webgl'])
  test(`SCN-TB01/03/09 ${renderer}: real viaduct and truss drawings with supports`, async ({
    page,
  }) => {
    await probeScene(page);
    let viaduct: ReturnType<typeof bridgeSite>,
      steel: ReturnType<typeof bridgeSite>;
    for (let k = 4; k < 480; k += 8) {
      const b = bridgeSite(1, k);
      if (b?.variant === 'viaduct') viaduct ??= b;
      if (b?.variant === 'steel') steel ??= b;
    }
    if (!viaduct || !steel) throw new Error('bridge witnesses missing');
    await restore(
      page,
      renderer,
      viaduct.chunkIndex,
      900,
      longestMixedConsist('steam_local').wagons.map((w) => w.definitionId),
      1,
    );
    for (const bridge of [viaduct, steel]) {
      await page.evaluate((k) => {
        const { ride } = window.__tunnelProbe;
        ride.step = () => {};
        while (ride.track.lastChunkIndex < k + 3)
          ride.track.ensureRange(ride.track.startS, ride.track.endS + 1);
        ride.headS = ride.track.sFromLocalX(k, 900);
        ride.resetMotion();
      }, bridge.chunkIndex);
      await renderedFrame(page);
      await waitForWorldAtlases(page);
      const fieldKey =
        bridge.variant === 'steel'
          ? 'bridge.steel-span'
          : 'bridge.viaduct-arch';
      expect(
        await page.evaluate(
          (key) =>
            window.__tunnelProbe.scene.children.list
              .flatMap((root) => root.list ?? [])
              .filter((o) => o.frame?.name === key).length,
          fieldKey,
        ),
      ).toBe(bridge.variant === 'steel' ? 2 : 4);
      const key =
        bridge.variant === 'steel' ? 'bridge.abutment' : 'bridge.viaduct-pier';
      const part = worldParts[key];
      const supports = await page.evaluate(
        ({ key, widthU, bottomU }) => {
          const { ride, scene } = window.__tunnelProbe;
          const player = scene.children.list.find(
            (o) => o.depth === 7 && typeof o.x === 'number',
          );
          if (player?.x === undefined) throw new Error('player origin missing');
          const origin = ride.vehiclePose(0).centerX - player.x;
          return scene.children.list
            .flatMap((root) => root.list ?? [])
            .filter((o) => o.frame?.name === key)
            .map((o) => {
              const matrix = o.getWorldTransformMatrix(),
                pxPerU = ((o.frame?.width ?? 2) - 2) / widthU;
              const left = matrix.transformPoint(
                1 - o.displayOriginX,
                1 + bottomU * pxPerU - o.displayOriginY,
              );
              const right = matrix.transformPoint(
                1 + widthU * pxPerU - o.displayOriginX,
                1 + bottomU * pxPerU - o.displayOriginY,
              );
              return {
                x: (left.x + right.x) / 2 + origin,
                y: (left.y + right.y) / 2,
                left: left.x + origin,
                right: right.x + origin,
              };
            });
        },
        {
          key,
          widthU: part.widthU,
          bottomU: bridge.variant === 'steel' ? 99 : 160,
        },
      );
      expect(supports).toHaveLength(bridge.variant === 'steel' ? 2 : 5);
      const x0 = bridge.chunkIndex * 1024;
      if (bridge.fromX === undefined || bridge.toX === undefined)
        throw new Error('deck range missing');
      const expectedXs =
        bridge.variant === 'steel'
          ? [bridge.fromX, bridge.toX]
          : Array.from({ length: 5 }, (_, i) => (bridge.fromX ?? 0) + i * 160);
      expect(
        supports.map((p) => Math.round(p.x)).sort((a, b) => a - b),
      ).toEqual(expectedXs.map((x) => x0 + x));
      for (const support of supports) {
        const terrain =
          -railYUpU(1, support.x) +
          TRACK_BED_DEPTH_U +
          bankHeightU(1, support.x);
        expect(
          Math.abs(support.y - terrain),
          `${key} foot at ${support.x}`,
        ).toBeLessThan(3);
        const river = x0 + bridge.localXU;
        // Both the 80u water corridor and a 32u road/vehicle envelope fit the opening.
        for (const halfWidth of [45, 16])
          expect(
            support.right < river - halfWidth ||
              support.left > river + halfWidth,
            `support blocks ${halfWidth * 2}u corridor`,
          ).toBe(true);
      }
      const river = x0 + bridge.localXU;
      const floor =
        -railYUpU(1, river) + TRACK_BED_DEPTH_U + bankHeightU(1, river);
      const clearance = worldParts['back.car'].heightU + 4;
      const clip = await worldCrop(page, {
        x: river - 45,
        y: floor - clearance,
        width: 90,
        height: clearance - 4,
      });
      await page.evaluate(() => {
        // setActive returns Phaser's entire Systems graph; keep it in the page.
        window.__tunnelProbe.scene.sys.setActive(false);
      });
      const before = await page.screenshot({ clip });
      const fields = [
        'bridge.viaduct-arch',
        'bridge.viaduct-pier',
        'bridge.steel-span',
        'bridge.abutment',
      ];
      await page.evaluate((keys) => {
        for (const root of window.__tunnelProbe.scene.children.list)
          for (const o of root.list ?? [])
            if (
              typeof o.frame?.name === 'string' &&
              keys.includes(o.frame.name)
            )
              o.setVisible(false);
      }, fields);
      await renderedFrame(page);
      const without = await page.screenshot({ clip });
      await page.evaluate((keys) => {
        for (const root of window.__tunnelProbe.scene.children.list)
          for (const o of root.list ?? [])
            if (
              typeof o.frame?.name === 'string' &&
              keys.includes(o.frame.name)
            )
              o.setVisible(true);
        window.__tunnelProbe.scene.sys.setActive(true);
      }, fields);
      expect(
        await pixelChanges(page, before, without),
        'rendered water opening includes a clear road/vehicle envelope',
      ).toBe(0);
    }
    expect(regionAt(1, viaduct.chunkIndex * 1024).landscape).toMatch(
      /mountains|foothills/,
    );
  });

for (const renderer of ['canvas', 'webgl'])
  for (const winter of [false, true])
    test(`SCN-TB09 ${renderer} ${winter ? 'winter' : 'summer'} portal uses its seasonal art`, async ({
      page,
    }) => {
      await probeScene(page);
      let witness: { seed: number; k: number } | undefined;
      for (let seed = 0; seed < 4 && !witness; seed++)
        for (let k = 6; k < 480; k += 8) {
          const t = tunnelSite(seed, k);
          if (
            t?.rock &&
            (regionAt(seed, k * 1024 + t.fromX).season === 'winter') === winter
          ) {
            witness = { seed, k };
            break;
          }
        }
      if (!witness) throw new Error('season witness missing');
      await restore(page, renderer, witness.k, 128, [], witness.seed);
      const key = winter
        ? 'tunnel.rock-portal-mouth-snow'
        : 'tunnel.rock-portal-mouth';
      expect(
        await page.evaluate(
          (key) =>
            window.__tunnelProbe.scene.children.list.some((o) =>
              o.list?.some((c) => c.frame?.name === key),
            ),
          key,
        ),
      ).toBe(true);
    });

for (const renderer of ['canvas', 'webgl'])
  test(`SCN-TB05 ${renderer}: a fully covered 2000u train keeps moving with camera and muffled audio`, async ({
    page,
  }) => {
    await probeScene(page);
    let entrance: number | undefined;
    for (let k = 6; k < 480; k += 8) {
      const t = tunnelSite(1, k);
      if (t?.rock) {
        entrance = k * 1024 + t.fromX;
        break;
      }
    }
    if (entrance === undefined) throw new Error('long tunnel witness missing');
    const x = entrance + 2300,
      k = Math.floor(x / 1024);
    const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
    await restore(
      page,
      renderer,
      k,
      arcAtX(table, x),
      electric2000uWagons(),
      1,
      'electric_retro',
    );
    await page.clock.install();
    // Pause at a future virtual instant; a 1ms target races the protocol round trip.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
    const before = await snapshot(page);
    expect(before.consistLengthU).toBe(2000);
    expect(before.catenary.electrified).toBe(true);
    expect(before.tunnels.some((t) => t.train === 'inside')).toBe(true);
    await page.keyboard.down('ArrowRight');
    for (let frame = 0; frame < 20; frame++) await page.clock.fastForward(80);
    await page.keyboard.up('ArrowRight');
    const after = await snapshot(page);
    expect(after.headS).toBeGreaterThan(before.headS + 100);
    expect(after.audioDetails.covered).toBe(1);
    expect(after.catenary.pantographGapU ?? Infinity).toBeLessThan(0.5);
    expect(after.catenary.outOfRange).toBe(0);
    expect(
      after.tunnels.some(
        (t) => t.train === 'inside' && t.vehicles.every((v) => v === 'inside'),
      ),
    ).toBe(true);
    expect(after.backdropMidOffsetU).not.toBe(before.backdropMidOffsetU);
  });

for (const renderer of ['canvas', 'webgl'])
  for (const section of ['tunnel hangers', 'bridge consoles'])
    test(`SCN-TB09 ${renderer}: electric long train under bridge consoles and through rock-tunnel hangers (${section})`, async ({
      page,
    }) => {
      await probeScene(page);
      let bridge: ReturnType<typeof bridgeSite>,
        tunnel: ReturnType<typeof tunnelSite>;
      for (let k = 4; k < 480; k++) {
        const b = bridgeSite(1, k),
          t = tunnelSite(1, k);
        if (b?.variant === 'steel') bridge ??= b;
        if (t?.rock) tunnel ??= t;
      }
      if (
        !bridge ||
        !tunnel ||
        bridge.fromX === undefined ||
        bridge.toX === undefined
      )
        throw new Error('electric witnesses missing');
      const wagons = electric2000uWagons();
      await restore(
        page,
        renderer,
        section === 'tunnel hangers' ? tunnel.chunkIndex : bridge.chunkIndex,
        128,
        wagons,
        1,
        'electric_retro',
      );
      const move = async (x: number) => {
        await page.evaluate((x) => {
          const { ride } = window.__tunnelProbe;
          ride.step = () => {};
          while (ride.track.lastChunkIndex < Math.floor(x / 1024) + 3)
            ride.track.ensureRange(ride.track.startS, ride.track.endS + 1);
          ride.headS = ride.track.sFromLocalX(Math.floor(x / 1024), x % 1024);
          ride.resetMotion();
        }, x);
        await renderedFrame(page);
        await waitForWorldAtlases(page);
        const state = await snapshot(page);
        expect(state.catenary.electrified).toBe(true);
        expect(state.consistLengthU).toBe(2000);
        expect(state.catenary.pantographGapU ?? Infinity).toBeLessThan(0.5);
        expect(state.catenary.outOfRange).toBe(0);
      };
      if (section === 'tunnel hangers') {
        const from = tunnel.chunkIndex * 1024 + tunnel.fromX,
          to = tunnel.chunkIndex * 1024 + tunnel.toX;
        for (const x of [from + 80, from + 2400, to + 80]) {
          await move(x);
          const contacts = await page.evaluate(() => {
            const { ride, scene } = window.__tunnelProbe;
            const player = scene.children.list.find(
              (o) => o.depth === 7 && typeof o.x === 'number',
            );
            if (player?.x === undefined) throw new Error('player missing');
            const origin = ride.vehiclePose(0).centerX - player.x;
            return scene.children.list
              .flatMap((o) => o.list ?? [])
              .filter((o) => o.frame?.name === 'tunnel.contact')
              .map((o) => {
                const px = ((o.frame?.width ?? 2) - 2) / 128;
                const p = o
                  .getWorldTransformMatrix()
                  .transformPoint(
                    1 + 64 * px - o.displayOriginX,
                    1 + 11 * px - o.displayOriginY,
                  );
                return { x: p.x + origin, y: p.y };
              });
          });
          const near = contacts.filter(
            (p) => p.x >= x - 240 && p.x <= x + 240 && p.x >= from && p.x <= to,
          );
          const expectedHangers = catenaryPoleXs(
            1,
            Math.max(from, x - 240),
            Math.min(to, x + 240),
          ).filter((at) => catenarySupport(1, at) === 'hanger');
          expect(expectedHangers.length).toBeGreaterThan(0);
          expect(
            near.map((p) => Math.round(p.x)).sort((a, b) => a - b),
          ).toEqual(expectedHangers);
          for (const p of near) {
            expect(catenarySupport(1, Math.round(p.x))).toBe('hanger');
            expect(Math.abs(p.y + railYUpU(1, p.x) + 128)).toBeLessThan(0.01);
          }
          if (x === from + 2400)
            expect(
              (await snapshot(page)).tunnels.some((t) => t.train === 'inside'),
            ).toBe(true);
        }
      } else {
        const consoleX = catenaryPoleXs(
          1,
          bridge.chunkIndex * 1024 + bridge.fromX,
          bridge.chunkIndex * 1024 + bridge.toX,
        )[0];
        if (consoleX === undefined)
          throw new Error('bridge console witness missing');
        await move(consoleX + 100);
        const clamps = await page.evaluate(() => {
          const { ride, scene } = window.__tunnelProbe;
          const player = scene.children.list.find(
            (o) => o.depth === 7 && typeof o.x === 'number',
          );
          if (player?.x === undefined) throw new Error('player missing');
          const origin = ride.vehiclePose(0).centerX - player.x;
          return scene.children.list
            .flatMap((o) => o.list ?? [])
            .filter((o) => o.frame?.name === 'bridge.catenary-console')
            .map((o) => {
              const px = ((o.frame?.width ?? 2) - 2) / 36;
              const p = o
                .getWorldTransformMatrix()
                .transformPoint(
                  1 + 27 * px - o.displayOriginX,
                  1 + 42 * px - o.displayOriginY,
                );
              return { x: p.x + origin, y: p.y };
            });
        });
        expect(clamps.length).toBeGreaterThan(0);
        for (const p of clamps)
          expect(Math.abs(p.y + railYUpU(1, p.x) + 128)).toBeLessThan(0.5);
      }
    });
