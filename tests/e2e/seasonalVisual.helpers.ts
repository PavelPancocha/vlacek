import { expect, type Page } from '@playwright/test';
import type { RideSimulation } from '../../src/domain/ride/RideSimulation.ts';
import type { ParticleField } from '../../src/render/particles/ParticleField.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { snapshot, tapAction } from './helpers.ts';
export interface ProbeObject {
  type: string;
  depth: number;
  x?: number;
  frame?: { name: string | number; width?: number; height?: number };
  list?: ProbeObject[];
  displayHeight?: number;
  alpha?: number;
  flipX?: boolean;
  visible?: boolean;
  seasonTestVisible?: boolean;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  setVisible(visible: boolean): ProbeObject;
}
interface ProbeScene {
  game: {
    renderer: { snapshot(callback: (image: { src: string }) => void): unknown };
  };
  sys: { setActive(active: boolean): void };
  update(time: number, delta: number): void;
  children: { list: ProbeObject[] };
  scale: { width: number };
  cameras: {
    main: {
      zoom: number;
      scrollX: number;
      scrollY: number;
      setScroll(x: number, y: number): unknown;
      getWorldPoint(x: number, y: number): { x: number; y: number };
    };
  };
}

interface TunnelProbe {
  ride: RideSimulation;
  scene: ProbeScene;
  field: ParticleField;
  step?: RideSimulation['step'];
  manualTime?: number;
  portalFeet?: ProbeScene['children']['list'];
}

declare global {
  interface Window {
    __seasonalProbe: TunnelProbe;
  }
}

/** Read-only scene/field probe plus deterministic pose fixtures; no production API. */
export async function probeScene(page: Page): Promise<void> {
  await page.route('**/assets/index-*.js', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const method = body.match(
      /#\w+\((\w+),\w+,\w+\)\{(?:const|let) \w+=this\.#\w+\.catalogVehicles\(\)/,
    );
    if (!method) throw new Error('NPC scene probe anchor missing');
    body = body.replace(
      /this\.stats\.oncomingVehicles=\w+/,
      `window.__seasonalProbe={...window.__seasonalProbe,ride:${method[1]},scene:this},$&`,
    );
    if (!/this\.(#\w+)\.step\(\w+\),this\.#\w+\?\.draw\(this\.\1,/.test(body))
      throw new Error('particle field probe anchor missing');
    body = body.replace(
      /this\.(#\w+)\.step\(\w+\),this\.#\w+\?\.draw\(this\.\1,/,
      'window.__seasonalProbe.field=this.$1,$&',
    );
    await route.fulfill({ response, body });
  });
}

export async function restore(
  page: Page,
  renderer: string,
  chunkIndex: number,
  arcOffsetU: number,
  wagonIds: string[] = [],
  seed = 123,
  quality: 'standard' | 'low' = 'standard',
): Promise<void> {
  const consist = {
    locomotiveId: 'steam_local',
    wagons: wagonIds.map((definitionId, i) => ({
      instanceId: 'w' + i,
      definitionId,
      visualSeed: 0,
    })),
  };
  await page.addInitScript(
    (save) => localStorage.setItem('vlacek.save.v1', JSON.stringify(save)),
    {
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: '2026-10-13T00:00:00.000Z',
      appBuildId: 'tunnel-1',
      settings: {
        sfxEnabled: false,
        musicEnabled: false,
        reducedEffects: false,
        maxSpeedFactor: 1,
        quality,
      },
      lastConsist: consist,
      journey: {
        seed,
        generatorVersion: TRACK_GENERATOR_VERSION,
        consist,
        head: { chunkIndex, arcOffsetU },
        simulationTick: 0,
        activeEntities: [],
      },
    },
  );
  await page.goto(`./?debug=1&renderer=${renderer}&quality=${quality}`);
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  await page.waitForFunction(() => window.__seasonalProbe?.field !== undefined);
  expect((await snapshot(page)).renderer).toBe(renderer);
  await page.addStyleTag({ content: '#diagnostics{display:none}' });
}

export async function pixelChanges(
  page: Page,
  before: Buffer,
  without: Buffer,
): Promise<number> {
  return page.evaluate(
    async ([a, b]) => {
      async function pixels(base64: string): Promise<Uint8ClampedArray> {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no pixel context');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      }
      const [left, right] = await Promise.all([
        pixels(a ?? ''),
        pixels(b ?? ''),
      ]);
      let count = 0;
      for (let i = 0; i < left.length; i += 4)
        if (
          left[i] !== right[i] ||
          left[i + 1] !== right[i + 1] ||
          left[i + 2] !== right[i + 2]
        )
          count++;
      return count;
    },
    [before.toString('base64'), without.toString('base64')],
  );
}

export async function renderedFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

export async function worldCrop(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
) {
  return page.evaluate((box) => {
    const { ride, scene } = window.__seasonalProbe;
    const vehicle = scene.children.list.find(
      (o) => o.depth === 7 && typeof o.x === 'number',
    );
    if (!vehicle || typeof vehicle.x !== 'number')
      throw new Error('player slot missing');
    const origin = ride.vehiclePose(0).centerX - vehicle.x;
    const point = scene.cameras.main.getWorldPoint(0, 0);
    const rect = document.querySelector('canvas')?.getBoundingClientRect();
    if (!rect) throw new Error('canvas missing');
    const z = (scene.cameras.main.zoom * rect.width) / scene.scale.width;
    return {
      x: Math.round(rect.left + (box.x - origin - point.x) * z),
      y: Math.round(rect.top + (box.y - point.y) * z),
      width: Math.max(1, Math.floor(box.width * z)),
      height: Math.max(1, Math.floor(box.height * z)),
    };
  }, box);
}

/** Pixels contributed by the named frames in one frozen, actually rendered scene. */
/** Actual Canvas/WebGL framebuffer; HTML button animations cannot count as snow pixels. */
export async function canvasPixels(page: Page): Promise<Buffer> {
  const data = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        window.__seasonalProbe.scene.game.renderer.snapshot((image) =>
          resolve(image.src),
        );
      }),
  );
  return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
}

export async function framePixelGroups(
  page: Page,
  groups: readonly (readonly string[])[],
): Promise<number[]> {
  await page.evaluate(() => {
    window.__seasonalProbe.scene.sys.setActive(false);
  });
  let before = await canvasPixels(page);
  const counts: number[] = [];
  for (const frames of groups) {
    await page.evaluate((frames) => {
      function hide(objects: ProbeObject[]) {
        for (const o of objects) {
          if (o.list) hide(o.list);
          if (o.type === 'Image' && frames.includes(String(o.frame?.name))) {
            o.seasonTestVisible = o.visible === true;
            o.setVisible(false);
          }
        }
      }
      hide(window.__seasonalProbe.scene.children.list);
    }, frames);
    await renderedFrame(page);
    const after = await canvasPixels(page);
    counts.push(await pixelChanges(page, before, after));
    before = after;
  }
  await page.evaluate(() => {
    function restore(objects: ProbeObject[]) {
      for (const o of objects) {
        if (o.list) restore(o.list);
        if (o.seasonTestVisible !== undefined) {
          o.setVisible(o.seasonTestVisible);
          delete o.seasonTestVisible;
        }
      }
    }
    restore(window.__seasonalProbe.scene.children.list);
    window.__seasonalProbe.scene.sys.setActive(true);
  });
  await renderedFrame(page);
  return counts;
}

export async function framePixels(
  page: Page,
  frames: readonly string[],
): Promise<number> {
  return (await framePixelGroups(page, [frames]))[0] ?? 0;
}

export async function imageCrop(page: Page, key: string) {
  return page.evaluate((key) => {
    const { scene } = window.__seasonalProbe;
    function find(objects: ProbeObject[]): ProbeObject | undefined {
      for (const o of objects) {
        if (o.frame?.name === key) return o;
        const child = o.list && find(o.list);
        if (child) return child;
      }
      return undefined;
    }
    const image = find(scene.children.list);
    if (!image?.getBounds) throw new Error(`missing image ${key}`);
    const b = image.getBounds(),
      camera = scene.cameras.main.getWorldPoint(0, 0),
      canvas = document.querySelector('canvas')?.getBoundingClientRect();
    if (!canvas) throw new Error('canvas missing');
    const z = (scene.cameras.main.zoom * canvas.width) / scene.scale.width;
    const x = Math.max(0, Math.round(canvas.left + (b.x - camera.x) * z)),
      y = Math.max(0, Math.round(canvas.top + (b.y - camera.y) * z));
    return {
      x,
      y,
      width: Math.max(1, Math.min(innerWidth - x, Math.ceil(b.width * z))),
      height: Math.max(1, Math.min(innerHeight - y, Math.ceil(b.height * z))),
    };
  }, key);
}

/** Authored visible roof slopes, excluding the plaster gable/dormer and chimney. */
export async function roofCoverage(page: Page) {
  // Measure the roof itself: a randomly passing near flake can otherwise
  // shadow half of a small roof band. The gameplay captures keep the weather.
  await page.evaluate(() => {
    for (const o of window.__seasonalProbe.scene.children.list)
      if (String(o.frame?.name).startsWith('fx.snow-')) {
        o.seasonTestVisible = o.visible === true;
        o.setVisible(false);
      }
  });
  const png = await canvasPixels(page);
  await page.evaluate(() => {
    for (const o of window.__seasonalProbe.scene.children.list)
      if (o.seasonTestVisible !== undefined) {
        o.setVisible(o.seasonTestVisible);
        delete o.seasonTestVisible;
      }
  });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('roof pixel context missing');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    const masks: Record<
      string,
      {
        width: number;
        height: number;
        ridge: number;
        eave: number;
        contains(x: number, y: number): boolean;
      }
    > = {
      'back.house-gable': {
        width: 120,
        height: 104,
        ridge: 8,
        eave: 42,
        contains: (x, y) =>
          y >
            Math.max(
              8 + ((x - 43) * 11) / 52,
              8 + ((43 - x) * 34) / 39,
              19 + ((x - 95) * 23) / 16,
            ) +
              1.5 &&
          y < 40 &&
          y < 12 + (Math.abs(x - 43) * 30) / 35 - 1.5 &&
          !(x > 85 && x < 95 && y < 28),
      },
      'back.house-hip': {
        width: 108,
        height: 90,
        ridge: 9,
        eave: 39,
        contains: (x, y) =>
          y > 10 &&
          y < 36 &&
          x > 25 - ((y - 9) * 21) / 30 + 2 &&
          x < 81 + ((y - 9) * 23) / 30 - 2 &&
          !(x > 62 && x < 72 && y < 20),
      },
      'back.house-a': {
        width: 96,
        height: 96,
        ridge: 4,
        eave: 41.82,
        contains: (x, y) =>
          y > 4 + (Math.abs(x - 48) * 37.82) / 44.16 + 1 &&
          y < 40 &&
          y < 9.68 + (Math.abs(x - 48) * 31.64) / 28.8 - 1 &&
          !(x > 63 && x < 72 && y < 27),
      },
      'back.house-b': {
        width: 90,
        height: 92,
        ridge: 4,
        eave: 40.14,
        contains: (x, y) =>
          y > 4 + (Math.abs(x - 45) * 36.14) / 41.4 + 1 &&
          y < 39 &&
          y < 9.27 + (Math.abs(x - 45) * 30.37) / 27 - 1 &&
          !(x > 59 && x < 69 && y < 26),
      },
      'back.house-c': {
        width: 120,
        height: 104,
        ridge: 6,
        eave: 45.68,
        contains: (x, y) =>
          y > 7 &&
          y < 44 &&
          x > 19.2 - ((y - 6) * 19.2) / 39.68 + 1 &&
          x < 100.8 + ((y - 6) * 19.2) / 39.68 - 1 &&
          !(x > 27 && x < 36 && y < 12) &&
          !(x > 49 && x < 71 && y < 29),
      },
    };
    const { scene } = window.__seasonalProbe;
    const camera = scene.cameras.main.getWorldPoint(0, 0);
    const z = (scene.cameras.main.zoom * image.width) / scene.scale.width;
    const houses = scene.children.list
      .flatMap((o) => o.list ?? [])
      // Winter bodies retain the exact authored roof geometry and masks.
      .filter((o) => masks[String(o.frame?.name).replace(/-winter$/, '')]);
    return houses.flatMap((o) => {
      const key = String(o.frame?.name).replace(/-winter$/, ''),
        mask = masks[key],
        b = o.getBounds?.();
      if (!mask || !b) return [];
      const fw = o.frame?.width,
        fh = o.frame?.height;
      if (!fw || !fh) throw new Error('roof frame dimensions missing');
      // ArtAtlas frames include one transparent texel on every edge. The
      // authored mask maps only the SVG interior, not that padding rectangle.
      const marginX = (b.width * z) / fw,
        marginY = (b.height * z) / fh;
      const left = (b.x - camera.x) * z + marginX,
        top = (b.y - camera.y) * z + marginY;
      const width = b.width * z - 2 * marginX,
        height = b.height * z - 2 * marginY;
      if (
        left < 0 ||
        left + width > image.width ||
        top < 0 ||
        top + height > image.height
      )
        return [];
      const total = [0, 0, 0],
        white = [0, 0, 0];
      for (let py = Math.ceil(top); py < top + height; py++)
        for (let px = Math.ceil(left); px < left + width; px++) {
          let x = ((px + 0.5 - left) / width) * mask.width;
          if (o.flipX) x = mask.width - x;
          const y = ((py + 0.5 - top) / height) * mask.height;
          if (!mask.contains(x, y)) continue;
          const band = Math.min(
            2,
            Math.floor(((y - mask.ridge) / (mask.eave - mask.ridge)) * 3),
          );
          total[band] = (total[band] ?? 0) + 1;
          const i = (py * image.width + px) * 4;
          if (
            (data[i] ?? 0) > 210 &&
            (data[i + 1] ?? 0) > 220 &&
            (data[i + 2] ?? 0) > 225
          )
            white[band] = (white[band] ?? 0) + 1;
        }
      return [
        {
          key,
          x: Math.round(left),
          bands: total.map((n, i) => (n ? (white[i] ?? 0) / n : 0)),
        },
      ];
    });
  }, png.toString('base64'));
}

/** Contrast-qualified framebuffer pixels in three independent train-relative regions. */
export async function snowRegions(page: Page, resume = true) {
  await page.evaluate(() => {
    window.__seasonalProbe.scene.sys.setActive(false);
  });
  const before = await canvasPixels(page);
  const groups = [
    ['fx.snow-far', 'fx.snow-mid', 'fx.snow-near'],
    ['fx.snow-kick'],
  ];
  const without: string[] = [];
  for (const frames of groups) {
    await page.evaluate((frames) => {
      for (const o of window.__seasonalProbe.scene.children.list)
        if (frames.includes(String(o.frame?.name))) {
          o.seasonTestVisible = o.visible === true;
          o.setVisible(false);
        }
    }, frames);
    without.push((await canvasPixels(page)).toString('base64'));
    await page.evaluate(() => {
      for (const o of window.__seasonalProbe.scene.children.list)
        if (o.seasonTestVisible !== undefined) {
          o.setVisible(o.seasonTestVisible);
          delete o.seasonTestVisible;
        }
    });
  }
  const result = await page.evaluate(
    async ({ before, without }) => {
      async function read(b64: string) {
        const image = new Image();
        image.src = `data:image/png;base64,${b64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('snow pixel context missing');
        ctx.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          data: ctx.getImageData(0, 0, image.width, image.height).data,
        };
      }
      const full = await read(before),
        fall = await read(without[0] ?? ''),
        spray = await read(without[1] ?? '');
      const { ride, scene } = window.__seasonalProbe;
      const vehicle = scene.children.list.find(
        (o) => o.depth === 7 && typeof o.x === 'number',
      );
      if (vehicle?.x === undefined) throw new Error('train origin missing');
      const origin = ride.vehiclePose(0).centerX - vehicle.x;
      const camera = scene.cameras.main.getWorldPoint(0, 0);
      const z = (scene.cameras.main.zoom * full.width) / scene.scale.width;
      const tail = ride.sample(ride.headS - ride.layout.tailOffsetU);
      const front = ride.sample(ride.headS + ride.layout.frontOffsetU);
      const x = (worldX: number) => (worldX - origin - camera.x) * z;
      const y = (worldY: number) => (-worldY - camera.y) * z;
      const top = Math.min(y(tail.y), y(front.y)),
        bottom = Math.max(y(tail.y), y(front.y));
      function measure(
        other: typeof full,
        left: number,
        top: number,
        right: number,
        bottom: number,
      ) {
        let pixels = 0;
        const tiles = new Set<string>();
        for (
          let py = Math.max(0, Math.ceil(top));
          py < Math.min(full.height, bottom);
          py++
        )
          for (
            let px = Math.max(0, Math.ceil(left));
            px < Math.min(full.width, right);
            px++
          ) {
            const i = (py * full.width + px) * 4;
            if (
              Math.max(
                ...[0, 1, 2].map((c) =>
                  Math.abs((full.data[i + c] ?? 0) - (other.data[i + c] ?? 0)),
                ),
              ) < 24
            )
              continue;
            pixels++;
            tiles.add(`${Math.floor(px / 24)},${Math.floor(py / 24)}`);
          }
        return { pixels, tiles: tiles.size };
      }
      return {
        fall: measure(fall, 0, 0, full.width, top - 35),
        bogies: measure(
          spray,
          x(tail.x),
          top - 55 * z,
          x(front.x),
          bottom + 25 * z,
        ),
        trail: measure(
          spray,
          x(tail.x) - 400 * z,
          y(tail.y) - 65 * z,
          x(tail.x) - 15 * z,
          y(tail.y) + 25 * z,
        ),
      };
    },
    { before: before.toString('base64'), without },
  );
  if (resume)
    await page.evaluate(() => {
      window.__seasonalProbe.scene.sys.setActive(true);
    });
  return result;
}

/** Fixed 30-Hz rendered frames through the real host/reducer/simulation. The scene
 * stays inactive between captures, so framebuffer readback cannot move the train. */
export async function advanceSeasonalFrames(page: Page, count: number) {
  await page.evaluate((count) => {
    const probe = window.__seasonalProbe;
    probe.scene.sys.setActive(false);
    for (let i = 0; i < count; i++) {
      probe.manualTime = (probe.manualTime ?? performance.now()) + 1000 / 30;
      probe.scene.update(probe.manualTime, 1000 / 30);
    }
  }, count);
}
