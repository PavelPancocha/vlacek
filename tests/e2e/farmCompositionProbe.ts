import { expect, type Page } from '@playwright/test';
import { chunkScenery } from '../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../../src/content/worldPlacementCatalog.ts';
import { railYUpU } from '../../src/domain/world/SceneryGeometry.ts';
import { snapshot, tapAction } from './helpers.ts';

interface ProbeObject {
  type: string;
  name: string;
  x: number;
  y: number;
  list?: ProbeObject[];
  texture?: { key: string };
  frame?: { name: string | number };
  setVisible(visible: boolean): void;
  getBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}
interface ProbeCamera {
  scrollX: number;
  scrollY: number;
  zoom: number;
  setZoom(zoom: number): ProbeCamera;
  setScroll(x: number, y: number): ProbeCamera;
  setBackgroundColor(color: string): ProbeCamera;
  centerOn(x: number, y: number): ProbeCamera;
}
interface ProbeScene {
  sys: { setActive(active: boolean): void };
  children: { list: ProbeObject[] };
  cameras: { main: ProbeCamera };
  textures: {
    getTextureKeys(): string[];
    get(key: string): { source: { width: number }[] };
  };
}

declare global {
  interface Window {
    __farmScene: ProbeScene;
    __farmChunks: Map<number, { update(timeSec: number): void }>;
  }
}

/** Capture only references; ordinary frame timing and render code are unchanged. */
export async function probeFarmScene(page: Page): Promise<void> {
  await page.route('**/assets/index-*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const anchor = /this\.stats\.renderedChunks=this\.(#\w+)\.size/;
    if (!anchor.test(body)) throw new Error('chunk probe anchor missing');
    await route.fulfill({
      response,
      body: body.replace(
        anchor,
        'window.__farmScene=this,window.__farmChunks=this.$1,$&',
      ),
    });
  });
}

export async function expectCompositionResources(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const scene = window.__farmScene;
    const keys = scene.textures
      .getTextureKeys()
      .filter((key) => key.startsWith('composition:'));
    const referenced: string[] = [];
    const visit = (object: ProbeObject) => {
      object.list?.forEach(visit);
      if (object.type === 'Image' && object.texture) {
        const key = object.texture.key;
        if (key.startsWith('composition:')) referenced.push(key);
      }
    };
    scene.children.list.forEach(visit);
    return {
      keys: keys.sort(),
      referenced: referenced.sort(),
      chunks: [...window.__farmChunks.keys()],
      sizes: keys.map((key) => ({
        key,
        width: scene.textures.get(key).source[0]?.width ?? 0,
      })),
    };
  });
  expect(result.keys).toEqual(result.referenced);
  expect(result.keys.length).toBeLessThanOrEqual(result.chunks.length * 4);
  for (const { key, width } of result.sizes) {
    expect(result.chunks).toContain(Number(key.split(':')[1]));
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(1024);
  }
}

/** Boot the built ride at chunk k of seed; collects rejected-mask warnings. */
async function openRide(
  page: Page,
  renderer: string,
  seed: number,
  k: number,
): Promise<string[]> {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (/setMask|GeometryMask|not supported/i.test(message.text()))
      warnings.push(message.text());
  });
  await probeFarmScene(page);
  const consist = { locomotiveId: 'steam_local', wagons: [] };
  await page.addInitScript(
    (save) => localStorage.setItem('vlacek.save.v1', JSON.stringify(save)),
    {
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: '2026-10-14T00:00:00.000Z',
      appBuildId: 'composition-test',
      settings: {
        sfxEnabled: false,
        musicEnabled: false,
        reducedEffects: false,
        maxSpeedFactor: 1,
        quality: 'standard',
      },
      lastConsist: consist,
      journey: {
        seed,
        generatorVersion: 2,
        consist,
        head: { chunkIndex: k, arcOffsetU: 500 },
        simulationTick: 0,
        activeEntities: [],
      },
    },
  );
  await page.goto(`./?debug=1&renderer=${renderer}`);
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).artVehicles).toBe(1);
  return warnings;
}

/** Probe the built renderer, without a production test API or replacing its draw path. */
export async function compositionPixels(
  page: Page,
  renderer: string,
  seed: number,
  k: number,
  layer: 'back' | 'near',
  depth: number,
) {
  const warnings = await openRide(page, renderer, seed, k);
  const scenery = chunkScenery(seed, k, worldPlacementCatalog);
  const props = scenery.props.filter(
    (p) => p.clip && p.layer === layer && p.depth === depth,
  );
  expect(props.length).toBeGreaterThan(0);
  const top = -railYUpU(seed, k * 1024 + 512) + (layer === 'back' ? -400 : 40);
  const camera = await page.evaluate(
    ({ rulePrefixes, name, top }) => {
      const scene = window.__farmScene;
      scene.sys.setActive(false);
      let selected = 0,
        rootX = 0;
      for (const object of scene.children.list) {
        if (object.type !== 'Container') {
          object.setVisible(false);
          continue;
        }
        const parent = object;
        let keep = false;
        for (const child of parent.list ?? []) {
          const match =
            child.name === name ||
            (child.type === 'Container' &&
              child.list?.some((item) =>
                rulePrefixes.some((prefix) => item.name.startsWith(prefix)),
              ));
          child.setVisible(Boolean(match));
          if (match) {
            keep = true;
            selected++;
            rootX = parent.x;
          }
        }
        parent.setVisible(keep);
      }
      const camera = scene.cameras.main;
      camera
        .setZoom(0.9)
        .setScroll(rootX - 40, top)
        .setBackgroundColor('#e500e5');
      return {
        selected,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        rootX,
        zoom: camera.zoom,
      };
    },
    {
      // Candidate offsets changed with the world lattice; rule identity is stable.
      rulePrefixes: [
        ...new Set(
          props.map((p) => p.id.replace(/:candidate:\d+$/, ':candidate:')),
        ),
      ],
      name: `composition:${k}:${layer}:${depth}`,
      top,
    },
  );
  expect(camera.selected).toBeGreaterThan(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const png = await page
    .locator('#game-root canvas')
    .screenshot({ style: '#ui-layer, #diagnostics {visibility:hidden}' });
  const result = await page.evaluate(
    async ({ png, clips, camera, k }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no pixel context');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      const inside = (
        x: number,
        y: number,
        poly: { xU: number; yU: number }[],
      ) => {
        let hit = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i],
            b = poly[j];
          if (!a || !b) continue;
          if (
            a.yU > y !== b.yU > y &&
            x < ((b.xU - a.xU) * (y - a.yU)) / (b.yU - a.yU) + a.xU
          )
            hit = !hit;
        }
        return hit;
      };
      let painted = 0,
        leaked = 0;
      for (let y = 2; y < image.height - 2; y++)
        for (let x = 2; x < image.width - 2; x++) {
          const i = (y * image.width + x) * 4;
          if (
            Math.abs((data[i] ?? 0) - 229) < 4 &&
            (data[i + 1] ?? 0) < 4 &&
            Math.abs((data[i + 2] ?? 0) - 229) < 4
          )
            continue;
          painted++;
          // Camera zoom is around the viewport centre, as Phaser's camera matrix specifies.
          const wx =
            (x - image.width / 2) / camera.zoom +
            image.width / 2 +
            camera.scrollX -
            camera.rootX +
            k * 1024;
          const wy =
            (y - image.height / 2) / camera.zoom +
            image.height / 2 +
            camera.scrollY;
          // One output pixel of AA at the shared polygon boundary is permitted.
          if (
            !clips.some((p) =>
              [-1.5, 0, 1.5].some((dx) =>
                [-1.5, 0, 1.5].some((dy) => inside(wx + dx, wy + dy, p)),
              ),
            )
          )
            leaked++;
        }
      return { painted, leaked };
    },
    {
      png: png.toString('base64'),
      clips: props.flatMap((p) => (p.clip ? [[...p.clip]] : [])),
      camera,
      k,
    },
  );
  expect(
    result.painted,
    'nonempty rendered composition control',
  ).toBeGreaterThan(500);
  expect(
    result.leaked,
    'composition pixels outside the accepted polygons',
  ).toBe(0);
  expect(warnings).toEqual([]);
  return png;
}

/**
 * Painter order of one baked near layer against one nearer individual prop
 * (both renderers): the display-list indices, plus opaque prop pixels over
 * the layer that the farther layer still paints over. Opacity is exact: a
 * pixel counts only if the prop alone renders identically on two backgrounds,
 * so the prop's own translucent shading and edge AA never count.
 */
export async function bakedLayerOrder(
  page: Page,
  renderer: string,
  seed: number,
  k: number,
  depth: number,
  propId: string,
) {
  const warnings = await openRide(page, renderer, seed, k);
  const layer = `composition:${k}:near:${depth}`;
  const order = await page.evaluate(
    ({ layer, propId }) => {
      const scene = window.__farmScene;
      scene.sys.setActive(false);
      let found: { layer: number; prop: number } | undefined;
      for (const object of scene.children.list) {
        const list = object.list ?? [];
        const at = list.findIndex((child) => child.name === layer);
        const prop = list.findIndex((child) => child.name === propId);
        const match = at >= 0 && prop >= 0;
        object.setVisible(match);
        if (!match) continue;
        list.forEach((child, i) => child.setVisible(i === at || i === prop));
        const centre = list[prop]?.getBounds();
        if (!centre) continue;
        scene.cameras.main.setZoom(2).centerOn(centre.centerX, centre.centerY);
        found = { layer: at, prop };
      }
      return found;
    },
    { layer, propId },
  );
  expect(order, `${layer} and ${propId} share a container`).toBeDefined();
  const shot = async (show: 'prop' | 'layer' | 'both', background: string) => {
    await page.evaluate(
      ({ layer, propId, show, background }) => {
        const scene = window.__farmScene;
        for (const object of scene.children.list)
          for (const child of object.list ?? []) {
            if (child.name === layer) child.setVisible(show !== 'prop');
            if (child.name === propId) child.setVisible(show !== 'layer');
          }
        scene.cameras.main.setBackgroundColor(background);
        return new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      },
      { layer, propId, show, background },
    );
    const png = await page
      .locator('#game-root canvas')
      .screenshot({ style: '#ui-layer, #diagnostics {visibility:hidden}' });
    return png.toString('base64');
  };
  const pngs = [
    await shot('prop', '#e500e5'),
    await shot('prop', '#00e500'),
    await shot('layer', '#e500e5'),
    await shot('both', '#e500e5'),
  ];
  const pixels = await page.evaluate(async (pngs) => {
    const decode = async (png: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no pixel context');
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height).data;
    };
    const [propOnMagenta, propOnGreen, layerOnly, both] = await Promise.all(
      pngs.map(decode),
    );
    if (!propOnMagenta || !propOnGreen || !layerOnly || !both)
      throw new Error('missing pass');
    const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number) =>
      Math.max(
        Math.abs((a[i] ?? 0) - (b[i] ?? 0)),
        Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)),
        Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0)),
      );
    let overlap = 0,
      covered = 0;
    for (let i = 0; i < both.length; i += 4) {
      // Different on magenta and green: the prop is translucent or absent there.
      if (diff(propOnMagenta, propOnGreen, i) > 2) continue;
      const layerPainted =
        Math.abs((layerOnly[i] ?? 0) - 229) > 8 ||
        (layerOnly[i + 1] ?? 0) > 8 ||
        Math.abs((layerOnly[i + 2] ?? 0) - 229) > 8;
      if (!layerPainted) continue;
      overlap++;
      if (diff(both, propOnMagenta, i) > 2) covered++;
    }
    return { overlap, covered };
  }, pngs);
  expect(warnings).toEqual([]);
  return {
    layerIndex: order?.layer ?? -1,
    propIndex: order?.prop ?? -1,
    ...pixels,
  };
}
