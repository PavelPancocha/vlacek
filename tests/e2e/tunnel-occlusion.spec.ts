import { expect, test, type Page } from '@playwright/test';
import { snapshot } from './helpers.ts';
import { kindIndex } from '../../src/render/particles/particleKinds.ts';
import {
  probeScene,
  restore,
  expectCoveredPixels,
  pixelChanges,
  renderedFrame,
  worldCrop,
  sceneryPixels,
} from './tunnelHelpers.ts';
import { vehicleArt } from '../../src/content/artManifest.ts';

for (const renderer of ['canvas', 'webgl']) {
  test(`tunnel-1 ${renderer}: fully covered player, old smoke and brake sparks cannot shine through`, async ({
    page,
  }) => {
    await probeScene(page);
    await restore(page, renderer, 6, 20);
    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => (await snapshot(page)).effects.kinds['smoke'] ?? 0)
      .toBeGreaterThan(0);
    // Move the same living smoke behind the core, preserving its age and source.
    await page.evaluate(() => {
      const { ride, field } = window.__tunnelProbe;
      ride.headS = ride.track.sFromLocalX(6, 370);
      ride.previousHeadS = ride.headS;
      ride.speedUPerSec = 480;
      for (const particle of field.particles()) {
        particle.x = 6500;
        particle.y = -ride.vehiclePose(0).centerY - 70;
      }
    });
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await snapshot(page)).intent).toBe('BRAKE');
    const brakingTick = await page.evaluate(() => {
      const { ride } = window.__tunnelProbe;
      const head = ride.track.sFromLocalX(6, 370);
      const step = ride.step.bind(ride);
      window.__tunnelProbe.step = step;
      ride.headS = head;
      ride.previousHeadS = head;
      ride.step = (intent) => {
        ride.speedUPerSec = 480;
        step(intent);
        ride.headS = head;
        ride.previousHeadS = head;
      };
      return ride.simulationTick;
    });
    // Advance across actual effect frames; one 0.5 s jump would expire sparks.
    await expect
      .poll(async () => (await snapshot(page)).simulationTick)
      .toBeGreaterThanOrEqual(brakingTick + 30);
    expect((await snapshot(page)).effects.kinds['spark'] ?? 0).toBe(0);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowRight');
    await page.evaluate(() => {
      const { ride } = window.__tunnelProbe;
      ride.resetMotion();
      ride.step = () => {};
    });
    const state = await snapshot(page);
    expect(state.effects.kinds['smoke'] ?? 0).toBeGreaterThan(0);
    expect(state.tunnels.find((t) => t.train === 'inside')?.alpha).toBe(1);
    expect(state.tunnels.find((t) => t.train === 'inside')?.vehicles).toEqual([
      'inside',
    ]);
    const clip = await page.evaluate(() => {
      const { ride, scene } = window.__tunnelProbe;
      const camera = scene.cameras.main,
        point = camera.getWorldPoint(0, 0);
      const vehicle = scene.children.list.find(
        (o) => 'depth' in o && o.depth === 7,
      );
      if (!vehicle || !('x' in vehicle) || typeof vehicle.x !== 'number')
        throw new Error('player slot missing');
      const x = (vehicle.x - point.x) * camera.zoom;
      const y = (-ride.vehiclePose(0).centerY - point.y) * camera.zoom;
      return {
        x: Math.round(x - 35),
        y: Math.round(y - 70),
        width: 70,
        height: 60,
      };
    });
    await expectCoveredPixels(page, clip, 7);
  });

  for (const fallback of [false, true]) {
    test(`tunnel-1 ${renderer} ${fallback ? 'fallback' : 'art'}: sloped NPC rock hides wheels and roofs at both stopped portals`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await probeScene(page);
      if (fallback)
        await page.route(/track\.tile-a-[^/]*\.svg$/, (route) => route.abort());
      // V2 chooses a steam NPC in world 123; world 8 keeps a diesel and both sloped portals.
      await restore(page, renderer, 11, 340, [], 8, 'steam_local', fallback);
      expect((await snapshot(page)).artAtlas === undefined).toBe(fallback);
      await page.keyboard.down('ArrowRight');
      await expect
        .poll(async () => (await snapshot(page)).oncoming.trains.length, {
          timeout: 15_000,
          intervals: [50],
        })
        .toBe(1);
      await expect
        .poll(async () => (await snapshot(page)).effects.kinds['diesel'] ?? 0)
        .toBeGreaterThan(0);
      await page.keyboard.up('ArrowRight');
      await page.evaluate(() => {
        const { ride, field } = window.__tunnelProbe;
        ride.resetMotion();
        window.__tunnelProbe.step = ride.step.bind(ride);
        ride.step = () => {};
        ride.track.ensureRange(ride.track.startS, ride.track.endS + 6000);
        const train = ride.oncomingTrains[0];
        if (!train) throw new Error('NPC missing');
        for (const particle of field.particles())
          if (particle.depth === 4.32) {
            particle.x = train.site.toX + 100;
            particle.y = -train.line.sample(train.line.sAtX(particle.x)).y - 40;
          }
      });
      for (const side of ['left', 'right']) {
        for (const delta of [100, 35, 0, -35, -100]) {
          await page.evaluate(
            ({ side, delta }) => {
              const { ride } = window.__tunnelProbe,
                train = ride.oncomingTrains[0];
              if (!train) throw new Error('seeded NPC missing');
              const portal =
                side === 'right' ? train.site.toX : train.site.fromX;
              train.headS = train.line.sAtX(portal + delta);
              const player = portal - 620;
              ride.headS = ride.track.sFromLocalX(
                Math.floor(player / 1024),
                player % 1024,
              );
              ride.resetMotion();
            },
            { side, delta },
          );
          // A render-frame boundary, not a timer: update the deterministic fixture.
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
          const clip = await page.evaluate((side) => {
            const { ride, scene } = window.__tunnelProbe,
              train = ride.oncomingTrains[0];
            if (!train) throw new Error('NPC missing');
            const portal = side === 'right' ? train.site.toX : train.site.fromX;
            const rail = train.line.sample(train.line.sAtX(portal));
            const camera = scene.cameras.main,
              point = camera.getWorldPoint(0, 0);
            // Derive the render origin from the main vehicle's world/render positions.
            const vehicle = scene.children.list.find(
              (o) => 'depth' in o && o.depth === 7,
            );
            if (!vehicle || !('x' in vehicle) || typeof vehicle.x !== 'number')
              throw new Error('player missing');
            const origin = ride.vehiclePose(0).centerX - vehicle.x;
            const left = portal + (side === 'right' ? 60 : -170);
            return {
              x: Math.round((left - origin - point.x) * camera.zoom),
              y: Math.round((-rail.y - 115 - point.y) * camera.zoom),
              width: Math.floor(110 * camera.zoom),
              height: Math.floor(145 * camera.zoom),
            };
          }, side);
          await expectCoveredPixels(page, clip, 4.3);
          const zoom = await page.evaluate(
            () => window.__tunnelProbe.scene.cameras.main.zoom,
          );
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
          await expectCoveredPixels(
            page,
            {
              ...clip,
              x: clip.x + Math.round((side === 'left' ? 145 : -45) * zoom),
              y: clip.y + Math.round(40 * zoom),
              width: Math.max(1, Math.floor(10 * zoom)),
              height: Math.floor(50 * zoom),
            },
            4.3,
          );
          if (side === 'right' && delta === -35) {
            const open = await page.evaluate(() => {
              const train = window.__tunnelProbe.ride.oncomingTrains[0];
              if (!train) throw new Error('NPC missing');
              const rail = train.line.sample(train.line.sAtX(train.site.toX));
              // Inside the open front half of the sloped mouth, on the partial locomotive.
              return {
                x: train.site.toX - 25,
                y: -rail.y - 60,
                width: 10,
                height: 20,
              };
            });
            await renderedFrame(page);
            await expectCoveredPixels(
              page,
              await worldCrop(page, open),
              4.3,
              false,
            );
          }
          if (
            (side === 'left' && delta === 100) ||
            (side === 'right' && delta === -100)
          ) {
            const zoom = await page.evaluate(
              () => window.__tunnelProbe.scene.cameras.main.zoom,
            );
            const open = {
              ...clip,
              x: clip.x + Math.round((side === 'left' ? 260 : -170) * zoom),
              y: clip.y + Math.round(65 * zoom),
              width: 20,
              height: 30,
            };
            await page.evaluate(
              () =>
                new Promise<void>((resolve) =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  ),
                ),
            );
            await expectCoveredPixels(page, open, 4.3, false);
          }
        }
      }
      await page.evaluate(() => {
        const { ride, step } = window.__tunnelProbe,
          train = ride.oncomingTrains[0];
        if (!train || !step) throw new Error('NPC cleanup fixture missing');
        train.headS =
          train.line.sAtX(train.site.fromX) - train.layout.tailOffsetU - 100;
        step('COAST');
      });
      await expect
        .poll(async () => (await snapshot(page)).oncoming.trains.length)
        .toBe(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.__tunnelProbe.scene.children.list.filter(
                (o) =>
                  o.type === 'Graphics' && Math.abs(o.depth - 4.345) < 0.0001,
              ).length,
          ),
        )
        .toBeGreaterThan(0);
      await page.evaluate(() => {
        const { ride, scene } = window.__tunnelProbe;
        window.__tunnelProbe.portalFeet = scene.children.list.filter(
          (o) => o.type === 'Graphics' && Math.abs(o.depth - 4.345) < 0.0001,
        );
        ride.headS = ride.track.sFromLocalX(17, 700);
        ride.resetMotion();
      });
      await renderedFrame(page);
      expect(
        await page.evaluate(() => {
          const { scene, portalFeet } = window.__tunnelProbe;
          if (!portalFeet?.length)
            throw new Error('portal cleanup fixture missing');
          return portalFeet.some((foot) => scene.children.list.includes(foot));
        }),
      ).toBe(false);
    });
  }
}

for (const renderer of ['canvas', 'webgl']) {
  test(`tunnel-3 ${renderer}: covered bubbles have no hit or pop, exposed touch still drives`, async ({
    page,
  }, testInfo) => {
    const pointerType = testInfo.project.use.hasTouch ? 'touch' : 'mouse';
    await probeScene(page);
    await restore(page, renderer, 6, 370);
    const hidden = await page.evaluate((kind) => {
      const { ride, field } = window.__tunnelProbe;
      window.__tunnelProbe.step = ride.step.bind(ride);
      ride.step = () => {};
      field.emit(kind, 6150, -ride.vehiclePose(0).centerY - 55, 1, {
        depth: 7.55,
      });
      field.step(0.5);
      const bubble = field.particles().find((p) => p.kind === kind);
      if (!bubble) throw new Error('emitted bubble missing');
      bubble.x = 6500;
      bubble.y = -ride.vehiclePose(0).centerY - 55;
      return { id: bubble.id, x: bubble.x, y: bubble.y, width: 1, height: 1 };
    }, kindIndex('bubble'));
    await renderedFrame(page);
    const before = await snapshot(page);
    expect(before.bubbles.some((b) => b.id === hidden.id)).toBe(false);
    const hiddenPoint = await worldCrop(page, hidden);
    const hit = await page.evaluate((point) => {
      const { scene } = window.__tunnelProbe;
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      if (!rect) throw new Error('canvas missing');
      return scene.hitObject(point.x, point.y, rect);
    }, hiddenPoint);
    expect(hit).toBeUndefined();
    expect(
      await page.evaluate(
        (id) => window.__tunnelProbe.scene.popBubble(id),
        hidden.id,
      ),
    ).toBe(false);
    expect((await snapshot(page)).effects.bubblePops).toBe(
      before.effects.bubblePops,
    );
    await page.evaluate(
      ({ point, pointerType }) => {
        const target = document.elementFromPoint(point.x, point.y);
        if (!target) throw new Error('touch target missing');
        for (const type of ['pointerdown', 'pointerup'])
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: 107,
              pointerType,
              isPrimary: true,
              button: 0,
              buttons: type === 'pointerdown' ? 1 : 0,
              clientX: point.x,
              clientY: point.y,
            }),
          );
      },
      { point: hiddenPoint, pointerType },
    );
    expect((await snapshot(page)).effects.bubblePops).toBe(
      before.effects.bubblePops,
    );
    const exposed = await page.evaluate((id) => {
      const { field } = window.__tunnelProbe;
      const bubble = field.particles().find((p) => p.id === id);
      if (!bubble) throw new Error('hidden bubble was removed');
      bubble.x = 6150;
      return { x: bubble.x, y: bubble.y, width: 1, height: 1 };
    }, hidden.id);
    await renderedFrame(page);
    expect((await snapshot(page)).bubbles.some((b) => b.id === hidden.id)).toBe(
      true,
    );
    const exposedPoint = await worldCrop(page, exposed);
    await page.evaluate(
      ({ point, pointerType }) => {
        const { ride, step } = window.__tunnelProbe;
        if (!step) throw new Error('simulation step missing');
        ride.step = step;
        const target = document.elementFromPoint(point.x, point.y);
        if (!target) throw new Error('touch target missing');
        target.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            pointerId: 108,
            pointerType,
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: point.x,
            clientY: point.y,
          }),
        );
      },
      { point: exposedPoint, pointerType },
    );
    expect((await snapshot(page)).effects.bubblePops).toBe(
      before.effects.bubblePops + 1,
    );
    expect((await snapshot(page)).intent).toBe('THROTTLE');
    await expect
      .poll(async () => (await snapshot(page)).headS)
      .toBeGreaterThan(before.headS);
    await page.evaluate(
      ({ point, pointerType }) => {
        document.elementFromPoint(point.x, point.y)?.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            pointerId: 108,
            pointerType,
            button: 0,
            buttons: 0,
            clientX: point.x,
            clientY: point.y,
          }),
        );
      },
      { point: exposedPoint, pointerType },
    );
  });

  test(`tunnel-3 ${renderer}: portal scenery survives NPC creation and removal, then releases with the chunk`, async ({
    page,
  }) => {
    await probeScene(page);
    await restore(page, renderer, 11, 340);
    await page.evaluate(() => {
      const { ride } = window.__tunnelProbe;
      ride.resetMotion();
      window.__tunnelProbe.step = ride.step.bind(ride);
      ride.step = () => {};
    });
    const feet = () =>
      page.evaluate(
        () =>
          window.__tunnelProbe.scene.children.list.filter(
            (o) => o.type === 'Graphics' && Math.abs(o.depth - 4.345) < 0.0001,
          ).length,
      );
    const owners = (await snapshot(page)).scenery.secondaryPortalViews;
    expect(owners).toBeGreaterThan(0);
    expect(await feet()).toBe(owners);
    await page.evaluate(() => {
      const { scene } = window.__tunnelProbe;
      window.__tunnelProbe.portalFeet = scene.children.list.filter(
        (o) => o.type === 'Graphics' && Math.abs(o.depth - 4.345) < 0.0001,
      );
    });
    const box = await page.evaluate(() => {
      const { ride } = window.__tunnelProbe;
      const x = 12288;
      const y = -ride.sample(ride.track.sFromLocalX(12, 0)).y - 64;
      return { x: x - 170, y: y - 110, width: 210, height: 145 };
    });
    const clip = await worldCrop(page, box);
    const before = await sceneryPixels(page, clip);
    const camera = () =>
      page.evaluate(() => {
        const c = window.__tunnelProbe.scene.cameras.main;
        const { x, y } = c.getWorldPoint(0, 0);
        return { x, y, zoom: c.zoom };
      });
    const frozenCamera = await camera();
    await page.evaluate(() => {
      const { ride, step } = window.__tunnelProbe;
      if (!step) throw new Error('step missing');
      const head = ride.headS;
      const tick = ride.simulationTick;
      for (
        let tick = 0;
        tick < 30 && ride.oncomingTrains.length === 0;
        tick++
      ) {
        ride.speedUPerSec = 480;
        step('THROTTLE');
      }
      if (ride.oncomingTrains.length !== 1)
        throw new Error('NPC trigger missing');
      ride.headS = head;
      // Hold world render time too: camera easing and ambient motion are not under test.
      ride.simulationTick = tick;
      ride.resetMotion();
    });
    await renderedFrame(page);
    expect(await feet()).toBe(owners);
    expect(await camera()).toEqual(frozenCamera);
    const created = await sceneryPixels(page, clip);
    expect(
      await pixelChanges(page, before, created),
      'portal pixels at NPC creation',
    ).toBe(0);
    await page.evaluate(() => {
      const { ride, step } = window.__tunnelProbe;
      const train = ride.oncomingTrains[0];
      if (!step || !train) throw new Error('NPC missing');
      const head = ride.headS;
      const tick = ride.simulationTick;
      train.headS =
        train.line.sAtX(train.site.fromX) - train.layout.tailOffsetU - 100;
      step('COAST');
      ride.headS = head;
      // Hold world render time too: camera easing and ambient motion are not under test.
      ride.simulationTick = tick;
      ride.resetMotion();
    });
    await renderedFrame(page);
    expect((await snapshot(page)).oncoming.trains).toHaveLength(0);
    expect(await feet()).toBe(owners);
    expect(await camera()).toEqual(frozenCamera);
    const removed = await sceneryPixels(page, clip);
    expect(
      await pixelChanges(page, before, removed),
      'portal pixels at NPC removal',
    ).toBe(0);
    await page.evaluate(() => {
      const { ride } = window.__tunnelProbe;
      ride.track.ensureRange(ride.track.startS, ride.track.endS + 7000);
      ride.headS = ride.track.sFromLocalX(17, 700);
      ride.resetMotion();
    });
    await renderedFrame(page);
    expect(
      await page.evaluate(() => {
        const { scene, portalFeet } = window.__tunnelProbe;
        if (!portalFeet?.length)
          throw new Error('portal cleanup fixture missing');
        return portalFeet.some((foot) => scene.children.list.includes(foot));
      }),
    ).toBe(false);
  });

  for (const fallback of [false, true]) {
    test(`tunnel-3 ${renderer} ${fallback ? 'fallback' : 'art'}: stopped player locomotive and wagon at both mouths, covered and exposed pixels`, async ({
      page,
    }) => {
      await probeScene(page);
      if (fallback)
        await page.route(/track\.tile-a-[^/]*\.svg$/, (route) => route.abort());
      await restore(
        page,
        renderer,
        6,
        20,
        ['cargo_box'],
        123,
        'steam_local',
        fallback,
      );
      expect((await snapshot(page)).artAtlas === undefined).toBe(fallback);
      await page.evaluate(() => {
        const { ride } = window.__tunnelProbe;
        ride.resetMotion();
        ride.step = () => {};
      });
      for (const side of ['left', 'right']) {
        await page.evaluate((side) => {
          const { ride } = window.__tunnelProbe;
          ride.headS = ride.track.sFromLocalX(6, side === 'left' ? 208 : 656);
          ride.resetMotion();
        }, side);
        await renderedFrame(page);
        expect((await snapshot(page)).tunnels[0]?.vehicles).toEqual(
          side === 'left' ? ['partly', 'outside'] : ['outside', 'partly'],
        );
        const boxes = await page.evaluate((side) => {
          const { ride } = window.__tunnelProbe;
          const partial = ride.vehiclePose(side === 'left' ? 0 : 1);
          const portal = 6 * 1024 + (side === 'left' ? 128 : 576);
          // Both crops target the same partial vehicle, including its exposed end in the mouth.
          return [
            {
              x: partial.centerX - 15,
              y: -partial.centerY - 55,
              width: 30,
              height: 30,
            },
            {
              x: portal + (side === 'left' ? 20 : -25),
              y: -partial.centerY - 55,
              width: 10,
              height: 20,
            },
          ];
        }, side);
        const covered = boxes[0],
          exposed = boxes[1];
        if (!covered || !exposed) throw new Error('vehicle crops missing');
        await expectCoveredPixels(page, await worldCrop(page, covered), 7);
        await renderedFrame(page);
        await expectCoveredPixels(
          page,
          await worldCrop(page, exposed),
          7,
          false,
        );
      }
    });
  }
}

/** Bright blue-white area attributable to the effect, not sky or train art. */
async function brightContactArea(
  page: Page,
  before: Buffer,
  without: Buffer,
): Promise<{ count: number; x: number; y: number }> {
  return page.evaluate(
    async ([a, b]) => {
      let width = 0;
      const pixels = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        width = image.width;
        canvas.width = width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('pixel context missing');
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const [lit, background] = await Promise.all([
        pixels(a ?? ''),
        pixels(b ?? ''),
      ]);
      let count = 0,
        sumX = 0,
        sumY = 0;
      for (let i = 0; i < lit.length; i += 4) {
        const r = lit[i] ?? 0,
          g = lit[i + 1] ?? 0,
          blue = lit[i + 2] ?? 0;
        const contrast = Math.max(
          Math.abs(r - (background[i] ?? 0)),
          Math.abs(g - (background[i + 1] ?? 0)),
          Math.abs(blue - (background[i + 2] ?? 0)),
        );
        if (r >= 190 && g >= 205 && blue >= 215 && contrast >= 45) {
          count++;
          sumX += ((i / 4) % width) + 0.5;
          sumY += Math.floor(i / 4 / width) + 0.5;
        }
      }
      return { count, x: sumX / count, y: sumY / count };
    },
    [before.toString('base64'), without.toString('base64')],
  );
}

for (const renderer of ['canvas', 'webgl']) {
  for (const viewport of [
    { width: 1140, height: 512 },
    { width: 568, height: 320 },
  ]) {
    test(`sparks-3 ${renderer} ${viewport.width}: contact pixels persist over three game frames and stay behind rock`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await probeScene(page);
      // Exactly 2000 u including couplers: exercise the maximum permitted train.
      await restore(
        page,
        renderer,
        1,
        700,
        [
          'cargo_cars',
          'cargo_container',
          'cargo_box',
          ...Array<string>(8).fill('passenger_open'),
        ],
        123,
        'electric_modern',
      );
      await page.keyboard.down('ArrowRight');
      await page.evaluate(() => {
        const { ride } = window.__tunnelProbe;
        const step = ride.step.bind(ride);
        ride.step = (intent) => {
          ride.speedUPerSec = 480;
          step(intent);
          ride.speedUPerSec = 480;
          ride.previousHeadS = ride.headS;
        };
      });
      await expect
        .poll(async () => (await snapshot(page)).intent)
        .toBe('THROTTLE');
      // Sample at 30 FPS, including the newborn glow after emit → advance → draw.
      await page.evaluate((glowKind) => {
        const { scene, field } = window.__tunnelProbe;
        scene.sys.setActive(false);
        field.clear();
        for (let i = 0; i < 30; i++) {
          scene.update(performance.now(), 1000 / 30);
          if (field.particles().some((p) => p.kind === glowKind)) return;
        }
        throw new Error('no contact glow within one game second');
      }, kindIndex('contact-glow'));
      const pantograph = vehicleArt['electric_modern']?.pantograph;
      if (!pantograph) throw new Error('pantograph art missing');
      for (let i = 0; i < 3; i++) {
        if (i > 0)
          await page.evaluate(() =>
            window.__tunnelProbe.scene.update(performance.now(), 1000 / 30),
          );
        await renderedFrame(page);
        // Use the actual drawn head's pivot and its vehicle transform, not
        // an approximate locomotive offset or the particle position under test.
        const contact = await page.evaluate((pantograph) => {
          const { scene } = window.__tunnelProbe;
          const vehicle = scene.children.list.find(
            (o) =>
              o.depth === 7 &&
              o.visible &&
              o.list?.some((child) => child.frame?.name === pantograph.head),
          );
          const head = vehicle?.list?.find(
            (o) => o.frame?.name === pantograph.head,
          );
          if (!vehicle?.getWorldTransformMatrix || !head)
            throw new Error('drawn head missing');
          const at = vehicle
            .getWorldTransformMatrix()
            .transformPoint(head.x, head.y - pantograph.headContactU);
          const rect = document
            .querySelector('canvas')
            ?.getBoundingClientRect();
          if (!rect) throw new Error('canvas missing');
          const origin = scene.cameras.main.getWorldPoint(0, 0);
          const cssPerU =
            (scene.cameras.main.zoom * rect.width) / scene.scale.width;
          return {
            x: rect.left + (at.x - origin.x) * cssPerU,
            y: rect.top + (at.y - origin.y) * cssPerU,
          };
        }, pantograph);
        const crop = {
          x: Math.floor(contact.x - 24),
          y: Math.floor(contact.y - 16),
          width: 48,
          height: 32,
        };
        const before = await page.screenshot({ clip: crop });
        await page.evaluate(() => {
          for (const o of window.__tunnelProbe.scene.children.list)
            if (o.frame?.name === 'fx.contact-spark') o.setVisible(false);
        });
        await renderedFrame(page);
        const glowOnly = await page.screenshot({ clip: crop });
        const shown = await page.evaluate(() => {
          const objects = window.__tunnelProbe.scene.children.list.filter(
            (o) => o.visible && o.frame?.name === 'fx.contact-glow',
          );
          for (const o of objects) o.setVisible(false);
          return objects.length;
        });
        expect(shown).toBeGreaterThan(0);
        await renderedFrame(page);
        const without = await page.screenshot({ clip: crop });
        expect(
          (await brightContactArea(page, before, without)).count,
          'at least 32 bright high-contrast contact pixels in each burst frame',
        ).toBeGreaterThanOrEqual(32);
        // The loose streaks deliberately trail behind. Measure the contact glow
        // independently, with the same brightness/contrast mask as above.
        const glow = await brightContactArea(page, glowOnly, without);
        expect(glow.count, 'bright contact core exists').toBeGreaterThan(0);
        expect(
          Math.hypot(crop.x + glow.x - contact.x, crop.y + glow.y - contact.y),
          'bright glow centroid stays within 1.25 CSS px of the rendered contact',
        ).toBeLessThanOrEqual(1.25);
      }
      // Existing living contact particles moved under the opaque core.
      await page.evaluate(() => {
        const { ride, field, scene } = window.__tunnelProbe;
        ride.track.ensureRange(ride.track.startS, ride.track.endS + 8000);
        // 370 u leaves the full 204 u locomotive inside the opaque span;
        // 550 u straddles the exit even though the contact itself is covered.
        ride.headS = ride.track.sFromLocalX(6, 370);
        ride.previousHeadS = ride.headS;
        ride.step = () => {
          ride.simulationTick++;
        };
        ride.speedUPerSec = 480;
        for (const p of field.particles()) {
          if (p.depth === 7.55) {
            p.x = 6500;
            p.y = -ride.vehiclePose(0).centerY - 128;
          }
        }
        scene.update(performance.now(), 1000 / 60);
      });
      await renderedFrame(page);
      expect(
        (await snapshot(page)).tunnels.some((t) => t.vehicles[0] === 'inside'),
      ).toBe(true);
      expect(
        (await snapshot(page)).effects.kinds['contact-spark'] ?? 0,
      ).toBeGreaterThan(0);
      const covered = await worldCrop(page, {
        x: 6465,
        y: await page.evaluate(
          () => -window.__tunnelProbe.ride.vehiclePose(0).centerY - 250,
        ),
        width: 110,
        height: 250,
      });
      await expectCoveredPixels(page, covered, 7.55);
      // Advance real effect ticks under throttle: hidden sources must not renew
      // the old contact particles after their short lifetimes expire.
      await page.evaluate(() => {
        const { scene } = window.__tunnelProbe;
        scene.sys.setActive(false);
        for (let i = 0; i < 30; i++) scene.update(performance.now(), 1000 / 60);
      });
      const hiddenKinds = (await snapshot(page)).effects.kinds;
      expect(hiddenKinds['contact-spark'] ?? 0).toBe(0);
      expect(hiddenKinds['contact-glow'] ?? 0).toBe(0);
      await page.keyboard.up('ArrowRight');
    });
  }
}
