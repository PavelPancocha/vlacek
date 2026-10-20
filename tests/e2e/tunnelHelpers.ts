import { expect, type Page } from '@playwright/test';
import type { RideSimulation } from '../../src/domain/ride/RideSimulation.ts';
import type { ParticleField } from '../../src/render/particles/ParticleField.ts';
import { TRACK_GENERATOR_VERSION } from '../../src/domain/world/TrackProfile.ts';
import { longestMixedConsist } from './perfConsist.ts';
import { snapshot, tapAction, waitForWorldAtlases } from './helpers.ts';
import {
  PARTICLE_KINDS,
  kindIndex,
} from '../../src/render/particles/particleKinds.ts';

const VEHICLE_EFFECT_FRAMES = [
  'smoke',
  'steam',
  'diesel',
  'star',
  'bubble',
  'bubble-pop',
  'rainbow-puff',
  'spark',
  'contact-spark',
  'contact-glow',
  'leaf',
  'snow',
].flatMap((name) => PARTICLE_KINDS[kindIndex(name)]?.frames ?? []);

interface ProbeScene {
  sys: { setActive(active: boolean): void };
  update(timeMs: number, deltaMs: number): void;
  textures: {
    list: Record<
      string,
      { getSourceImage(): { width: number; height: number } }
    >;
  };
  children: {
    list: {
      type: string;
      name?: string;
      list?: ProbeScene['children']['list'];
      depth: number;
      x: number;
      y: number;
      visible: boolean;
      displayOriginX: number;
      displayOriginY: number;
      getWorldTransformMatrix(): {
        transformPoint(x: number, y: number): { x: number; y: number };
      };
      frame?: { name: string | number; width: number; height: number };
      texture?: { key: string };
      setVisible(visible: boolean): void;
      setAlpha(alpha: number): void;
    }[];
  };
  scale: { width: number };
  hitObject(x: number, y: number, rect: DOMRect): unknown;
  popBubble(id: number): boolean;
  cameras: {
    main: {
      scrollX: number;
      zoom: number;
      getWorldPoint(x: number, y: number): { x: number; y: number };
    };
  };
}

interface TunnelProbe {
  ride: RideSimulation;
  scene: ProbeScene;
  field: ParticleField;
  step?: RideSimulation['step'];
  portalFeet?: ProbeScene['children']['list'];
}

declare global {
  interface Window {
    __tunnelProbe: TunnelProbe;
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
      `window.__tunnelProbe={...window.__tunnelProbe,ride:${method[1]},scene:this},$&`,
    );
    if (!/this\.(#\w+)\.step\(\w+\),this\.#\w+\?\.draw\(this\.\1,/.test(body))
      throw new Error('particle field probe anchor missing');
    body = body.replace(
      /this\.(#\w+)\.step\(\w+\),this\.#\w+\?\.draw\(this\.\1,/,
      'window.__tunnelProbe.field=this.$1,$&',
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
  locomotiveId = 'steam_local',
  fallback = false,
): Promise<void> {
  const consist = {
    locomotiveId,
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
        quality: 'standard',
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
  await page.goto(`./?debug=1&renderer=${renderer}`);
  await tapAction(page, 'continue');
  await tapAction(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('RIDING');
  await page.waitForFunction(() => window.__tunnelProbe?.field !== undefined);
  if (fallback)
    await expect
      .poll(async () => (await snapshot(page)).worldAtlases.failure)
      .toBeDefined();
  else await waitForWorldAtlases(page);
  expect((await snapshot(page)).renderer).toBe(renderer);
  await page.addStyleTag({ content: '#diagnostics{display:none}' });
}

/** Same frozen frame with/without train sprites: rock pixels must be identical. */
export async function expectCoveredPixels(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  depth: number,
  covered = true,
): Promise<void> {
  await page.evaluate(() => {
    window.__tunnelProbe.scene.sys.setActive(false);
  });
  const before = await page.screenshot({ clip });
  await page.evaluate(
    ({ trainDepth, effectFrames }) => {
      window.__tunnelProbe.scene.sys.setActive(false);
      const objects = window.__tunnelProbe.scene.children.list.filter(
        (object) => object.type === 'Image' || object.type === 'Container',
      );
      for (const object of objects)
        if (
          object.depth === trainDepth ||
          (typeof object.frame?.name === 'string' &&
            effectFrames.includes(object.frame.name))
        )
          object.setVisible(false);
    },
    { trainDepth: depth, effectFrames: VEHICLE_EFFECT_FRAMES },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const without = await page.screenshot({ clip });
  const changed = await pixelChanges(page, before, without);
  if (covered)
    expect(changed, 'vehicle/particle pixels behind opaque rock').toBe(0);
  else
    expect(
      changed,
      'control crop contains visible vehicle pixels',
    ).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__tunnelProbe.scene.sys.setActive(true);
  });
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
    const { ride, scene } = window.__tunnelProbe;
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

export async function sceneryPixels(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
) {
  await page.evaluate((frames) => {
    const { scene } = window.__tunnelProbe;
    scene.sys.setActive(false);
    for (const o of scene.children.list)
      if (
        o.depth === 7 ||
        o.depth === 4.3 ||
        (typeof o.frame?.name === 'string' && frames.includes(o.frame.name))
      )
        o.setVisible(false);
  }, VEHICLE_EFFECT_FRAMES);
  await renderedFrame(page);
  const pixels = await page.screenshot({ clip });
  await page.evaluate(() => {
    window.__tunnelProbe.scene.sys.setActive(true);
  });
  return pixels;
}

/** Exact legal 2000u electric witness: replace the first 176u coach by 144u, then add 144u + 8u coupling. */
export function electric2000uWagons(): string[] {
  return [
    ...longestMixedConsist('electric_retro').wagons.map((w, i) =>
      i === 0 ? 'passenger_open' : w.definitionId,
    ),
    'passenger_open',
  ];
}
